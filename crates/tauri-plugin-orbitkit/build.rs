const COMMANDS: &[&str] = &[
    "overlay_permission",
    "request_overlay_permission",
    "show_overlay",
    "hide_overlay",
    "open_popup",
    "close_popup",
    "set_mascot_state",
    "emit_menu_action",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
