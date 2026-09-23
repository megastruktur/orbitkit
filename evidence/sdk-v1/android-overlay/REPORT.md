# Task Report: `oks_android-overlay` (T09) — Remediation Round 2

## Executive Summary & Round 2 Remediation
This report details the implementation, verification, and Round 2 remediation of the Android radial overlay menu for OrbitKit (`tauri-plugin-orbitkit`). All findings from Round 2 review have been resolved:

1. **F1 (MAJOR — Overlay Events Reach WebView `listen()`):**
   - In `crates/tauri-plugin-orbitkit/src/mobile.rs`, `init()` captures the `AppHandle` and registers an event emitter in `jni_bridge::register_event_emitter`.
   - In `crates/tauri-plugin-orbitkit/src/jni_bridge.rs`, on native action dispatch (`process_native_action`), the Rust side emits `orbitkit://menu-action` with `{ "id": action, "source": "overlay" }` via the registered emitter to the global Tauri event bus, in addition to calling `OrbitkitExt` handlers. WebView suspended ⇒ emit is harmlessly handled.
   - Dropped Kotlin `trigger("orbitkit://menu-action", ...)` from `OrbitkitNativePlugin.kt` to prevent double-firing handlers on the webview listener.
   - Added pure function `build_menu_action_payload(id, source)` and pure dispatch unit `emit_overlay_menu_action(id)`.
   - Added 3 Rust unit tests in `jni_bridge.rs` proving payload construction, emitter callback dispatch, and dual dispatch in `process_native_action`.

