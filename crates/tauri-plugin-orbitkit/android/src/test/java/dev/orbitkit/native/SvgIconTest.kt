package dev.orbitkit.native

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

class SvgIconTest {

    private val DELTA = 0.001f

    private fun loadIconFile(name: String): File {
        val userDir = File(System.getProperty("user.dir", "."))
        val candidates = listOf(
            File("examples/starter/public/icons/$name"),
            File("../../../examples/starter/public/icons/$name"),
            File("../../../../examples/starter/public/icons/$name"),
            File(userDir, "examples/starter/public/icons/$name"),
            File(userDir, "../../../examples/starter/public/icons/$name"),
            File(userDir, "../../../../examples/starter/public/icons/$name")
        )
        for (c in candidates) {
            if (c.exists()) return c
        }
        var dir: File? = userDir
        while (dir != null) {
            val check = File(dir, "examples/starter/public/icons/$name")
            if (check.exists()) return check
            dir = dir.parentFile
        }
        fail("Required icon file $name not found in repo!")
        throw AssertionError("Unreachable")
    }

    @Test
    fun testMoveToAbsoluteAndRelative() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 10 20 m 5 15" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(2, cmds.size)
        assertTrue(cmds[0] is PathCommand.MoveTo)
        val m1 = cmds[0] as PathCommand.MoveTo
        assertEquals(10f, m1.x, DELTA)
        assertEquals(20f, m1.y, DELTA)

