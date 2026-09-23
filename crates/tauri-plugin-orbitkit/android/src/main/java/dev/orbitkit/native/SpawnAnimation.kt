package dev.orbitkit.native

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

/**
 * Pure animation and timing math for radial menu item spawn/collapse animations.
 * Invariants:
 * - Zero Android imports: pure Kotlin, fully testable on host JVM.
 * - Mascot bubble center is anchor: start translation offsets place items exactly at mascot centroid.
 * - Per-item duration: open is 220ms (OvershootInterpolator 1.2f), close is 180ms (AccelerateInterpolator).
 * - Stagger delays: 20ms per item for all items (uncapped); open is forward, close is reverse.
 * - Reversal math: scales remaining duration by distance fraction so speed is preserved.
 * - Decision helper: disabled if reduced motion (animatorScale == 0) or config is "none".
 */
object SpawnAnimation {

    const val DEFAULT_ANIMATION = "spawn"
    const val ANIMATION_NONE = "none"
    const val ANIMATION_SPAWN = "spawn"

    const val OPEN_DURATION_MS = 220L
    const val CLOSE_DURATION_MS = 180L
    const val DEFAULT_STAGGER_STEP_MS = 20L

    data class TranslationOffset(val x: Float, val y: Float)

    /**
     * Determines whether spawn animation should run.
     *
     * Returns false if system animator scale is 0 (reduced motion) or config is "none".
     * Defaults to true ("spawn") for null, empty, or unknown values.
     */
    @JvmStatic
    fun enabled(configValue: String?, animatorScale: Float): Boolean {
        if (animatorScale == 0f) {
            return false
        }
        val normalized = configValue?.lowercase()?.trim()
        if (normalized == ANIMATION_NONE) {
            return false
        }
        return true
    }

    /**
     * Computes initial translation offset so that an item centered at [itemFinalCenterX], [itemFinalCenterY]
     * in its final orbit position starts centered exactly at [mascotCenterX], [mascotCenterY].
     */
    @JvmStatic
    fun startOffset(
        mascotCenterX: Double,
        mascotCenterY: Double,
        itemFinalCenterX: Double,
        itemFinalCenterY: Double
    ): TranslationOffset {
        return TranslationOffset(
            x = (mascotCenterX - itemFinalCenterX).toFloat(),
            y = (mascotCenterY - itemFinalCenterY).toFloat()
        )
    }

    /**
     * Computes start translation offset given the item's on-screen bounding box [itemScreenX], [itemScreenY]
     * (clamped to screen bounds by OverlayGeometry) and its side [itemSize].
     */
    @JvmStatic
    fun startOffset(
        mascotCenterX: Double,
        mascotCenterY: Double,
        itemScreenX: Int,
        itemScreenY: Int,
        itemSize: Int
    ): TranslationOffset {
        val finalCenterX = itemScreenX + itemSize / 2.0
        val finalCenterY = itemScreenY + itemSize / 2.0
        return startOffset(mascotCenterX, mascotCenterY, finalCenterX, finalCenterY)
    }

    /**
     * Computes start delay in milliseconds for item at [index] out of [totalItems].
     *
     * Stagger is 20ms per item for all items (uncapped):
     * - Opening: forward order (index 0 starts first at 0ms delay).
     * - Closing: reverse order (index totalItems - 1 starts first at 0ms delay).
     */
    @JvmStatic
    fun staggerDelay(
        index: Int,
        totalItems: Int,
        isOpening: Boolean,
        stepMs: Long = DEFAULT_STAGGER_STEP_MS
    ): Long {
        if (totalItems <= 1 || index < 0 || index >= totalItems) {
            return 0L
        }
        val effectiveIndex = if (isOpening) index else (totalItems - 1 - index)
        return effectiveIndex * stepMs
    }

    /**
     * Returns the list of stagger delays for all items [0 until totalItems].
     */
    @JvmStatic
    fun staggerDelays(
        totalItems: Int,
        isOpening: Boolean,
        stepMs: Long = DEFAULT_STAGGER_STEP_MS
    ): List<Long> {
        if (totalItems <= 0) return emptyList()
        return (0 until totalItems).map { i ->
            staggerDelay(i, totalItems, isOpening, stepMs)
        }
    }

    /**
     * Computes current progress fraction in range [0f, 1f] from [currentValue] between [startValue] and [endValue].
     */
    @JvmStatic
    fun currentFraction(
        currentValue: Float,
        startValue: Float = 0f,
        endValue: Float = 1f
    ): Float {
        val range = endValue - startValue
        if (abs(range) < 1e-6f) return 1f
        val raw = (currentValue - startValue) / range
        return max(0f, min(1f, raw))
    }

    /**
     * Computes remaining animation duration in milliseconds when reversing mid-animation.
     * Traversed distance fraction scales the base duration so speed is preserved.
     */
    @JvmStatic
    fun reverseDuration(
        currentFraction: Float,
        targetFraction: Float,
        baseDurationMs: Long = OPEN_DURATION_MS,
        minDurationMs: Long = 0L
    ): Long {
        val distance = abs(targetFraction - currentFraction)
        val scaled = (baseDurationMs * distance).roundToLong()
        return max(minDurationMs, min(baseDurationMs, scaled))
    }

    /**
     * Linear interpolation helper.
     */
    @JvmStatic
    fun lerp(start: Float, end: Float, fraction: Float): Float {
        return start + (end - start) * max(0f, min(1f, fraction))
    }
}
