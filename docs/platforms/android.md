# Android Platform Guide

OrbitKit provides a native system overlay on Android using `android.permission.SYSTEM_ALERT_WINDOW`. This allows the interactive mascot and radial action menu to float above other applications and dispatch actions directly into the Rust backend.

---

## 1. Overview & Architecture

On Android, OrbitKit renders a native Android view hierarchy attached directly to `WindowManager` (`TYPE_APPLICATION_OVERLAY`), rather than hosting a transparent webview.

```
+--------------------------------------------------------------+
|                     Android System Display                   |
|                                                              |
|   +------------------------------------------------------+   |
|   | Other Apps / Home Launcher                           |   |
|   |                                                      |   |
|   |        [ Mascot Bubble (WindowManager) ]             |   |
|   |                  /     |     \                       |   |
|   |          (Notes)    (Timer)   (Settings)             |   |
|   +------------------------------------------------------+   |
+--------------------------------------------------------------+
                               |
                        (Touch Event)
                               v
            +------------------------------------+
            | Kotlin: OrbitkitNativePlugin       |
            +------------------------------------+
                               |
                    (Direct JNI Invocation)
                               v
            +------------------------------------+
            | Rust: OrbitkitJniBridge            |
            | - onNativeAction(id)               |
            | - Invokes on_menu_action handlers  |
            +------------------------------------+
                               |
             (If WebView active)
                               v
            +------------------------------------+
            | Event: orbitkit://menu-action      |
            +------------------------------------+
```

---

## 2. Permissions & Manifest

### Core Plugin Permission

The core plugin (`tauri-plugin-orbitkit`) declares strictly one permission in its Android manifest:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
</manifest>
```

Core OrbitKit does **not** request microphone, camera, or foreground service permissions. Modular extensions (such as `tauri-plugin-orbitkit-recorder`) declare their own permissions independently.

### Runtime Permission Flow (SAW)

On Android 6.0+ (API 23+), `SYSTEM_ALERT_WINDOW` is a special permission requiring explicit user approval in system settings:

```ts
import { overlayPermission, requestOverlayPermission, showOverlay } from "@orbitkit/ui";
import config from "./orbitkit.config";

async function openMascotOverlay() {
  const granted = await overlayPermission();
  if (!granted) {
    // Directs user to Android "Display over other apps" settings screen
    await requestOverlayPermission();
    return;
  }

  await showOverlay({ menu: config.menu });
}
```

- `overlayPermission()`: Evaluates `Settings.canDrawOverlays(context)`.
- `requestOverlayPermission()`: Launches `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` with the app package URI.

---

## 3. Overlay Lifecycle & Interaction

1. **Displaying the Overlay**:
   When `showOverlay` is invoked, `OrbitkitNativePlugin` inflates a floating bubble view positioned in `WindowManager`.
2. **Dragging & Positioning**:
   The user can drag the mascot bubble freely across the screen. Touch gestures distinguish between dragging (updating window layout parameters) and clicking (toggling radial menu).
3. **Radial Menu**:
   Tapping the mascot expands a radial arc of native buttons matching `config.menu.items`.
4. **State Synchronization**:
   Calling `setMascotState(state)` updates both the native overlay view (applying state-based tints and indicator badges) and webview listeners.
5. **Dismissal**:
   `hideOverlay()` removes the view from `WindowManager`.

---

## 4. Direct JNI Bridge

A critical requirement on mobile is ensuring user interactions survive when the main application is backgrounded or minimized.

When an Android activity moves to the background:
- Android battery optimizations may throttle, suspend, or terminate the Chromium WebView runtime.
- If menu actions relied solely on webview IPC (`window.__TAURI_INTERNALS__`), user taps on the floating overlay would be lost or delayed.

### The JNI Path

OrbitKit solves this via a direct JNI bridge (`OrbitkitJniBridge`):
1. The overlay touch listener detects a button click.
2. Kotlin invokes `OrbitkitJniBridge.onNativeAction(id)`.
3. JNI dispatches to Rust: `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction`.
4. Rust executes all registered application handlers (`OrbitkitExt::on_menu_action`) immediately in native code.
5. Rust logs the event in an atomic action receipt buffer (`get_jni_action_log`).
6. If the Tauri WebView is alive, Rust concurrently emits `orbitkit://menu-action` to frontend listeners.

---

## 5. While-In-Use Gate B Limitation

> **Contract Notice**: **"overlay cannot cold-start mic FGS"**

Under Android 14+ (API 34) and Android 16, Google introduced strict "While-In-Use" background execution restrictions (referred to as **Gate B**) on microphone foreground services (`FOREGROUND_SERVICE_TYPE_MICROPHONE`).

### The Technical Limitation
- Android requires the application process to be in a visible foreground state (having a visible `TopActivity`) to start a microphone foreground service.
- A system overlay window (`TYPE_APPLICATION_OVERLAY`) **does not** constitute visible Activity focus or Top Activity state.
- If an overlay button attempts to cold-start a microphone foreground service while the main Activity is backgrounded, Android throws `ForegroundServiceStartNotAllowedException` / `SecurityException`.

### Supported Flow
1. **Activity-Driven Start**: The microphone foreground service must be initiated while the app's Activity is visibly displayed to the user.
2. **Overlay Control**: Once the foreground service is active, the overlay can pause, resume, and stop the service without restriction.
3. **Standby Notification Alternative**: In extension scenarios, cold-starting via an ongoing standby notification action (`PendingIntent.getForegroundService`) can be used as an authorized candidate exemption.

---

## 6. Platform Support & Device Testing Status

| Capability | Status | Evidence & Verification |
|---|---|---|
| `SYSTEM_ALERT_WINDOW` Overlay | Supported | Verified via `OrbitkitNativePluginTest` JUnit suite |
| Touch Drag & Radial Expansion | Supported | Verified via native touch simulation |
| Direct JNI Dispatch | Supported | Verified via `OrbitkitSurvivalJniTest` |
| Multi-Window Popups (`open_popup`) | Unsupported | Explicitly returns `ErrorCode::Unsupported` |
| On-Device Physical Execution | **DEFERRED** | No physical device was connected during campaign CI; runbooks prepared and verified via automated test suites |

---

## 7. Build Commands

To build the Android APK or run unit tests from the workspace:

```bash
# Build debug APK for arm64
pnpm --filter starter tauri android build --debug --target aarch64 --apk

# Run Android unit tests (the plugin library modules are included in the starter's Gradle project)
cd examples/starter/src-tauri/gen/android
./gradlew :tauri-plugin-orbitkit:testDebugUnitTest   # core native plugin
./gradlew :app:testUniversalDebugUnitTest            # starter app (JNI survival tests)
./gradlew test                                       # everything, as CI runs it
```
