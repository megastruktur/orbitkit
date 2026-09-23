package dev.orbitkit.native

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpawnAnimationTest {

    @Test
    fun testDurationAndStaggerConstants() {
        assertEquals("Open duration must be 220ms per item", 220L, SpawnAnimation.OPEN_DURATION_MS)
        assertEquals("Close duration must be 180ms per item", 180L, SpawnAnimation.CLOSE_DURATION_MS)
        assertEquals("Stagger step must be 20ms per item", 20L, SpawnAnimation.DEFAULT_STAGGER_STEP_MS)
    }

    @Test
    fun testStartOffsetCentersItemOnMascotUnclamped() {
        val mascotCenterX = 500.0
        val mascotCenterY = 600.0
        val itemScreenX = 400
        val itemScreenY = 450
        val itemSize = 48

        val offset = SpawnAnimation.startOffset(
            mascotCenterX = mascotCenterX,
            mascotCenterY = mascotCenterY,
            itemScreenX = itemScreenX,
            itemScreenY = itemScreenY,
            itemSize = itemSize
        )

        val finalCenterX = itemScreenX + itemSize / 2.0 // 424.0
        val finalCenterY = itemScreenY + itemSize / 2.0 // 474.0

        assertEquals(
            "Start X translation must be mascotCenterX - finalCenterX",
            (mascotCenterX - finalCenterX).toFloat(),
            offset.x,
            0.001f
        )
        assertEquals(
            "Start Y translation must be mascotCenterY - finalCenterY",
            (mascotCenterY - finalCenterY).toFloat(),
            offset.y,
            0.001f
        )
        // With start offset applied, the item center is exactly mascot center
        assertEquals(
            "Final center X + offset.x == mascotCenterX",
            mascotCenterX,
            finalCenterX + offset.x.toDouble(),
            0.001
        )
        assertEquals(
            "Final center Y + offset.y == mascotCenterY",
            mascotCenterY,
            finalCenterY + offset.y.toDouble(),
            0.001
        )
    }

    @Test
    fun testStartOffsetWhenItemClampedToScreenEdges() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 100, right = 1080, bottom = 2400)
        val mascotCenterX = 80.0
        val mascotCenterY = 250.0
        val itemSize = 48
        val relX = -120.0 // rawX would be 80 - 120 - 24 = -64 (off-screen left)
        val relY = 0.0

        // OverlayGeometry clamps to screen.left = 0
        val pos = OverlayGeometry.itemScreenPosition(
            bubbleCenterX = mascotCenterX,
            bubbleCenterY = mascotCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen
        )
        assertEquals("Item clamped to screen left", 0, pos.x)

        val offset = SpawnAnimation.startOffset(
            mascotCenterX = mascotCenterX,
            mascotCenterY = mascotCenterY,
            itemScreenX = pos.x,
            itemScreenY = pos.y,
            itemSize = itemSize
        )

        val clampedFinalCenterX = pos.x + itemSize / 2.0
        val clampedFinalCenterY = pos.y + itemSize / 2.0

        // Invariant: Even though item is clamped against edge, start offset places it exactly at mascot
        assertEquals(
            "Item starts exactly at mascotCenterX despite edge clamp",
            mascotCenterX,
            clampedFinalCenterX + offset.x.toDouble(),
            0.001
        )
        assertEquals(
            "Item starts exactly at mascotCenterY despite edge clamp",
            mascotCenterY,
            clampedFinalCenterY + offset.y.toDouble(),
            0.001
        )
    }

    @Test
    fun testStaggerDelaysForFiveItems() {
        val totalItems = 5
        val openDelays = SpawnAnimation.staggerDelays(totalItems = totalItems, isOpening = true)
        assertEquals("Must return delays for all 5 items", 5, openDelays.size)
        assertEquals("Item 0 starts at 0ms", 0L, openDelays[0])
        assertEquals("Item 1 starts at 20ms", 20L, openDelays[1])
        assertEquals("Item 2 starts at 40ms", 40L, openDelays[2])
        assertEquals("Item 3 starts at 60ms", 60L, openDelays[3])
        assertEquals("Item 4 starts at 80ms (uncapped beyond 60ms)", 80L, openDelays[4])
        assertEquals(listOf(0L, 20L, 40L, 60L, 80L), openDelays)

        val closeDelays = SpawnAnimation.staggerDelays(totalItems = totalItems, isOpening = false)
        assertEquals("Must return delays for all 5 items", 5, closeDelays.size)
        assertEquals("Item 0 closes last at 80ms", 80L, closeDelays[0])
        assertEquals("Item 1 closes at 60ms", 60L, closeDelays[1])
        assertEquals("Item 2 closes at 40ms", 40L, closeDelays[2])
        assertEquals("Item 3 closes at 20ms", 20L, closeDelays[3])
        assertEquals("Item 4 starts closing first at 0ms", 0L, closeDelays[4])
        assertEquals(listOf(80L, 60L, 40L, 20L, 0L), closeDelays)
    }

    @Test
    fun testStaggerDelaysForTwelveItems() {
        val totalItems = 12
        val openDelays = SpawnAnimation.staggerDelays(totalItems = totalItems, isOpening = true)
        assertEquals("Must return delays for all 12 items", 12, openDelays.size)
        val expectedOpen = (0 until 12).map { it * 20L }
        assertEquals(expectedOpen, openDelays)
        assertEquals("First item starts at 0ms", 0L, openDelays[0])
        assertEquals("Last item delay is 220ms (uncapped)", 220L, openDelays[11])

        val closeDelays = SpawnAnimation.staggerDelays(totalItems = totalItems, isOpening = false)
        assertEquals("Must return delays for all 12 items", 12, closeDelays.size)
        val expectedClose = (0 until 12).map { (11 - it) * 20L }
        assertEquals(expectedClose, closeDelays)
        assertEquals("First item closes last at 220ms (uncapped)", 220L, closeDelays[0])
        assertEquals("Last item starts closing at 0ms", 0L, closeDelays[11])
    }
    @Test
    fun testStaggerDelaySingleItemAndZeroItems() {
        assertEquals(0L, SpawnAnimation.staggerDelay(0, 1, isOpening = true))
        assertEquals(0L, SpawnAnimation.staggerDelay(0, 1, isOpening = false))
        assertEquals(emptyList<Long>(), SpawnAnimation.staggerDelays(0, isOpening = true))
    }

    @Test
    fun testReverseDurationProportionalToRemainingDistance() {
        // Open duration (220ms base)
        val openHalf = SpawnAnimation.reverseDuration(
            currentFraction = 0.5f,
            targetFraction = 1.0f,
            baseDurationMs = SpawnAnimation.OPEN_DURATION_MS
        )
        assertEquals("Remaining 50% to open takes 110ms", 110L, openHalf)

        val openQuarter = SpawnAnimation.reverseDuration(
            currentFraction = 0.75f,
            targetFraction = 1.0f,
            baseDurationMs = SpawnAnimation.OPEN_DURATION_MS
        )
        assertEquals("Remaining 25% to open takes 55ms", 55L, openQuarter)

        // Close duration (180ms base)
        val closeHalf = SpawnAnimation.reverseDuration(
            currentFraction = 0.5f,
            targetFraction = 0.0f,
            baseDurationMs = SpawnAnimation.CLOSE_DURATION_MS
        )
        assertEquals("50% progress takes 90ms to reverse to closed", 90L, closeHalf)

        val closeQuarter = SpawnAnimation.reverseDuration(
            currentFraction = 0.25f,
            targetFraction = 0.0f,
            baseDurationMs = SpawnAnimation.CLOSE_DURATION_MS
        )
        assertEquals("25% progress takes 45ms to reverse to closed", 45L, closeQuarter)

        val closeFull = SpawnAnimation.reverseDuration(
            currentFraction = 1.0f,
            targetFraction = 0.0f,
            baseDurationMs = SpawnAnimation.CLOSE_DURATION_MS
        )
        assertEquals("100% progress takes full 180ms to close", 180L, closeFull)

        // Already at target: 0 duration
        val zeroDuration = SpawnAnimation.reverseDuration(
            currentFraction = 1.0f,
            targetFraction = 1.0f,
            baseDurationMs = SpawnAnimation.OPEN_DURATION_MS
        )
        assertEquals(0L, zeroDuration)
    }

    @Test
    fun testCurrentFractionAndLerp() {
        assertEquals(0f, SpawnAnimation.currentFraction(0f, 0f, 1f), 0.001f)
        assertEquals(0.5f, SpawnAnimation.currentFraction(0.5f, 0f, 1f), 0.001f)
        assertEquals(1f, SpawnAnimation.currentFraction(1f, 0f, 1f), 0.001f)
        // Clamp out-of-bounds and interpolator overshoot
        assertEquals(0f, SpawnAnimation.currentFraction(-0.2f, 0f, 1f), 0.001f)
        assertEquals(1f, SpawnAnimation.currentFraction(1.2f, 0f, 1f), 0.001f)
        assertEquals(1f, SpawnAnimation.currentFraction(1.5f, 0f, 1f), 0.001f)

        assertEquals(10f, SpawnAnimation.lerp(10f, 20f, 0f), 0.001f)
        assertEquals(15f, SpawnAnimation.lerp(10f, 20f, 0.5f), 0.001f)
        assertEquals(20f, SpawnAnimation.lerp(10f, 20f, 1f), 0.001f)
    }

    @Test
    fun testAnimationEnabledDecision() {
        // Reduced motion: scale == 0 disables animation regardless of config
        assertFalse(SpawnAnimation.enabled("spawn", 0f))
        assertFalse(SpawnAnimation.enabled(null, 0f))
        assertFalse(SpawnAnimation.enabled("none", 0f))
        assertFalse(SpawnAnimation.enabled("invalid", 0f))

        // Normal motion (scale == 1f)
        assertTrue(SpawnAnimation.enabled("spawn", 1f))
        assertTrue(SpawnAnimation.enabled("SPAWN", 1f))
        assertTrue(SpawnAnimation.enabled(" spawn ", 1f))

        // Config is "none" disables animation
        assertFalse(SpawnAnimation.enabled("none", 1f))
        assertFalse(SpawnAnimation.enabled("NONE", 1f))
        assertFalse(SpawnAnimation.enabled(" none ", 1f))

        // Missing / null defaults to "spawn" -> enabled
        assertTrue(SpawnAnimation.enabled(null, 1f))

        // Unknown / garbage falls back to "spawn" -> enabled
        assertTrue(SpawnAnimation.enabled("garbage", 1f))
        assertTrue(SpawnAnimation.enabled("", 1f))
    }
}
