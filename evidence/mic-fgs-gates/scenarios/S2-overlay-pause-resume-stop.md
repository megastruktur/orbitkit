# Scenario S2: Pause/Resume/Stop from Overlay on Running FGS

- **Scenario Identifier:** `S2` (RESEARCH.md §3.1 Row 2)
- **Goal:** With the microphone FGS already running in the foreground (started in S1) and the Activity backgrounded (user pressed HOME or opened a foreign app), verify that overlay button taps (`PAUSE`, `RESUME`, `STOP`) transition the service state without stopping or restarting the FGS. Specifically, PAUSE must be internal at the `AudioRecord` level with NO `stopForeground` churn (RESEARCH §3 NB).
- **Grant State:** `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` granted.
- **While-In-Use Gate B Status:** Passed / Exempt (FGS was already established from visible foreground; service lifecycle is maintained).

## Contract & Implementation

1. **Setup:**
   - App is launched; user starts FGS (S1); user shows overlay (`overlayShow`).
   - User navigates to Home screen or another app (Activity enters `onStop`/backgrounded).
   - Overlay remains floating (`TYPE_APPLICATION_OVERLAY`).
2. **Pause Transition:**
   - User taps `PAUSE` button on the overlay.
   - Click listener in overlay dispatches `Intent(ctx, OrbitkitRecorderService::class.java).apply { action = ACTION_PAUSE }`.
   - `OrbitkitRecorderService.handlePause()` is executed:
     - `isPaused.set(true)`
     - `audioRecord?.stop()` called internally to halt microphone sampling.
     - Spool writing paused; FGS remains live (`startForeground` is NOT canceled).
     - Notification updated to "PAUSED" with "RESUME" and "STOP" action buttons.
     - Logcat: `Log.i(TAG, "OrbitkitRecorderService paused internally. AudioRecord stopped, FGS active without churn. Bytes so far: ...")`.
3. **Resume Transition:**
   - User taps `RESUME` button on the overlay.
   - Dispatches `ACTION_RESUME`.
   - `OrbitkitRecorderService.handleResume()` is executed:
     - `audioRecord?.startRecording()` called.
     - `isPaused.set(false)`
     - Spool writing resumes, appending to the same spool file.
     - Notification updated to "RECORDING" with "PAUSE" and "STOP" action buttons.
     - Logcat: `Log.i(TAG, "OrbitkitRecorderService resumed. AudioRecord restarted, FGS active. Current bytes: ...")`.
4. **Stop Transition:**
   - User taps `STOP` button on the overlay.
   - Dispatches `ACTION_STOP`.
   - `OrbitkitRecorderService.handleStop()` is executed:
     - `isRecordingRunning.set(false)`, audioRecord released, fileOutputStream flushed & closed.
     - `stopForeground(STOP_FOREGROUND_REMOVE)` called.
     - `stopSelf()` called.
     - Logcat: `Log.i(TAG, "OrbitkitRecorderService stopped cleanly. Final bytes: ..., spool: ...")`.

## Static & Bytecode Verification

- **Action Constants:** `ACTION_PAUSE`, `ACTION_RESUME`, `ACTION_STOP` present in `OrbitkitRecorderService` (`raw/11-apk-dex-symbols.txt`).
- **Overlay Actions:** `buildOverlayView` includes `START`, `PAUSE`, `RESUME`, `STOP` actions wired directly to service intents and `handleAction` channel emission (`raw/11-apk-dex-symbols.txt`).
- **State Machine:** `OrbitkitRecorderService.State` (`IDLE`, `RECORDING`, `PAUSED`, `STOPPED`) verified in unit tests (`raw/05-junit-tests.txt`).

## On-Device Verification Runbook

```bash
# 1. Start FGS and show overlay
adb shell am start -n dev.orbitkit.app/.MainActivity
# (Tap S1: Start FGS and overlayShow in app)

# 2. Background the activity (press Home key)
adb shell input keyevent KEYCODE_HOME

# 3. Confirm FGS is active in background
adb shell dumpsys activity services dev.orbitkit.app | grep -E "isForeground|foregroundType"

# 4. Tap PAUSE on overlay (or via adb intent dispatch):
adb shell am start-service -a dev.orbitkit.native.action.PAUSE dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService

# Verify pause: spool file size stops increasing
adb shell "ls -l /data/user/0/dev.orbitkit.app/files/recorder_spool.pcm"
sleep 2
adb shell "ls -l /data/user/0/dev.orbitkit.app/files/recorder_spool.pcm"

# 5. Tap RESUME on overlay:
adb shell am start-service -a dev.orbitkit.native.action.RESUME dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService

# Verify resume: spool file size resumes increasing
adb shell "ls -l /data/user/0/dev.orbitkit.app/files/recorder_spool.pcm"
sleep 2
adb shell "ls -l /data/user/0/dev.orbitkit.app/files/recorder_spool.pcm"

# 6. Tap STOP on overlay:
adb shell am start-service -a dev.orbitkit.native.action.STOP dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService

# Verify stop: service is destroyed and removed from foreground
adb shell dumpsys activity services dev.orbitkit.app
# Expected: (no active foreground services for dev.orbitkit.app)
```
