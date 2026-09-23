# Changelog

All notable changes to the OrbitKit workspace are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-23

Initial release of the OrbitKit SDK.

### Added

#### Frontend (`@orbitkit/ui`)
- **`<Mascot />` Svelte 5 Component**:
  - Secure SVG rendering using data URLs (`data:image/svg+xml;charset=utf-8,...`) via `<img>` (K3-A3) to prevent script execution, DOM clobbering, and mXSS.
  - Frame-based CSS sprite sheet animations with configurable FPS, looping, row indexing, and OS reduced-motion detection.
  - Static image support (PNG, WebP, SVG).
- **`<RadialMenu />` Svelte 5 Component**:
  - Math-driven item positioning (`layoutItems`) supporting full 360-degree circles or custom angle arcs.
  - Configurable interaction triggers: `"click"` or `"hover"`.
  - Accessible keyboard navigation and outside-click dismissal.
- **Typed Configuration (Contract K2)**:
  - `defineConfig`: Identity helper providing TypeScript autocompletion.
  - `validateConfig`: Runtime validation enforcing item limits (1..12), regex identifier constraints (`^[a-z0-9][a-z0-9_-]{0,31}$`), and positive geometry dimensions.
  - `withDefaults`: Populates fallback values for optional configuration parameters.
- **Typed IPC Bridge**:
  - Non-Tauri safe wrappers: `showOverlay`, `hideOverlay`, `openPopup`, `closePopup`, `setMascotState`, `emitMenuAction`, `overlayPermission`, `requestOverlayPermission`, `isTauri`.
  - Event listeners: `onMenuAction` (`orbitkit://menu-action`) and `onMascotState` (`orbitkit://mascot-state`).
  - Structured error handling: `OrbitKitError` mapped strictly to four codes (`permission_denied`, `unsupported`, `not_found`, `invalid_config`).
- **Assets**:
  - Bundled default planet mascot asset exported at `@orbitkit/ui/assets/default-mascot.svg`.

#### Plugin (`tauri-plugin-orbitkit`)
- **Desktop Multi-Window Engine**:
  - Frameless, transparent mascot window (`orbitkit-mascot`) loaded at `index.html?orbitkit=mascot`.
  - Dynamic sizing calculation: $\max(\text{mascotSize}, 2 \times (\text{radius} + \text{itemSize})) + 16\text{ px}$.
  - Auxiliary popup window lifecycle management (`orbitkit-popup-*`).
  - Automated debug selftest hooks (`ORBITKIT_SELFTEST=1` and `ORBITKIT_SELFTEST_CONFIG=<json>`).
- **Android Native Overlay**:
  - Floating `WindowManager` view (`TYPE_APPLICATION_OVERLAY`) using `android.permission.SYSTEM_ALERT_WINDOW`.
  - Native Kotlin touch handling and radial button expansion.
  - Direct JNI bridge (`OrbitkitJniBridge`) delivering actions to Rust even when the Chromium WebView is throttled or suspended in the background.
  - Rust `OrbitkitExt` trait exposing `app.on_menu_action(...)` and `app.orbitkit()`.

#### Extension (`tauri-plugin-orbitkit-recorder`)
- Modular audio recording plugin illustrating the extension pattern with zero permission footprint on core OrbitKit.
- Android `OrbitkitRecorderService` microphone foreground service.
- Disk-backed atomic state persistence (`OrbitkitStatePersistence`) ensuring spool files survive OS Low Memory Killer (LMK) process termination.

#### Starter Example (`examples/starter`)
- End-to-end runnable Tauri v2 + Svelte 5 application.
- Demonstrates mascot state transitions (`idle` to `busy`), Notes and Settings popups, and native quit action.

#### Build Tools & CI
- `scripts/linux-desktop.sh`: Containerized Linux desktop compiler, Xvfb headless runner, screenshot capture, and automated scenario runner.
- Multi-platform GitHub Actions CI matrix for Linux, Windows, macOS, and Android.
