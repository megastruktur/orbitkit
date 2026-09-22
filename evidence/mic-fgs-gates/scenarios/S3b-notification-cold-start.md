# Scenario S3b: Cold Mic-FGS Start from Notification Action

- **Scenario Identifier:** `S3b` (RESEARCH.md §3.1 Row 3b)
- **Goal:** Execute cold mic-FGS start from a live notification action PendingIntent while the Activity is backgrounded, testing the candidate exemption for notification interactions under Android 14+ / Android 16 While-In-Use Gate B.
- **Documented Status:** Candidate for allowed (user interaction with notification action `PendingIntent.getForegroundService`).
- **Target Verdict:** FGS starts (allowed candidate exemption) OR reject (`ForegroundServiceStartNotAllowedException`).
- **Grant State:** `RECORD_AUDIO` and `POST_NOTIFICATIONS` granted.
- **While-In-Use Gate B Status:** Candidate exemption under test.

## Contract & Mechanism

1. **Standby Notification:**
   - App posts a standby notification via `OrbitkitRecorderService.postStandbyNotification(context)` on notification channel `orbitkit_recorder`.
   - Notification contains an action button labeled `"START"`.
   - The action is wired to:
     ```kotlin
     val startIntent = Intent(context, OrbitkitRecorderService::class.java).apply {
         action = ACTION_START_FOREGROUND
     }
     val startPendingIntent = PendingIntent.getForegroundService(
         context,
         201,
         startIntent,
         PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
     )
     ```
2. **Cold Trigger:**
   - User backgrounds the application (Activity in `onStop`).
   - User expands the Android system notification shade.
   - User taps the `"START"` action button inside the OrbitKit standby notification.
3. **Evaluation:**
   - Does Android treat direct user interaction with a notification action PendingIntent as an exemption to the while-in-use FGS start restriction?
   - If exempt: `OrbitkitRecorderService` starts successfully in foreground with `FOREGROUND_SERVICE_TYPE_MICROPHONE`.
   - If not exempt: `ForegroundServiceStartNotAllowedException` is thrown and logged.

## Static & Bytecode Verification

- **Standby Notification API:** `OrbitkitRecorderService.postStandbyNotification` implemented and tested (`raw/05-junit-tests.txt`).
- **DEX Symbols:** `postStandbyNotification`, `STANDBY_NOTIFICATION_ID`, `recorderPostStandbyNotification` present in `classes6.dex` (`raw/11-apk-dex-symbols.txt`).

## On-Device Verification Runbook

```bash
# 1. Grant permissions
adb shell pm grant dev.orbitkit.app android.permission.RECORD_AUDIO
adb shell pm grant dev.orbitkit.app android.permission.POST_NOTIFICATIONS

# 2. Launch app and post standby notification
adb shell am start -n dev.orbitkit.app/.MainActivity
# (Tap "S3b: Standby Notif" in app UI)

# 3. Background app completely (Home key)
adb shell input keyevent KEYCODE_HOME
sleep 2

# 4. Verify standby notification is posted
adb shell dumpsys notification --noredact | grep -A 5 "dev.orbitkit.app"

# 5. Open notification shade on device
adb shell cmd statusbar expand-notifications

# 6. Start logcat capture
adb logcat -c
adb logcat -s OrbitkitNative OrbitkitRecorder AndroidRuntime ActivityManager:W &
LOGCAT_PID=$!

# 7. User taps "START" action on notification
# (Or trigger the exact pending intent via adb):
adb shell am start-foreground-service -a dev.orbitkit.native.action.START_FOREGROUND dev.orbitkit.app/dev.orbitkit.native.OrbitkitRecorderService

# 8. Check result in dumpsys
adb shell dumpsys activity services dev.orbitkit.app

# Record outcome:
# Result A: FGS is live (foregroundType=128) -> candidate exemption confirmed!
# Result B: ForegroundServiceStartNotAllowedException -> notification action does NOT exempt mic FGS.
kill $LOGCAT_PID
```
