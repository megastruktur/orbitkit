
pub use tauri_plugin_orbitkit::jni_bridge;
pub use tauri_plugin_orbitkit::OrbitkitExt;

#[tauri::command]
fn jni_get_action_log() -> Vec<tauri_plugin_orbitkit::jni_bridge::JniActionRecord> {
    tauri_plugin_orbitkit::jni_bridge::get_jni_action_log()
}

/// Receives webview debug log telemetry forwarded from the frontend when `VITE_ORBITKIT_DEBUG=1`.
#[tauri::command]
fn log_telemetry(msg: String) {
    eprintln!("[telemetry] {}", msg);
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
        log_telemetry,
    ]);

    builder = builder.setup(|app| {
        let app_handle = app.handle().clone();
        // Demo-b2: "note" spawns a NEW popup instance per click (K11
        // instanceKey: orbitkit-popup-notes-note-N). Settings stays a
        // singleton (no instanceKey → idempotent show + focus).
        let note_counter = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        app.on_menu_action(move |action| {
            let action_id = action.id.clone();
            let app_clone = app_handle.clone();
            match action_id.as_str() {
                "app.about" => {
                    log::info!("Menu action: about");
                    eprintln!("[starter] Menu action: app.about");
                }
                "app.quit" => {
                    log::info!("Menu action: quit");
                    eprintln!("[starter] Menu action: app.quit");
                    app_clone.exit(0);
                }
                "app.notes" => {
                    let n = note_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                    let instance = format!("note-{n}");
                    log::info!("Menu action: notes (instance {instance})");
                    eprintln!("[starter] Menu action: app.notes (instance {instance})");
                    let app_popup = app_clone.clone();
                    let _ = app_clone.run_on_main_thread(move || {
                        let _ = app_popup
                            .orbitkit()
                            .open_popup("notes".to_string(), None, Some(instance));
                    });
                }
                "app.settings" => {
                    let app_popup = app_clone.clone();
                    let _ = app_clone.run_on_main_thread(move || {
                        let _ = app_popup
                            .orbitkit()
                            .open_popup("settings".to_string(), None, None);
                    });
                }
                // Demo-b1: timer mutes the planet into the sleep pool for 5s.
                "app.timer" => {
                    log::info!("Menu action: timer");
                    eprintln!("[starter] Menu action: app.timer (sleep for 5s then idle)");
                    let app_clone_timer = app_clone.clone();
                    std::thread::spawn(move || {
                        let _ = app_clone_timer.orbitkit().set_mascot_state("sleep".to_string());
                        std::thread::sleep(std::time::Duration::from_secs(5));
                        let _ = app_clone_timer.orbitkit().set_mascot_state("idle".to_string());
                    });
                }
                // Demo-b1: alert pool has ttlMs=8000, so the mascot reverts to
                // idle by itself when the state machine expires the state.
                "app.alert" => {
                    log::info!("Menu action: alert");
                    eprintln!("[starter] Menu action: app.alert (alert state, ttl 8s)");
                    let _ = app_clone.orbitkit().set_mascot_state("alert".to_string());
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
