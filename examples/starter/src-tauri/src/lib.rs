

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

    #[cfg(feature = "recorder")]
    {
        builder = builder.plugin(tauri_plugin_orbitkit_recorder::init());
    }

    builder = builder.invoke_handler(tauri::generate_handler![
        jni_get_action_log,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
