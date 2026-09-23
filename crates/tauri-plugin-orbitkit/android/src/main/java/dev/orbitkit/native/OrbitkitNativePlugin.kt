package dev.orbitkit.native

import android.Manifest
import android.content.pm.PackageManager
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

@InvokeArg
class OverlayShowArgs {
    var channel: Channel? = null
}

@TauriPlugin
class OrbitkitNativePlugin(private val activity: Activity) : Plugin(activity) {

    private val TAG = "OrbitkitNative"
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var actionChannel: Channel? = null
    private var statusView: TextView? = null

    companion object {
        const val RECORDER_SERVICE_CLASS = "dev.orbitkit.native.OrbitkitRecorderService"
        const val PERSISTENCE_CLASS = "dev.orbitkit.native.OrbitkitStatePersistence"

        const val ACTION_START_FOREGROUND = "dev.orbitkit.native.action.START_FOREGROUND"
        const val ACTION_PAUSE = "dev.orbitkit.native.action.PAUSE"
        const val ACTION_RESUME = "dev.orbitkit.native.action.RESUME"
        const val ACTION_STOP = "dev.orbitkit.native.action.STOP"
        const val ACTION_POST_STANDBY = "dev.orbitkit.native.action.POST_STANDBY"
    }

    @Command
    fun isOverlayPermissionGranted(invoke: Invoke) {
        val granted = Settings.canDrawOverlays(activity)
        Log.i(TAG, "isOverlayPermissionGranted -> $granted")
        invoke.resolveObject(granted)
    }

    @Command
    fun requestOverlayPermission(invoke: Invoke) {
        Log.i(TAG, "requestOverlayPermission called")
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${activity.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to launch package-specific overlay settings, using fallback", e)
            try {
                val fallback = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(fallback)
                invoke.resolve()
            } catch (ex: Exception) {
                Log.e(TAG, "Failed to open overlay settings", ex)
                invoke.reject("Failed to open overlay settings: ${ex.message}", "SETTINGS_FAILED", ex, null)
            }
        }
    }

