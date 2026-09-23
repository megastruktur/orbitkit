# OrbitKit Architecture

OrbitKit is a domain-neutral shell SDK for desktop and mobile applications built on [Tauri v2](https://v2.tauri.app) and [Svelte 5](https://svelte.dev). It provides a floating, replaceable mascot, a configurable radial/arc action menu, and auxiliary popup windows or native overlays.

For the original binding contracts and campaign decisions, see [Contract Specifications](architecture/contracts.md).

---

## 1. System Overview

OrbitKit decouples the persistent interactive mascot and radial menu shell from underlying application logic:

```
+--------------------------------------------------------------------------+
|                          Consumer Application                            |
|          (UI views, business logic, native menu action handlers)         |
+--------------------------------------------------------------------------+
                                     |
       +-----------------------------+-----------------------------+
       |                                                           |
       v                                                           v
+-------------------------------+             +----------------------------+
|         @orbitkit/ui          |             |   tauri-plugin-orbitkit    |
|  - Svelte 5 Mascot Component  |             |  - Plugin Builder & Config |
|  - RadialMenu & Geometry      |             |  - Desktop Window Manager  |
|  - Typed Config & Validation  |             |  - Android JNI Bridge      |
|  - Typed Bridge & Events      |             |  - OrbitkitExt Trait       |
+-------------------------------+             +----------------------------+
       |                                                           |
       | (Invoke / Listen)                                         | (Native APIs)
       +-----------------------------+-----------------------------+
                                     |
       +-----------------------------+-----------------------------+
       |                                                           |
       v                                                           v
+-------------------------------+             +----------------------------+
|        Desktop Engine         |             |       Android Engine       |
|  - Transparent Mascot Window  |             |  - WindowManager Overlay   |
|  - Auxiliary Popup Windows    |             |  - SYSTEM_ALERT_WINDOW     |
|  - Multi-window Event Routing |             |  - Direct JNI Callbacks    |
+-------------------------------+             +----------------------------+
```

---

## 2. Multi-Platform Abstraction Model

OrbitKit bridges desktop windowing and Android system overlays through a unified configuration and command contract:

| Concept | Desktop (Linux / macOS / Windows) | Android |
|---|---|---|
| **Mascot Window** | Frameless, transparent `WebviewWindow` labeled `orbitkit-mascot` | Native `WindowManager` floating bubble (`TYPE_APPLICATION_OVERLAY`) |
| **Radial Menu** | Svelte 5 component (`RadialMenu.svelte`) rendered inside the webview | Native Android canvas view drawing arc items and handling touch hits |
| **Menu Action Dispatch** | Emitted to Rust handlers (`on_menu_action`) & webviews via `orbitkit://menu-action` | Dispatched to Rust via direct JNI (`OrbitkitJniBridge.onNativeAction`) & Tauri event |
| **Suspended Execution** | Process stays active; webview remains live | WebView may be suspended in background; direct JNI ensures actions still process |
| **Popups** | Native `WebviewWindow` instances (`orbitkit-popup-<id>`) | Main app activity / webview (`open_popup` returns `unsupported` on mobile) |
| **Permissions** | No runtime permissions required | Requires `SYSTEM_ALERT_WINDOW` permission |

---

## 3. Layer Breakdown

### Frontend Layer: `@orbitkit/ui`

- **Components**:
  - `Mascot.svelte`: Renders SVG (data URL sandbox via `<img>` per K3-A3), static image, or CSS sprite sheets with frame-based animations and reduced-motion support.
  - `RadialMenu.svelte`: Renders circular or arc menus positioned by `layoutItems` geometry calculations.
- **Config & Validation**:
  - `defineConfig`: Identity helper providing TypeScript autocompletion.
  - `validateConfig`: Structural validator ensuring radii, angles, item counts (1..12), and item identifiers match `MENU_ITEM_ID_REGEX` (`^[a-z0-9][a-z0-9_-]{0,31}$`).
  - `withDefaults`: Merges user configuration with fallback values.
- **IPC Bridge**:
  - Typed wrappers around Tauri invoke: `showOverlay`, `hideOverlay`, `openPopup`, `closePopup`, `setMascotState`, `emitMenuAction`, `overlayPermission`, `requestOverlayPermission`.
  - Event listeners: `onMenuAction`, `onMascotState`.
  - Error normalization: Normalizes backend errors into `OrbitKitError` with typed error codes (`permission_denied`, `unsupported`, `not_found`, `invalid_config`).

### Plugin Layer: `tauri-plugin-orbitkit`

- **Plugin Initialization**: Initialized in Rust via `tauri_plugin_orbitkit::init(config)`.
- **Command Routing**: Maps IPC invocations to desktop window operations or mobile JNI calls.
- **Extension Trait**: Provides `OrbitkitExt` on `AppHandle` and `Manager`, exposing:
  - `app.orbitkit()`: Access to internal desktop or mobile controller.
  - `app.on_menu_action(|action| { ... })`: Registers global native callbacks for menu selections.

### Android Native & JNI Bridge

On Android, the floating mascot and radial menu run as a native `WindowManager` overlay using `android.permission.SYSTEM_ALERT_WINDOW`.

When a user taps an item on the native radial menu overlay:
1. Kotlin touch listener intercepts the tap.
2. Kotlin invokes `OrbitkitJniBridge.onNativeAction(id)`.
3. The native C/Rust JNI handler receives the action identifier, records an action receipt, and executes all handlers registered via `OrbitkitExt::on_menu_action`.
4. If the Tauri WebView is currently alive and active, the event `orbitkit://menu-action` is also broadcast to the frontend.
5. If the Tauri WebView is frozen or backgrounded by Android battery optimization, the Rust native handler executes regardless.

---

## 4. Extension Pattern: `tauri-plugin-orbitkit-recorder`

OrbitKit maintains minimal permissions in its core plugin (`SYSTEM_ALERT_WINDOW` only on Android). Domain capabilities such as audio recording and foreground services are implemented as modular extensions.

The `tauri-plugin-orbitkit-recorder` crate illustrates this architecture:
- Ships its own Android manifest with `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, and `POST_NOTIFICATIONS`.
- Implements an Android `Service` (`OrbitkitRecorderService`) with notification channel and state persistence.
- Keeps core OrbitKit lightweight and audit-friendly.

See [Extension Guide](extensions.md) for architecture and implementation details.

---

## 5. Further Reading

- [Getting Started](getting-started.md) — Step-by-step integration into a Tauri v2 application.
- [Configuration Reference](configuration.md) — Complete schema reference for K2 configuration.
- [API Reference](api.md) — Full TypeScript and Rust API surfaces, commands, and error codes.
- [Platform Specifics](platforms/desktop.md) — Multi-window, Linux container builds, macOS transparency, and Windows notes.
- [Android Architecture](platforms/android.md) — SAW permission flow, overlay lifecycle, JNI bridge, and Gate B limitations.
- [Development & CI](development.md) — Running tests, container workflows, and CI configuration.
