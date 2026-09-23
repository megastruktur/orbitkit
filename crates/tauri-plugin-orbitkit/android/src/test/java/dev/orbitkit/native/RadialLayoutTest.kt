package dev.orbitkit.native

import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RadialLayoutTest {

    private val DELTA = 0.001

    @Test
    fun testFullRingFourItemsProducesCardinalPoints() {
        // Full ring n=4 distributes 4 cardinal points without duplicating endpoint (0..360)
        val points = RadialLayout.positions(4, 100.0, 0.0, 360.0)
        assertEquals(4, points.size)

        // 0 deg: right (100, 0)
        assertEquals(100.0, points[0].x, DELTA)
        assertEquals(0.0, points[0].y, DELTA)
        assertEquals(0.0, points[0].angle, DELTA)

        // 90 deg: down (0, 100)
        assertEquals(0.0, points[1].x, DELTA)
        assertEquals(100.0, points[1].y, DELTA)
        assertEquals(90.0, points[1].angle, DELTA)

        // 180 deg: left (-100, 0)
        assertEquals(-100.0, points[2].x, DELTA)
        assertEquals(0.0, points[2].y, DELTA)
        assertEquals(180.0, points[2].angle, DELTA)

        // 270 deg: up (0, -100)
        assertEquals(0.0, points[3].x, DELTA)
        assertEquals(-100.0, points[3].y, DELTA)
        assertEquals(270.0, points[3].angle, DELTA)
    }

    @Test
    fun testFullRingNegativeStartAngleProducesCardinalPoints() {
        // Full ring n=4 with negative start angle (-90..270) produces 4 cardinal points
        val points = RadialLayout.positions(4, 100.0, -90.0, 270.0)
        assertEquals(4, points.size)

        // -90 deg: up (0, -100)
        assertEquals(0.0, points[0].x, DELTA)
        assertEquals(-100.0, points[0].y, DELTA)
        assertEquals(-90.0, points[0].angle, DELTA)

        // 0 deg: right (100, 0)
        assertEquals(100.0, points[1].x, DELTA)
        assertEquals(0.0, points[1].y, DELTA)
        assertEquals(0.0, points[1].angle, DELTA)

        // 90 deg: down (0, 100)
        assertEquals(0.0, points[2].x, DELTA)
        assertEquals(100.0, points[2].y, DELTA)
        assertEquals(90.0, points[2].angle, DELTA)

        // 180 deg: left (-100, 0)
        assertEquals(-100.0, points[3].x, DELTA)
        assertEquals(0.0, points[3].y, DELTA)
        assertEquals(180.0, points[3].angle, DELTA)
    }

    @Test
    fun testPartialArcEndpointsAndMidpoint() {
        // Partial arc -90..90 n=3 includes both endpoints and midpoint
        val points = RadialLayout.positions(3, 100.0, -90.0, 90.0)
        assertEquals(3, points.size)

        // start endpoint: -90 deg -> (0, -100)
        assertEquals(0.0, points[0].x, DELTA)
        assertEquals(-100.0, points[0].y, DELTA)
        assertEquals(-90.0, points[0].angle, DELTA)

        // midpoint: 0 deg -> (100, 0)
        assertEquals(100.0, points[1].x, DELTA)
        assertEquals(0.0, points[1].y, DELTA)
        assertEquals(0.0, points[1].angle, DELTA)

        // end endpoint: 90 deg -> (0, 100)
        assertEquals(0.0, points[2].x, DELTA)
        assertEquals(100.0, points[2].y, DELTA)
        assertEquals(90.0, points[2].angle, DELTA)
    }

    @Test
    fun testPartialArcSingleItemPlacedAtMidpoint() {
        val points1 = RadialLayout.positions(1, 100.0, -90.0, 90.0)
        assertEquals(1, points1.size)
        // midpoint between -90 and 90 is 0 deg -> (100, 0)
        assertEquals(100.0, points1[0].x, DELTA)
        assertEquals(0.0, points1[0].y, DELTA)
        assertEquals(0.0, points1[0].angle, DELTA)

        val points2 = RadialLayout.positions(1, 100.0, 0.0, 180.0)
        assertEquals(1, points2.size)
        // midpoint between 0 and 180 is 90 deg -> (0, 100)
        assertEquals(0.0, points2[0].x, DELTA)
        assertEquals(100.0, points2[0].y, DELTA)
        assertEquals(90.0, points2[0].angle, DELTA)
    }

    @Test
    fun testFullRingSingleItemPlacedAtStartAngle() {
        val points1 = RadialLayout.positions(1, 100.0, 0.0, 360.0)
        assertEquals(1, points1.size)
        assertEquals(100.0, points1[0].x, DELTA)
        assertEquals(0.0, points1[0].y, DELTA)
        assertEquals(0.0, points1[0].angle, DELTA)

        val pointsNeg = RadialLayout.positions(1, 100.0, -90.0, 270.0)
        assertEquals(1, pointsNeg.size)
        assertEquals(0.0, pointsNeg[0].x, DELTA)
        assertEquals(-100.0, pointsNeg[0].y, DELTA)
        assertEquals(-90.0, pointsNeg[0].angle, DELTA)
    }

    @Test
    fun testScalesCoordinatesProportionallyWithRadius() {
        val r50 = RadialLayout.positions(4, 50.0, 0.0, 360.0)
        val r150 = RadialLayout.positions(4, 150.0, 0.0, 360.0)

        assertEquals(50.0, r50[0].x, DELTA)
        assertEquals(150.0, r150[0].x, DELTA)

        assertEquals(50.0, r50[1].y, DELTA)
        assertEquals(150.0, r150[1].y, DELTA)

        assertEquals(-50.0, r50[2].x, DELTA)
        assertEquals(-150.0, r150[2].x, DELTA)

        assertEquals(-50.0, r50[3].y, DELTA)
        assertEquals(-150.0, r150[3].y, DELTA)
    }

    @Test
    fun testNegativeAnglesAndCounterClockwise() {
        // Negative angles arc: -180 to -90, n=2 (both endpoints)
        val negArc = RadialLayout.positions(2, 100.0, -180.0, -90.0)
        assertEquals(2, negArc.size)
        assertEquals(-100.0, negArc[0].x, DELTA)
        assertEquals(0.0, negArc[0].y, DELTA)
        assertEquals(-180.0, negArc[0].angle, DELTA)

        assertEquals(0.0, negArc[1].x, DELTA)
        assertEquals(-100.0, negArc[1].y, DELTA)
        assertEquals(-90.0, negArc[1].angle, DELTA)

        // Counter-clockwise full ring (360 -> 0)
        val ccw = RadialLayout.positions(4, 100.0, 360.0, 0.0)
        assertEquals(4, ccw.size)
        assertEquals(360.0, ccw[0].angle, DELTA)
        assertEquals(270.0, ccw[1].angle, DELTA)
        assertEquals(180.0, ccw[2].angle, DELTA)
        assertEquals(90.0, ccw[3].angle, DELTA)
    }

    @Test
    fun testTwelveItemsFullRingNoDuplicateEndpoint() {
        val points = RadialLayout.positions(12, 100.0, 0.0, 360.0)
        assertEquals(12, points.size)

        for (i in 0 until 12) {
            assertEquals((i * 30).toDouble(), points[i].angle, DELTA)
        }

        // Endpoint 360 is not duplicated
        assertEquals(0.0, points[0].angle, DELTA)
        assertEquals(330.0, points[11].angle, DELTA)
    }

    @Test
    fun testZeroOrNegativeItemCountReturnsEmpty() {
        assertTrue(RadialLayout.positions(0, 100.0, 0.0, 360.0).isEmpty())
        assertTrue(RadialLayout.positions(-1, 100.0, 0.0, 360.0).isEmpty())
        assertTrue(RadialLayout.positions(-5, 50.0, -90.0, 90.0).isEmpty())
    }

    @Test
    fun testRoundsCoordinatesAndNormalizesNegativeZero() {
        // 45 degrees: cos(45) = sin(45) = 1/sqrt(2) approx 0.7071
        val points45 = RadialLayout.positions(1, 100.0, 45.0, 45.0)
        assertEquals(70.71, points45[0].x, DELTA)
        assertEquals(70.71, points45[0].y, DELTA)

        // Ensure -0.0 is normalized to 0.0
        val points180 = RadialLayout.positions(1, 100.0, 180.0, 180.0)
        assertEquals(-100.0, points180[0].x, DELTA)
        assertEquals(0.0, points180[0].y, DELTA)
        assertEquals(0L, java.lang.Double.doubleToLongBits(points180[0].y))
    }

    @Test
    fun testHalfUpRoundingTieVectorsMatchingJsMathRound() {
        // (1, r=0.125, 0, 0) -> x=0.13 (0.125 * 100 = 12.5 -> half-up rounds to 13 -> 0.13)
        val tiePos = RadialLayout.positions(1, 0.125, 0.0, 0.0)
        assertEquals(1, tiePos.size)
        assertEquals(0.13, tiePos[0].x, DELTA)
        assertEquals(0.0, tiePos[0].y, DELTA)
        assertEquals(0.0, tiePos[0].angle, DELTA)

        // (1, 100, 10.125, 10.125) -> angle=10.13
        val tieAngle = RadialLayout.positions(1, 100.0, 10.125, 10.125)
        assertEquals(1, tieAngle.size)
        assertEquals(10.13, tieAngle[0].angle, DELTA)

        // Negative tie angle: (1, 100, -10.125, -10.125) -> angle=-10.12 (half-up towards +inf like JS)
        val tieNegAngle = RadialLayout.positions(1, 100.0, -10.125, -10.125)
        assertEquals(1, tieNegAngle.size)
        assertEquals(-10.12, tieNegAngle[0].angle, DELTA)

        // Negative tie coordinate: (1, r=0.125, 180, 180) -> x=-0.12 (-0.125 * 100 = -12.5 -> -12 -> -0.12)
        val tieNegCoord = RadialLayout.positions(1, 0.125, 180.0, 180.0)
        assertEquals(1, tieNegCoord.size)
        assertEquals(-0.12, tieNegCoord[0].x, DELTA)
        assertEquals(0.0, tieNegCoord[0].y, DELTA)
    }

    private fun loadArcVectorsJson(): String {
        val candidates = listOf(
            File("../../../packages/orbitkit/src/arc-vectors.json"),
            File("../../../../../packages/orbitkit/src/arc-vectors.json"),
            File("packages/orbitkit/src/arc-vectors.json")
        )
        for (c in candidates) {
            if (c.exists()) return c.readText(Charsets.UTF_8)
        }
        var dir: File? = File(System.getProperty("user.dir") ?: ".")
        while (dir != null) {
            val candidate = File(dir, "packages/orbitkit/src/arc-vectors.json")
            if (candidate.exists()) return candidate.readText(Charsets.UTF_8)
            dir = dir.parentFile
        }
        throw IllegalStateException("Unable to locate packages/orbitkit/src/arc-vectors.json from user.dir=${System.getProperty("user.dir")}")
    }

    @Test
    fun testResolveMenuAnglesAndPositionsFromCanonicalArcVectors() {
        val jsonText = loadArcVectorsJson()
        val vectors = JSONArray(jsonText)
        assertTrue("Canonical vectors must not be empty", vectors.length() > 0)

        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val layout = if (v.has("layout") && !v.isNull("layout")) v.getString("layout") else null
            val arcObj = if (v.has("arc") && !v.isNull("arc")) v.getJSONObject("arc") else null
            val position = if (arcObj != null && arcObj.has("position") && !arcObj.isNull("position")) {
                arcObj.getString("position")
            } else null
            val span = if (arcObj != null && arcObj.has("span") && !arcObj.isNull("span")) {
                arcObj.getDouble("span")
            } else null
            val startAngle = if (v.has("startAngle") && !v.isNull("startAngle")) v.getDouble("startAngle") else null
            val endAngle = if (v.has("endAngle") && !v.isNull("endAngle")) v.getDouble("endAngle") else null

            val expectedStart = v.getDouble("startAngle")
            val expectedEnd = v.getDouble("endAngle")
            val n = v.getInt("n")
            val expectedPositions = v.getJSONArray("positions")

            val resolved = RadialLayout.resolveMenuAngles(
                layout = layout,
                position = position,
                span = span,
                startAngle = startAngle,
                endAngle = endAngle
            )

            assertEquals("Vector $i startAngle mismatch", expectedStart, resolved.startAngle, 0.01)
            assertEquals("Vector $i endAngle mismatch", expectedEnd, resolved.endAngle, 0.01)

            val computedPositions = RadialLayout.positions(n, 96.0, resolved.startAngle, resolved.endAngle)
            assertEquals("Vector $i positions count mismatch", expectedPositions.length(), computedPositions.size)

            for (j in 0 until expectedPositions.length()) {
                val expPos = expectedPositions.getJSONObject(j)
                val expX = expPos.getDouble("x")
                val expY = expPos.getDouble("y")
                val expAngle = expPos.getDouble("angle")
                val actPos = computedPositions[j]

                assertEquals("Vector $i item $j x mismatch", expX, actPos.x, 0.01)
                assertEquals("Vector $i item $j y mismatch", expY, actPos.y, 0.01)
                assertEquals("Vector $i item $j angle mismatch", expAngle, actPos.angle, 0.01)
            }
        }
    }

    @Test
    fun testResolveMenuAnglesFourPositionsDefaultSpan() {
        // top: centre -90, span 180 -> -180..0
        val top = RadialLayout.resolveMenuAngles(layout = "arc", position = "top")
        assertEquals(-180.0, top.startAngle, DELTA)
        assertEquals(0.0, top.endAngle, DELTA)

        // right: centre 0, span 180 -> -90..90
        val right = RadialLayout.resolveMenuAngles(layout = "arc", position = "right")
        assertEquals(-90.0, right.startAngle, DELTA)
        assertEquals(90.0, right.endAngle, DELTA)

        // bottom: centre 90, span 180 -> 0..180
        val bottom = RadialLayout.resolveMenuAngles(layout = "arc", position = "bottom")
        assertEquals(0.0, bottom.startAngle, DELTA)
        assertEquals(180.0, bottom.endAngle, DELTA)

        // left: centre 180, span 180 -> 90..270
        val left = RadialLayout.resolveMenuAngles(layout = "arc", position = "left")
        assertEquals(90.0, left.startAngle, DELTA)
        assertEquals(270.0, left.endAngle, DELTA)
    }

    @Test
    fun testResolveMenuAnglesCustomSpans() {
        // top: centre -90, span 120 -> -150..-30
        val top120 = RadialLayout.resolveMenuAngles(layout = "arc", position = "top", span = 120.0)
        assertEquals(-150.0, top120.startAngle, DELTA)
        assertEquals(-30.0, top120.endAngle, DELTA)

        // right: centre 0, span 90 -> -45..45
        val right90 = RadialLayout.resolveMenuAngles(layout = "arc", position = "right", span = 90.0)
        assertEquals(-45.0, right90.startAngle, DELTA)
        assertEquals(45.0, right90.endAngle, DELTA)

        // bottom: centre 90, span 60 -> 60..120
        val bottom60 = RadialLayout.resolveMenuAngles(layout = "arc", position = "bottom", span = 60.0)
        assertEquals(60.0, bottom60.startAngle, DELTA)
        assertEquals(120.0, bottom60.endAngle, DELTA)
    }

    @Test
    fun testResolveMenuAnglesOrbitDefaultsAndOverrides() {
        // layout: "orbit", defaults to -90..270
        val orbitDef = RadialLayout.resolveMenuAngles(layout = "orbit")
        assertEquals(-90.0, orbitDef.startAngle, DELTA)
        assertEquals(270.0, orbitDef.endAngle, DELTA)

        // layout: "orbit", custom startAngle/endAngle
        val orbitCustom = RadialLayout.resolveMenuAngles(layout = "orbit", startAngle = 0.0, endAngle = 180.0)
        assertEquals(0.0, orbitCustom.startAngle, DELTA)
        assertEquals(180.0, orbitCustom.endAngle, DELTA)

        // layout: "orbit" ignores arc position/span
        val orbitWithArc = RadialLayout.resolveMenuAngles(layout = "orbit", position = "bottom", span = 90.0)
        assertEquals(-90.0, orbitWithArc.startAngle, DELTA)
        assertEquals(270.0, orbitWithArc.endAngle, DELTA)
    }

    @Test
    fun testResolveMenuAnglesNativeMenuConfigOverload() {
        val config = NativeMenuConfig(
            items = listOf(NativeMenuItem(id = "item1", label = "One")),
            layout = "arc",
            arc = NativeArcConfig(position = "bottom", span = 180.0)
        )
        val resolved = RadialLayout.resolveMenuAngles(config)
        assertEquals(0.0, resolved.startAngle, DELTA)
        assertEquals(180.0, resolved.endAngle, DELTA)
    }
}
