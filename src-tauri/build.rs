const BASE_COMMANDS: &[&str] = &[
    "overlayShow",
    "overlayHide",
    "requestOverlayPermission",
    "isOverlayPermissionGranted",
    "overlay_show",
    "overlay_hide",
    "request_overlay_permission",
    "is_overlay_permission_granted",
];

const ALL_COMMANDS: &[&str] = &[
    "overlayShow",
    "overlayHide",
    "requestOverlayPermission",
    "isOverlayPermissionGranted",
    "overlay_show",
    "overlay_hide",
    "request_overlay_permission",
    "is_overlay_permission_granted",
    "recorderStartForeground",
    "recorderPause",
    "recorderResume",
    "recorderStop",
    "recorderState",
    "recorder_start_foreground",
    "recorder_pause",
    "recorder_resume",
    "recorder_stop",
    "recorder_state",
    "recorderPostStandbyNotification",
    "recorder_post_standby_notification",
    "recorderGetPersistedState",
    "recorder_get_persisted_state",
    "recorderRecoverState",
    "recorder_recover_state",
];

fn main() {
    let mic_recorder_enabled = cfg!(feature = "mic-recorder")
        || std::env::var("CARGO_FEATURE_MIC_RECORDER").is_ok();

    let commands = if mic_recorder_enabled {
        ALL_COMMANDS
    } else {
        BASE_COMMANDS
    };
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "orbitkit-native",
            tauri_build::InlinedPlugin::new()
                .commands(&commands)
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("failed to run tauri-build");
}