        assertTrue(cmds[1] is PathCommand.MoveTo)
        val m2 = cmds[1] as PathCommand.MoveTo
        assertEquals(15f, m2.x, DELTA)
        assertEquals(35f, m2.y, DELTA)
    }

    @Test
    fun testLineToAbsoluteAndRelative() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 0 0 L 10 20 l 5 10" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(3, cmds.size)
        assertTrue(cmds[1] is PathCommand.LineTo)
        val l1 = cmds[1] as PathCommand.LineTo
        assertEquals(10f, l1.x, DELTA)
        assertEquals(20f, l1.y, DELTA)

        assertTrue(cmds[2] is PathCommand.LineTo)
        val l2 = cmds[2] as PathCommand.LineTo
        assertEquals(15f, l2.x, DELTA)
        assertEquals(30f, l2.y, DELTA)
    }

    @Test
    fun testHorizontalAndVerticalLineTo() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 0 0 H 10 h 5 V 20 v 5" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(5, cmds.size)

        // H 10 -> (10, 0)
        assertEquals(PathCommand.LineTo(10f, 0f), cmds[1])
        // h 5 -> (15, 0)
        assertEquals(PathCommand.LineTo(15f, 0f), cmds[2])
        // V 20 -> (15, 20)
        assertEquals(PathCommand.LineTo(15f, 20f), cmds[3])
        // v 5 -> (15, 25)
        assertEquals(PathCommand.LineTo(15f, 25f), cmds[4])
    }

    @Test
    fun testCubicBezierAbsoluteAndRelative() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 0 0 C 1 2 3 4 5 6 c 1 1 2 2 3 3" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(3, cmds.size)

        val c1 = cmds[1] as PathCommand.CubicTo
        assertEquals(1f, c1.x1, DELTA)
        assertEquals(2f, c1.y1, DELTA)
        assertEquals(3f, c1.x2, DELTA)
        assertEquals(4f, c1.y2, DELTA)
        assertEquals(5f, c1.x, DELTA)
        assertEquals(6f, c1.y, DELTA)

        val c2 = cmds[2] as PathCommand.CubicTo
        assertEquals(6f, c2.x1, DELTA)
        assertEquals(7f, c2.y1, DELTA)
        assertEquals(7f, c2.x2, DELTA)
        assertEquals(8f, c2.y2, DELTA)
        assertEquals(8f, c2.x, DELTA)
        assertEquals(9f, c2.y, DELTA)
    }

    @Test
    fun testSmoothCubicBezierWithAndWithoutPriorCubic() {
        // With prior C: S reflects control point 2 of C (3, 4) across endpoint (5, 6): (2*5-3, 2*6-4) = (7, 8)
        val svg1 = """<svg viewBox="0 0 100 100"><path d="M 0 0 C 1 2 3 4 5 6 S 7 8 9 10" /></svg>"""
        val icon1 = SvgParser.parse(svg1)
        assertNotNull(icon1)
        val s1 = icon1!!.commands[2] as PathCommand.CubicTo
        assertEquals(7f, s1.x1, DELTA)
        assertEquals(8f, s1.y1, DELTA)
        assertEquals(7f, s1.x2, DELTA)
        assertEquals(8f, s1.y2, DELTA)
        assertEquals(9f, s1.x, DELTA)
        assertEquals(10f, s1.y, DELTA)

        // Without prior C: control point 1 is current point (5, 6)
        val svg2 = """<svg viewBox="0 0 100 100"><path d="M 5 6 S 7 8 9 10" /></svg>"""
        val icon2 = SvgParser.parse(svg2)
        assertNotNull(icon2)
        val s2 = icon2!!.commands[1] as PathCommand.CubicTo
        assertEquals(5f, s2.x1, DELTA)
        assertEquals(6f, s2.y1, DELTA)
        assertEquals(7f, s2.x2, DELTA)
        assertEquals(8f, s2.y2, DELTA)
    }

    @Test
    fun testQuadraticBezierAbsoluteAndRelative() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 0 0 Q 3 6 6 6 q 3 0 6 0" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(3, cmds.size)

        // Q 3 6 6 6 -> CP1 = 0 + 2/3*(3-0) = 2, CP2 = 6 + 2/3*(3-6) = 4
        val q1 = cmds[1] as PathCommand.CubicTo
        assertEquals(2f, q1.x1, DELTA)
        assertEquals(4f, q1.y1, DELTA)
        assertEquals(4f, q1.x2, DELTA)
        assertEquals(6f, q1.y2, DELTA)
        assertEquals(6f, q1.x, DELTA)
        assertEquals(6f, q1.y, DELTA)

        // q 3 0 6 0 -> absolute Q (9, 6) end (12, 6)
        val q2 = cmds[2] as PathCommand.CubicTo
        assertEquals(8f, q2.x1, DELTA)
        assertEquals(6f, q2.y1, DELTA)
        assertEquals(10f, q2.x2, DELTA)
        assertEquals(6f, q2.y2, DELTA)
        assertEquals(12f, q2.x, DELTA)
        assertEquals(6f, q2.y, DELTA)
    }

    @Test
    fun testSmoothQuadraticBezier() {
        // M 0 0 Q 3 6 6 6 T 12 6
        // Reflection of (3, 6) across (6, 6) is (9, 6)
        val svg = """<svg viewBox="0 0 100 100"><path d="M 0 0 Q 3 6 6 6 T 12 6" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val t = icon!!.commands[2] as PathCommand.CubicTo
        assertEquals(8f, t.x1, DELTA)
        assertEquals(6f, t.y1, DELTA)
        assertEquals(10f, t.x2, DELTA)
        assertEquals(6f, t.y2, DELTA)
        assertEquals(12f, t.x, DELTA)
        assertEquals(6f, t.y, DELTA)
    }

    @Test
    fun testEllipticalArcAbsoluteAndRelative() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 10 0 A 10 10 0 0 1 0 10 a 10 10 0 0 1 -10 -10" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertTrue(cmds.size >= 3)
        // First arc ends at (0, 10)
        val lastSegArc1 = cmds[1] as PathCommand.CubicTo
        assertEquals(0f, lastSegArc1.x, 0.05f)
        assertEquals(10f, lastSegArc1.y, 0.05f)

        // Second relative arc ends at (0 - 10, 10 - 10) = (-10, 0)
        val lastSegArc2 = cmds[2] as PathCommand.CubicTo
        assertEquals(-10f, lastSegArc2.x, 0.05f)
        assertEquals(0f, lastSegArc2.y, 0.05f)
    }

    @Test
    fun testClosePath() {
        val svg = """<svg viewBox="0 0 100 100"><path d="M 0 0 L 10 10 Z" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(3, cmds.size)
        assertEquals(PathCommand.Close, cmds[2])
    }

    @Test
    fun testImplicitRepeatsForMoveAndLine() {
        // M 10 20 30 40 50 60 -> M(10, 20) followed by implicit L(30, 40) and L(50, 60)
        val svg = """<svg viewBox="0 0 100 100"><path d="M 10 20 30 40 50 60" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(3, cmds.size)
        assertEquals(PathCommand.MoveTo(10f, 20f), cmds[0])
        assertEquals(PathCommand.LineTo(30f, 40f), cmds[1])
        assertEquals(PathCommand.LineTo(50f, 60f), cmds[2])
    }

    @Test
    fun testImplicitRepeatsForRelativeMoveAndLine() {
        // m 10 20 5 5 -> m(10, 20) followed by implicit l(5, 5) -> (15, 25)
        val svg = """<svg viewBox="0 0 100 100"><path d="m 10 20 5 5" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(2, cmds.size)
        assertEquals(PathCommand.MoveTo(10f, 20f), cmds[0])
        assertEquals(PathCommand.LineTo(15f, 25f), cmds[1])
    }

    @Test
    fun testNumberSeparatorsAndSigns() {
        // Test concatenated numbers with signs, leading dots, and arc flags
        // M12 8h.01 -> M(12, 8), LineTo(12.01, 8)
        val svg1 = """<svg viewBox="0 0 24 24"><path d="M12 8h.01" /></svg>"""
        val icon1 = SvgParser.parse(svg1)
        assertNotNull(icon1)
        assertEquals(PathCommand.MoveTo(12f, 8f), icon1!!.commands[0])
        val l = icon1.commands[1] as PathCommand.LineTo
        assertEquals(12.01f, l.x, DELTA)
        assertEquals(8f, l.y, DELTA)

        // Arc with flags concatenated: a2 2 0 0 1-2-2
        val svg2 = """<svg viewBox="0 0 24 24"><path d="M6 22a2 2 0 0 1-2-2" /></svg>"""
        val icon2 = SvgParser.parse(svg2)
        assertNotNull(icon2)
        val arcCmd = icon2!!.commands[1] as PathCommand.CubicTo
        assertEquals(4f, arcCmd.x, DELTA)
        assertEquals(20f, arcCmd.y, DELTA)
    }

    @Test
    fun testCircleGeometry() {
        val svg = """<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(6, cmds.size) // MoveTo, 4 CubicTo, Close
        assertEquals(PathCommand.MoveTo(22f, 12f), cmds[0])
        assertTrue(cmds[1] is PathCommand.CubicTo)
        assertTrue(cmds[2] is PathCommand.CubicTo)
        assertTrue(cmds[3] is PathCommand.CubicTo)
        assertTrue(cmds[4] is PathCommand.CubicTo)
        assertEquals(PathCommand.Close, cmds[5])
    }

    @Test
    fun testEllipseGeometry() {
        val svg = """<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="8" ry="4" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(6, cmds.size)
        assertEquals(PathCommand.MoveTo(20f, 14f), cmds[0])
        assertEquals(PathCommand.Close, cmds[5])
    }

    @Test
    fun testLineGeometry() {
        val svg = """<svg viewBox="0 0 24 24"><line x1="10" y1="2" x2="14" y2="2" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        val cmds = icon!!.commands
        assertEquals(2, cmds.size)
        assertEquals(PathCommand.MoveTo(10f, 2f), cmds[0])
        assertEquals(PathCommand.LineTo(14f, 2f), cmds[1])
    }

    @Test
    fun testRectGeometryWithoutAndWithRoundedCorners() {
        val svgSharp = """<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="10" /></svg>"""
        val iconSharp = SvgParser.parse(svgSharp)
        assertNotNull(iconSharp)
        assertEquals(5, iconSharp!!.commands.size) // MoveTo, 3 LineTo, Close

        val svgRound = """<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="10" rx="2" ry="2" /></svg>"""
        val iconRound = SvgParser.parse(svgRound)
        assertNotNull(iconRound)
        // MoveTo + 4 lines + 4 cubic curves + Close = 10 commands
        assertEquals(10, iconRound!!.commands.size)
        assertEquals(PathCommand.Close, iconRound.commands[9])
    }

    @Test
    fun testPolylineAndPolygon() {
        val svgPolyline = """<svg viewBox="0 0 24 24"><polyline points="2 2 12 12 22 2" /></svg>"""
        val iconPolyline = SvgParser.parse(svgPolyline)
        assertNotNull(iconPolyline)
        assertEquals(3, iconPolyline!!.commands.size) // MoveTo, 2 LineTo
        assertEquals(PathCommand.MoveTo(2f, 2f), iconPolyline.commands[0])
        assertEquals(PathCommand.LineTo(12f, 12f), iconPolyline.commands[1])
        assertEquals(PathCommand.LineTo(22f, 2f), iconPolyline.commands[2])

        val svgPolygon = """<svg viewBox="0 0 24 24"><polygon points="2 2 12 12 22 2" /></svg>"""
        val iconPolygon = SvgParser.parse(svgPolygon)
        assertNotNull(iconPolygon)
        assertEquals(4, iconPolygon!!.commands.size) // MoveTo, 2 LineTo, Close
        assertEquals(PathCommand.Close, iconPolygon.commands[3])
    }

    @Test
    fun testRealIconAboutSvg() {
        val file = loadIconFile("about.svg")
        val content = file.readText(Charsets.UTF_8)
        val icon = SvgParser.parse(content)
        assertNotNull("about.svg must parse cleanly", icon)
        assertEquals(0f, icon!!.viewBox.minX, DELTA)
        assertEquals(0f, icon.viewBox.minY, DELTA)
        assertEquals(24f, icon.viewBox.width, DELTA)
        assertEquals(24f, icon.viewBox.height, DELTA)
        assertEquals("#E6F6FF", icon.strokeColor)
        assertEquals(2f, icon.strokeWidth, DELTA)
        assertTrue(icon.commands.isNotEmpty())
    }

    @Test
    fun testRealIconNotesSvg() {
        val file = loadIconFile("notes.svg")
        val content = file.readText(Charsets.UTF_8)
        val icon = SvgParser.parse(content)
        assertNotNull("notes.svg must parse cleanly", icon)
        assertEquals(24f, icon!!.viewBox.width, DELTA)
        assertEquals(24f, icon.viewBox.height, DELTA)
        assertTrue(icon.commands.isNotEmpty())
    }

    @Test
    fun testRealIconQuitSvg() {
        val file = loadIconFile("quit.svg")
        val content = file.readText(Charsets.UTF_8)
        val icon = SvgParser.parse(content)
        assertNotNull("quit.svg must parse cleanly", icon)
        assertEquals(24f, icon!!.viewBox.width, DELTA)
        assertEquals(24f, icon.viewBox.height, DELTA)
        assertTrue(icon.commands.isNotEmpty())
    }

    @Test
    fun testRealIconSettingsSvg() {
        val file = loadIconFile("settings.svg")
        val content = file.readText(Charsets.UTF_8)
        val icon = SvgParser.parse(content)
        assertNotNull("settings.svg must parse cleanly", icon)
        assertEquals(24f, icon!!.viewBox.width, DELTA)
        assertEquals(24f, icon.viewBox.height, DELTA)
        assertTrue(icon.commands.isNotEmpty())
    }

    @Test
    fun testRealIconTimerSvg() {
        val file = loadIconFile("timer.svg")
        val content = file.readText(Charsets.UTF_8)
        val icon = SvgParser.parse(content)
        assertNotNull("timer.svg must parse cleanly", icon)
        assertEquals(24f, icon!!.viewBox.width, DELTA)
        assertEquals(24f, icon.viewBox.height, DELTA)
        assertTrue(icon.commands.isNotEmpty())
    }

    @Test
    fun testPathMustStartWithMoveTo() {
        // First command is L (not M/m) -> reject
        val svgLineStart = """<svg viewBox="0 0 24 24"><path d="L 10 10" /></svg>"""
        assertNull(SvgParser.parse(svgLineStart))

        // First command is C (not M/m) -> reject
        val svgCurveStart = """<svg viewBox="0 0 24 24"><path d="C 1 2 3 4 5 6" /></svg>"""
        assertNull(SvgParser.parse(svgCurveStart))

        // First command is Z -> reject
        val svgCloseStart = """<svg viewBox="0 0 24 24"><path d="Z" /></svg>"""
        assertNull(SvgParser.parse(svgCloseStart))

        // Valid start with M -> accept
        val svgValidM = """<svg viewBox="0 0 24 24"><path d="M 10 10 L 20 20" /></svg>"""
        assertNotNull(SvgParser.parse(svgValidM))

        // Valid start with m -> accept
        val svgValidLowerM = """<svg viewBox="0 0 24 24"><path d="m 10 10 l 10 10" /></svg>"""
        assertNotNull(SvgParser.parse(svgValidLowerM))
    }

    @Test
    fun testRejectNonFiniteNumbers() {
        // Path with 1e999 (overflows float to Infinity) -> reject
        val svgPathInfinity = """<svg viewBox="0 0 24 24"><path d="M 0 0 L 1e999 10" /></svg>"""
        assertNull(SvgParser.parse(svgPathInfinity))

        // Path with -1e999 (-Infinity) -> reject
        val svgPathNegInfinity = """<svg viewBox="0 0 24 24"><path d="M 0 0 L -1e999 10" /></svg>"""
        assertNull(SvgParser.parse(svgPathNegInfinity))
    }
}
