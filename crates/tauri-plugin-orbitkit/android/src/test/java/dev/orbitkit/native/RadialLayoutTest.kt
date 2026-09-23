package dev.orbitkit.native

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
}
