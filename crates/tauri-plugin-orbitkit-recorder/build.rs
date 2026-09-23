const COMMANDS: &[&str] = &[
    "start_foreground",
    "pause",
    "resume",
    "stop",
    "state",
    "post_standby_notification",
    "get_persisted_state",
    "recover_state",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
