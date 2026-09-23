# `tauri-plugin-orbitkit`

Core [Tauri v2](https://v2.tauri.app) plugin for [OrbitKit](../../README.md), powering floating mascot overlay windows, radial menus, auxiliary popups, and native Android `SYSTEM_ALERT_WINDOW` integration with direct JNI dispatch.

---

## Installation

Add to your Tauri application's `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "=2.11.6", default-features = false }
tauri-plugin-orbitkit = { path = "../../crates/tauri-plugin-orbitkit" } # or crates.io
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

---

## Features

- **Multi-Window Desktop Management**:
  - Automatically manages frameless, transparent `orbitkit-mascot` window anchored to primary monitor coordinates.
  - Dynamically creates and focuses auxiliary popup windows (`orbitkit-popup-<id>`) based on user configuration.
- **Android System Overlay**:
  - Native `WindowManager` floating bubble and radial menu attached via `android.permission.SYSTEM_ALERT_WINDOW`.
  - Direct JNI bridge (`OrbitkitJniBridge`) that routes menu clicks to Rust even when the Chromium WebView is throttled or suspended.
- **Unified Action Pipeline**:
  - Global `app.on_menu_action(|action| { ... })` handler receives actions triggered from either webview or native overlay.
- **Strict Error Handling**:
  - Error union mapped strictly to four codes: `permission_denied`, `unsupported`, `not_found`, `invalid_config`.

---

## Quick Example

In your `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_orbitkit::{init, OrbitKitConfig, OrbitkitExt};

pub fn run() {
    let config: OrbitKitConfig = serde_json::from_str(include_str!("../../src/orbitkit.config.json"))
        .expect("invalid orbitkit config");

    tauri::Builder::default()
        .plugin(init(config))
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.on_menu_action(move |action| {
                println!("Action ID: {}", action.id);
                println!("Action source: {}", action.source); // "webview" | "overlay"

                if action.id == "quit" {
                    app_handle.exit(0);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
```

---

## Capability Configuration

In `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "orbitkit:default"
  ]
}
```

---

## Commands & Events

| Command | Args | Returns | Description |
|---|---|---|---|
| `overlay_permission` | — | `{ granted: bool }` | Checks overlay permission (always true on desktop, SAW check on Android). |
| `request_overlay_permission` | — | `()` | Requests overlay permission (opens settings on Android). |
| `show_overlay` | `menu?, mascot?` | `()` | Displays mascot window or Android overlay. |
| `hide_overlay` | — | `()` | Hides mascot window or removes Android overlay. |
| `open_popup` | `id` | `()` | Opens/focuses popup window (desktop only). |
| `close_popup` | `id` | `()` | Closes popup window (desktop only). |
| `set_mascot_state` | `state` | `()` | Sets mascot state & emits `orbitkit://mascot-state`. |
| `emit_menu_action` | `id` | `()` | Dispatches menu action & emits `orbitkit://menu-action`. |

---

## Documentation

- [Getting Started Guide](../../docs/getting-started.md)
- [API Reference](../../docs/api.md)
- [Android Platform Guide](../../docs/platforms/android.md)
- [Desktop Platform Guide](../../docs/platforms/desktop.md)
