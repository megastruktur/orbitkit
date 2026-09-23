package dev.orbitkit.native

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * 2D coordinates and orientation for a radial menu item relative to the menu center.
 * x: horizontal offset in pixels (positive = right)
 * y: vertical offset in pixels (positive = down)
 * angle: angle in degrees (0 = right, clockwise)
 */
data class ItemPosition(
    val x: Double,
    val y: Double,
    val angle: Double
)

/**
 * Pure geometry helper computing radial layout coordinates and angles.
 * Mirrors K3 geometry semantics (layoutItems in @orbitkit/ui geometry.ts).
 */
object RadialLayout {
    private fun round2(v: Double): Double {
        val rounded = Math.round(v * 100.0) / 100.0
        return if (rounded == -0.0) 0.0 else rounded
    }

    /**
     * Computes layout coordinates and angles for radial menu items.
     *
     * @param n Number of items to place
     * @param radiusPx Distance from center in pixels
     * @param startDeg Start angle in degrees (0 = right, clockwise screen y down)
     * @param endDeg End angle in degrees
     * @return List of item positions relative to center, rounded to 0.01 precision
     */
    @JvmStatic
    fun positions(n: Int, radiusPx: Double, startDeg: Double, endDeg: Double): List<ItemPosition> {
        if (n <= 0) return emptyList()

        val span = endDeg - startDeg
        val isFullRing = abs(span) >= 360.0

        if (isFullRing) {
            if (n == 1) {
                val rad = startDeg * PI / 180.0
                return listOf(
                    ItemPosition(
                        x = round2(radiusPx * cos(rad)),
                        y = round2(radiusPx * sin(rad)),
                        angle = round2(startDeg)
                    )
                )
            }

            val step = (if (span >= 0) 360.0 else -360.0) / n
            val result = ArrayList<ItemPosition>(n)
            for (i in 0 until n) {
                val angle = startDeg + i * step
                val rad = angle * PI / 180.0
                result.add(
                    ItemPosition(
                        x = round2(radiusPx * cos(rad)),
                        y = round2(radiusPx * sin(rad)),
                        angle = round2(angle)
                    )
                )
            }
            return result
        } else {
            if (n == 1) {
                val angle = (startDeg + endDeg) / 2.0
                val rad = angle * PI / 180.0
                return listOf(
                    ItemPosition(
                        x = round2(radiusPx * cos(rad)),
                        y = round2(radiusPx * sin(rad)),
                        angle = round2(angle)
                    )
                )
            }

            val step = span / (n - 1)
            val result = ArrayList<ItemPosition>(n)
            for (i in 0 until n) {
                val angle = if (i == n - 1) endDeg else startDeg + i * step
                val rad = angle * PI / 180.0
                result.add(
                    ItemPosition(
                        x = round2(radiusPx * cos(rad)),
                        y = round2(radiusPx * sin(rad)),
                        angle = round2(angle)
                    )
                )
            }
            return result
        }
    }

    @JvmStatic
    fun positions(n: Int, radiusPx: Float, startDeg: Float, endDeg: Float): List<ItemPosition> =
        positions(n, radiusPx.toDouble(), startDeg.toDouble(), endDeg.toDouble())
}
