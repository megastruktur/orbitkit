pub mod orbitkit_native;

pub use orbitkit_native::OrbitkitNativeExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(orbitkit_native::init());

    #[cfg(feature = "mic-recorder")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            orbitkit_native::is_overlay_permission_granted,
            orbitkit_native::request_overlay_permission,
            orbitkit_native::overlay_show,
            orbitkit_native::overlay_hide,
            orbitkit_native::is_overlay_permission_granted_snake,
            orbitkit_native::request_overlay_permission_snake,
            orbitkit_native::overlay_show_snake,
            orbitkit_native::overlay_hide_snake,
            orbitkit_native::recorder_start_foreground,
            orbitkit_native::recorder_pause,
            orbitkit_native::recorder_resume,
            orbitkit_native::recorder_stop,
            orbitkit_native::recorder_state,
            orbitkit_native::recorder_start_foreground_snake,
            orbitkit_native::recorder_pause_snake,
            orbitkit_native::recorder_resume_snake,
            orbitkit_native::recorder_stop_snake,
            orbitkit_native::recorder_state_snake,
            orbitkit_native::recorder_post_standby_notification,
            orbitkit_native::recorder_post_standby_notification_snake,
        ]);
    }

    #[cfg(not(feature = "mic-recorder"))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            orbitkit_native::is_overlay_permission_granted,
            orbitkit_native::request_overlay_permission,
            orbitkit_native::overlay_show,
            orbitkit_native::overlay_hide,
            orbitkit_native::is_overlay_permission_granted_snake,
            orbitkit_native::request_overlay_permission_snake,
            orbitkit_native::overlay_show_snake,
            orbitkit_native::overlay_hide_snake,
        ]);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
