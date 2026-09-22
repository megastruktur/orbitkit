# Scenario S3: Cold Mic-FGS Start from Overlay Tap

- **Scenario Identifier:** `S3` (RESEARCH.md §3.1 Row 3)
- **Goal:** Execute cold mic-FGS start from an overlay button tap while the Activity is backgrounded, testing Android 14+ / Android 16 While-In-Use Gate B restrictions.
- **Documented Expectation:** REJECTED (expected `ForegroundServiceStartNotAllowedException` or `SecurityException` per RESEARCH.md §3.1 row 3 [D-по-умолчанию]).
- **Undocumented Finding Candidate:** If it SUCCEEDS on this Android 16 build, that is an undocumented-behavior finding to record with full logcat proof without celebration.
- **Grant State:** `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` granted.
- **While-In-Use Gate B Status:** Under test. The app's Activity is backgrounded; only a `TYPE_APPLICATION_OVERLAY` WindowManager view is active.

## Contract & Mechanism

1. **Cold State:**
   - `OrbitkitRecorderService` is NOT running (`IDLE`/`STOPPED`).
   - `MainActivity` was launched, overlay shown (`overlayShow`), then user navigated to Home screen or switched apps.
   - Activity is stopped/backgrounded.
2. **Cold Start Trigger:**
   - User taps `START` on the floating overlay window.
   - Overlay click listener dispatches:
     ```kotlin
     val intent = Intent(ctx, OrbitkitRecorderService::class.java).apply {
         action = OrbitkitRecorderService.ACTION_START_FOREGROUND
     }
     ctx.startForegroundService(intent)
     ```
3. **System Behavior Under Gate B:**
   - Android checks whether the calling process is in a while-in-use state for microphone foreground services.
   - An overlay window (`TYPE_APPLICATION_OVERLAY`) does NOT provide visible Activity focus.
   - System throws:
     `android.app.ForegroundServiceStartNotAllowedException: Service.startForeground() not allowed due to mAllowStartForeground false: service dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService`
     or `SecurityException`.
4. **Resilience Contract:**
   - Both `OrbitkitNativePlugin` overlay handler and `OrbitkitRecorderService` wrap the start call in try/catch.
   - Exception is logged to logcat with full stack trace:
     `Log.e(TAG, "Overlay START failed: ${e::class.java.simpleName}: ${e.message}", e)`
   - The application does NOT crash.

## Static & Bytecode Verification

- **Overlay START handler:** Implemented in `OrbitkitNativePlugin.kt` lines 472-488 (`Ldev/orbitkit/native/OrbitkitNativePlugin$buildOverlayView$recActions$1;` in `classes6.dex`).
- **Service FGS start:** Implemented in `OrbitkitRecorderService.kt` with explicit `startForeground(2001, notification, FOREGROUND_SERVICE_TYPE_MICROPHONE)`.

## On-Device Verification Runbook

```bash
# 1. Ensure permissions granted
adb shell pm grant dev.orbitkit.app android.permission.RECORD_AUDIO
adb shell pm grant dev.orbitkit.app android.permission.SYSTEM_ALERT_WINDOW

# 2. Launch app and show overlay
adb shell am start -n dev.orbitkit.app/.MainActivity
# (Tap overlayShow in app UI)

# 3. Background app completely
adb shell input keyevent KEYCODE_HOME
sleep 2

# 4. Verify no FGS is currently running
adb shell dumpsys activity services dev.orbitkit.app

# 5. Clear and start logcat monitoring
adb logcat -c
adb logcat -s OrbitkitNative OrbitkitRecorder AndroidRuntime ActivityManager:W &
LOGCAT_PID=$!

# 6. Tap START on the floating overlay window
# Or dispatch cold start intent while backgrounded:
adb shell am start-foreground-service -a dev.orbitkit.native.action.START_FOREGROUND dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService

# 7. Observe outcome:
# EXPECTED REJECT (Android 14+ / 16 Gate B):
# ActivityManager: W ForegroundServiceStartNotAllowedException
# OrbitkitNative: E Overlay START failed: ForegroundServiceStartNotAllowedException
# dumpsys shows service is NOT running in foreground.

# ALTERNATIVE (Undocumented success finding):
# Service starts with isForeground=true. Record full logcat as spike finding.
kill $LOGCAT_PID
```
