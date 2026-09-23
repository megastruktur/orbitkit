# OrbitKit Starter Example

A minimal, compilable, and runnable consumer application showcasing `@orbitkit/ui` and `tauri-plugin-orbitkit` across desktop (Linux/macOS/Windows) and Android platforms.

## Architecture

- **Configuration (`src/orbitkit.config.json` & `src/orbitkit.config.ts`)**:
  Single source of truth configuration defining the floating mascot (SVG with `idle` and `busy` states), 5 radial menu actions (`notes`, `timer`, `settings`, `about`, `quit`), popups (`notes`: 320x420, `settings`: 360x300), and window styling defaults (`transparent: true`, `alwaysOnTop: true`, `decorations: false`).
- **Routing (`src/main.ts`)**:
  Inspects URL parameters on window startup:
  - `?orbitkit=mascot` → `MascotView.svelte` (floating mascot + radial menu; click mascot toggles menu; selecting item emits `emitMenuAction(id)`).
  - `?popup=notes` → `NotesPopup.svelte` (quick notes textarea persisted to `localStorage`).
  - `?popup=settings` → `SettingsPopup.svelte` (controls mascot animation state via `setMascotState`).
  - Default (no query params) → `MainView.svelte` (main dashboard to show/hide overlay, inspect Android permission, and view `onMenuAction` event log).
- **Backend (`src-tauri/src/lib.rs`)**:
  Initializes `tauri_plugin_orbitkit::init(config)` with parsed `orbitkit.config.json`. Handles native menu events via `OrbitkitExt::on_menu_action`:
  - `about` → logs action.
  - `quit` → exits process (`app.exit(0)`).
  - `notes` / `settings` → opens popup window (`open_popup(id)`).
  - `timer` → sets mascot state to `busy` for 5s then reverts to `idle`.

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
