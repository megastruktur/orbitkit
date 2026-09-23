package dev.orbitkit.native

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayGeometryTest {

    @Test
    fun testCenterOfScreenWindowCenteredAndBubbleCenterUnchanged() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 0, right = 1000, bottom = 1000)
        val windowSize = 400
        val bubbleSize = 100
        val placement = OverlayGeometry.place(
            desiredCenterX = 500,
            desiredCenterY = 500,
            windowSize = windowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        assertEquals("Window origin X should be centered around desired center", 300, placement.windowX)
        assertEquals("Window origin Y should be centered around desired center", 300, placement.windowY)
        assertEquals("Local center X should be half window size", 200, placement.localCenterX)
        assertEquals("Local center Y should be half window size", 200, placement.localCenterY)
        assertEquals("Bubble center X unchanged", 500, placement.bubbleCenterX)
        assertEquals("Bubble center Y unchanged", 500, placement.bubbleCenterY)
        assertEquals("Screen bubble X exact", placement.bubbleCenterX, placement.windowX + placement.localCenterX)
        assertEquals("Screen bubble Y exact", placement.bubbleCenterY, placement.windowY + placement.localCenterY)
    }

    @Test
    fun testNearLeftEdgeWindowClampedAndLocalCenterShifted() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 100, right = 1000, bottom = 2000)
        val windowSize = 400
        val bubbleSize = 100
        // Desired X = 100. Ideal window X = 100 - 200 = -100.
        // Screen left = 0, so window X clamps to 0.
        val placement = OverlayGeometry.place(
            desiredCenterX = 100,
            desiredCenterY = 500,
            windowSize = windowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        assertEquals("Window X clamped to screen.left", 0, placement.windowX)
        assertEquals("Bubble center X unchanged", 100, placement.bubbleCenterX)
        assertEquals("Local center X shifted so bubble stays put", 100, placement.localCenterX)
        assertEquals(
            "windowX + localCenterX == bubbleCenterX exact",
            placement.bubbleCenterX,
            placement.windowX + placement.localCenterX
        )
        assertEquals(
            "windowY + localCenterY == bubbleCenterY exact",
            placement.bubbleCenterY,
            placement.windowY + placement.localCenterY
        )
    }

    @Test
    fun testNearTopEdgeWindowClampedAndLocalCenterShifted() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 100, right = 1000, bottom = 2000)
        val windowSize = 400
        val bubbleSize = 100
        // Desired Y = 200. Ideal window Y = 200 - 200 = 0.
        // Screen top = 100, so window Y clamps to 100.
        val placement = OverlayGeometry.place(
            desiredCenterX = 500,
            desiredCenterY = 200,
            windowSize = windowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        assertEquals("Window Y clamped to screen.top", 100, placement.windowY)
        assertEquals("Bubble center Y unchanged", 200, placement.bubbleCenterY)
        assertEquals("Local center Y shifted so bubble stays put", 100, placement.localCenterY)
        assertEquals(
            "windowY + localCenterY == bubbleCenterY exact",
            placement.bubbleCenterY,
            placement.windowY + placement.localCenterY
        )
        assertEquals(
            "windowX + localCenterX == bubbleCenterX exact",
            placement.bubbleCenterX,
            placement.windowX + placement.localCenterX
        )
    }

    @Test
    fun testNearRightEdgeWindowClampedAndLocalCenterShifted() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 100, right = 1000, bottom = 2000)
        val windowSize = 400
        val bubbleSize = 100
        // Desired X = 900. Ideal window X = 900 - 200 = 700.
        // Screen right = 1000, so max window X = 1000 - 400 = 600. Window X clamps to 600.
        val placement = OverlayGeometry.place(
            desiredCenterX = 900,
            desiredCenterY = 500,
            windowSize = windowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        assertEquals("Window X clamped to screen.right - windowSize", 600, placement.windowX)
        assertEquals("Bubble center X unchanged", 900, placement.bubbleCenterX)
        assertEquals("Local center X shifted so bubble stays put", 300, placement.localCenterX)
        assertEquals(
            "windowX + localCenterX == bubbleCenterX exact",
            placement.bubbleCenterX,
            placement.windowX + placement.localCenterX
        )
        assertEquals(
            "windowY + localCenterY == bubbleCenterY exact",
            placement.bubbleCenterY,
            placement.windowY + placement.localCenterY
        )
    }

    @Test
    fun testNearBottomEdgeWindowClampedAndLocalCenterShifted() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 100, right = 1000, bottom = 2000)
        val windowSize = 400
        val bubbleSize = 100
        // Desired Y = 1900. Ideal window Y = 1900 - 200 = 1700.
        // Screen bottom = 2000, so max window Y = 2000 - 400 = 1600. Window Y clamps to 1600.
        val placement = OverlayGeometry.place(
            desiredCenterX = 500,
            desiredCenterY = 1900,
            windowSize = windowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        assertEquals("Window Y clamped to screen.bottom - windowSize", 1600, placement.windowY)
        assertEquals("Bubble center Y unchanged", 1900, placement.bubbleCenterY)
        assertEquals("Local center Y shifted so bubble stays put", 300, placement.localCenterY)
        assertEquals(
            "windowY + localCenterY == bubbleCenterY exact",
            placement.bubbleCenterY,
            placement.windowY + placement.localCenterY
        )
        assertEquals(
            "windowX + localCenterX == bubbleCenterX exact",
            placement.bubbleCenterX,
            placement.windowX + placement.localCenterX
        )
    }

    @Test
    fun testInvariantOverGridOfCentersAndBothWindowSizes() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val bubbleSize = 168
        val windowSizes = listOf(936, 168)

        for (windowSize in windowSizes) {
            for (desiredX in -200..1300 step 50) {
                for (desiredY in -200..2700 step 100) {
                    val p = OverlayGeometry.place(
                        desiredCenterX = desiredX.toDouble(),
                        desiredCenterY = desiredY.toDouble(),
                        windowSize = windowSize,
                        bubbleSize = bubbleSize,
                        screen = screen
                    )

                    // 1) windowX + localCenterX == bubbleCenterX (exact, per axis)
                    assertEquals(
                        "X axis identity failed for wSize=$windowSize at ($desiredX, $desiredY)",
                        p.bubbleCenterX,
                        p.windowX + p.localCenterX
                    )
                    assertEquals(
                        "Y axis identity failed for wSize=$windowSize at ($desiredX, $desiredY)",
                        p.bubbleCenterY,
                        p.windowY + p.localCenterY
                    )

                    // 2) window fully inside screen
                    assertTrue("Window left inside screen", p.windowX >= screen.left)
                    assertTrue("Window right inside screen", p.windowX + windowSize <= screen.right)
                    assertTrue("Window top inside screen", p.windowY >= screen.top)
                    assertTrue("Window bottom inside screen", p.windowY + windowSize <= screen.bottom)

                    // 3) bubble fully inside screen
                    val halfBubble = bubbleSize / 2
                    assertTrue("Bubble left inside screen", p.bubbleCenterX - halfBubble >= screen.left)
                    assertTrue("Bubble right inside screen", p.bubbleCenterX + halfBubble <= screen.right)
                    assertTrue("Bubble top inside screen", p.bubbleCenterY - halfBubble >= screen.top)
                    assertTrue("Bubble bottom inside screen", p.bubbleCenterY + halfBubble <= screen.bottom)
                }
            }
        }
    }

    @Test
    fun testToggleInvariantExpandedAndCollapsedBubbleCenterMatch() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val expandedWindowSize = 936
        val collapsedWindowSize = 168
        val bubbleSize = 168

        // Test over a range of coordinates from left/top edges to right/bottom edges
        for (desiredX in -100..1200 step 25) {
            for (desiredY in 0..2600 step 50) {
                val expanded = OverlayGeometry.place(
                    desiredCenterX = desiredX.toDouble(),
                    desiredCenterY = desiredY.toDouble(),
                    windowSize = expandedWindowSize,
                    bubbleSize = bubbleSize,
                    screen = screen
                )
                val collapsed = OverlayGeometry.place(
                    desiredCenterX = desiredX.toDouble(),
                    desiredCenterY = desiredY.toDouble(),
                    windowSize = collapsedWindowSize,
                    bubbleSize = bubbleSize,
                    screen = screen
                )

                assertEquals(
                    "Bubble center X must match between expanded and collapsed at ($desiredX, $desiredY)",
                    expanded.bubbleCenterX,
                    collapsed.bubbleCenterX
                )
                assertEquals(
                    "Bubble center Y must match between expanded and collapsed at ($desiredX, $desiredY)",
                    expanded.bubbleCenterY,
                    collapsed.bubbleCenterY
                )
                assertEquals(
                    "Screen position X must match between expanded and collapsed at ($desiredX, $desiredY)",
                    expanded.windowX + expanded.localCenterX,
                    collapsed.windowX + collapsed.localCenterX
                )
                assertEquals(
                    "Screen position Y must match between expanded and collapsed at ($desiredX, $desiredY)",
                    expanded.windowY + expanded.localCenterY,
                    collapsed.windowY + collapsed.localCenterY
                )
            }
        }
    }

    @Test
    fun testWindowLargerThanScreenPinnedToScreenLeftTopNoCrash() {
        val screen = OverlayGeometry.Bounds(left = 100, top = 200, right = 800, bottom = 900)
        val windowSize = 1200
        val bubbleSize = 100
        val placement = OverlayGeometry.place(
            desiredCenterX = 450,
            desiredCenterY = 550,
            windowSize = windowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        assertEquals("Window X pinned to screen.left when larger than screen", screen.left, placement.windowX)
        assertEquals("Window Y pinned to screen.top when larger than screen", screen.top, placement.windowY)
        assertEquals("Bubble center X unchanged", 450, placement.bubbleCenterX)
        assertEquals("Bubble center Y unchanged", 550, placement.bubbleCenterY)
        assertEquals(
            "Screen X identity holds even for oversized window",
            placement.bubbleCenterX,
            placement.windowX + placement.localCenterX
        )
        assertEquals(
            "Screen Y identity holds even for oversized window",
            placement.bubbleCenterY,
            placement.windowY + placement.localCenterY
        )
    }

    @Test
    fun testBubbleDraggedPartlyOffScreenClampedToStayFullyVisible() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val bubbleSize = 168
        val halfBubble = bubbleSize / 2

        // 1) Dragged off left edge
        val offLeft = OverlayGeometry.place(-50, 500, 168, bubbleSize, screen)
        assertEquals("Clamped to left edge", screen.left + halfBubble, offLeft.bubbleCenterX)
        assertTrue("Bubble left at screen.left", offLeft.bubbleCenterX - halfBubble >= screen.left)

        // 2) Dragged off right edge
        val offRight = OverlayGeometry.place(1500, 500, 168, bubbleSize, screen)
        assertEquals("Clamped to right edge", screen.right - halfBubble, offRight.bubbleCenterX)
        assertTrue("Bubble right at screen.right", offRight.bubbleCenterX + halfBubble <= screen.right)

        // 3) Dragged off top edge
        val offTop = OverlayGeometry.place(500, -50, 168, bubbleSize, screen)
        assertEquals("Clamped to top edge", screen.top + halfBubble, offTop.bubbleCenterY)
        assertTrue("Bubble top at screen.top", offTop.bubbleCenterY - halfBubble >= screen.top)

        // 4) Dragged off bottom edge
        val offBottom = OverlayGeometry.place(500, 3000, 168, bubbleSize, screen)
        assertEquals("Clamped to bottom edge", screen.bottom - halfBubble, offBottom.bubbleCenterY)
        assertTrue("Bubble bottom at screen.bottom", offBottom.bubbleCenterY + halfBubble <= screen.bottom)
    }

    @Test
    fun testDeviceReproductionZFlip7Coordinates() {
        // Measured on Z Flip 7:
        // Screen bounds parent=[0,0][1080,2475] with top inset 116 (status bar) -> [0, 116, 1080, 2475]
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val collapsedWindowSize = 168
        val expandedWindowSize = 936
        val bubbleSize = 168

        // Collapsed bubble dragged to center (124, 303)
        val collapsed = OverlayGeometry.place(
            desiredCenterX = 124,
            desiredCenterY = 303,
            windowSize = collapsedWindowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        // Window placed at (124 - 84 = 40, 303 - 84 = 219)
        assertEquals(40, collapsed.windowX)
        assertEquals(219, collapsed.windowY)
        assertEquals(84, collapsed.localCenterX)
        assertEquals(84, collapsed.localCenterY)
        assertEquals(124, collapsed.bubbleCenterX)
        assertEquals(303, collapsed.bubbleCenterY)
        assertEquals(124, collapsed.windowX + collapsed.localCenterX)
        assertEquals(303, collapsed.windowY + collapsed.localCenterY)

        // Tap -> expands to 936x936 window
        val expanded = OverlayGeometry.place(
            desiredCenterX = collapsed.bubbleCenterX,
            desiredCenterY = collapsed.bubbleCenterY,
            windowSize = expandedWindowSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        // WindowManager clamps window to [0, 116]
        assertEquals(0, expanded.windowX)
        assertEquals(116, expanded.windowY)
        // Mascot offset inside window shifts to preserve on-screen position (124, 303)
        assertEquals(124, expanded.localCenterX)
        assertEquals(187, expanded.localCenterY)
        assertEquals(124, expanded.bubbleCenterX)
        assertEquals(303, expanded.bubbleCenterY)
        // Screen position is IDENTICAL: no jump!
        assertEquals(124, expanded.windowX + expanded.localCenterX)
        assertEquals(303, expanded.windowY + expanded.localCenterY)
    }

    @Test
    fun testItemMarginComputation() {
        val localCenterX = 124
        val localCenterY = 187
        val itemSize = 48
        val relX = 100.0
        val relY = -50.0

        val margin = OverlayGeometry.itemMargin(
            localCenterX = localCenterX,
            localCenterY = localCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize
        )

        // left = round(124 + 100 - 24) = 200
        assertEquals(200, margin.left)
        // top = round(187 - 50 - 24) = 113
        assertEquals(113, margin.top)

        // Item center in menu window:
        val itemLocalCenterX = margin.left + itemSize / 2
        val itemLocalCenterY = margin.top + itemSize / 2
        assertEquals(224, itemLocalCenterX)
        assertEquals(137, itemLocalCenterY)
    }

    @Test
    fun testTwoWindowAbsoluteItemPositionsMatchBubbleCenter() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val bubbleSize = 168
        val menuSize = 936
        val itemSize = 48

        // Test near left edge (Z Flip 7 coordinate)
        val desiredCenterX = 124.0
        val desiredCenterY = 303.0

        val bubblePlacement = OverlayGeometry.place(
            desiredCenterX = desiredCenterX,
            desiredCenterY = desiredCenterY,
            windowSize = bubbleSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        val menuPlacement = OverlayGeometry.place(
            desiredCenterX = bubblePlacement.bubbleCenterX.toDouble(),
            desiredCenterY = bubblePlacement.bubbleCenterY.toDouble(),
            windowSize = menuSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        // Radial offsets around the circle
        val angles = listOf(0.0, 60.0, 120.0, 180.0, 240.0, 300.0)
        val radius = 240.0
        for (deg in angles) {
            val rad = Math.toRadians(deg)
            val relX = radius * kotlin.math.cos(rad)
            val relY = radius * kotlin.math.sin(rad)

            val margin = OverlayGeometry.itemMargin(
                localCenterX = menuPlacement.localCenterX,
                localCenterY = menuPlacement.localCenterY,
                relX = relX,
                relY = relY,
                itemSize = itemSize
            )

            val itemScreenCenterX = menuPlacement.windowX + margin.left + itemSize / 2.0
            val itemScreenCenterY = menuPlacement.windowY + margin.top + itemSize / 2.0

            val expectedScreenCenterX = bubblePlacement.bubbleCenterX + relX
            val expectedScreenCenterY = bubblePlacement.bubbleCenterY + relY

            assertEquals(expectedScreenCenterX, itemScreenCenterX, 1.0)
            assertEquals(expectedScreenCenterY, itemScreenCenterY, 1.0)
        }
    }

    @Test
    fun testBubbleWindowPositionIndependentOfMenuState() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val bubbleSize = 168

        // Bubble window is ALWAYS placed with windowSize = bubbleSize
        val p1 = OverlayGeometry.place(
            desiredCenterX = 124.0,
            desiredCenterY = 303.0,
            windowSize = bubbleSize,
            bubbleSize = bubbleSize,
            screen = screen
        )

        // During toggle expand or collapse, the bubble window parameters are NEVER changed
        assertEquals(40, p1.windowX)
        assertEquals(219, p1.windowY)
        assertEquals(124, p1.bubbleCenterX)
        assertEquals(303, p1.bubbleCenterY)
        assertEquals(84, p1.localCenterX)
        assertEquals(84, p1.localCenterY)
    }

    @Test
    fun testItemScreenPositionCenterOfScreenNoClamping() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val bubbleCenterX = 500.0
        val bubbleCenterY = 800.0
        val relX = 120.0
        val relY = -80.0
        val itemSize = 48

        val pos = OverlayGeometry.itemScreenPosition(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen
        )

        // Center: 500 + 120 = 620, top-left: 620 - 24 = 596
        // Center: 800 - 80 = 720, top-left: 720 - 24 = 696
        assertEquals(596, pos.x)
        assertEquals(696, pos.y)
        assertEquals(pos.x, pos.left)
        assertEquals(pos.y, pos.top)
        assertTrue("Item left inside screen", pos.x >= screen.left)
        assertTrue("Item right inside screen", pos.x + itemSize <= screen.right)
        assertTrue("Item top inside screen", pos.y >= screen.top)
        assertTrue("Item bottom inside screen", pos.y + itemSize <= screen.bottom)
    }

    @Test
    fun testItemScreenPositionClampedNearLeftAndTopEdges() {
        val screen = OverlayGeometry.Bounds(left = 50, top = 100, right = 1000, bottom = 2000)
        val bubbleCenterX = 60.0
        val bubbleCenterY = 110.0
        val relX = -100.0 // Desired center = -40, raw left = -40 - 24 = -64
        val relY = -80.0  // Desired center = 30, raw top = 30 - 24 = 6
        val itemSize = 48

        val pos = OverlayGeometry.itemScreenPosition(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen
        )

        // Should be clamped to screen.left and screen.top
        assertEquals("Item clamped to screen.left", screen.left, pos.x)
        assertEquals("Item clamped to screen.top", screen.top, pos.y)
        assertTrue("Item left inside screen", pos.x >= screen.left)
        assertTrue("Item top inside screen", pos.y >= screen.top)
    }

    @Test
    fun testItemScreenPositionClampedNearRightAndBottomEdges() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 100, right = 1000, bottom = 2000)
        val bubbleCenterX = 980.0
        val bubbleCenterY = 1950.0
        val relX = 150.0 // Desired center = 1130, raw left = 1130 - 24 = 1106
        val relY = 120.0 // Desired center = 2070, raw top = 2070 - 24 = 2046
        val itemSize = 48

        val pos = OverlayGeometry.itemScreenPosition(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen
        )

        // Should be clamped to screen.right - itemSize and screen.bottom - itemSize
        val expectedMaxX = screen.right - itemSize
        val expectedMaxY = screen.bottom - itemSize
        assertEquals("Item clamped to screen.right - itemSize", expectedMaxX, pos.x)
        assertEquals("Item clamped to screen.bottom - itemSize", expectedMaxY, pos.y)
        assertEquals("Item right edge at screen.right", screen.right, pos.x + itemSize)
        assertEquals("Item bottom edge at screen.bottom", screen.bottom, pos.y + itemSize)
    }

    @Test
    fun testItemScreenPositionWithScreenSmallerThanItemPinsToOrigin() {
        val screen = OverlayGeometry.Bounds(left = 20, top = 30, right = 50, bottom = 60)
        val itemSize = 64 // width 30 < 64, height 30 < 64

        val pos = OverlayGeometry.itemScreenPosition(
            bubbleCenterX = 35.0,
            bubbleCenterY = 45.0,
            relX = 0.0,
            relY = 0.0,
            itemSize = itemSize,
            screen = screen
        )

        assertEquals("Pins to screen.left when screen smaller than item", screen.left, pos.x)
        assertEquals("Pins to screen.top when screen smaller than item", screen.top, pos.y)
    }

    @Test
    fun testItemMarginWithMenuWindowOriginOffset() {
        val screen = OverlayGeometry.Bounds(left = 0, top = 116, right = 1080, bottom = 2475)
        val bubbleCenterX = 500.0
        val bubbleCenterY = 600.0
        val relX = 100.0
        val relY = 50.0
        val itemSize = 48

        // Menu origin at (0, 0)
        val marginZeroOrigin = OverlayGeometry.itemMargin(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen,
            menuOriginX = 0,
            menuOriginY = 0
        )
        val screenPos = OverlayGeometry.itemScreenPosition(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen
        )
        assertEquals(screenPos.x, marginZeroOrigin.left)
        assertEquals(screenPos.y, marginZeroOrigin.top)

        // Menu origin with offset (e.g. 50, 100)
        val menuOriginX = 50
        val menuOriginY = 100
        val marginOffsetOrigin = OverlayGeometry.itemMargin(
            bubbleCenterX = bubbleCenterX,
            bubbleCenterY = bubbleCenterY,
            relX = relX,
            relY = relY,
            itemSize = itemSize,
            screen = screen,
            menuOriginX = menuOriginX,
            menuOriginY = menuOriginY
        )
        assertEquals(screenPos.x - menuOriginX, marginOffsetOrigin.left)
        assertEquals(screenPos.y - menuOriginY, marginOffsetOrigin.top)
    }
}
