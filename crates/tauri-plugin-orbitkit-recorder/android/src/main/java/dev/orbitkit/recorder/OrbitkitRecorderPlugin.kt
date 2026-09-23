package dev.orbitkit.recorder

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import dev.orbitkit.native.OrbitkitRecorderService
import dev.orbitkit.native.OrbitkitStatePersistence

@TauriPlugin
class OrbitkitRecorderPlugin(private val activity: Activity) : Plugin(activity) {
    private val TAG = "OrbitkitRecorderPlugin"

    @Command
    fun startForeground(invoke: Invoke) {
        Log.i(TAG, "startForeground called")
        val hasPermission = activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!hasPermission) {
            Log.w(TAG, "startForeground rejected: RECORD_AUDIO permission not granted")
            val errData = JSObject().apply {
                put("error", "PERMISSION_DENIED")
                put("message", "RECORD_AUDIO permission not granted")
                put("permission", "android.permission.RECORD_AUDIO")
            }
            invoke.reject("RECORD_AUDIO permission not granted", "PERMISSION_DENIED", null, errData)
            return
        }

        try {
            val intent = Intent(activity, OrbitkitRecorderService::class.java).apply {
                action = OrbitkitRecorderService.ACTION_START_FOREGROUND
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent)
            } else {
                activity.startService(intent)
            }
            Log.i(TAG, "startForegroundService dispatched from Activity")
            val spoolPath = try {
                OrbitkitRecorderService.getSpoolFile(activity).absolutePath
            } catch (_: Throwable) {
                ""
            }
            val res = JSObject().apply {
                put("state", "STARTING")
                put("spoolPath", spoolPath)
                put("channel", OrbitkitRecorderService.CHANNEL_ID)
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recorder foreground service", e)
            invoke.reject("Failed to start recorder: ${e.message}", "START_FAILED", e, null)
        }
    }

    @Command
    fun pause(invoke: Invoke) {
        Log.i(TAG, "pause called")
        try {
            val intent = Intent(activity, OrbitkitRecorderService::class.java).apply {
                action = OrbitkitRecorderService.ACTION_PAUSE
            }
            activity.startService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to pause recorder", e)
            invoke.reject("Failed to pause recorder: ${e.message}", "PAUSE_FAILED", e, null)
        }
    }

    @Command
    fun resume(invoke: Invoke) {
        Log.i(TAG, "resume called")
        try {
            val intent = Intent(activity, OrbitkitRecorderService::class.java).apply {
                action = OrbitkitRecorderService.ACTION_RESUME
            }
            activity.startService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to resume recorder", e)
            invoke.reject("Failed to resume recorder: ${e.message}", "RESUME_FAILED", e, null)
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        Log.i(TAG, "stop called")
        try {
            val intent = Intent(activity, OrbitkitRecorderService::class.java).apply {
                action = OrbitkitRecorderService.ACTION_STOP
            }
            activity.startService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recorder", e)
            invoke.reject("Failed to stop recorder: ${e.message}", "STOP_FAILED", e, null)
        }
    }

    @Command
    fun state(invoke: Invoke) {
        Log.i(TAG, "state called")
        try {
            val state = OrbitkitRecorderService.stateRef.get().name
            val spool = OrbitkitRecorderService.getSpoolFile(activity)
            val spoolPath = spool.absolutePath
            val isFg = OrbitkitRecorderService.isForegroundActive.get()
            val bytes = if (isFg) OrbitkitRecorderService.bytesRecorded.get() else if (spool.exists()) spool.length() else 0L

            val res = JSObject().apply {
                put("state", state)
                put("spoolPath", spoolPath)
                put("bytesRecorded", bytes)
                put("isForeground", isFg)
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read recorder state", e)
            invoke.reject("Failed to get recorder state: ${e.message}", "STATE_FAILED", e, null)
        }
    }

    @Command
    fun postStandbyNotification(invoke: Invoke) {
        Log.i(TAG, "postStandbyNotification called")
        try {
            OrbitkitRecorderService.postStandbyNotification(activity)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to post standby notification", e)
            invoke.reject("Failed to post standby notification: ${e.message}", "STANDBY_FAILED", e, null)
        }
    }

    @Command
    fun getPersistedState(invoke: Invoke) {
        try {
            val jsonStr = OrbitkitStatePersistence.getStateJson(activity)
            val stateObj = OrbitkitStatePersistence.getCurrentState()

            val res = JSObject().apply {
                put("state", stateObj.state)
                put("bytesRecorded", stateObj.bytesRecorded)
                put("spoolPath", stateObj.spoolPath)
                put("updatedAt", stateObj.updatedAt)
                put("lastAction", stateObj.lastAction)
                put("recoveryCount", stateObj.recoveryCount)
                put("lastRecoveredAt", stateObj.lastRecoveredAt)
                put("isForeground", stateObj.isForeground)
                put("processPid", stateObj.processPid)
                put("rawJson", jsonStr)
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read persisted state", e)
            invoke.reject("Failed to read persisted state: ${e.message}", "GET_STATE_FAILED", e, null)
        }
    }

    @Command
    fun recoverState(invoke: Invoke) {
        try {
            val recovered = OrbitkitStatePersistence.recoverState(activity)
            val res = JSObject().apply {
                put("state", recovered.state)
                put("bytesRecorded", recovered.bytesRecorded)
                put("spoolPath", recovered.spoolPath)
                put("recoveryCount", recovered.recoveryCount)
                put("lastRecoveredAt", recovered.lastRecoveredAt)
                put("processPid", recovered.processPid)
                put("lastAction", recovered.lastAction)
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to recover state", e)
            invoke.reject("Failed to recover state: ${e.message}", "RECOVERY_FAILED", e, null)
        }
    }
}
