# OrbitKit Starter Example

A minimal, compilable, and runnable consumer application showcasing `@orbitkit/ui` and `tauri-plugin-orbitkit` across desktop (Linux/macOS/Windows) and Android platforms.

## Architecture

- **Configuration (`src/orbitkit.config.json` & `src/orbitkit.config.ts`)**:
  Single source of truth configuration defining the floating mascot (sprite-sheet kind `sheets`: "Glim", a 32x32 frame, integer-upscaled 3x, with `idle` / `alert` (8s TTL) / `sleep` state pools), 6 dotted-id radial menu actions (`app.notes`, `app.timer`, `app.alert`, `app.settings`, `app.about`, `app.quit`) in the `arc-anchor` layout with inline `{svg}` icons and centre-first stagger, popups (`notes`: 320x420, `settings`: 360x300), and window styling defaults (`transparent: true`, `alwaysOnTop: true`, `decorations: false`, `passthrough: true`, `fitContent: true`).
- **Routing & Screens (`src/main.ts` & `src/views/`)**:
  Inspects URL parameters on window startup:
  - `?orbitkit=mascot` → `MascotView.svelte`: Glim the pixel-art blob overlay with its arc-anchor radial menu (glass discs `#0E1433` @ 85%, cyan 1.5px rings, inline-SVG icons, hover/focus glow, desktop tooltips). The window content-fits the sprite (idle: sprite + transparent side padding) and grows above the mascot for the menu; clicks on transparent areas pass through to the app underneath (`src/lib/windowFit.ts` holds the pure fit math).
  - `?popup=notes` → `NotesPopup.svelte`: Planetary glass card popup for quick notes, persisted to `localStorage`.
  - `?popup=settings` → `SettingsPopup.svelte`: Planetary settings popup controlling the mascot state pools (`idle` / `alert` / `sleep`) via `setMascotState`.
  - `?popup=<id>` (unregistered) → `UnknownPopup.svelte`: Planetary fallback glass card for unregistered popup identifiers.
  - Default (no query params) → `MainView.svelte`: Sleek mission control dashboard featuring a hero mascot with orbital rings, tagline, and glass cards for overlay controls (the overlay auto-shows on desktop startup), Android permission status, mascot state toggles, and live event telemetry log.
- **Backend (`src-tauri/src/lib.rs`)**:
  Initializes `tauri_plugin_orbitkit::init(config)` with parsed `orbitkit.config.json`. Handles native menu events via `OrbitkitExt::on_menu_action`:
  - `app.about` → logs action.
  - `app.quit` → exits process (`app.exit(0)`).
  - `app.notes` / `app.settings` → opens popup window (`open_popup(id)`).
  - `app.timer` → sets mascot state to `sleep` for 5s then reverts to `idle`.
  - `app.alert` → sets mascot state to `alert` (state pool TTL auto-reverts after ~8s).

---

## Desktop Execution

### 1. Host with WebKit2GTK installed
```bash
# From workspace root:
pnpm install
pnpm -r build

# Run debug build:
pnpm --filter starter tauri build --debug --no-bundle
./examples/starter/src-tauri/target/debug/starter
```

### 2. Containerized Linux Desktop (Docker)
OrbitKit provides a headless containerized desktop environment running Xvfb and Openbox.

```bash
# Build desktop binary:
./scripts/linux-desktop.sh build examples/starter

# Capture desktop screenshot:
./scripts/linux-desktop.sh run-screenshot examples/starter /tmp/screenshot.png 5

# Run automated full-flow scenario (shows overlay, opens radial menu, opens notes popup, quits):
./scripts/linux-desktop.sh run-scenario examples/starter evidence/sdk-v1/starter-example/run-desktop-flow.sh
```

---

## Android Execution

### Prerequisites
- Android SDK installed (`$ANDROID_HOME`)
- Android NDK `27.3.13750724` (`$NDK_HOME`)
- Rust target `aarch64-linux-android` (`rustup target add aarch64-linux-android`)

### 1. Build Core APK (No Recorder)
Builds the minimal APK containing only `SYSTEM_ALERT_WINDOW` permission (no mic or audio foreground service permissions):

```bash
pnpm --filter starter tauri android build --debug --target aarch64 --apk
```
Output path:
`examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

### 2. Build Recorder Extension APK
Builds the APK with the optional `recorder` feature enabled (`RECORD_AUDIO`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS`):

```bash
pnpm --filter starter tauri android build --debug --target aarch64 --apk --features recorder
```
Output path:
`examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

---

## Physical / Emulator Device Runbook (DEFERRED Flow)

When an Android device or emulator is connected via ADB:

1. **Verify device connection**:
   ```bash
   adb devices -l
   ```
2. **Install Core APK**:
   ```bash
   adb install -r examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
   ```
3. **Grant Overlay Permission (`SYSTEM_ALERT_WINDOW`)**:
   ```bash
   adb shell appops set dev.orbitkit.app SYSTEM_ALERT_WINDOW allow
   ```
4. **Launch Main Activity**:
   ```bash
   adb shell am start -n dev.orbitkit.app/dev.orbitkit.app.MainActivity
   ```
5. **Display Floating Mascot Overlay**:
   Tap the **Show Overlay** button in the app.
   The floating mascot bubble will appear on top of other applications.
6. **Interact with Radial Menu**:
   - Tap the mascot bubble: radial menu items (`notes`, `timer`, `settings`, `about`, `quit`) expand.
   - Tap the **About** item: observe native action dispatch in logcat:
     ```bash
     adb logcat -s starter:V Orbitkit:V
     ```
     Expected log output:
     `[starter] Menu action: about`
