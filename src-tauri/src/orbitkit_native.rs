use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "dev.orbitkit.native";

pub struct OrbitkitNative<R: Runtime> {
    #[allow(dead_code)]
    app: AppHandle<R>,
    #[cfg(target_os = "android")]
    handle: tauri::plugin::PluginHandle<R>,
}

impl<R: Runtime> OrbitkitNative<R> {
    pub fn is_overlay_permission_granted(&self) -> Result<bool, String> {
        #[cfg(target_os = "android")]
        {
            self.handle
                .run_mobile_plugin::<bool>("isOverlayPermissionGranted", ())
                .or_else(|_| {
                    #[derive(serde::Deserialize)]
                    struct Status {
                        granted: bool,
                    }
                    self.handle
                        .run_mobile_plugin::<Status>("isOverlayPermissionGranted", ())
                        .map(|s| s.granted)
                })
                .map_err(|e| e.to_string())
        }
        #[cfg(not(target_os = "android"))]
        {
            Ok(true)
        }
    }

    pub fn request_overlay_permission(&self) -> Result<(), String> {
        #[cfg(target_os = "android")]
        {
            self.handle
                .run_mobile_plugin::<()>("requestOverlayPermission", ())
                .map_err(|e| e.to_string())
        }
        #[cfg(not(target_os = "android"))]
        {
            Ok(())
        }
    }

    pub fn overlay_show(&self) -> Result<(), String> {
        #[cfg(target_os = "android")]
        {
            let action_channel: tauri::ipc::Channel<serde_json::Value> = tauri::ipc::Channel::new(|response| {
                match response {
                    tauri::ipc::InvokeResponseBody::Json(json) => {
                        eprintln!("[orbitkit-native] Overlay action received: {json}");
                        log::info!("[orbitkit-native] Overlay action received: {json}");
                    }
                    tauri::ipc::InvokeResponseBody::Raw(bytes) => {
                        eprintln!("[orbitkit-native] Overlay action received (raw): {bytes:?}");
                        log::info!("[orbitkit-native] Overlay action received (raw): {bytes:?}");
                    }
                }
                Ok(())
            });

            self.handle
                .run_mobile_plugin::<()>(
                    "overlayShow",
                    serde_json::json!({
                        "channel": action_channel,
                    }),
                )
                .map_err(|e| e.to_string())
        }
        #[cfg(not(target_os = "android"))]
        {
            eprintln!("[orbitkit-native] Desktop overlayShow invoked (no-op on non-Android)");
            Ok(())
        }
    }

    pub fn overlay_hide(&self) -> Result<(), String> {
        #[cfg(target_os = "android")]
        {
            self.handle
                .run_mobile_plugin::<()>("overlayHide", ())
                .map_err(|e| e.to_string())
        }
        #[cfg(not(target_os = "android"))]
        {
            eprintln!("[orbitkit-native] Desktop overlayHide invoked (no-op on non-Android)");
            Ok(())
        }
    }
}

pub trait OrbitkitNativeExt<R: Runtime> {
    fn orbitkit_native(&self) -> &OrbitkitNative<R>;
}

impl<R: Runtime, T: Manager<R>> OrbitkitNativeExt<R> for T {
    fn orbitkit_native(&self) -> &OrbitkitNative<R> {
        self.state::<OrbitkitNative<R>>().inner()
    }
}

#[tauri::command(rename = "isOverlayPermissionGranted")]
pub async fn is_overlay_permission_granted<R: Runtime>(
    app: AppHandle<R>,
) -> Result<bool, String> {
    app.orbitkit_native().is_overlay_permission_granted()
}

#[tauri::command(rename = "requestOverlayPermission")]
pub async fn request_overlay_permission<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.orbitkit_native().request_overlay_permission()
}

#[tauri::command(rename = "overlayShow")]
pub async fn overlay_show<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.orbitkit_native().overlay_show()
}

#[tauri::command(rename = "overlayHide")]
pub async fn overlay_hide<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.orbitkit_native().overlay_hide()
}

#[tauri::command(rename = "is_overlay_permission_granted")]
pub async fn is_overlay_permission_granted_snake<R: Runtime>(
    app: AppHandle<R>,
) -> Result<bool, String> {
    app.orbitkit_native().is_overlay_permission_granted()
}

#[tauri::command(rename = "request_overlay_permission")]
pub async fn request_overlay_permission_snake<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.orbitkit_native().request_overlay_permission()
}

#[tauri::command(rename = "overlay_show")]
pub async fn overlay_show_snake<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.orbitkit_native().overlay_show()
}

#[tauri::command(rename = "overlay_hide")]
pub async fn overlay_hide_snake<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.orbitkit_native().overlay_hide()
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("orbitkit-native")
        .setup(|app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin(PLUGIN_IDENTIFIER, "OrbitkitNativePlugin")?;
                app.manage(OrbitkitNative {
                    app: app.clone(),
                    handle,
                });
            }
            #[cfg(not(target_os = "android"))]
            {
                app.manage(OrbitkitNative {
                    app: app.clone(),
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            is_overlay_permission_granted,
            request_overlay_permission,
            overlay_show,
            overlay_hide,
            is_overlay_permission_granted_snake,
            request_overlay_permission_snake,
            overlay_show_snake,
            overlay_hide_snake,
        ])
        .build()
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_action_payload_serialization() {
        let json = serde_json::json!({
            "action": "ACT_A",
            "timestamp": 1234567890i64
        });
        assert_eq!(json["action"], "ACT_A");
        assert_eq!(json["timestamp"], 1234567890i64);
    }

    #[test]
    fn test_actions_variants() {
        let actions = vec!["ACT_A", "ACT_B", "ACT_C"];
        for act in actions {
            let val = serde_json::json!({ "action": act });
            assert_eq!(val["action"].as_str().unwrap(), act);
        }
    }
}
