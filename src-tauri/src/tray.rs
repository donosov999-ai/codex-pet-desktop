use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Wry,
};

use crate::{commands, state::AppState, windowing};

const TRAY_ID: &str = "main-tray";

fn emit_tray_command(window: &tauri::WebviewWindow<Wry>, command: &str) {
    let _ = window.emit(
        "pet-desktop-tray-command",
        serde_json::json!({ "command": command }),
    );
}

fn tray_menu(
    app: &AppHandle<Wry>,
    auto_wander: bool,
    always_on_top: bool,
) -> tauri::Result<Menu<Wry>> {
    let show = MenuItem::with_id(app, "show", "显示桌宠", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "隐藏桌宠", true, None::<&str>)?;
    let recall = MenuItem::with_id(app, "recall", "召回到屏幕中央", true, None::<&str>)?;
    let wander_id = if auto_wander {
        "pause_wander"
    } else {
        "resume_wander"
    };
    let wander_label = if auto_wander {
        "暂停自动散步"
    } else {
        "恢复自动散步"
    };
    let wander = MenuItem::with_id(app, wander_id, wander_label, true, None::<&str>)?;
    let open_store = MenuItem::with_id(app, "open_store", "打开宠物资源库", true, None::<&str>)?;
    let open_data = MenuItem::with_id(app, "open_data", "打开数据目录", true, None::<&str>)?;
    let always = CheckMenuItem::with_id(
        app,
        "always_on_top",
        "保持置顶",
        true,
        always_on_top,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    Menu::with_items(
        app,
        &[
            &show,
            &hide,
            &recall,
            &wander,
            &PredefinedMenuItem::separator(app)?,
            &open_store,
            &open_data,
            &PredefinedMenuItem::separator(app)?,
            &always,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )
}

pub(crate) fn update_tray_state(
    app: &AppHandle<Wry>,
    auto_wander: bool,
    always_on_top: bool,
) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(tray_menu(app, auto_wander, always_on_top)?))?;
    }
    Ok(())
}

pub(crate) fn setup_tray(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let menu = tray_menu(app, true, true)?;
    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Бирюзик")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "open_data" {
                let _ = commands::open_app_data_dir(app);
                return;
            }
            if let Some(window) = app.get_webview_window("main") {
                match event.id.as_ref() {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    "hide" => {
                        let _ = window.hide();
                    }
                    "recall" => {
                        let _ = window.show();
                        let _ = windowing::center_window_position(&window);
                        let _ = window.set_focus();
                    }
                    "pause_wander" => {
                        let _ = window.show();
                        emit_tray_command(&window, "pause_wander");
                    }
                    "resume_wander" => {
                        let _ = window.show();
                        emit_tray_command(&window, "resume_wander");
                    }
                    "open_store" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                        emit_tray_command(&window, "open_store");
                    }
                    "always_on_top" => {
                        let state = app.state::<AppState>();
                        if let Ok(mut value) = state.always_on_top.lock() {
                            *value = !*value;
                            let _ = window.set_always_on_top(*value);
                        };
                    }
                    "quit" => app.exit(0),
                    _ => {}
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
