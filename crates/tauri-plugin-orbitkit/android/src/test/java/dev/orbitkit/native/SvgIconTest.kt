package dev.orbitkit.native

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.json.JSONObject
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
    private fun loadConfigFile(): File {
        val userDir = File(System.getProperty("user.dir", "."))
        val candidates = listOf(
            File("examples/starter/src/orbitkit.config.json"),
            File("../../../examples/starter/src/orbitkit.config.json"),
            File("../../../../examples/starter/src/orbitkit.config.json"),
            File(userDir, "examples/starter/src/orbitkit.config.json"),
            File(userDir, "../../../examples/starter/src/orbitkit.config.json"),
            File(userDir, "../../../../examples/starter/src/orbitkit.config.json")
        )
        for (c in candidates) {
            if (c.exists()) return c
        }
        var dir: File? = userDir
        while (dir != null) {
            val check = File(dir, "examples/starter/src/orbitkit.config.json")
            if (check.exists()) return check
            dir = dir.parentFile
        }
        fail("Required config file examples/starter/src/orbitkit.config.json not found in repo!")
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

    @Test
    fun testIdleMascotFromConfigParsesCorrectElementsAndPaint() {
        val configFile = loadConfigFile()
        assertTrue("ConfigFile must exist", configFile.exists())
        val json = JSONObject(configFile.readText(Charsets.UTF_8))
        val idleSvg = json.getJSONObject("mascot").getJSONObject("states").getJSONObject("idle").getString("src")

        val icon = SvgParser.parse(idleSvg)
        assertNotNull("Idle mascot must parse successfully", icon)
        assertEquals("Idle mascot must parse into exactly 6 elements", 6, icon!!.elements.size)

        // 1. Body circle: #4f7cff
        val body = icon.elements[0]
        assertEquals(0xFF4F7CFF.toInt(), body.paint.fill)
        assertEquals("#4f7cff", body.paint.fillHex)
        assertNull("Body circle has no stroke", body.paint.stroke)

        // 2. Orbit ring ellipse: fill="none", stroke="#9db4ff", stroke-width="4", transform="rotate(-20 80 80)"
        val ring = icon.elements[1]
        assertNull("Orbit ring has no fill", ring.paint.fill)
        assertFalse(ring.paint.hasFill)
        assertEquals(0xFF9DB4FF.toInt(), ring.paint.stroke)
        assertEquals("#9db4ff", ring.paint.strokeHex)
        assertEquals(4f, ring.paint.strokeWidth, DELTA)

        // Check transform rotate(-20 80 80)
        val rad = Math.toRadians(-20.0)
        val cos = Math.cos(rad).toFloat()
        val sin = Math.sin(rad).toFloat()
        val tx = 80f * (1f - cos) + 80f * sin
        val ty = 80f * (1f - cos) - 80f * sin
        val m = ring.matrix
        assertEquals(cos, m[0], DELTA)
        assertEquals(-sin, m[1], DELTA)
        assertEquals(tx, m[2], DELTA)
        assertEquals(sin, m[3], DELTA)
        assertEquals(cos, m[4], DELTA)
        assertEquals(ty, m[5], DELTA)

        // 3. Eye left: #ffffff
        val eyeL = icon.elements[2]
        assertEquals(0xFFFFFFFF.toInt(), eyeL.paint.fill)
        assertEquals("#ffffff", eyeL.paint.fillHex)

        // 4. Eye right: #ffffff
        val eyeR = icon.elements[3]
        assertEquals(0xFFFFFFFF.toInt(), eyeR.paint.fill)
        assertEquals("#ffffff", eyeR.paint.fillHex)

        // 5. Pupil left: #10141a
        val pupilL = icon.elements[4]
        assertEquals(0xFF10141A.toInt(), pupilL.paint.fill)
        assertEquals("#10141a", pupilL.paint.fillHex)

        // 6. Pupil right: #10141a
        val pupilR = icon.elements[5]
        assertEquals(0xFF10141A.toInt(), pupilR.paint.fill)
        assertEquals("#10141a", pupilR.paint.fillHex)
    }

    @Test
    fun testBusyMascotFromConfigGivesAmberBody() {
        val configFile = loadConfigFile()
        assertTrue("ConfigFile must exist", configFile.exists())
        val json = JSONObject(configFile.readText(Charsets.UTF_8))
        val busySvg = json.getJSONObject("mascot").getJSONObject("states").getJSONObject("busy").getString("src")

        val icon = SvgParser.parse(busySvg)
        assertNotNull("Busy mascot must parse successfully", icon)
        assertEquals(6, icon!!.elements.size)

        // Body circle: #f59e0b
        val body = icon.elements[0]
        assertEquals(0xFFF59E0B.toInt(), body.paint.fill)
        assertEquals("#f59e0b", body.paint.fillHex)

        // Ring ellipse: #fcd34d stroke
        val ring = icon.elements[1]
        assertEquals(0xFFFCD34D.toInt(), ring.paint.stroke)
        assertEquals("#fcd34d", ring.paint.strokeHex)
    }

    @Test
    fun testTransformCompositionNumericallyChecked() {
        // Matrix composition of translate(10, 20) followed by scale(2, 3)
        val t = SvgParser.parseTransform("translate(10, 20) scale(2, 3)")
        assertNotNull(t)
        assertEquals(2f, t!![0], DELTA)
        assertEquals(0f, t[1], DELTA)
        assertEquals(10f, t[2], DELTA)
        assertEquals(0f, t[3], DELTA)
        assertEquals(3f, t[4], DELTA)
        assertEquals(20f, t[5], DELTA)
        assertEquals(0f, t[6], DELTA)
        assertEquals(0f, t[7], DELTA)
        assertEquals(1f, t[8], DELTA)

        // Nested group transform: parent translate, child scale
        val svg = """<svg viewBox="0 0 100 100"><g transform="translate(15, 25)"><circle cx="0" cy="0" r="5" transform="scale(3, 4)" /></g></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        assertEquals(1, icon!!.elements.size)
        val m = icon.elements[0].matrix
        assertEquals(3f, m[0], DELTA)
        assertEquals(15f, m[2], DELTA)
        assertEquals(4f, m[4], DELTA)
        assertEquals(25f, m[5], DELTA)
    }

    @Test
    fun testFillNoneMeansNoFill() {
        val svg = """<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="none" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        assertEquals(1, icon!!.elements.size)
        assertNull("fill='none' must result in null fill", icon.elements[0].paint.fill)
        assertFalse("fill='none' hasFill must be false", icon.elements[0].paint.hasFill)
    }

    @Test
    fun testInheritanceRootStrokeAppliesToChildren() {
        val svg = """<svg viewBox="0 0 100 100" stroke="#123456" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="5" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        assertEquals(1, icon!!.elements.size)
        val p = icon.elements[0].paint
        assertEquals(0xFF123456.toInt(), p.stroke)
        assertEquals(3f, p.strokeWidth, DELTA)
        assertEquals("round", p.cap)
        assertEquals("round", p.join)
    }

    @Test
    fun testCurrentColorResolvesToRootStroke() {
        val svg = """<svg viewBox="0 0 100 100" stroke="#4477aa"><circle cx="10" cy="10" r="5" stroke="currentColor" fill="currentColor" /></svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        assertEquals(1, icon!!.elements.size)
        val p = icon.elements[0].paint
        assertEquals(0xFF4477AA.toInt(), p.stroke)
        assertEquals(0xFF4477AA.toInt(), p.fill)
    }

    @Test
    fun testGroupPaintInheritanceAndOverride() {
        val svg = """<svg viewBox="0 0 100 100" stroke="#111111" stroke-width="2">
            <g stroke="#222222" stroke-width="4">
                <circle cx="10" cy="10" r="5" />
                <circle cx="20" cy="20" r="5" stroke="#333333" stroke-width="6" />
            </g>
        </svg>"""
        val icon = SvgParser.parse(svg)
        assertNotNull(icon)
        assertEquals(2, icon!!.elements.size)

        // First circle inherits group paint
        assertEquals(0xFF222222.toInt(), icon.elements[0].paint.stroke)
        assertEquals(4f, icon.elements[0].paint.strokeWidth, DELTA)

        // Second circle overrides group paint
        assertEquals(0xFF333333.toInt(), icon.elements[1].paint.stroke)
        assertEquals(6f, icon.elements[1].paint.strokeWidth, DELTA)
    }

    @Test
    fun testParseTransformRejectsTrailingGarbage() {
        assertNull("Trailing text must be rejected", SvgParser.parseTransform("rotate(45) garbage"))
        assertNull("Trailing semicolon must be rejected", SvgParser.parseTransform("rotate(45);"))
        assertNull("Trailing closing paren must be rejected", SvgParser.parseTransform("rotate(45))"))
        assertNull("Trailing number must be rejected", SvgParser.parseTransform("rotate(45) 123"))
        assertNull("Leading garbage must be rejected", SvgParser.parseTransform("bad rotate(45)"))
        assertNull("Garbage between commands must be rejected", SvgParser.parseTransform("rotate(45) bad scale(2)"))
        assertNotNull("Valid sequence with spaces is accepted", SvgParser.parseTransform("rotate(45) scale(2)"))
        assertNotNull("Valid sequence with comma is accepted", SvgParser.parseTransform("rotate(45), scale(2)"))
    }

    @Test
    fun testRejectNonFiniteFloatsInTransformsAndShapeAttributes() {
        // Non-finite in transforms
        assertNull("NaN in translate must be rejected", SvgParser.parseTransform("translate(NaN, 10)"))
        assertNull("Infinity in translate must be rejected", SvgParser.parseTransform("translate(10, Infinity)"))
        assertNull("-Infinity in scale must be rejected", SvgParser.parseTransform("scale(-Infinity)"))

        // Non-finite in shape attributes
        assertNull("NaN in cx must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 100"><circle cx="NaN" cy="50" r="10" /></svg>"""))
        assertNull("Infinity in r must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="Infinity" /></svg>"""))
        assertNull("NaN in rx must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="NaN" ry="10" /></svg>"""))
        assertNull("Infinity in width must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 100"><rect x="0" y="0" width="Infinity" height="20" /></svg>"""))
        assertNull("NaN in line coord must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 100"><line x1="0" y1="0" x2="NaN" y2="20" /></svg>"""))
        assertNull("NaN in stroke-width must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" stroke-width="NaN" /></svg>"""))
    }

    @Test
    fun testStrokeWidthScalesWithSqrtAbsDetMatrix() {
        val elemIdentity = Element(emptyList(), Paint(null, 0xFF000000.toInt(), 2f), SvgParser.IDENTITY_MATRIX)
        assertEquals(1f, elemIdentity.matrixDeterminant(), DELTA)
        assertEquals(1f, elemIdentity.strokeScale(), DELTA)

        // Scale 2x uniform -> det = 4 -> strokeScale = 2
        val matScale2 = SvgParser.parseTransform("scale(2)")!!
        val elemScale2 = Element(emptyList(), Paint(null, 0xFF000000.toInt(), 2f), matScale2)
        assertEquals(4f, elemScale2.matrixDeterminant(), DELTA)
        assertEquals(2f, elemScale2.strokeScale(), DELTA)

        // Non-uniform scale 3x and 12x -> det = 36 -> strokeScale = 6
        val matNonUniform = SvgParser.parseTransform("scale(3, 12)")!!
        val elemNonUniform = Element(emptyList(), Paint(null, 0xFF000000.toInt(), 2f), matNonUniform)
        assertEquals(36f, elemNonUniform.matrixDeterminant(), DELTA)
        assertEquals(6f, elemNonUniform.strokeScale(), DELTA)

        // Pure rotation -> det = 1 -> strokeScale = 1
        val matRotate = SvgParser.parseTransform("rotate(45)")!!
        val elemRotate = Element(emptyList(), Paint(null, 0xFF000000.toInt(), 2f), matRotate)
        assertEquals(1f, elemRotate.matrixDeterminant(), DELTA)
        assertEquals(1f, elemRotate.strokeScale(), DELTA)

        // Negative scale (reflection) -2x and 2x -> det = -4 -> abs(det) = 4 -> strokeScale = 2
        val matReflect = SvgParser.parseTransform("scale(-2, 2)")!!
        val elemReflect = Element(emptyList(), Paint(null, 0xFF000000.toInt(), 2f), matReflect)
        assertEquals(-4f, elemReflect.matrixDeterminant(), DELTA)
        assertEquals(2f, elemReflect.strokeScale(), DELTA)
    }

    @Test
    fun testParseViewBoxRejectsZeroAndNegativeRootDimensions() {
        // Root width/height fallback
        assertNull("Zero width must be rejected", SvgParser.parse("""<svg width="0" height="100"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Zero height must be rejected", SvgParser.parse("""<svg width="100" height="0"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Zero width and height must be rejected", SvgParser.parse("""<svg width="0" height="0"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Negative width must be rejected", SvgParser.parse("""<svg width="-24" height="24"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Negative height must be rejected", SvgParser.parse("""<svg width="24" height="-24"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Negative width and height must be rejected", SvgParser.parse("""<svg width="-24" height="-24"><circle cx="10" cy="10" r="5" /></svg>"""))

        // viewBox attribute dimensions
        assertNull("Zero viewBox width must be rejected", SvgParser.parse("""<svg viewBox="0 0 0 100"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Zero viewBox height must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 0"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Negative viewBox width must be rejected", SvgParser.parse("""<svg viewBox="0 0 -100 100"><circle cx="10" cy="10" r="5" /></svg>"""))
        assertNull("Negative viewBox height must be rejected", SvgParser.parse("""<svg viewBox="0 0 100 -100"><circle cx="10" cy="10" r="5" /></svg>"""))
    }
}
