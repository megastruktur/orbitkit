fn main() {
    let cap_path = std::path::Path::new("capabilities/recorder.json");
    if std::env::var("CARGO_FEATURE_RECORDER").is_ok() {
        let json = r#"{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "recorder",
  "description": "Recorder capability for main window.",
  "windows": ["main"],
  "permissions": [
    "orbitkit-recorder:default"
  ]
}
"#;
        let _ = std::fs::write(cap_path, json);
    } else if cap_path.exists() {
        let _ = std::fs::remove_file(cap_path);
    }
    println!("cargo:rerun-if-env-changed=CARGO_FEATURE_RECORDER");
    tauri_build::build();
}
