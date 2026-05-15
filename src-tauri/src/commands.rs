use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Serialize;
use tauri::{AppHandle, Wry};
use tauri_plugin_opener::OpenerExt;

use crate::{
    pet_catalog::{self, PetList},
    petpack,
    state::AppState,
    windowing::{self, WindowBounds},
};

#[derive(Debug, Serialize)]
struct WindowState {
    #[serde(rename = "alwaysOnTop")]
    always_on_top: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportPetpackResult {
    imported_pet_id: String,
    display_name: String,
    version: String,
    replaced: bool,
    previous_version: String,
    pets: PetList,
}

#[tauri::command]
fn list_pets(app: AppHandle<Wry>) -> PetList {
    pet_catalog::list_pet_packages(&app)
}

#[tauri::command]
fn import_petpack(app: AppHandle<Wry>, data: String) -> Result<ImportPetpackResult, String> {
    let bytes = BASE64.decode(data).map_err(|error| error.to_string())?;
    let pets_dir = pet_catalog::user_pets_dir(&app)?;
    let summary = petpack::inspect_petpack_bytes(&bytes)?;
    let previous_dir = pet_catalog::user_pet_dir(&pets_dir, &summary.id).ok();
    let replaced = previous_dir.is_some();
    let previous_version = previous_dir
        .map(|dir| pet_catalog::pet_version(&dir))
        .unwrap_or_default();
    let installed = petpack::install_petpack_bytes(&bytes, &pets_dir)?;
    let imported_pet_id = installed
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    Ok(ImportPetpackResult {
        imported_pet_id,
        display_name: summary.display_name,
        version: summary.version,
        replaced,
        previous_version,
        pets: pet_catalog::list_pet_packages(&app),
    })
}

#[tauri::command]
fn uninstall_pet(app: AppHandle<Wry>, id: String) -> Result<PetList, String> {
    let pets_dir = pet_catalog::user_pets_dir(&app)?;
    pet_catalog::uninstall_user_pet(&pets_dir, &id)?;
    Ok(pet_catalog::list_pet_packages(&app))
}

#[tauri::command]
fn reveal_pet(app: AppHandle<Wry>, id: String) -> Result<(), String> {
    let pet = pet_catalog::list_pet_packages(&app)
        .pets
        .into_iter()
        .find(|pet| pet.id == id)
        .ok_or_else(|| format!("Pet not found: {id}"))?;
    app.opener()
        .open_path(pet.root, None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn move_by(app: AppHandle<Wry>, x: f64, y: f64) -> Result<WindowBounds, String> {
    let window = windowing::main_window(&app)?;
    windowing::move_window_by(&window, x, y)
}

#[tauri::command]
fn set_ignore_mouse_events(app: AppHandle<Wry>, ignored: bool) -> Result<bool, String> {
    let window = windowing::main_window(&app)?;
    window
        .set_ignore_cursor_events(ignored)
        .map_err(|error| error.to_string())?;
    Ok(ignored)
}

#[tauri::command]
fn reset_position(app: AppHandle<Wry>) -> Result<WindowBounds, String> {
    let window = windowing::main_window(&app)?;
    windowing::reset_window_position(&window)
}

#[tauri::command]
fn set_always_on_top(
    app: AppHandle<Wry>,
    state: tauri::State<AppState>,
    value: bool,
) -> Result<bool, String> {
    let window = windowing::main_window(&app)?;
    window
        .set_always_on_top(value)
        .map_err(|error| error.to_string())?;
    *state
        .always_on_top
        .lock()
        .map_err(|error| error.to_string())? = value;
    Ok(value)
}

#[tauri::command]
fn get_window_state(state: tauri::State<AppState>) -> Result<WindowState, String> {
    Ok(WindowState {
        always_on_top: *state
            .always_on_top
            .lock()
            .map_err(|error| error.to_string())?,
    })
}

#[tauri::command]
fn quit(app: AppHandle<Wry>) {
    app.exit(0);
}

pub(crate) fn handler() -> impl Fn(tauri::ipc::Invoke<Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        list_pets,
        import_petpack,
        uninstall_pet,
        reveal_pet,
        move_by,
        set_ignore_mouse_events,
        reset_position,
        set_always_on_top,
        get_window_state,
        quit
    ]
}
