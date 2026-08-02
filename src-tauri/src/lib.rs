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
/// The stream is throttled hard: what the renderer needs is "someone is typing right now", not
/// every keystroke, and an unthrottled hook floods the IPC channel enough to make the window
/// stutter. On macOS this needs Accessibility permission — without it the hook simply never
/// starts, and the pet stays idle instead of the app failing.
fn spawn_input_hook(app: tauri::AppHandle) {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri::Emitter;

    std::thread::spawn(move || {
        static LAST_EMIT_MS: AtomicU64 = AtomicU64::new(0);
        let now_ms = || {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
        };
        let result = rdev::listen(move |event| {
            if let rdev::EventType::KeyPress(_) = event.event_type {
                let now = now_ms();
                if now.saturating_sub(LAST_EMIT_MS.load(Ordering::Relaxed)) >= 400 {
                    LAST_EMIT_MS.store(now, Ordering::Relaxed);
                    let _ = app.emit("pet-desktop-typing", ());
                }
            }
        });
        if let Err(error) = result {
            eprintln!("[biruzik] global input hook unavailable: {error:?}");
        }
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
            spawn_input_hook(handle.clone());
            emit_e2e(handle);
            let _ = handle.emit("pet-desktop-ready", ());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Biruzik Desktop");
}
