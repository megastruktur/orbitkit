package dev.orbitkit.native

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

        // 1. Verify SYSTEM_ALERT_WINDOW permission
        if (!Settings.canDrawOverlays(activity)) {
            Log.w(TAG, "overlayShow rejected: SYSTEM_ALERT_WINDOW permission not granted")
            val errData = JSObject().apply {
                put("error", "PERMISSION_DENIED")
                put("message", "SYSTEM_ALERT_WINDOW permission not granted")
            }
            invoke.reject("SYSTEM_ALERT_WINDOW permission not granted", "PERMISSION_DENIED", null, errData)
            return
        }

        // 2. Parse optional channel argument from payload
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
        statusView?.text = "Last Action: $action"

        val payload = JSObject().apply {
            put("action", action)
            put("timestamp", System.currentTimeMillis())
        }

        // 1. Send via dedicated IPC channel to Rust
        actionChannel?.let { ch ->
            try {
                ch.send(payload)
                Log.i(TAG, "Action $action dispatched via actionChannel to Rust")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send action via channel", e)
            }
        }

        // 2. Also emit via plugin event
        trigger("action", payload)
    }

    private fun buildOverlayView(params: WindowManager.LayoutParams, wm: WindowManager): View {
        val ctx = activity

        // Main Container
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

        // Header / Drag Handle
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

        // Drag Listener on Header and Container
        val dragListener = object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f

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

        // Buttons Row
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
                setPadding(dpToPx(ctx, 12f), dpToPx(ctx, 8f), dpToPx(ctx, 12f), dpToPx(ctx, 8f))
                isAllCaps = false
                minHeight = dpToPx(ctx, 42f)
                minWidth = dpToPx(ctx, 72f)

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

        // Status / Feedback label
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
