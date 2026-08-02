mod commands;
mod pet_catalog;
mod petpack;
mod preferences;
#[cfg(test)]
mod sprite_quality;
mod state;
mod tray;
mod windowing;

use std::env;
use tauri::{Emitter, Wry};

use crate::{pet_catalog::list_pet_packages, state::AppState};

fn emit_e2e(app: &tauri::AppHandle<Wry>) {
    if env::var("PET_DESKTOP_E2E").ok().as_deref() != Some("1") {
        return;
    }

    let pets = list_pet_packages(app);
    println!(
        "{}",
        serde_json::json!({
            "ok": true,
            "windowCreated": true,
            "petCount": pets.pets.len(),
            "firstPet": pets.pets.first().map(|pet| pet.id.clone())
        })
    );

    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        app.exit(0);
    });
}

/// Watch typing across the whole desktop so the pet can work alongside you.
///
/// The previous attempt used rdev and crashed the app: its macOS listener resolves each key
/// through TSMGetInputSourceProperty, that call asserts it runs on the main queue, and from a
/// background thread the assertion fires as SIGTRAP. Here we take the raw event tap instead —
/// key codes only, no text-input services, nothing that cares which queue it runs on.
///
/// Listen-only: keystrokes are never modified, never stored, and never leave the process. We only
/// count that typing is happening, not what is typed.
#[cfg(target_os = "macos")]
fn spawn_typing_watch(app: tauri::AppHandle) {
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use core_graphics::event::{
        CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
    };
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    std::thread::spawn(move || {
        // A fast typist fires dozens of keys a second; the pet only needs to know that it is
        // happening, so one nudge per 120 ms keeps the IPC quiet.
        static LAST_MS: AtomicU64 = AtomicU64::new(0);
        let tap = CGEventTap::new(
            CGEventTapLocation::Session,
            CGEventTapPlacement::HeadInsertEventTap,
            CGEventTapOptions::ListenOnly,
            vec![CGEventType::KeyDown],
            move |_proxy, _event_type, _event| {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                if now.saturating_sub(LAST_MS.load(Ordering::Relaxed)) >= 120 {
                    LAST_MS.store(now, Ordering::Relaxed);
                    let _ = app.emit("pet-desktop-typing", ());
                }
                None
            },
        );

        // Without Accessibility permission the tap simply is not created. That is a normal state,
        // not a failure: the pet keeps working, it just stops typing along.
        let Ok(tap) = tap else {
            eprintln!("[pet] typing watch is off: grant Accessibility to enable it");
            return;
        };
        let Ok(source) = tap.mach_port.create_runloop_source(0) else {
            eprintln!("[pet] typing watch could not attach to the run loop");
            return;
        };
        let run_loop = CFRunLoop::get_current();
        unsafe { run_loop.add_source(&source, kCFRunLoopCommonModes) };
        tap.enable();
        CFRunLoop::run_current();
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new_always_on_top())
        .invoke_handler(commands::handler())
        .setup(|app| {
            let handle = app.handle();
            tray::setup_tray(handle)?;
            windowing::position_initial_window(handle)
                .map_err(|error| tauri::Error::Io(std::io::Error::other(error)))?;
            emit_e2e(handle);
            #[cfg(target_os = "macos")]
            spawn_typing_watch(handle.clone());
            let _ = handle.emit("pet-desktop-ready", ());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Biruzik Desktop");
}