    @Command
    fun overlayShow(invoke: Invoke) {
        Log.i(TAG, "overlayShow called")

        if (!Settings.canDrawOverlays(activity)) {
            Log.w(TAG, "overlayShow rejected: SYSTEM_ALERT_WINDOW permission not granted")
            val errData = JSObject().apply {
                put("error", "PERMISSION_DENIED")
                put("message", "SYSTEM_ALERT_WINDOW permission not granted")
            }
            invoke.reject("SYSTEM_ALERT_WINDOW permission not granted", "PERMISSION_DENIED", null, errData)
            return
        }

        try {
            val args = invoke.parseArgs(OverlayShowArgs::class.java)
            if (args.channel != null) {
                actionChannel = args.channel
                Log.i(TAG, "actionChannel registered from overlayShow args")
            }
        } catch (e: Exception) {
            Log.d(TAG, "No channel argument in overlayShow args: ${e.message}")
        }

        activity.runOnUiThread {
            try {
                if (overlayView != null) {
                    Log.i(TAG, "overlayView already visible, keeping current view")
                    invoke.resolve()
                    return@runOnUiThread
                }

                val wm = activity.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                windowManager = wm

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.START
                    x = dpToPx(activity, 24f)
                    y = dpToPx(activity, 80f)
                }

                val view = buildOverlayView(params, wm)
                wm.addView(view, params)
                overlayView = view

                Log.i(TAG, "Overlay view added to WindowManager (TYPE_APPLICATION_OVERLAY, FLAG_LAYOUT_IN_SCREEN)")
                invoke.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "Error displaying overlay view", e)
                invoke.reject("Failed to show overlay: ${e.message}", "OVERLAY_SHOW_FAILED", e, null)
            }
        }
    }

    @Command
    fun overlayHide(invoke: Invoke) {
        Log.i(TAG, "overlayHide called")
        activity.runOnUiThread {
            try {
                val view = overlayView
                val wm = windowManager
                if (view != null && wm != null) {
                    wm.removeView(view)
                    overlayView = null
                    Log.i(TAG, "Overlay view removed cleanly from WindowManager")
                } else {
                    Log.i(TAG, "overlayHide: no active overlay view (no-op)")
                }
                invoke.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "Error removing overlay view", e)
                invoke.reject("Failed to hide overlay: ${e.message}", "OVERLAY_HIDE_FAILED", e, null)
            }
        }
    }

    @Command
    fun recorderStartForeground(invoke: Invoke) {
        Log.i(TAG, "recorderStartForeground called")
        val hasPermission = activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!hasPermission) {
            Log.w(TAG, "recorderStartForeground rejected: RECORD_AUDIO permission not granted")
            val errData = JSObject().apply {
                put("error", "PERMISSION_DENIED")
                put("message", "RECORD_AUDIO permission not granted")
                put("permission", "android.permission.RECORD_AUDIO")
            }
            invoke.reject("RECORD_AUDIO permission not granted", "PERMISSION_DENIED", null, errData)
            return
        }

        try {
            val intent = Intent().setClassName(activity, RECORDER_SERVICE_CLASS).apply {
                action = ACTION_START_FOREGROUND
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent)
            } else {
                activity.startService(intent)
            }
            Log.i(TAG, "startForegroundService dispatched from Activity")
            val spoolPath = try {
                val clazz = Class.forName(RECORDER_SERVICE_CLASS)
                val getSpool = clazz.getMethod("getSpoolFile", Context::class.java)
                val file = getSpool.invoke(null, activity) as File
                file.absolutePath
            } catch (_: Throwable) {
                ""
            }
            val res = JSObject().apply {
                put("state", "STARTING")
                put("spoolPath", spoolPath)
                put("channel", "orbitkit_recorder")
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recorder foreground service", e)
            invoke.reject("Failed to start recorder: ${e.message}", "START_FAILED", e, null)
        }
    }

    @Command
    fun recorderPause(invoke: Invoke) {
        Log.i(TAG, "recorderPause called")
        try {
            val intent = Intent().setClassName(activity, RECORDER_SERVICE_CLASS).apply {
                action = ACTION_PAUSE
            }
            activity.startService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to pause recorder", e)
            invoke.reject("Failed to pause recorder: ${e.message}", "PAUSE_FAILED", e, null)
        }
    }

    @Command
    fun recorderResume(invoke: Invoke) {
        Log.i(TAG, "recorderResume called")
        try {
            val intent = Intent().setClassName(activity, RECORDER_SERVICE_CLASS).apply {
                action = ACTION_RESUME
            }
            activity.startService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to resume recorder", e)
            invoke.reject("Failed to resume recorder: ${e.message}", "RESUME_FAILED", e, null)
        }
    }

    @Command
    fun recorderStop(invoke: Invoke) {
        Log.i(TAG, "recorderStop called")
        try {
            val intent = Intent().setClassName(activity, RECORDER_SERVICE_CLASS).apply {
                action = ACTION_STOP
            }
            activity.startService(intent)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recorder", e)
            invoke.reject("Failed to stop recorder: ${e.message}", "STOP_FAILED", e, null)
        }
    }

    @Command
    fun recorderState(invoke: Invoke) {
        Log.i(TAG, "recorderState called")
        try {
            var state = "IDLE"
            var bytes = 0L
            var isFg = false
            var spoolPath = ""
            try {
                val clazz = Class.forName(RECORDER_SERVICE_CLASS)
                val getStateMethod = clazz.getMethod("getState")
                val stateEnum = getStateMethod.invoke(null)
                state = stateEnum?.toString() ?: "IDLE"

                val getSpoolMethod = clazz.getMethod("getSpoolFile", Context::class.java)
                val spool = getSpoolMethod.invoke(null, activity) as File
                spoolPath = spool.absolutePath

                val isFgField = clazz.getField("isForegroundActive")
                val isFgRef = isFgField.get(null) as AtomicBoolean
                isFg = isFgRef.get()

                val bytesField = clazz.getField("bytesRecorded")
                val bytesRef = bytesField.get(null) as AtomicLong
                bytes = if (isFg) bytesRef.get() else if (spool.exists()) spool.length() else 0L
            } catch (_: Throwable) {
            }

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
    fun recorderPostStandbyNotification(invoke: Invoke) {
        Log.i(TAG, "recorderPostStandbyNotification called")
        try {
            val clazz = Class.forName(RECORDER_SERVICE_CLASS)
            val method = clazz.getMethod("postStandbyNotification", Context::class.java)
            method.invoke(null, activity)
            invoke.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to post standby notification", e)
            invoke.reject("Failed to post standby notification: ${e.message}", "STANDBY_FAILED", e, null)
        }
    }

    @Command
    fun recorderGetPersistedState(invoke: Invoke) {
        try {
            val clazz = Class.forName(PERSISTENCE_CLASS)
            val jsonMethod = clazz.getMethod("getStateJson", Context::class.java)
            val jsonStr = jsonMethod.invoke(null, activity) as String

            val currentMethod = clazz.getMethod("getCurrentState")
            val stateObj = currentMethod.invoke(null)

            val stateClass = stateObj.javaClass
            val res = JSObject().apply {
                put("state", stateClass.getMethod("getState").invoke(stateObj))
                put("bytesRecorded", stateClass.getMethod("getBytesRecorded").invoke(stateObj))
                put("spoolPath", stateClass.getMethod("getSpoolPath").invoke(stateObj))
                put("updatedAt", stateClass.getMethod("getUpdatedAt").invoke(stateObj))
                put("lastAction", stateClass.getMethod("getLastAction").invoke(stateObj))
                put("recoveryCount", stateClass.getMethod("getRecoveryCount").invoke(stateObj))
                put("lastRecoveredAt", stateClass.getMethod("getLastRecoveredAt").invoke(stateObj))
                put("isForeground", stateClass.getMethod("isForeground").invoke(stateObj))
                put("processPid", stateClass.getMethod("getProcessPid").invoke(stateObj))
                put("rawJson", jsonStr)
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get persisted state", e)
            invoke.reject("Failed to get persisted state: ${e.message}", "PERSISTENCE_FAILED", e, null)
        }
    }

    @Command
    fun recorderRecoverState(invoke: Invoke) {
        try {
            val clazz = Class.forName(PERSISTENCE_CLASS)
            val recoverMethod = clazz.getMethod("recoverState", Context::class.java)
            val recovered = recoverMethod.invoke(null, activity)

            val stateClass = recovered.javaClass
            val res = JSObject().apply {
                put("state", stateClass.getMethod("getState").invoke(recovered))
                put("bytesRecorded", stateClass.getMethod("getBytesRecorded").invoke(recovered))
                put("spoolPath", stateClass.getMethod("getSpoolPath").invoke(recovered))
                put("recoveryCount", stateClass.getMethod("getRecoveryCount").invoke(recovered))
                put("lastRecoveredAt", stateClass.getMethod("getLastRecoveredAt").invoke(recovered))
                put("processPid", stateClass.getMethod("getProcessPid").invoke(recovered))
                put("lastAction", stateClass.getMethod("getLastAction").invoke(recovered))
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to recover state", e)
            invoke.reject("Failed to recover state: ${e.message}", "RECOVERY_FAILED", e, null)
        }
    }

    override fun onDestroy(activity: AppCompatActivity) {
        super.onDestroy(activity)
        val view = overlayView
        val wm = windowManager
        if (view != null && wm != null) {
            try {
                wm.removeView(view)
            } catch (e: Exception) {
                Log.w(TAG, "Error cleaning up overlay view in onDestroy", e)
            }
            overlayView = null
        }
    }

    private fun handleAction(action: String) {
        Log.i(TAG, "Overlay action tapped: $action")
        statusView?.text = "Last Action: $action (JNI)"

        val jniResponse = OrbitkitJniBridge.dispatchNativeAction(action)
        Log.i(TAG, "JNI bridge direct dispatch for '$action' returned: $jniResponse")

        try {
            val clazz = Class.forName(PERSISTENCE_CLASS)
            val method = clazz.getMethod("recordAction", Context::class.java, String::class.java)
            method.invoke(null, activity, action)
        } catch (_: Throwable) {
        }

        val payload = JSObject().apply {
            put("id", action)
            put("action", action)
            put("source", "overlay")
            put("timestamp", System.currentTimeMillis())
            put("jniResult", jniResponse)
        }

        actionChannel?.let { ch ->
            try {
                ch.send(payload)
                Log.i(TAG, "Action $action dispatched via actionChannel to Rust")
            } catch (e: Exception) {
                Log.d(TAG, "actionChannel not delivered (WebView may be suspended): ${e.message}")
            }
        }

        trigger("action", payload)
        trigger("orbitkit://menu-action", payload)
    }

    private fun buildOverlayView(params: WindowManager.LayoutParams, wm: WindowManager): View {
        val ctx = activity

        val container = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(ctx, 14f), dpToPx(ctx, 10f), dpToPx(ctx, 14f), dpToPx(ctx, 12f))
            isClickable = false
            isFocusable = false

            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(ctx, 16f).toFloat()
                setColor(Color.parseColor("#1B212C"))
                setStroke(dpToPx(ctx, 2f), Color.parseColor("#3B82F6"))
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                elevation = dpToPx(ctx, 10f).toFloat()
            }
        }

        val header = TextView(ctx).apply {
            text = "✥ OrbitKit Native [Drag] ✥"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dpToPx(ctx, 8f), dpToPx(ctx, 4f), dpToPx(ctx, 8f), dpToPx(ctx, 6f))
            isClickable = true
            isFocusable = false

            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(ctx, 8f).toFloat()
                setColor(Color.parseColor("#0F172A"))
            }
        }
        container.addView(header, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f

        val dragListener = object : View.OnTouchListener {
            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()
                        params.x = initialX + dx
                        params.y = initialY + dy
                        try {
                            wm.updateViewLayout(container, params)
                        } catch (e: Exception) {
                            Log.w(TAG, "Error updating overlay layout during drag", e)
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        v.performClick()
                        return true
                    }
                }
                return false
            }
        }
        header.setOnTouchListener(dragListener)
        container.setOnTouchListener(dragListener)

        val buttonsRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            val rowParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(ctx, 10f)
            }
            layoutParams = rowParams
        }

        val actions = listOf(
            Triple("ACT_A", "#2563EB", "#1D4ED8"),
            Triple("ACT_B", "#059669", "#047857"),
            Triple("ACT_C", "#D97706", "#B45309")
        )

        for ((actionName, bgColor, _) in actions) {
            val btn = Button(ctx).apply {
                text = actionName
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setPadding(dpToPx(ctx, 14f), dpToPx(ctx, 8f), dpToPx(ctx, 14f), dpToPx(ctx, 8f))
                isAllCaps = false
                minHeight = dpToPx(ctx, 40f)

                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = dpToPx(ctx, 8f).toFloat()
                    setColor(Color.parseColor(bgColor))
                }

                setOnClickListener {
                    handleAction(actionName)
                }
            }

            val btnParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                leftMargin = dpToPx(ctx, 4f)
                rightMargin = dpToPx(ctx, 4f)
            }
            buttonsRow.addView(btn, btnParams)
        }
        container.addView(buttonsRow)

        val recRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            val rowParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(ctx, 6f)
            }
            layoutParams = rowParams
        }

        fun sendRecorderServiceIntent(action: String) {
            try {
                val intent = Intent().setClassName(ctx, RECORDER_SERVICE_CLASS).apply {
                    this.action = action
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && action == ACTION_START_FOREGROUND) {
                    ctx.startForegroundService(intent)
                } else {
                    ctx.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "sendRecorderServiceIntent failed for $action: ${e.message}", e)
            }
        }

        val recActions = listOf(
            Triple("START", "#DC2626") {
                sendRecorderServiceIntent(ACTION_START_FOREGROUND)
                handleAction("REC_START")
            },
            Triple("PAUSE", "#CA8A04") {
                sendRecorderServiceIntent(ACTION_PAUSE)
                handleAction("REC_PAUSE")
            },
            Triple("RESUME", "#16A34A") {
                sendRecorderServiceIntent(ACTION_RESUME)
                handleAction("REC_RESUME")
            },
            Triple("STOP", "#475569") {
                sendRecorderServiceIntent(ACTION_STOP)
                handleAction("REC_STOP")
            }
        )

        for ((recName, recColor, recClick) in recActions) {
            val btn = Button(ctx).apply {
                text = recName
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setPadding(dpToPx(ctx, 8f), dpToPx(ctx, 6f), dpToPx(ctx, 8f), dpToPx(ctx, 6f))
                isAllCaps = false
                minHeight = dpToPx(ctx, 36f)
                minWidth = dpToPx(ctx, 54f)

                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = dpToPx(ctx, 6f).toFloat()
                    setColor(Color.parseColor(recColor))
                }

                setOnClickListener {
                    recClick()
                }
            }

            val btnParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                leftMargin = dpToPx(ctx, 3f)
                rightMargin = dpToPx(ctx, 3f)
            }
            recRow.addView(btn, btnParams)
        }
        container.addView(recRow)

        val status = TextView(ctx).apply {
            text = "Status: Floating active"
            setTextColor(Color.parseColor("#64748B"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            gravity = Gravity.CENTER
            val statusParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(ctx, 6f)
            }
            layoutParams = statusParams
        }
        statusView = status
        container.addView(status)

        return container
    }

    private fun dpToPx(context: Context, dp: Float): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            context.resources.displayMetrics
        ).toInt()
    }
}
