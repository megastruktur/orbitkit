use tauri::{AppHandle, Runtime};
#[cfg_attr(not(target_os = "android"), allow(unused_imports))]
use tauri_plugin_orbitkit::OrbitkitExt;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecorderStateResponse {
    pub state: String,
    pub spool_path: String,
    pub bytes_recorded: u64,
    pub is_foreground: bool,
}

#[tauri::command(rename = "recorderStartForeground")]
pub async fn recorder_start_foreground<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<()>("recorderStartForeground", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        eprintln!("[starter-recorder] Desktop recorderStartForeground invoked (mock)");
        Ok(())
    }
}

#[tauri::command(rename = "recorderPause")]
pub async fn recorder_pause<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<()>("recorderPause", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        eprintln!("[starter-recorder] Desktop recorderPause invoked (mock)");
        Ok(())
    }
}

#[tauri::command(rename = "recorderResume")]
pub async fn recorder_resume<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<()>("recorderResume", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        eprintln!("[starter-recorder] Desktop recorderResume invoked (mock)");
        Ok(())
    }
}

#[tauri::command(rename = "recorderStop")]
pub async fn recorder_stop<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<()>("recorderStop", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        eprintln!("[starter-recorder] Desktop recorderStop invoked (mock)");
        Ok(())
    }
}

#[tauri::command(rename = "recorderState")]
pub async fn recorder_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<RecorderStateResponse, String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<RecorderStateResponse>("recorderState", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(RecorderStateResponse {
            state: "IDLE".to_string(),
            spool_path: "".to_string(),
            bytes_recorded: 0,
            is_foreground: false,
        })
    }
}

#[tauri::command(rename = "recorderPostStandbyNotification")]
pub async fn recorder_post_standby_notification<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<()>("recorderPostStandbyNotification", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        eprintln!("[starter-recorder] Desktop recorderPostStandbyNotification invoked (mock)");
        Ok(())
    }
}

#[tauri::command(rename = "recorderGetPersistedState")]
pub async fn recorder_get_persisted_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<serde_json::Value>("recorderGetPersistedState", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(serde_json::json!({
            "state": "IDLE",
            "bytesRecorded": 0,
            "spoolPath": "",
            "recoveryCount": 0,
            "lastAction": "NONE"
        }))
    }
}

#[tauri::command(rename = "recorderRecoverState")]
pub async fn recorder_recover_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "android")]
    {
        app.orbitkit()
            .run_mobile_plugin::<serde_json::Value>("recorderRecoverState", ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(serde_json::json!({
            "state": "IDLE",
            "bytesRecorded": 0,
            "spoolPath": "",
            "recoveryCount": 0,
            "lastAction": "NONE"
        }))
    }
}
