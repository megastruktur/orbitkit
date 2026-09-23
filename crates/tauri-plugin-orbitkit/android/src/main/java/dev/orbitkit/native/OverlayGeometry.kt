package dev.orbitkit.native

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Pure geometry for the Android SAW overlay window.
 *
 * Problem this solves: the overlay is one square window of [windowSize] px with the mascot bubble
 * drawn around a logical "bubble center" in screen coordinates. When the bubble sits near a screen edge,
 * the ideal window origin (center - half) would be off-screen, and WindowManager CLAMPS the window back
 * inside the display. Previously the mascot was always drawn at the window's center, so a clamp made it
 * visibly jump, and the stored bubble center silently drifted from what the user sees.
 *
 * Here the window origin is clamped explicitly (so we know exactly where WindowManager will put it), and
 * the mascot/items are offset INSIDE the window so the bubble stays exactly at [OverlayPlacement.bubbleCenterX],
 * [OverlayPlacement.bubbleCenterY] on screen, regardless of edge proximity or menu state.
 */
object OverlayGeometry {

    data class Bounds(val left: Int, val top: Int, val right: Int, val bottom: Int) {
        val width: Int get() = right - left
        val height: Int get() = bottom - top
    }

    data class OverlayPlacement(
        /** Window origin in screen px (what goes into WindowManager.LayoutParams.x/y). */
        val windowX: Int,
        val windowY: Int,
        /** Bubble center inside the window, px. */
        val localCenterX: Int,
        val localCenterY: Int,
        /** Bubble center on screen after clamping the bubble itself to stay fully visible. */
        val bubbleCenterX: Int,
        val bubbleCenterY: Int,
    )

    data class ItemMargin(
        val left: Int,
        val top: Int,
    )

    data class ItemPosition(
        val x: Int,
        val y: Int,
    ) {
        val left: Int get() = x
        val top: Int get() = y
    }

    /**
     * Computes the on-screen top-left coordinates for a menu item of size [itemSize] px
     * centered at ([bubbleCenterX] + [relX], [bubbleCenterY] + [relY]), clamped so the item
     * stays fully within [screen] bounds.
     */
    fun itemScreenPosition(
        bubbleCenterX: Double,
        bubbleCenterY: Double,
        relX: Double,
        relY: Double,
        itemSize: Int,
        screen: Bounds,
    ): ItemPosition {
        val halfItem = itemSize / 2.0
        val rawX = bubbleCenterX + relX - halfItem
        val rawY = bubbleCenterY + relY - halfItem
        val clampedX = clampWindow(rawX, screen.left, screen.right, itemSize)
        val clampedY = clampWindow(rawY, screen.top, screen.bottom, itemSize)
        return ItemPosition(x = clampedX, y = clampedY)
    }

    fun itemScreenPosition(
        bubbleCenterX: Int,
        bubbleCenterY: Int,
        relX: Double,
        relY: Double,
        itemSize: Int,
        screen: Bounds,
    ): ItemPosition = itemScreenPosition(
        bubbleCenterX = bubbleCenterX.toDouble(),
        bubbleCenterY = bubbleCenterY.toDouble(),
        relX = relX,
        relY = relY,
        itemSize = itemSize,
        screen = screen,
    )

    /**
     * Computes the FrameLayout left/top margins for a menu item given:
     * - [bubbleCenterX], [bubbleCenterY] on screen
     * - [relX], [relY] offset from bubble center
     * - [itemSize] item width/height
     * - [screen] screen usable bounds (for clamping item inside screen)
     * - [menuOriginX], [menuOriginY] on-screen top-left origin of the menu container
     */
    fun itemMargin(
        bubbleCenterX: Double,
        bubbleCenterY: Double,
        relX: Double,
        relY: Double,
        itemSize: Int,
        screen: Bounds,
        menuOriginX: Int = 0,
        menuOriginY: Int = 0,
    ): ItemMargin {
        val pos = itemScreenPosition(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen,
        )
        return ItemMargin(
            left = pos.x - menuOriginX,
            top = pos.y - menuOriginY,
        )
    }

