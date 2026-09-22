# Scenario S1: Start from Visible Activity

- **Scenario Identifier:** `S1` (RESEARCH.md §3.1 Row 1)
- **Goal:** Verify that a microphone Foreground Service (`FOREGROUND_SERVICE_TYPE_MICROPHONE`) can be started while the Activity is visible, posts an ongoing notification to channel `orbitkit_recorder`, and captures raw PCM audio to a growing spool file.
- **Grant State:** `android.permission.RECORD_AUDIO` granted (`adb shell pm grant dev.orbitkit.app android.permission.RECORD_AUDIO`).
- **While-In-Use Gate B Status:** Passed (app is in visible foreground / Top Activity state).

## Contract & Implementation

1. **Trigger:** User taps "S1: Start FGS" in `App.svelte` or Tauri frontend calls `invoke("recorderStartForeground")`.
2. **Permission Check:** `OrbitkitNativePlugin.recorderStartForeground` checks `checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PERMISSION_GRANTED`.
   - If not granted: rejects with typed error `code: "PERMISSION_DENIED"` (no crash).
3. **Service Launch:** Dispatches `Intent(activity, OrbitkitRecorderService::class.java)` with action `ACTION_START_FOREGROUND`.
4. **Foreground Transition:** In `OrbitkitRecorderService.handleStartForeground`:
   - Channel: `orbitkit_recorder` created with `NotificationManager.IMPORTANCE_LOW`.
   - Notification posted with ongoing flag and actions (`PAUSE`, `STOP`).
   - `startForeground(2001, notification, FOREGROUND_SERVICE_TYPE_MICROPHONE)` called.
5. **Audio Spooling:**
   - `AudioRecord` initialized (`SAMPLE_RATE=16000`, `CHANNEL_IN_MONO`, `ENCODING_PCM_16BIT`).
   - Spool file: `/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm`.
   - Background thread `OrbitkitAudioSpooler` continuously reads PCM buffers and writes to spool file.
   - `bytesRecorded` atomic counter increments.

## Static & Bytecode Verification

- **Manifest Declaration:** `<service android:name="dev.orbitkit.native.OrbitkitRecorderService" android:exported="false" android:foregroundServiceType="microphone" />` verified via `aapt dump xmltree` (`raw/10-apk-xmltree-manifest.txt`).
- **DEX Symbols:** `OrbitkitRecorderService`, `recorderStartForeground`, `ACTION_START_FOREGROUND`, `orbitkit_recorder` verified in `classes6.dex` (`raw/11-apk-dex-symbols.txt`).
- **JUnit Test:** `testC2RecorderCommandsPresentAndAnnotated` and `testRecorderServiceHierarchyAndConstants` passed in `OrbitkitNativePluginTest` (`raw/05-junit-tests.txt`).

## On-Device Verification Runbook

```bash
# 1. Grant permissions
adb shell pm grant dev.orbitkit.app android.permission.RECORD_AUDIO
adb shell pm grant dev.orbitkit.app android.permission.POST_NOTIFICATIONS

# 2. Launch App
adb shell am start -n dev.orbitkit.app/.MainActivity

# 3. Tap "S1: Start FGS" in app UI
# Or trigger via adb:
adb shell am start-foreground-service -a dev.orbitkit.native.action.START_FOREGROUND dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService

# 4. Verify FGS state in dumpsys
adb shell dumpsys activity services dev.orbitkit.app

# Expected Observable Output:
# ServiceRecord:
#   intent={act=dev.orbitkit.native.action.START_FOREGROUND cmp=dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService}
#   isForeground=true foregroundId=2001 foregroundType=128 (microphone)

# 5. Verify Audio Spool File Growth
adb shell "ls -l /data/user/0/dev.orbitkit.app/files/recorder_spool.pcm"
sleep 2
adb shell "ls -l /data/user/0/dev.orbitkit.app/files/recorder_spool.pcm"
# Expected: File size grows continuously (~32,000 bytes/sec for 16kHz 16-bit mono PCM).

# 6. Check Logcat
adb logcat -s OrbitkitNative OrbitkitRecorder
# Expected:
# OrbitkitRecorder: handleStartForeground invoked
# OrbitkitRecorder: startForeground succeeded with FOREGROUND_SERVICE_TYPE_MICROPHONE
# OrbitkitRecorder: AudioRecord spooling thread started
```
