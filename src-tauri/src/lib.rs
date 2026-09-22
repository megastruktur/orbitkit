pub mod orbitkit_native;

pub use orbitkit_native::OrbitkitNativeExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(orbitkit_native::init())
        .invoke_handler(tauri::generate_handler![
            orbitkit_native::is_overlay_permission_granted,
            orbitkit_native::request_overlay_permission,
            orbitkit_native::overlay_show,
            orbitkit_native::overlay_hide,
            orbitkit_native::is_overlay_permission_granted_snake,
            orbitkit_native::request_overlay_permission_snake,
            orbitkit_native::overlay_show_snake,
            orbitkit_native::overlay_hide_snake,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
