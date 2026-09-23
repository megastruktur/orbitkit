# `tauri-plugin-orbitkit-recorder`

Modular audio recording and foreground service extension plugin for [OrbitKit](../../README.md), providing microphone audio spooling, Android foreground service lifecycle management, and crash/LMK state persistence.

---

## Installation

Add to your application's `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "=2.11.6", default-features = false }
tauri-plugin-orbitkit-recorder = { path = "../../crates/tauri-plugin-orbitkit-recorder" }
```

---

## Architecture & Permissions

To maintain clean separation of concerns, sensitive audio and foreground service permissions are isolated within this extension rather than core OrbitKit.

### Android Permissions
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

## Quick Example

In your `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_orbitkit_recorder::{init, OrbitkitRecorderExt};

pub fn run() {
    tauri::Builder::default()
        .plugin(init())
        .setup(|app| {
            // Access recorder via OrbitkitRecorderExt
            let _recorder = app.orbitkit_recorder();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

---

## Capability Configuration

In `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "orbitkit:default",
    "orbitkit-recorder:default"
  ]
}
```

---

## Commands

All commands are prefixed with `plugin:orbitkit-recorder|<cmd>`:

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `start_foreground` | — | `()` | Starts audio capture and promotes service to foreground. |
| `pause` | — | `()` | Pauses audio recording while keeping service in foreground. |
| `resume` | — | `()` | Resumes audio capture. |
| `stop` | — | `()` | Stops recording, finalizes spool file, and stops service. |
| `state` | — | `RecorderStateResponse` | Returns active status (`IDLE`, `RECORDING`, `PAUSED`, `STOPPED`). |
| `post_standby_notification` | — | `()` | Posts standby notification with a `"START"` action intent. |
| `get_persisted_state` | — | `serde_json::Value` | Reads last recorded state from disk cache. |
| `recover_state` | — | `serde_json::Value` | Recovers unfinalized spool files following unexpected process exit. |

---

## Android Gate B Notice

> **Important**: Under Android 14+ (API 34) and Android 16 While-In-Use Gate B rules, microphone foreground services **cannot be cold-started from an overlay window** while the main activity is backgrounded.
>
> The service must be initiated while the application's Activity is visibly displayed (or via standby notification action exemption). Once running, overlay pause/resume/stop controls work seamlessly.

---

## Documentation

- [Extension Guide](../../docs/extensions.md)
- [Android Platform Guide](../../docs/platforms/android.md)
- [API Reference](../../docs/api.md)