    fun itemMargin(
        bubbleCenterX: Int,
        bubbleCenterY: Int,
        relX: Double,
        relY: Double,
        itemSize: Int,
        screen: Bounds,
        menuOriginX: Int = 0,
        menuOriginY: Int = 0,
    ): ItemMargin = itemMargin(
        bubbleCenterX = bubbleCenterX.toDouble(),
        bubbleCenterY = bubbleCenterY.toDouble(),
        relX = relX,
        relY = relY,
        itemSize = itemSize,
        screen = screen,
        menuOriginX = menuOriginX,
        menuOriginY = menuOriginY,
    )

    /**
     * Computes the FrameLayout left/top margins for a menu item of size [itemSize] px
     * offset by ([relX], [relY]) px from the bubble center, given the bubble center's
     * position ([localCenterX], [localCenterY]) within the menu window.
     */
    fun itemMargin(
        localCenterX: Int,
        localCenterY: Int,
        relX: Double,
        relY: Double,
        itemSize: Int,
    ): ItemMargin {
        val halfItem = itemSize / 2.0
        return ItemMargin(
            left = (localCenterX + relX - halfItem).roundToInt(),
            top = (localCenterY + relY - halfItem).roundToInt(),
        )
    }

    fun itemMargin(
        localCenterX: Int,
        localCenterY: Int,
        relX: Int,
        relY: Int,
        itemSize: Int,
    ): ItemMargin = itemMargin(
        localCenterX = localCenterX,
        localCenterY = localCenterY,
        relX = relX.toDouble(),
        relY = relY.toDouble(),
        itemSize = itemSize,
    )

    /**
     * @param desiredCenterX desired bubble center on screen (px)
     * @param desiredCenterY desired bubble center on screen (px)
     * @param windowSize square window side (px), e.g. 2*(radius+itemSize+pad) or mascotSize
     * @param bubbleSize mascot bubble diameter (px); the bubble is kept fully inside [screen]
     * @param screen usable screen area in px (the area WindowManager lets the overlay occupy)
     */
    fun place(
        desiredCenterX: Double,
        desiredCenterY: Double,
        windowSize: Int,
        bubbleSize: Int,
        screen: Bounds,
    ): OverlayPlacement {
        val halfBubble = bubbleSize / 2.0
        // 1) keep the bubble itself fully visible
        val cx = clamp(desiredCenterX, screen.left + halfBubble, screen.right - halfBubble)
        val cy = clamp(desiredCenterY, screen.top + halfBubble, screen.bottom - halfBubble)
        // 2) ideal window origin centers the bubble; clamp window inside the screen like WindowManager does
        val half = windowSize / 2.0
        val wx = clampWindow(cx - half, screen.left, screen.right, windowSize)
        val wy = clampWindow(cy - half, screen.top, screen.bottom, windowSize)
        val bcx = cx.roundToInt()
        val bcy = cy.roundToInt()
        // 3) bubble position relative to the (possibly clamped) window
        return OverlayPlacement(
            windowX = wx,
            windowY = wy,
            localCenterX = bcx - wx,
            localCenterY = bcy - wy,
            bubbleCenterX = bcx,
            bubbleCenterY = bcy,
        )
    }

    fun place(
        desiredCenterX: Int,
        desiredCenterY: Int,
        windowSize: Int,
        bubbleSize: Int,
        screen: Bounds,
    ): OverlayPlacement = place(
        desiredCenterX.toDouble(),
        desiredCenterY.toDouble(),
        windowSize,
        bubbleSize,
        screen
    )

    private fun clamp(v: Double, lo: Double, hi: Double): Double =
        if (hi < lo) (lo + hi) / 2.0 else min(max(v, lo), hi)

    /** Window of [size] along an axis [lo, hi): stays inside; if larger than the screen, pin to lo. */
    private fun clampWindow(origin: Double, lo: Int, hi: Int, size: Int): Int {
        val o = origin.roundToInt()
        if (size >= hi - lo) return lo
        return min(max(o, lo), hi - size)
    }
}
