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
import android.view.ViewConfiguration
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import kotlin.math.abs
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
    private var mascotView: TextView? = null
    private var currentMascotState: String = STATE_IDLE
    companion object {

        const val STATE_IDLE = "idle"
        const val STATE_ACTIVE = "active"
        const val STATE_BUSY = "busy"
        const val STATE_ATTENTION = "attention"

        const val COLOR_IDLE = 0xFF3B82F6.toInt()      // bright blue (#3B82F6)
        const val COLOR_ACTIVE = 0xFF10B981.toInt()    // bright emerald green (#10B981)
        const val COLOR_BUSY = 0xFFF59E0B.toInt()      // bright amber (#F59E0B)
        const val COLOR_ATTENTION = 0xFFEF4444.toInt() // bright red (#EF4444)

        @JvmStatic
        fun getMascotTint(state: String?): Int {
            return when (state?.lowercase()?.trim()) {
                STATE_ACTIVE -> COLOR_ACTIVE
                STATE_BUSY -> COLOR_BUSY
                STATE_ATTENTION -> COLOR_ATTENTION
                STATE_IDLE -> COLOR_IDLE
                else -> COLOR_IDLE
            }
        }
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

        val overlayConfig = try {
            val raw = invoke.getRawArgs()
            if (raw.isNullOrEmpty() || raw == "{}" || raw == "null") {
                throw IllegalArgumentException("Missing menu configuration: items must have 1..12 items")
            }
            val parsed = MenuConfigParser.parse(raw)
            parsed.menu
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "Invalid menu configuration for overlayShow", e)
            invoke.reject("Invalid menu configuration: ${e.message}", "INVALID_CONFIG", e, null)
            return
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse overlayShow args", e)
            invoke.reject("Invalid config: ${e.message}", "INVALID_CONFIG", e, null)
            return
        }

        activity.runOnUiThread {
            try {
                val wm = activity.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                windowManager = wm

                overlayView?.let { oldView ->
                    try {
                        wm.removeView(oldView)
                    } catch (e: Exception) {
                        Log.w(TAG, "Error removing prior overlayView", e)
                    }
                    overlayView = null
                    mascotView = null
                }

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val radiusPx = dpToPx(activity, overlayConfig.radius.toFloat())
                val itemSizePx = dpToPx(activity, overlayConfig.itemSize.toFloat())
                val halfExtent = radiusPx + itemSizePx + dpToPx(activity, 16f)
                val containerSize = halfExtent * 2

                val params = WindowManager.LayoutParams(
                    containerSize,
                    containerSize,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.START
                    x = dpToPx(activity, 24f)
                    y = dpToPx(activity, 80f)
                }

                val view = buildOverlayView(params, wm, overlayConfig)
                wm.addView(view, params)
                overlayView = view

                Log.i(TAG, "Overlay view added to WindowManager (items=${overlayConfig.items.size}, radius=$radiusPx)")
                invoke.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "Error displaying overlay view", e)
                invoke.reject("Failed to show overlay: ${e.message}", "UNSUPPORTED", e, null)
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
                    mascotView = null
                    Log.i(TAG, "Overlay view removed cleanly from WindowManager")
                } else {
                    Log.i(TAG, "overlayHide: no active overlay view (no-op)")
                }
                invoke.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "Error removing overlay view", e)
                invoke.reject("Failed to hide overlay: ${e.message}", "UNSUPPORTED", e, null)
            }
        }
    }

    @Command
    fun setMascotState(invoke: Invoke) {
        val state = try {
            val raw = invoke.getRawArgs()
            if (raw.isNotEmpty() && raw != "null" && raw != "{}") {
                val obj = JSONObject(raw)
                obj.optString("state", STATE_IDLE)
            } else {
                STATE_IDLE
            }
        } catch (_: Exception) {
            STATE_IDLE
        }

        currentMascotState = state
        activity.runOnUiThread {
            applyMascotStateTint(state)
            invoke.resolve()
        }
    }

    private fun applyMascotStateTint(state: String) {
        val mascot = mascotView ?: return
        val ctx = activity
        val tint = getMascotTint(state)
        val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(tint)
            setStroke(dpToPx(ctx, 2f), Color.WHITE)
        }
        mascot.background = bg
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
            mascotView = null
        }
    }

    private fun handleAction(action: String, disabled: Boolean = false) {
        Log.i(TAG, "Overlay action tapped: $action (disabled=$disabled)")
        OverlayActionDispatcher.handleAction(
            id = action,
            disabled = disabled,
            jniDispatch = { act ->
                val jniResponse = OrbitkitJniBridge.dispatchNativeAction(act)
                Log.i(TAG, "JNI bridge direct dispatch for '$act' returned: $jniResponse")
                jniResponse
            },
        )

        // If a Tauri plugin channel was passed in overlayShow args, send to channel
        actionChannel?.let { ch ->
            try {
                val payload = JSObject().apply {
                    put("id", action)
                    put("source", "overlay")
                }
                ch.send(payload)
            } catch (e: Exception) {
                Log.d(TAG, "Error sending to actionChannel: ${e.message}")
            }
        }
    }

    private fun buildOverlayView(
        params: WindowManager.LayoutParams,
        wm: WindowManager,
        menuConfig: NativeMenuConfig
    ): View {
        val ctx = activity
        val radiusPx = dpToPx(ctx, menuConfig.radius.toFloat())
        val itemSizePx = dpToPx(ctx, menuConfig.itemSize.toFloat())
        val mascotSizePx = dpToPx(ctx, 56f)

        val halfExtent = radiusPx + itemSizePx + dpToPx(ctx, 16f)
        val containerSize = halfExtent * 2
        val centerX = halfExtent.toDouble()
        val centerY = halfExtent.toDouble()

        var isMenuExpanded = true
        var bubbleCenterX = params.x + halfExtent.toDouble()
        var bubbleCenterY = params.y + halfExtent.toDouble()
        val container = FrameLayout(ctx).apply {
            isClickable = false
            isFocusable = false
        }

        // 1. Mascot bubble at center
        val mascot = TextView(ctx).apply {
            text = "🪐"
            gravity = Gravity.CENTER
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
            contentDescription = "OrbitKit Mascot"

            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(getMascotTint(currentMascotState))
                setStroke(dpToPx(ctx, 2f), Color.WHITE)
            }
            background = bg

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                elevation = dpToPx(ctx, 8f).toFloat()
            }
        }
        mascotView = mascot

        val mascotLp = FrameLayout.LayoutParams(mascotSizePx, mascotSizePx).apply {
            leftMargin = (centerX - mascotSizePx / 2.0).toInt()
            topMargin = (centerY - mascotSizePx / 2.0).toInt()
        }

        // Drag listener on mascot bubble keeping bubble center anchored
        var initialTouchX = 0f
        var initialTouchY = 0f
        var initialBubbleCenterX = 0.0
        var initialBubbleCenterY = 0.0
        var isDragging = false
        val touchSlop = ViewConfiguration.get(ctx).scaledTouchSlop

        mascot.setOnTouchListener(object : View.OnTouchListener {
            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        initialBubbleCenterX = bubbleCenterX
                        initialBubbleCenterY = bubbleCenterY
                        isDragging = false
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = event.rawX - initialTouchX
                        val dy = event.rawY - initialTouchY
                        if (!isDragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) {
                            isDragging = true
                        }
                        if (isDragging) {
                            bubbleCenterX = initialBubbleCenterX + dx
                            bubbleCenterY = initialBubbleCenterY + dy
                            if (isMenuExpanded) {
                                params.x = (bubbleCenterX - halfExtent).toInt()
                                params.y = (bubbleCenterY - halfExtent).toInt()
                            } else {
                                params.x = (bubbleCenterX - mascotSizePx / 2.0).toInt()
                                params.y = (bubbleCenterY - mascotSizePx / 2.0).toInt()
                            }
                            try {
                                wm.updateViewLayout(container, params)
                            } catch (e: Exception) {
                                Log.w(TAG, "Error updating overlay layout during drag", e)
                            }
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!isDragging) {
                            v.performClick()
                        }
                        return true
                    }
                }
                return false
            }
        })
        val itemViews = ArrayList<View>()

        // Mascot click toggles menu: when collapsed, window sizes to mascotSizePx so touches pass through;
        // when expanded, window sizes to containerSize with items visible. Bubble stays anchored at bubbleCenter.
        mascot.setOnClickListener {
            isMenuExpanded = !isMenuExpanded
            Log.i(TAG, "Mascot bubble tapped, toggling menu: expanded=$isMenuExpanded")
            if (isMenuExpanded) {
                params.width = containerSize
                params.height = containerSize
                params.x = (bubbleCenterX - halfExtent).toInt()
                params.y = (bubbleCenterY - halfExtent).toInt()

                mascotLp.leftMargin = (halfExtent - mascotSizePx / 2.0).toInt()
                mascotLp.topMargin = (halfExtent - mascotSizePx / 2.0).toInt()
                mascot.layoutParams = mascotLp

                for (v in itemViews) {
                    v.visibility = View.VISIBLE
                }
            } else {
                for (v in itemViews) {
                    v.visibility = View.GONE
                }

                params.width = mascotSizePx
                params.height = mascotSizePx
                params.x = (bubbleCenterX - mascotSizePx / 2.0).toInt()
                params.y = (bubbleCenterY - mascotSizePx / 2.0).toInt()

                mascotLp.leftMargin = 0
                mascotLp.topMargin = 0
                mascot.layoutParams = mascotLp
            }
            try {
                wm.updateViewLayout(container, params)
            } catch (e: Exception) {
                Log.w(TAG, "Error updating overlay layout on toggle", e)
            }
        }
        // 2. Radial menu items around mascot bubble
        val items = menuConfig.items
        if (items.isNotEmpty()) {
            val positions = RadialLayout.positions(
                items.size,
                radiusPx.toDouble(),
                menuConfig.startAngle,
                menuConfig.endAngle
            )

            for (i in items.indices) {
                val item = items[i]
                val pos = positions[i]

                val itemView = TextView(ctx).apply {
                    contentDescription = item.label
                    gravity = Gravity.CENTER
                    text = item.icon ?: item.label
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    setTypeface(typeface, android.graphics.Typeface.BOLD)

                    if (item.disabled) {
                        isEnabled = false
                        alpha = 0.5f
                        setTextColor(Color.parseColor("#9CA3AF"))
                        background = GradientDrawable().apply {
                            shape = GradientDrawable.OVAL
                            setColor(Color.parseColor("#4B5563"))
                        }
                    } else {
                        isEnabled = true
                        alpha = 1.0f
                        setTextColor(Color.WHITE)
                        background = GradientDrawable().apply {
                            shape = GradientDrawable.OVAL
                            setColor(Color.parseColor("#1E293B"))
                            setStroke(dpToPx(ctx, 2f), Color.parseColor("#38BDF8"))
                        }
                        setOnClickListener {
                            handleAction(item.id, item.disabled)
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            elevation = dpToPx(ctx, 6f).toFloat()
                        }
                    }
                }

                val itemLp = FrameLayout.LayoutParams(itemSizePx, itemSizePx).apply {
                    leftMargin = (centerX + pos.x - itemSizePx / 2.0).toInt()
                    topMargin = (centerY + pos.y - itemSizePx / 2.0).toInt()
                }
                itemViews.add(itemView)
                container.addView(itemView, itemLp)
            }
        }

        // Add mascot after items so it sits on top in center
        container.addView(mascot, mascotLp)

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
