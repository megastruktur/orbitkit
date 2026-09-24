package dev.orbitkit.native

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class IconDecoderTest {

    @Test
    fun testDecodeBase64SvgDataUrl() {
        val svg = """<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>"""
        val base64 = "PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PC9zdmc+"
        val dataUrl = "data:image/svg+xml;base64,$base64"

        val decoded = IconDecoder.decode(dataUrl)
        assertNotNull("Must decode valid base64 SVG", decoded)
        assertTrue("Must produce DecodedIcon.Svg", decoded is DecodedIcon.Svg)
        val svgIcon = (decoded as DecodedIcon.Svg).icon
        assertEquals(24f, svgIcon.viewBox.width, 0.001f)
        assertTrue(svgIcon.commands.isNotEmpty())
    }

    @Test
    fun testDecodeUrlEncodedSvgDataUrl() {
        val urlEncoded = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2024%2024%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%2F%3E%3C%2Fsvg%3E"
        val decoded = IconDecoder.decode(urlEncoded)
        assertNotNull("Must decode valid URL-encoded SVG", decoded)
        assertTrue("Must produce DecodedIcon.Svg", decoded is DecodedIcon.Svg)
        val svgIcon = (decoded as DecodedIcon.Svg).icon
        assertEquals(24f, svgIcon.viewBox.width, 0.001f)
    }

    @Test
    fun testDecodeUtf8PrefixedSvgDataUrl() {
        val url = "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24'><line x1='1' y1='1' x2='2' y2='2'/></svg>"
        val decoded = IconDecoder.decode(url)
        assertNotNull("Must decode utf8-prefixed SVG", decoded)
        assertTrue(decoded is DecodedIcon.Svg)
    }

    @Test
    fun testDecodePlainTextAndEmoji() {
        val emoji = IconDecoder.decode("⭐")
        assertNotNull(emoji)
        assertTrue(emoji is DecodedIcon.Text)
        assertEquals("⭐", (emoji as DecodedIcon.Text).text)

        val text = IconDecoder.decode("Settings")
        assertNotNull(text)
        assertTrue(text is DecodedIcon.Text)
        assertEquals("Settings", (text as DecodedIcon.Text).text)
    }

    @Test
    fun testFallbackRulesUnsupportedTagsReturnNull() {
        // Tag <text> is unsupported per minimal SVG subset
        val svgWithText = """<svg viewBox="0 0 24 24"><text>hello</text></svg>"""
        assertNull("SVG with <text> must return null", SvgParser.parse(svgWithText))

        // Tag <image> is unsupported
        val svgWithImage = """<svg viewBox="0 0 24 24"><image href="foo.png"/></svg>"""
        assertNull("SVG with <image> must return null", SvgParser.parse(svgWithImage))

        // Tag <filter> is unsupported
        val svgWithFilter = """<svg viewBox="0 0 24 24"><filter id="f"/></svg>"""
        assertNull("SVG with <filter> must return null", SvgParser.parse(svgWithFilter))
    }

    @Test
    fun testFallbackRulesMalformedXmlReturnsNull() {
        assertNull(SvgParser.parse("<svg><path d=\"M0 0\""))
        assertNull(SvgParser.parse("plain text is not xml"))
        assertNull(SvgParser.parse(""))
    }

    @Test
    fun testDataUrlNeverDisplayedAsText() {
        // Requirement: "Never display a string that starts with data:"
        // Unsupported data URLs must return null, NEVER DecodedIcon.Text
        assertNull(IconDecoder.decode("data:invalid"))
        assertNull(IconDecoder.decode("data:text/plain;base64,aGVsbG8="))
        assertNull(IconDecoder.decode("data:image/svg+xml;base64,invalid!!!base64"))

        // Valid base64 encoding of unsupported SVG content (<text>) -> must return null, not text
        val unsupportedSvgBase64 = "PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiPjx0ZXh0PmhpPC90ZXh0Pjwvc3ZnPg=="
        val unsupportedDataUrl = "data:image/svg+xml;base64,$unsupportedSvgBase64"
        assertNull("Unsupported SVG inside data URL must yield null, not fallback to text", IconDecoder.decode(unsupportedDataUrl))
    }

    @Test
    fun testNullAndEmptyReturnNull() {
        assertNull(IconDecoder.decode(null))
        assertNull(IconDecoder.decode(""))
        assertNull(IconDecoder.decode("   "))
    }

    @Test
    fun testBitmapDataUrlWithCustomDecoder() {
        // 4 bytes: 0x01, 0x02, 0x03, 0x04 -> base64 AQIDBA==
        val dataUrl = "data:image/png;base64,AQIDBA=="
        var calledWithBytes: ByteArray? = null
        val fakeDecoder = BitmapDecoder { bytes ->
            calledWithBytes = bytes
            // Return null or would return mock bitmap
            null
        }

        val res = IconDecoder.decode(dataUrl, fakeDecoder)
        assertNotNull(calledWithBytes)
        assertEquals(4, calledWithBytes!!.size)
        assertEquals(1.toByte(), calledWithBytes!![0])
        assertEquals(4.toByte(), calledWithBytes!![3])
        // Since fakeDecoder returned null, decode returns null
        assertNull(res)
    }

    @Test
    fun testStarterConfigIconsDecodeCleanly() {
        val userDir = File(System.getProperty("user.dir", "."))
        val candidates = listOf(
            File("examples/starter/src/orbitkit.config.json"),
            File("../../../examples/starter/src/orbitkit.config.json"),
            File(userDir, "examples/starter/src/orbitkit.config.json"),
            File(userDir, "../../../examples/starter/src/orbitkit.config.json")
        )
        val configFile = candidates.firstOrNull { it.exists() }
        assertNotNull("starter orbitkit.config.json must exist", configFile)

        val json = JSONObject(configFile!!.readText(Charsets.UTF_8))
        val items = json.getJSONObject("menu").getJSONArray("items")
        assertTrue("Starter menu has items", items.length() > 0)

        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val iconStr = item.optString("icon", null)
            val label = item.getString("label")
            assertNotNull("Item $label must have icon", iconStr)
            val decoded = IconDecoder.decode(iconStr)
            assertNotNull("Icon for $label must decode", decoded)
            assertTrue("Icon for $label must be SVG", decoded is DecodedIcon.Svg)
            val icon = (decoded as DecodedIcon.Svg).icon
            assertEquals(24f, icon.viewBox.width, 0.001f)
            assertEquals(24f, icon.viewBox.height, 0.001f)
            assertTrue("Icon for $label must have path commands", icon.commands.isNotEmpty())
        }
    }

    @Test
    fun testResolveItemIconFallbackWhenMalformedDataUrl() {
        val result = IconDecoder.resolveItemIcon("data:image/svg+xml;base64,invalid-base64!!!", "Quit")
        assertNotNull(result)
        assertTrue(result is DecodedIcon.Text)
        assertEquals("Quit", (result as DecodedIcon.Text).text)
    }

    @Test
    fun testResolveItemIconFallbackWhenUnsupportedSvgElement() {
        val unsupportedSvgDataUrl = "data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\"><text>hello</text></svg>"
        val result = IconDecoder.resolveItemIcon(unsupportedSvgDataUrl, "Quit")
        assertNotNull(result)
        assertTrue(result is DecodedIcon.Text)
        assertEquals("Quit", (result as DecodedIcon.Text).text)
    }

    @Test
    fun testResolveItemIconFallbackWhenNullIcon() {
        val result = IconDecoder.resolveItemIcon(null, "Quit")
        assertNotNull(result)
        assertTrue(result is DecodedIcon.Text)
        assertEquals("Quit", (result as DecodedIcon.Text).text)
    }

    @Test
    fun testResolveItemIconReturnsSvgWhenValid() {
        val validSvgDataUrl = "data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\"><path d=\"M2 2 L22 22\"/></svg>"
        val result = IconDecoder.resolveItemIcon(validSvgDataUrl, "Quit")
        assertNotNull(result)
        assertTrue(result is DecodedIcon.Svg)
        val svg = (result as DecodedIcon.Svg).icon
        assertEquals(24f, svg.viewBox.width, 0.001f)
        assertEquals(24f, svg.viewBox.height, 0.001f)
    }
}
