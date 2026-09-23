# Getting Started with OrbitKit

This guide demonstrates how to add OrbitKit to an existing [Tauri v2](https://v2.tauri.app) application with a Svelte 5 frontend.

For full architectural context, see [Architecture](architecture.md). For configuration options, see [Configuration Reference](configuration.md).

---

## 1. Prerequisites

- **Tauri v2**: Tauri CLI and core `^2.11.0`.
- **Node.js & Package Manager**: Node 20+ and pnpm 12 (pinned 12.4.1).
- **Rust Toolchain**: Rust 1.77+ (edition 2021).
- **Frontend Framework**: Svelte 5 (`svelte@^5.0.0`).

---

## 2. Add `@orbitkit/ui` to Frontend

In a pnpm workspace (such as `examples/starter`), reference the workspace package:

```json
"dependencies": {
  "@orbitkit/ui": "workspace:*"
}
```

Or install via relative path:

```bash
pnpm add path:../../packages/orbitkit
```

`@orbitkit/ui` includes:
- Svelte 5 components: `Mascot`, `RadialMenu`.
- Menu positioning geometry: `layoutItems`, `ItemPosition`.
- Typed config helpers: `defineConfig`, `validateConfig`, `withDefaults`.
- Typed IPC bridge: `showOverlay`, `hideOverlay`, `openPopup`, `closePopup`, `setMascotState`, `emitMenuAction`, `overlayPermission`, `requestOverlayPermission`, `onMenuAction`, `onMascotState`, `OrbitKitError`.
- Default planet mascot asset: `@orbitkit/ui/assets/default-mascot.svg`.

---

## 3. Add `tauri-plugin-orbitkit` to Rust

Add the plugin crate to your `src-tauri/Cargo.toml` as a path dependency:

```toml
[dependencies]
tauri = { version = "2.11", default-features = false }
tauri-plugin-orbitkit = { path = "../../crates/tauri-plugin-orbitkit" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

---

## 4. Define OrbitKit Configuration

Create `src/orbitkit.config.json` (or TypeScript configuration using `defineConfig` from `@orbitkit/ui`):

```json
{
  "mascot": {
    "kind": "svg",
    "src": "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#4f7cff\" /><ellipse cx=\"80\" cy=\"80\" rx=\"70\" ry=\"22\" fill=\"none\" stroke=\"#9db4ff\" stroke-width=\"4\" transform=\"rotate(-20 80 80)\" /><circle cx=\"60\" cy=\"68\" r=\"10\" fill=\"#ffffff\" /><circle cx=\"100\" cy=\"68\" r=\"10\" fill=\"#ffffff\" /><circle cx=\"62\" cy=\"70\" r=\"4\" fill=\"#10141a\" /><circle cx=\"102\" cy=\"70\" r=\"4\" fill=\"#10141a\" /></svg>",
    "size": 96,
    "initialState": "idle",
    "states": {
      "idle": {
        "src": "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#4f7cff\" /></svg>"
      },
      "busy": {
        "src": "<svg width=\"160\" height=\"160\" viewBox=\"0 0 160 160\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"80\" cy=\"80\" r=\"56\" fill=\"#f59e0b\" /></svg>"
      }
    }
  },
  "menu": {
    "items": [
      { "id": "notes", "label": "Notes" },
      { "id": "settings", "label": "Settings" },
      { "id": "quit", "label": "Quit" }
    ],
    "radius": 96,
    "startAngle": -90,
    "endAngle": 270,
    "itemSize": 44,
    "trigger": "click"
  },
  "windows": {
    "mascotWindow": {
      "transparent": true,
      "alwaysOnTop": true,
      "decorations": false
    },
    "popups": [
      {
        "id": "notes",
        "url": "index.html?popup=notes",
        "title": "Notes",
        "width": 320,
        "height": 420
      },
      {
        "id": "settings",
        "url": "index.html?popup=settings",
        "title": "Settings",
        "width": 360,
        "height": 300
      }
    ]
  }
}
```

Validate and re-export in TypeScript via `src/orbitkit.config.ts`:

```ts
import { defineConfig, validateConfig, type OrbitKitConfig } from "@orbitkit/ui";
import rawConfig from "./orbitkit.config.json";

export const config: OrbitKitConfig = defineConfig(rawConfig as OrbitKitConfig);
const validation = validateConfig(config);
if (!validation.ok) {
  console.error("OrbitKit config validation errors:", validation.errors);
}
export default config;
```

---

## 5. Register the Plugin in Rust

In `src-tauri/src/lib.rs`, load the configuration and register `tauri_plugin_orbitkit::init`:

```rust
use tauri_plugin_orbitkit::{init, OrbitKitConfig, OrbitkitExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_str = include_str!("../../src/orbitkit.config.json");
    let config: OrbitKitConfig = serde_json::from_str(config_str)
        .expect("Failed to parse orbitkit.config.json");

    tauri::Builder::default()
        .plugin(init(config))
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.on_menu_action(move |action| {
                println!("Menu action received: id={}, source={}", action.id, action.source);
                match action.id.as_str() {
                    "quit" => app_handle.exit(0),
                    "notes" | "settings" => {
                        let app_popup = app_handle.clone();
                        let id = action.id.clone();
                        let _ = app_handle.run_on_main_thread(move || {
                            let _ = app_popup.orbitkit().open_popup(id);
                        });
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 6. Configure Tauri Capabilities

Create or update `src-tauri/capabilities/default.json` to grant permissions to the main window, the mascot window, and popup windows:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for all OrbitKit windows.",
  "windows": ["main", "orbitkit-mascot", "orbitkit-popup-*"],
  "permissions": [
    "core:default",
    "orbitkit:default"
  ]
}
```

In `src-tauri/tauri.conf.json`, ensure transparent frameless windows are allowed:

```json
{
  "productName": "my-app",
  "version": "0.1.0",
  "identifier": "com.example.myapp",
  "app": {
    "macOSPrivateApi": true,
    "windows": [
      {
        "label": "main",
        "title": "My Application",
        "width": 800,
        "height": 600
      }
    ]
  }
}
```

> **macOS Note**: `macOSPrivateApi: true` is required by Tauri on macOS to support transparent window backgrounds.

---

## 7. Android Configuration & Gradle Notes

OrbitKit provides out-of-the-box support for Android `SYSTEM_ALERT_WINDOW` floating overlays.

### Manifest Permissions

The `tauri-plugin-orbitkit` Android library manifest automatically includes:

```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
```

No additional microphone or audio permissions are requested by the core plugin.

### Overlay Permission Verification

Android requires explicit user consent in system settings for overlays. Check and request permission before opening the overlay:

```ts
import { overlayPermission, requestOverlayPermission, showOverlay } from "@orbitkit/ui";
import config from "./orbitkit.config";

async function enableOverlay() {
  const granted = await overlayPermission();
  if (!granted) {
    // Opens Android "Display over other apps" settings page
    await requestOverlayPermission();
    return;
  }
  await showOverlay({ menu: config.menu });
}
```

For more Android configuration details, see [Android Platform Notes](platforms/android.md).

---

## 8. Frontend Integration (Svelte 5)

Render the mascot and radial menu in your Svelte 5 application:

```svelte
<script lang="ts">
  import {
    Mascot,
    RadialMenu,
    showOverlay,
    hideOverlay,
    openPopup,
    onMenuAction,
    onMascotState
  } from "@orbitkit/ui";
  import config from "./orbitkit.config";

  let menuOpen = $state(false);
  let currentState = $state("idle");

  onMenuAction((action) => {
    console.log("Action selected:", action.id, "from:", action.source);
    if (action.id === "notes") {
      openPopup("notes");
    }
  });

  onMascotState((payload) => {
    currentState = payload.state;
  });
</script>

<div class="mascot-container">
  <Mascot
    {config}
    state={currentState}
    onclick={() => (menuOpen = !menuOpen)}
  />

  <RadialMenu
    config={config.menu}
    open={menuOpen}
    onselect={(id) => {
      menuOpen = false;
      console.log("Menu item clicked:", id);
    }}
    onclose={() => (menuOpen = false)}
  />
</div>
```

---

## 9. Next Steps

- Explore [Configuration Reference](configuration.md) to customize mascot sprite sheets, triggers, and popup dimensions.
- Check [API Reference](api.md) for full Rust and TypeScript method signatures and error types.
- Learn about the [Extensions System](extensions.md) for background audio recording and persistence.
