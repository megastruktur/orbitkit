package dev.orbitkit.native

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.view.animation.AccelerateInterpolator
import android.view.animation.OvershootInterpolator

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
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import kotlin.math.abs
import android.view.WindowInsets
import kotlin.math.roundToInt
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
    private var bubbleView: View? = null
    private var menuView: View? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var menuParams: WindowManager.LayoutParams? = null
    private var isMenuAttached: Boolean = false
    private var isBubbleAttached: Boolean = false
    private var isMenuExpanded: Boolean = false
    private var actionChannel: Channel? = null
    private var mascotView: View? = null
    private var activeMascotSpec: MascotSpec? = null
    private var isMascotFallback: Boolean = false
    private var hasLoggedFallbackWarning: Boolean = false
    private var currentMascotState: String = STATE_IDLE
    private var activeOverlayTeardown: (() -> Unit)? = null
    private var activeMenuCollapse: ((animate: Boolean) -> Unit)? = null
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

        val parsedOverlayConfig = try {
            val raw = invoke.getRawArgs()
            if (raw.isNullOrEmpty() || raw == "{}" || raw == "null") {
                throw IllegalArgumentException("Missing menu configuration: items must have 1..12 items")
            }
            MenuConfigParser.parse(raw)
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "Invalid menu configuration for overlayShow", e)
            invoke.reject("Invalid menu configuration: ${e.message}", "INVALID_CONFIG", e, null)
            return
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse overlayShow args", e)
            invoke.reject("Invalid config: ${e.message}", "INVALID_CONFIG", e, null)
            return
        }
        val overlayConfig = parsedOverlayConfig.menu

        activity.runOnUiThread {
            try {
                val wm = activity.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                windowManager = wm

                removeOverlayViews()

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
                val mascotDp = parsedOverlayConfig.mascot?.size?.toFloat()
                    ?: parsedOverlayConfig.mascotSpec?.size?.toFloat()
                    ?: 56f
                val mascotSizePx = dpToPx(activity, mascotDp)

                parsedOverlayConfig.mascotSpec?.initialState?.let { initial ->
                    if (initial.isNotEmpty()) {
                        currentMascotState = initial
                    }
                }

                val initialDesiredCenterX = dpToPx(activity, 24f) + halfExtent.toDouble()
                val initialDesiredCenterY = dpToPx(activity, 80f) + halfExtent.toDouble()
                buildOverlayView(
                    wm = wm,
                    layoutType = layoutType,
                    menuConfig = overlayConfig,
                    mascotSpec = parsedOverlayConfig.mascotSpec,
                    containerSize = containerSize,
                    mascotSizePx = mascotSizePx,
                    itemSizePx = itemSizePx,
                    radiusPx = radiusPx,
                    initialDesiredCenterX = initialDesiredCenterX,
                    initialDesiredCenterY = initialDesiredCenterY
                )

                Log.i(TAG, "Overlay windows added to WindowManager (items=${overlayConfig.items.size}, radius=$radiusPx)")
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
                removeOverlayViews()
                Log.i(TAG, "Overlay views removed cleanly from WindowManager")
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
            updateMascotDisplay(state)
            invoke.resolve()
        }
    }

    @Command
    fun bringToFront(invoke: Invoke) {
        Log.i(TAG, "bringToFront called")
        activity.runOnUiThread {
            try {
                val intent = Intent(activity, activity.javaClass).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
                activity.startActivity(intent)

                if (activeMenuCollapse != null) {
                    activeMenuCollapse?.invoke(false)
                } else if (menuView != null && menuParams != null) {
                    menuView?.visibility = View.INVISIBLE
                    menuParams?.let { params ->
                        params.flags = params.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        try {
                            windowManager?.updateViewLayout(menuView, params)
                        } catch (e: Exception) {
                            Log.w(TAG, "Error updating menu layout on fallback collapse", e)
                        }
                    }
                    isMenuExpanded = false
                }

                invoke.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to bring activity to front", e)
                invoke.reject("Failed to bring activity to front: ${e.message}", "UNSUPPORTED", e, null)
            }
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

    private fun createMascotView(ctx: Context, spec: MascotSpec?, mascotSizePx: Int): View {
        activeMascotSpec = spec
        if (spec != null && !spec.isFallback) {
            val src = spec.srcFor(currentMascotState)
            val decoded = IconDecoder.decode(src)
            if (decoded is DecodedIcon.Svg) {
                isMascotFallback = false
                return ImageView(ctx).apply {
                    contentDescription = "OrbitKit Mascot"
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    setImageDrawable(SvgDrawable(decoded.icon, fraction = 1.0f))
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        elevation = dpToPx(ctx, 8f).toFloat()
                    }
                }
            } else if (decoded is DecodedIcon.Bitmap && spec.kind == MascotKind.IMAGE) {
                isMascotFallback = false
                return ImageView(ctx).apply {
                    contentDescription = "OrbitKit Mascot"
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    setImageBitmap(decoded.bitmap)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        elevation = dpToPx(ctx, 8f).toFloat()
                    }
                }
            }
        }

        // Fallback path
        isMascotFallback = true
        if (!hasLoggedFallbackWarning) {
            Log.w(TAG, "Mascot config missing, undecodable, or sprite; falling back to default planet bubble")
            hasLoggedFallbackWarning = true
        }
        return TextView(ctx).apply {
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
    }

    private fun updateMascotDisplay(state: String) {
        val spec = activeMascotSpec
        val view = mascotView
        if (!isMascotFallback && spec != null && view is ImageView) {
            val src = spec.srcFor(state)
            val decoded = IconDecoder.decode(src)
            if (decoded is DecodedIcon.Svg) {
                view.setImageDrawable(SvgDrawable(decoded.icon, fraction = 1.0f))
                return
            } else if (decoded is DecodedIcon.Bitmap && spec.kind == MascotKind.IMAGE) {
                view.setImageBitmap(decoded.bitmap)
                return
            }
        }
        applyMascotStateTint(state)
    }
    private fun getSystemAnimatorScale(context: Context): Float {
        return try {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1.0f
            )
        } catch (_: Exception) {
            1.0f
        }
    }



    private fun removeOverlayViews() {
        val wm = windowManager ?: return
        try {
            activeOverlayTeardown?.invoke()
        } catch (e: Exception) {
            Log.w(TAG, "Error invoking activeOverlayTeardown", e)
        }
        activeOverlayTeardown = null
        activeMenuCollapse = null
        if (isMenuAttached) {
            menuView?.let { menu ->
                try {
                    wm.removeViewImmediate(menu)
                } catch (e: Exception) {
                    Log.w(TAG, "Error removing menuView in removeOverlayViews", e)
                }
            }
        }
        menuView = null
        isMenuAttached = false

        if (isBubbleAttached) {
            bubbleView?.let { bubble ->
                try {
                    wm.removeViewImmediate(bubble)
                } catch (e: Exception) {
                    Log.w(TAG, "Error removing bubbleView in removeOverlayViews", e)
                }
            }
        }
        bubbleView = null
        mascotView = null
        activeMascotSpec = null
        isMascotFallback = false
        bubbleParams = null
        menuParams = null
        isBubbleAttached = false
        isMenuExpanded = false
    }

    override fun onDestroy(activity: AppCompatActivity) {
        super.onDestroy(activity)
        try {
            removeOverlayViews()
        } catch (e: Exception) {
            Log.w(TAG, "Error cleaning up overlay views in onDestroy", e)
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

    private fun getScreenBounds(wm: WindowManager, context: Context): OverlayGeometry.Bounds {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val metrics = wm.currentWindowMetrics
            val bounds = metrics.bounds
            val insets = metrics.windowInsets.getInsetsIgnoringVisibility(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
            )
            return OverlayGeometry.Bounds(
                left = bounds.left + insets.left,
                top = bounds.top + insets.top,
                right = bounds.right - insets.right,
                bottom = bounds.bottom - insets.bottom
            )
        } else {
            val dm = context.resources.displayMetrics
            var statusBarHeight = 0
            val resId = context.resources.getIdentifier("status_bar_height", "dimen", "android")
            if (resId > 0) {
                statusBarHeight = context.resources.getDimensionPixelSize(resId)
            }
            return OverlayGeometry.Bounds(
                left = 0,
                top = statusBarHeight,
                right = dm.widthPixels,
                bottom = dm.heightPixels
            )
        }
    }

    private fun buildOverlayView(
        wm: WindowManager,
        layoutType: Int,
        menuConfig: NativeMenuConfig,
        mascotSpec: MascotSpec? = null,
        containerSize: Int,
        mascotSizePx: Int,
        itemSizePx: Int,
        radiusPx: Int,
        initialDesiredCenterX: Double,
        initialDesiredCenterY: Double
    ): View {
        val ctx = activity
        val screen = getScreenBounds(wm, ctx)

        // Compute initial bubble position clamped to usable screen bounds
        val initialBubblePlacement = OverlayGeometry.place(
            desiredCenterX = initialDesiredCenterX,
            desiredCenterY = initialDesiredCenterY,
            windowSize = mascotSizePx,
            bubbleSize = mascotSizePx,
            screen = screen
        )
        var bubbleCenterX = initialBubblePlacement.bubbleCenterX.toDouble()
        var bubbleCenterY = initialBubblePlacement.bubbleCenterY.toDouble()

        // 1. Bubble window params: exactly mascotSizePx x mascotSizePx, NEVER resized.
        val bParams = WindowManager.LayoutParams(
            mascotSizePx,
            mascotSizePx,
            layoutType,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = initialBubblePlacement.windowX
            y = initialBubblePlacement.windowY
            windowAnimations = 0
        }
        bubbleParams = bParams

        // 2. Menu window params: full-screen, added ONCE before bubble window, never moves/resizes.
        val mParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = 0
            windowAnimations = 0
        }
        menuParams = mParams

        // 1. Bubble window: contains ONLY the mascot
        val bubbleContainer = FrameLayout(ctx).apply {
            isClickable = false
            isFocusable = false
        }
        val mascot = createMascotView(ctx, mascotSpec, mascotSizePx)
        mascotView = mascot
        val mascotLp = FrameLayout.LayoutParams(mascotSizePx, mascotSizePx)
        bubbleContainer.addView(mascot, mascotLp)
        bubbleView = bubbleContainer

        // 2. Menu window: contains ONLY the item views (no mascot)
        val menuContainer = FrameLayout(ctx).apply {
            isClickable = true
            isFocusable = false
        }
        val itemViews = ArrayList<View>()
        val items = menuConfig.items
        val resolvedAngles = RadialLayout.resolveMenuAngles(menuConfig)
        val positions = if (items.isNotEmpty()) {
            RadialLayout.positions(
                items.size,
                radiusPx.toDouble(),
                resolvedAngles.startAngle,
                resolvedAngles.endAngle
            )
        } else {
            emptyList()
        }

        for (i in items.indices) {
            val item = items[i]
            val itemView = ImageView(ctx).apply {
                contentDescription = item.label
                scaleType = ImageView.ScaleType.FIT_CENTER

                val decoded = IconDecoder.resolveItemIcon(item.icon, item.label)

                if (decoded != null) {
                    when (decoded) {
                        is DecodedIcon.Svg -> setImageDrawable(SvgDrawable(decoded.icon))
                        is DecodedIcon.Bitmap -> setImageBitmap(decoded.bitmap)
                        is DecodedIcon.Text -> setImageDrawable(
                            TextDrawable(decoded.text, density = ctx.resources.displayMetrics.density)
                        )
                    }
                }

                if (item.disabled) {
                    isEnabled = false
                    isClickable = true
                    setOnClickListener {
                        // Consumes tap so it does not fall through to container, keeping menu open
                    }
                    alpha = 0.5f
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.parseColor("#4B5563"))
                    }
                } else {
                    isEnabled = true
                    alpha = 1.0f
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.argb((255 * 0.85f).toInt(), 0x0E, 0x14, 0x33))
                        setStroke(Math.max(1, dpToPx(ctx, 1.5f)), Color.parseColor("#38BDF8"))
                    }
                    setOnClickListener {
                        handleAction(item.id, item.disabled)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        elevation = dpToPx(ctx, 6f).toFloat()
                    }
                }
            }
            val itemLp = FrameLayout.LayoutParams(itemSizePx, itemSizePx)
            itemViews.add(itemView)
            menuContainer.addView(itemView, itemLp)
        }
        menuView = menuContainer

        fun updateMenuPositions(centerPxX: Double, centerPxY: Double) {
            val screenBounds = getScreenBounds(wm, ctx)
            val originX: Int
            val originY: Int
            if (menuContainer.isAttachedToWindow) {
                val loc = IntArray(2)
                menuContainer.getLocationOnScreen(loc)
                originX = loc[0]
                originY = loc[1]
            } else {
                originX = screenBounds.left
                originY = screenBounds.top
            }
            for (i in itemViews.indices) {
                val itemView = itemViews[i]
                val pos = positions[i]
                val itemLp = itemView.layoutParams as FrameLayout.LayoutParams
                val margin = OverlayGeometry.itemMargin(
                    bubbleCenterX = centerPxX,
                    bubbleCenterY = centerPxY,
                    relX = pos.x,
                    relY = pos.y,
                    itemSize = itemSizePx,
                    screen = screenBounds,
                    menuOriginX = originX,
                    menuOriginY = originY,
                )
                itemLp.leftMargin = margin.left
                itemLp.topMargin = margin.top
                itemView.layoutParams = itemLp
            }
        }

        var targetOpen = true
        var animSession = 0L
        val overshootInterpolator = OvershootInterpolator(1.2f)
        val accelerateInterpolator = AccelerateInterpolator()

        fun cancelAllItemAnimators() {
            for (itemView in itemViews) {
                itemView.animate().setListener(null).cancel()
            }
        }
        activeOverlayTeardown = {
            cancelAllItemAnimators()
        }

        fun collapseMenu(animate: Boolean = true) {
            if (!targetOpen && !isMenuExpanded) return
            val animScale = getSystemAnimatorScale(ctx)
            val animEnabled = animate && SpawnAnimation.enabled(menuConfig.animation, animScale)
            targetOpen = false
            val session = ++animSession

            for (itemView in itemViews) {
                itemView.isClickable = false
            }

            if (!animEnabled || items.isEmpty()) {
                cancelAllItemAnimators()
                menuContainer.visibility = View.INVISIBLE
                mParams.flags = mParams.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                try {
                    wm.updateViewLayout(menuContainer, mParams)
                } catch (e: Exception) {
                    Log.w(TAG, "Error updating menu window layout on instant collapse", e)
                }
                for (itemView in itemViews) {
                    itemView.scaleX = 0f
                    itemView.scaleY = 0f
                    itemView.alpha = 0f
                }
                isMenuExpanded = false
                Log.i(TAG, "Menu collapsed instantly (no animation)")
                return
            }

            val screenBounds = getScreenBounds(wm, ctx)
            var pendingAnimations = items.size

            for (i in items.indices) {
                val itemView = itemViews[i]
                val pos = positions[i]
                val itemScreenPos = OverlayGeometry.itemScreenPosition(
                    bubbleCenterX = bubbleCenterX,
                    bubbleCenterY = bubbleCenterY,
                    relX = pos.x,
                    relY = pos.y,
                    itemSize = itemSizePx,
                    screen = screenBounds
                )
                val offset = SpawnAnimation.startOffset(
                    mascotCenterX = bubbleCenterX,
                    mascotCenterY = bubbleCenterY,
                    itemScreenX = itemScreenPos.x,
                    itemScreenY = itemScreenPos.y,
                    itemSize = itemSizePx
                )

                itemView.animate().setListener(null).cancel()

                val currentFrac = SpawnAnimation.currentFraction(itemView.scaleX, 0f, 1f)
                val duration = SpawnAnimation.reverseDuration(
                    currentFraction = currentFrac,
                    targetFraction = 0f,
                    baseDurationMs = SpawnAnimation.CLOSE_DURATION_MS
                )
                val delay = if (currentFrac < 0.95f) 0L else SpawnAnimation.staggerDelay(
                    index = i,
                    totalItems = items.size,
                    isOpening = false
                )

                var wasCanceled = false
                itemView.animate()
                    .translationX(offset.x)
                    .translationY(offset.y)
                    .scaleX(0f)
                    .scaleY(0f)
                    .alpha(0f)
                    .setDuration(duration)
                    .setStartDelay(delay)
                    .setInterpolator(accelerateInterpolator)
                    .setListener(object : AnimatorListenerAdapter() {
                        override fun onAnimationCancel(animation: Animator) {
                            wasCanceled = true
                        }
                        override fun onAnimationEnd(animation: Animator) {
                            itemView.animate().setListener(null)
                            if (!wasCanceled && animSession == session && !targetOpen) {
                                pendingAnimations--
                                if (pendingAnimations <= 0) {
                                    menuContainer.visibility = View.INVISIBLE
                                    mParams.flags = mParams.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                                    try {
                                        wm.updateViewLayout(menuContainer, mParams)
                                    } catch (e: Exception) {
                                        Log.w(TAG, "Error updating menu window layout on collapse complete", e)
                                    }
                                    isMenuExpanded = false
                                    Log.i(TAG, "Spawn close animation completed, window invisible")
                                }
                            }
                        }
                    })
                    .start()
            }
        }
        activeMenuCollapse = { animate ->
            collapseMenu(animate)
        }

        fun expandMenu() {
            if (targetOpen && isMenuExpanded) return
            val animScale = getSystemAnimatorScale(ctx)
            val animEnabled = SpawnAnimation.enabled(menuConfig.animation, animScale)
            targetOpen = true
            val session = ++animSession

            updateMenuPositions(bubbleCenterX, bubbleCenterY)
            menuContainer.visibility = View.VISIBLE
            mParams.flags = mParams.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
            try {
                wm.updateViewLayout(menuContainer, mParams)
            } catch (e: Exception) {
                Log.e(TAG, "Error updating menu window layout on expand", e)
            }

            if (!animEnabled || items.isEmpty()) {
                cancelAllItemAnimators()
                for (i in itemViews.indices) {
                    val item = items[i]
                    val itemView = itemViews[i]
                    itemView.translationX = 0f
                    itemView.translationY = 0f
                    itemView.scaleX = 1f
                    itemView.scaleY = 1f
                    itemView.alpha = if (item.disabled) 0.5f else 1.0f
                    itemView.isClickable = true
                }
                isMenuExpanded = true
                Log.i(TAG, "Menu expanded instantly at ($bubbleCenterX, $bubbleCenterY)")
                return
            }

            for (itemView in itemViews) {
                itemView.isClickable = false
            }

            val screenBounds = getScreenBounds(wm, ctx)
            var pendingAnimations = items.size

            for (i in items.indices) {
                val item = items[i]
                val itemView = itemViews[i]
                val pos = positions[i]
                val itemScreenPos = OverlayGeometry.itemScreenPosition(
                    bubbleCenterX = bubbleCenterX,
                    bubbleCenterY = bubbleCenterY,
                    relX = pos.x,
                    relY = pos.y,
                    itemSize = itemSizePx,
                    screen = screenBounds
                )
                val offset = SpawnAnimation.startOffset(
                    mascotCenterX = bubbleCenterX,
                    mascotCenterY = bubbleCenterY,
                    itemScreenX = itemScreenPos.x,
                    itemScreenY = itemScreenPos.y,
                    itemSize = itemSizePx
                )

                itemView.animate().setListener(null).cancel()

                if (!isMenuExpanded && itemView.scaleX <= 0.01f) {
                    itemView.translationX = offset.x
                    itemView.translationY = offset.y
                    itemView.scaleX = 0f
                    itemView.scaleY = 0f
                    itemView.alpha = 0f
                }

                val currentFrac = SpawnAnimation.currentFraction(itemView.scaleX, 0f, 1f)
                val duration = SpawnAnimation.reverseDuration(
                    currentFraction = currentFrac,
                    targetFraction = 1f,
                    baseDurationMs = SpawnAnimation.OPEN_DURATION_MS
                )
                val delay = if (currentFrac > 0.05f) 0L else SpawnAnimation.staggerDelay(
                    index = i,
                    totalItems = items.size,
                    isOpening = true
                )
                val targetAlpha = if (item.disabled) 0.5f else 1.0f

                var wasCanceled = false
                itemView.animate()
                    .translationX(0f)
                    .translationY(0f)
                    .scaleX(1f)
                    .scaleY(1f)
                    .alpha(targetAlpha)
                    .setDuration(duration)
                    .setStartDelay(delay)
                    .setInterpolator(overshootInterpolator)
                    .setListener(object : AnimatorListenerAdapter() {
                        override fun onAnimationCancel(animation: Animator) {
                            wasCanceled = true
                        }
                        override fun onAnimationEnd(animation: Animator) {
                            itemView.animate().setListener(null)
                            if (!wasCanceled && animSession == session && targetOpen) {
                                pendingAnimations--
                                if (pendingAnimations <= 0) {
                                    isMenuExpanded = true
                                    for (v in itemViews) {
                                        v.isClickable = true
                                    }
                                    Log.i(TAG, "Spawn open animation completed, items clickable")
                                }
                            }
                        }
                    })
                    .start()
            }
        }

        menuContainer.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                if (targetOpen) {
                    collapseMenu()
                }
                true
            } else {
                false
            }
        }

        fun moveBubble(desiredX: Double, desiredY: Double) {
            val screenBounds = getScreenBounds(wm, ctx)
            val placement = OverlayGeometry.place(
                desiredCenterX = desiredX,
                desiredCenterY = desiredY,
                windowSize = mascotSizePx,
                bubbleSize = mascotSizePx,
                screen = screenBounds
            )
            bubbleCenterX = placement.bubbleCenterX.toDouble()
            bubbleCenterY = placement.bubbleCenterY.toDouble()
            bParams.x = placement.windowX
            bParams.y = placement.windowY
            if (isBubbleAttached) {
                try {
                    wm.updateViewLayout(bubbleContainer, bParams)
                } catch (e: Exception) {
                    Log.w(TAG, "Error updating bubble layout", e)
                }
            }
        }

        // Drag listener on mascot bubble
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
                            if (targetOpen || isMenuExpanded) {
                                collapseMenu(animate = false)
                            }
                        }
                        if (isDragging) {
                            moveBubble(initialBubbleCenterX + dx, initialBubbleCenterY + dy)
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

        mascot.setOnClickListener {
            Log.i(TAG, "Mascot bubble tapped, toggling menu: current targetOpen=$targetOpen, expanded=$isMenuExpanded")
            if (targetOpen) {
                collapseMenu()
            } else {
                expandMenu()
            }
        }

        // Initial show: add menu window FIRST, then bubble window on top
        updateMenuPositions(bubbleCenterX, bubbleCenterY)
        wm.addView(menuContainer, mParams)
        isMenuAttached = true
        wm.addView(bubbleContainer, bParams)
        isBubbleAttached = true
        isMenuExpanded = true
        menuContainer.post {
            if (isMenuAttached) {
                updateMenuPositions(bubbleCenterX, bubbleCenterY)
            }
        }

        return bubbleContainer
    }

    private fun dpToPx(context: Context, dp: Float): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            context.resources.displayMetrics
        ).toInt()
    }
}