2. **F2 (MAJOR — Rounding Matches JS `Math.round`):**
   - Replaced `kotlin.math.round` (which uses IEEE half-even / banker's rounding) with `java.lang.Math.round(v * 100.0) / 100.0` (half-up towards $+\infty$ including negatives, matching JavaScript `Math.round`). Preserved `-0.0` normalization.
   - Added tie-vector tests in `RadialLayoutTest.kt`:
     - Positive coordinate tie: `(1, r=0.125, 0, 0)` $\rightarrow$ `x = 0.13`, `y = 0.0`, `angle = 0.0`
     - Positive angle tie: `(1, 100, 10.125, 10.125)` $\rightarrow$ `angle = 10.13`
     - Negative angle tie: `(1, 100, -10.125, -10.125)` $\rightarrow$ `angle = -10.12`
     - Negative coordinate tie: `(1, r=0.125, 180, 180)` $\rightarrow$ `x = -0.12`, `y = 0.0`

3. **F3 (MAJOR — Mutation-Meaningful Action Dispatch Unit & Tests):**
   - Extracted pure dispatch unit `OverlayActionDispatcher.kt` with `handleAction(id, disabled, jniDispatch, recordAction, emitAction)` and `menuActionPayload(id)`.
   - Added 6 unit tests in `OverlayActionDispatcherTest.kt` asserting exact ID JNI dispatch, zero dispatch for disabled items, proper payload shape, and blank ID rejection.
   - In `OrbitkitNativePlugin.kt`, disabled menu items do not receive click listeners (`setOnClickListener(null)`), and `handleAction` guards with `disabled` check.
   - Proved test sensitivity via two deliberate mutations:
     - Mutant 1 (commented out JNI dispatch call): failed `testHandleActionCallsJniDispatchOnceWithExactId` (`raw/mutation-dispatch-commented-out.txt`, `EXIT_CODE=1`).
     - Mutant 2 (constant action ID): failed `testHandleActionCallsJniDispatchOnceWithExactId` (`raw/mutation-constant-id.txt`, `EXIT_CODE=1`).

4. **F4 (Minor — Configuration Validation for Items and Trigger):**
   - In `MenuConfigParser.kt`: validated `items.length()` is within `1..12` (`count < 1 || count > 12` throws `IllegalArgumentException`); validated `trigger` is in `{"click", "hover"}` (invalid trigger throws `IllegalArgumentException`).
   - In `OrbitkitNativePlugin.kt`: rejected null/empty or invalid raw arguments with code `INVALID_CONFIG`.
   - In `mobile.rs`: added validation ensuring `menu.items` has 1..12 items, returning `Error::invalid_config` otherwise.
   - Added unit tests in `MenuConfigParserTest.kt` (`testParseZeroItemsThrowsException`, `testParseInvalidTriggerThrowsException`, `testParseValidTriggersAccepted`).

5. **F5 (Minor — Exact Reproducible Device Runbook):**
   - Added exact Chrome remote inspection console snippet and `adb shell input tap X Y` formula derived from display density (`dp * (density / 160)`).

6. **F6 (Minor — UX Window Resize on Collapse & StatusView Removal):**
   - In `OrbitkitNativePlugin.kt`, the `WindowManager` layout parameters resize to `mascotSizePx` ($\sim 56\text{dp}$) when collapsed and expand to `containerSize` ($\sim 312\text{dp}$) when expanded via `wm.updateViewLayout(container, params)`.
   - Mascot bubble center is anchored across toggles and drags (`bubbleCenterX`, `bubbleCenterY`).
   - Touches outside the collapsed $56\text{dp}$ bubble pass directly to underlying applications.
   - Removed all dead `statusView` code.

---

## Acceptance Criteria Verification Matrix

| # | Scenario | Command | Expected | Observed | Exit Code | Raw Log |
|---|---|---|---|---|---|---|
| 1 | JUnit Tests (Plugin) | `./gradlew :tauri-plugin-orbitkit:testDebugUnitTest --rerun-tasks` | All green (RadialLayout $\ge 6$, MenuConfig $\ge 4$, ActionDispatcher, JNI) | pass (37/37 tests pass: 11 RadialLayout, 10 MenuConfigParser, 6 OverlayActionDispatcher, 10 OrbitkitNativePlugin) | 0 | `evidence/sdk-v1/android-overlay/raw/03-gradle-unit-tests-plugin.txt` |
| 1b | JUnit Tests (Starter) | `./gradlew :app:testUniversalDebugUnitTest --rerun-tasks` | All green | pass (14/14 tests pass in OrbitkitSurvivalJniTest) | 0 | `evidence/sdk-v1/android-overlay/raw/04-gradle-unit-tests-starter.txt` |
| 2a | Rust Android Check | `cargo check --target aarch64-linux-android -p tauri-plugin-orbitkit` | pass | pass (compiled cleanly for aarch64-linux-android in 0.12s) | 0 | `evidence/sdk-v1/android-overlay/raw/01-cargo-check-android.txt` |
| 2b | Rust Docker Desktop Tests | `docker run ... cargo test -p tauri-plugin-orbitkit` | pass | pass (11/11 tests pass including all F1 event tests) | 0 | `evidence/sdk-v1/android-overlay/raw/02-docker-cargo-test.txt` |
| 2c | Android APK Build | `pnpm --filter starter tauri android build --debug --target aarch64 --apk` | APK built | APK built at `examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` | 0 | `evidence/sdk-v1/android-overlay/raw/05-starter-apk-build.txt` |
| 2d | Native & Dex Symbols | `llvm-nm` on `liborbitkit_lib.so` & `dexdump` on APK | symbols present | JNI export `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction` exported in .so; `OverlayActionDispatcher`, `RadialLayout`, `MenuConfigParser` present in DEX | 0 | `evidence/sdk-v1/android-overlay/raw/06-symbols-check.txt` |
| 3 | Merged Starter Manifest | Inspect merged manifest | SAW + starter perms explained | K5 compliant: plugin contributes `SYSTEM_ALERT_WINDOW` only; starter app retains audio/service perms until T10 | 0 | `evidence/sdk-v1/android-overlay/raw/07-merged-manifest.txt` |
| 4 | Device / Probe | `adb devices -l` | attached or DEFERRED | 0 devices attached; comprehensive runbook provided below | 0 | `evidence/sdk-v1/android-overlay/raw/08-adb-devices.txt` |

---

## Merged Starter Manifest Analysis (AC 3)

The merged manifest at `examples/starter/src-tauri/gen/android/app/build/intermediates/merged_manifests/universalDebug/processUniversalDebugManifest/AndroidManifest.xml` was inspected:

### Permissions Present:
1. `android.permission.SYSTEM_ALERT_WINDOW`:
   - **Source:** `crates/tauri-plugin-orbitkit/android/src/main/AndroidManifest.xml` (K5 core plugin manifest).
   - **Reason:** Required by Android framework to draw floating overlays over other apps using `TYPE_APPLICATION_OVERLAY`.
2. `android.permission.INTERNET`:
   - **Source:** Tauri core Android base manifest (`examples/starter/src-tauri/gen/android/app/src/main/AndroidManifest.xml`).
   - **Reason:** Standard permission required by Tauri WebView to load application assets and communicate via localhost IPC.
3. `android.permission.RECORD_AUDIO`:
   - **Source:** Starter application manifest (`examples/starter/src-tauri/gen/android/app/src/main/AndroidManifest.xml`).
   - **Reason:** Existing audio recorder example feature in `examples/starter`. Note: Per task brief, recorder lives in starter until T10 (`oks-recorder-ext`). The plugin itself requests SAW only (K5 compliance).
4. `android.permission.FOREGROUND_SERVICE` & `android.permission.FOREGROUND_SERVICE_MICROPHONE`:
   - **Source:** Starter application manifest.
   - **Reason:** Required for background audio recording service (`OrbitkitRecorderService`) in the starter example prior to T10 extraction.
5. `android.permission.POST_NOTIFICATIONS`:
   - **Source:** Starter application manifest.
   - **Reason:** Required for ongoing recorder notifications on Android 13+ (API level 33+).

---

## Symbol Verification (AC 2)

### Native Shared Library (`liborbitkit_lib.so`):
Inspected using `$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-nm -D target/aarch64-linux-android/debug/liborbitkit_lib.so`:
- `0000000000613484 T Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction`
- `000000000061323c T Java_dev_orbitkit_native_OrbitkitJniBridge_00024Companion_onNativeAction`
- `0000000000613270 T Java_dev_orbitkit_native_OrbitkitJniBridge_getActionCount`
- `00000000006132e4 T Java_dev_orbitkit_native_OrbitkitJniBridge_getActionLogJson`

### APK DEX Classes:
Inspected using `$ANDROID_HOME/build-tools/35.0.0/dexdump` on `app-universal-debug.apk`:
- `Ldev/orbitkit/native/OverlayActionDispatcher;`
- `Ldev/orbitkit/native/RadialLayout;`
- `Ldev/orbitkit/native/ItemPosition;`
- `Ldev/orbitkit/native/MenuConfigParser;`
- `Ldev/orbitkit/native/NativeMenuConfig;`
- `Ldev/orbitkit/native/NativeMenuItem;`
- `Ldev/orbitkit/native/NativeMascotArgs;`
- `Ldev/orbitkit/native/OverlayConfig;`
- `Ldev/orbitkit/native/OrbitkitNativePlugin;`
- `Ldev/orbitkit/native/OrbitkitJniBridge;`

---

## Mutation Testing Proofs (F3)

To ensure the test suite is strictly mutation-meaningful and cannot pass if features are broken or deleted:

1. **Mutant 1: Commented out JNI Dispatch Call (`raw/mutation-dispatch-commented-out.txt`):**
   - **Mutation:** In `OverlayActionDispatcher.kt`, commented out `jniDispatch(trimmedId)`.
   - **Observed:** `./gradlew :tauri-plugin-orbitkit:testDebugUnitTest --rerun-tasks` failed:
     ```
     OverlayActionDispatcherTest > testHandleActionCallsJniDispatchOnceWithExactId FAILED
         java.lang.AssertionError at OverlayActionDispatcherTest.kt:41
     37 tests completed, 2 failed
     BUILD FAILED in 2s
     EXIT_CODE=1
     ```
   - **Reverted:** Restored `jniDispatch(trimmedId)`; suite returned to 37/37 passing.

2. **Mutant 2: Hardcoded Constant Action ID (`raw/mutation-constant-id.txt`):**
   - **Mutation:** In `OverlayActionDispatcher.kt`, changed `jniDispatch(trimmedId)` to `jniDispatch("constant_id")`.
   - **Observed:** `./gradlew :tauri-plugin-orbitkit:testDebugUnitTest --rerun-tasks` failed:
     ```
     OverlayActionDispatcherTest > testHandleActionCallsJniDispatchOnceWithExactId FAILED
         org.junit.ComparisonFailure: JNI dispatch must receive exact action id expected:<[custom_action_id]> but was:<[constant_id]>
     37 tests completed, 1 failed
     BUILD FAILED in 2s
     EXIT_CODE=1
     ```
   - **Reverted:** Restored `trimmedId`; suite returned to 37/37 passing.

3. **Mutant 3: RadialLayout Rounding Disabled (`raw/mutation-radial-layout-failure.txt`):**
   - **Mutation:** Modified `round2(v: Double)` to return `0.0`.
   - **Result:** Failed 9 tests in `RadialLayoutTest` (`EXIT_CODE=1`). Reverted.

4. **Mutant 4: MenuConfigParser ID Validation Bypassed (`raw/mutation-menu-config-failure.txt`):**
   - **Mutation:** Modified `NativeMenuConfig.isValidId(id)` to return `true`.
   - **Result:** Failed `testParseInvalidIdThrowsException` (`EXIT_CODE=1`). Reverted.

---

## Exact Device Runbook (F5)

When an Android device (e.g. Samsung Galaxy Z Flip 7) is connected via ADB:

### 1. Verify Device Connection & Query Density
```bash
adb devices -l
# Check display density to determine scale factor
adb shell wm density
```
*Formula:* $\text{scale} = \frac{\text{density}}{160}$.
- For 420 dpi (default on Galaxy Z Flip series): $\text{scale} = \frac{420}{160} = 2.625$.
- For 480 dpi: $\text{scale} = \frac{480}{160} = 3.0$.

### 2. Install Universal Debug APK & Grant SAW Permission
```bash
adb install -r examples/starter/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
adb shell appops set dev.orbitkit.app SYSTEM_ALERT_WINDOW allow
adb shell am start -n dev.orbitkit.app/dev.orbitkit.app.MainActivity
```

### 3. Trigger 5-Item Radial Overlay via Remote Webview Console
Navigate to `chrome://inspect` in desktop Chrome, click "inspect" on `dev.orbitkit.app`, and execute:
```javascript
window.__TAURI_INTERNALS__.invoke('plugin:orbitkit|show_overlay', {
  menu: {
    items: [
      { id: "act_one", label: "One", icon: "1️⃣" },
      { id: "act_two", label: "Two", icon: "2️⃣" },
      { id: "act_three", label: "Three", icon: "3️⃣" },
      { id: "act_four", label: "Four", icon: "4️⃣" },
      { id: "act_five", label: "Five", icon: "5️⃣", disabled: true }
    ],
    radius: 96.0,
    startAngle: -90.0,
    endAngle: 270.0,
    itemSize: 44.0,
    trigger: "click"
  }
});
```

### 4. Computed Coordinates for Item 1 Tap via ADB
- Overlay origin: $X = 24\text{dp}$, $Y = 80\text{dp}$.
- Radius = $96\text{dp}$, item size = $44\text{dp}$, padding = $16\text{dp}$.
- Extent half-width: $\text{halfExtent} = 96 + 44 + 16 = 156\text{dp}$.
- Mascot bubble center:
  $$X_{\text{bubble}} = 24 + 156 = 180\text{dp}$$
  $$Y_{\text{bubble}} = 80 + 156 = 236\text{dp}$$
- Item 1 position (at $\text{startAngle} = -90^\circ$, 12 o'clock / top):
  $$X_{\text{item1}} = 180\text{dp}$$
  $$Y_{\text{item1}} = 236\text{dp} - 96\text{dp} = 140\text{dp}$$

#### Screen Pixel Calculation:
$$\text{Pixel } X = \text{round}\left(180 \times \frac{\text{density}}{160}\right)$$
$$\text{Pixel } Y = \text{round}\left(140 \times \frac{\text{density}}{160}\right)$$

- At **420 dpi**: $X = \text{round}(180 \times 2.625) = 473\text{px}$, $Y = \text{round}(140 \times 2.625) = 368\text{px}$.
  ```bash
  adb shell input tap 473 368
  ```
- At **480 dpi**: $X = \text{round}(180 \times 3.0) = 540\text{px}$, $Y = \text{round}(140 \times 3.0) = 420\text{px}$.
  ```bash
  adb shell input tap 540 420
  ```

### 5. Verify Background JNI Action & Tauri Event Delivery
1. Send app to background:
   ```bash
   adb shell input keyevent KEYCODE_HOME
   ```
2. Tap Item 1 using the computed coordinates above:
   ```bash
   adb shell input tap 473 368
   ```
3. Inspect logcat for JNI receipt:
   ```bash
   adb logcat -d -s OrbitkitJni OrbitkitNative | grep RUST-JNI-RECEIPT
   ```
   *Expected output:*
   `[RUST-JNI-RECEIPT] receiptId=1 action="act_one" timestamp=... webviewSuspended=true (Direct native dispatch, no WebView JS)`
4. When WebView is resumed, `@tauri-apps/api/event listen("orbitkit://menu-action")` receives:
   `{ "id": "act_one", "source": "overlay" }` (emitted directly from Rust `emit_overlay_menu_action`).

### 6. Verify Bubble Collapse & Touch Pass-Through (F6)
- Tap the center mascot bubble:
  $$\text{Pixel } X = \text{round}\left(180 \times \frac{\text{density}}{160}\right)$$
  $$\text{Pixel } Y = \text{round}\left(236 \times \frac{\text{density}}{160}\right)$$
  (At 420 dpi: `adb shell input tap 473 620`).
- The window shrinks to $56\text{dp} \times 56\text{dp}$.
- Tap anywhere around the bubble (e.g. at $(473, 368)$): touch passes cleanly through to the underlying app without interception.
- Tap the bubble again: overlay window expands back to full $312\text{dp}$ ring with bubble anchored at exact original position.

---

## Out-of-Scope Findings & Deviations
- None. All edits strictly confined to allowlisted paths:
  - `crates/tauri-plugin-orbitkit/android/**`
  - `crates/tauri-plugin-orbitkit/src/{mobile.rs,jni_bridge.rs}`
  - `evidence/sdk-v1/android-overlay/**`

## Contract Questions
- None.

---

READY FOR REVIEW at 7e459fe19f1172d8442adb83b59d7ff7ae9aaeeb
