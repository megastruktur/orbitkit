
pub use tauri_plugin_orbitkit::jni_bridge;
pub use tauri_plugin_orbitkit::OrbitkitExt;

#[tauri::command]
fn jni_get_action_log() -> Vec<tauri_plugin_orbitkit::jni_bridge::JniActionRecord> {
    tauri_plugin_orbitkit::jni_bridge::get_jni_action_log()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_str = include_str!("../../src/orbitkit.config.json");
    let config: tauri_plugin_orbitkit::OrbitKitConfig =
        serde_json::from_str(config_str).expect("Failed to parse orbitkit.config.json");

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_orbitkit::init(config));

    #[cfg(feature = "recorder")]
    {
        builder = builder.plugin(tauri_plugin_orbitkit_recorder::init());
    }

    builder = builder.invoke_handler(tauri::generate_handler![
        jni_get_action_log,
    ]);

    builder = builder.setup(|app| {
        let app_handle = app.handle().clone();
        app.on_menu_action(move |action| {
            let action_id = action.id.clone();
            let app_clone = app_handle.clone();
            match action_id.as_str() {
                "about" => {
                    log::info!("Menu action: about");
                    eprintln!("[starter] Menu action: about");
                }
                "quit" => {
                    log::info!("Menu action: quit");
                    eprintln!("[starter] Menu action: quit");
                    app_clone.exit(0);
                }
                "notes" | "settings" => {
                    let app_popup = app_clone.clone();
                    let _ = app_clone.run_on_main_thread(move || {
                        let _ = app_popup.orbitkit().open_popup(action_id);
                    });
                }
                "timer" => {
                    log::info!("Menu action: timer");
                    eprintln!("[starter] Menu action: timer (busy for 5s then idle)");
                    let app_clone_timer = app_clone.clone();
                    std::thread::spawn(move || {
                        let _ = app_clone_timer.orbitkit().set_mascot_state("busy".to_string());
                        std::thread::sleep(std::time::Duration::from_secs(5));
                        let _ = app_clone_timer.orbitkit().set_mascot_state("idle".to_string());
                    });
                }
                other => {
                    log::info!("Menu action: {}", other);
                    eprintln!("[starter] Menu action: {}", other);
                }
            }
        });
        Ok(())
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
