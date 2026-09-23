#[cfg(feature = "mic-recorder")]
pub mod recorder;

pub use tauri_plugin_orbitkit::jni_bridge;
pub use tauri_plugin_orbitkit::OrbitkitExt;

#[tauri::command]
fn jni_get_action_log() -> Vec<tauri_plugin_orbitkit::jni_bridge::JniActionRecord> {
    tauri_plugin_orbitkit::jni_bridge::get_jni_action_log()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_orbitkit::init_default());

    #[cfg(feature = "mic-recorder")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            recorder::recorder_start_foreground,
            recorder::recorder_pause,
            recorder::recorder_resume,
            recorder::recorder_stop,
            recorder::recorder_state,
            recorder::recorder_post_standby_notification,
            recorder::recorder_get_persisted_state,
            recorder::recorder_recover_state,
            jni_get_action_log,
        ]);
    }

    #[cfg(not(feature = "mic-recorder"))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            jni_get_action_log,
        ]);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
