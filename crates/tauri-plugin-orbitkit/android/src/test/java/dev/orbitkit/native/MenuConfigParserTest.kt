package dev.orbitkit.native

import app.tauri.plugin.JSObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class MenuConfigParserTest {

    private val DELTA = 0.001

    @Test
    fun testParseMinimalJsonWithDefaults() {
        val json = """
            {
                "items": [
                    { "id": "item1", "label": "First Item" }
                ]
            }
        """.trimIndent()

        val config = MenuConfigParser.parse(json)
        assertNotNull(config)
        assertNull(config.mascot)

        val menu = config.menu
        assertEquals(1, menu.items.size)
        assertEquals("item1", menu.items[0].id)
        assertEquals("First Item", menu.items[0].label)
        assertNull(menu.items[0].icon)
        assertFalse(menu.items[0].disabled)

        // Defaults per K2
        assertEquals(96.0, menu.radius, DELTA)
        assertEquals(-90.0, menu.startAngle, DELTA)
        assertEquals(270.0, menu.endAngle, DELTA)
        assertEquals(44.0, menu.itemSize, DELTA)
        assertEquals("click", menu.trigger)
    }

    @Test
    fun testParseFullJsonConfig() {
        val json = """
            {
                "items": [
                    { "id": "play", "label": "Play", "icon": "▶️", "disabled": false },
                    { "id": "pause", "label": "Pause", "icon": "⏸️", "disabled": true },
                    { "id": "stop_1", "label": "Stop", "icon": "⏹️" }
                ],
                "radius": 120.0,
                "startAngle": 0.0,
                "endAngle": 180.0,
                "itemSize": 48.0,
                "trigger": "hover"
            }
        """.trimIndent()

        val config = MenuConfigParser.parse(json)
        val menu = config.menu

        assertEquals(3, menu.items.size)
        assertEquals("play", menu.items[0].id)
        assertEquals("▶️", menu.items[0].icon)
        assertFalse(menu.items[0].disabled)

        assertEquals("pause", menu.items[1].id)
        assertEquals("⏸️", menu.items[1].icon)
        assertTrue(menu.items[1].disabled)

        assertEquals("stop_1", menu.items[2].id)
        assertEquals("⏹️", menu.items[2].icon)
        assertFalse(menu.items[2].disabled)

        assertEquals(120.0, menu.radius, DELTA)
        assertEquals(0.0, menu.startAngle, DELTA)
        assertEquals(180.0, menu.endAngle, DELTA)
        assertEquals(48.0, menu.itemSize, DELTA)
        assertEquals("hover", menu.trigger)
    }

    @Test
    fun testParseNestedMenuWrapper() {
        val json = """
            {
                "menu": {
                    "items": [
                        { "id": "act-a", "label": "Action A" },
                        { "id": "act_b", "label": "Action B" }
                    ],
                    "radius": 80.0
                },
                "mascot": {
                    "size": 64.0
                }
            }
        """.trimIndent()

        val config = MenuConfigParser.parse(json)
        assertNotNull(config.mascot)
        assertEquals(64.0, config.mascot!!.size!!, DELTA)

        val menu = config.menu
        assertEquals(2, menu.items.size)
        assertEquals("act-a", menu.items[0].id)
        assertEquals("act_b", menu.items[1].id)
        assertEquals(80.0, menu.radius, DELTA)
        assertEquals(-90.0, menu.startAngle, DELTA)
        assertEquals(270.0, menu.endAngle, DELTA)
    }

    @Test
    fun testParseFromJSObject() {
        val json = """
            {
                "menu": {
                    "items": [
                        { "id": "settings", "label": "Settings", "icon": "⚙️" }
                    ],
                    "radius": 100.0,
                    "itemSize": 50.0
                }
            }
        """.trimIndent()

        val jsObj = JSObject(json)
        val config = MenuConfigParser.parse(jsObj)

        assertEquals(1, config.menu.items.size)
        assertEquals("settings", config.menu.items[0].id)
        assertEquals("Settings", config.menu.items[0].label)
        assertEquals("⚙️", config.menu.items[0].icon)
        assertEquals(100.0, config.menu.radius, DELTA)
        assertEquals(50.0, config.menu.itemSize, DELTA)
    }

    @Test
    fun testParseInvalidIdThrowsException() {
        val invalidIds = listOf(
            "",                     // empty
            "-invalid",             // starts with hyphen
            "_invalid",             // starts with underscore
            "Invalid_Upper",        // contains uppercase
            "has space",            // contains space
            "special@char",         // contains special char
            "a".repeat(33)          // exceeds 32 chars
        )

        for (badId in invalidIds) {
            val json = """
                {
                    "items": [
                        { "id": "$badId", "label": "Bad" }
                    ]
                }
            """.trimIndent()

            try {
                MenuConfigParser.parse(json)
                fail("Expected IllegalArgumentException for invalid id: '$badId'")
            } catch (e: IllegalArgumentException) {
                assertTrue(
                    "Exception message should mention id: ${e.message}",
                    e.message?.contains("id") == true
                )
            }
        }
    }

    @Test
    fun testParseItemsExceedingTwelveThrowsException() {
        val itemsJson = (1..13).joinToString(",") { i ->
            """{ "id": "item$i", "label": "Item $i" }"""
        }
        val json = """{ "items": [ $itemsJson ] }"""

        try {
            MenuConfigParser.parse(json)
            fail("Expected IllegalArgumentException for 13 items (> 12 limit)")
        } catch (e: IllegalArgumentException) {
            assertTrue(
                "Exception message should mention maximum of 12: ${e.message}",
                e.message?.contains("12") == true
            )
        }
    }

    @Test
    fun testParseMissingItemsThrowsException() {
        try {
            MenuConfigParser.parse("{}")
            fail("Expected IllegalArgumentException for empty JSON")
        } catch (e: IllegalArgumentException) {
            assertNotNull(e.message)
        }

        try {
            MenuConfigParser.parse("""{ "radius": 100 }""")
            fail("Expected IllegalArgumentException for missing items")
        } catch (e: IllegalArgumentException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun testParseZeroItemsThrowsException() {
        val json = """{ "items": [] }"""
        try {
            MenuConfigParser.parse(json)
            fail("Expected IllegalArgumentException for 0 items (< 1 limit)")
        } catch (e: IllegalArgumentException) {
            assertTrue(
                "Exception message should mention 1 and 12: ${e.message}",
                e.message?.contains("1 and 12") == true
            )
        }
    }

    @Test
    fun testParseInvalidTriggerThrowsException() {
        val badTriggers = listOf("press", "long_press", "double_click", "pointer", "swipe")
        for (trigger in badTriggers) {
            val json = """
                {
                    "items": [ { "id": "act1", "label": "Act 1" } ],
                    "trigger": "$trigger"
                }
            """.trimIndent()
            try {
                MenuConfigParser.parse(json)
                fail("Expected IllegalArgumentException for invalid trigger '$trigger'")
            } catch (e: IllegalArgumentException) {
                assertTrue(
                    "Exception should mention trigger: ${e.message}",
                    e.message?.contains("trigger") == true
                )
            }
        }
    }

    @Test
    fun testParseValidTriggersAccepted() {
        for (trigger in listOf("click", "hover")) {
            val json = """
                {
                    "items": [ { "id": "act1", "label": "Act 1" } ],
                    "trigger": "$trigger"
                }
            """.trimIndent()
            val config = MenuConfigParser.parse(json)
            assertEquals(trigger, config.menu.trigger)
        }
    }

    @Test
    fun testParseAnimationField() {
        // missing -> spawn
        val missingJson = """{"items": [{"id": "act1", "label": "Act 1"}]}"""
        val configMissing = MenuConfigParser.parse(missingJson)
        assertEquals("spawn", configMissing.menu.animation)

        // "none" -> none
        val noneJson = """{"items": [{"id": "act1", "label": "Act 1"}], "animation": "none"}"""
        val configNone = MenuConfigParser.parse(noneJson)
        assertEquals("none", configNone.menu.animation)

        // "spawn" -> spawn
        val spawnJson = """{"items": [{"id": "act1", "label": "Act 1"}], "animation": "spawn"}"""
        val configSpawn = MenuConfigParser.parse(spawnJson)
        assertEquals("spawn", configSpawn.menu.animation)

        // garbage -> spawn (falls back with warning)
        val garbageJson = """{"items": [{"id": "act1", "label": "Act 1"}], "animation": "unknown-slide-fade"}"""
        val configGarbage = MenuConfigParser.parse(garbageJson)
        assertEquals("spawn", configGarbage.menu.animation)
    }

    @Test
    fun testParseValidArcLayoutAndConfig() {
        val json = """
            {
                "items": [{ "id": "act1", "label": "Act 1" }],
                "layout": "arc",
                "arc": {
                    "position": "bottom",
                    "span": 120.0
                }
            }
        """.trimIndent()
        val config = MenuConfigParser.parse(json)
        assertEquals("arc", config.menu.layout)
        assertNotNull(config.menu.arc)
        assertEquals("bottom", config.menu.arc?.position)
        assertEquals(120.0, config.menu.arc?.span ?: 0.0, DELTA)
    }

    @Test
    fun testParseArcWithDefaultPositionAndSpan() {
        // arc object empty -> position defaults to "top", span to 180.0
        val jsonEmptyArc = """
            {
                "items": [{ "id": "act1", "label": "Act 1" }],
                "layout": "arc",
                "arc": {}
            }
        """.trimIndent()
        val configEmptyArc = MenuConfigParser.parse(jsonEmptyArc)
        assertEquals("arc", configEmptyArc.menu.layout)
        assertNotNull(configEmptyArc.menu.arc)
        assertEquals("top", configEmptyArc.menu.arc?.position)
        assertEquals(180.0, configEmptyArc.menu.arc?.span ?: 0.0, DELTA)

        // layout: "arc" with no arc field -> arc is null
        val jsonNoArc = """
            {
                "items": [{ "id": "act1", "label": "Act 1" }],
                "layout": "arc"
            }
        """.trimIndent()
        val configNoArc = MenuConfigParser.parse(jsonNoArc)
        assertEquals("arc", configNoArc.menu.layout)
        assertNull(configNoArc.menu.arc)
    }

    @Test
    fun testParseUnknownLayoutFallsBackToOrbit() {
        for (invalidLayout in listOf("spiral", "unknown", "circle", "ARC_TOP", "")) {
            val json = """
                {
                    "items": [{ "id": "act1", "label": "Act 1" }],
                    "layout": "$invalidLayout"
                }
            """.trimIndent()
            val config = MenuConfigParser.parse(json)
            assertEquals("orbit", config.menu.layout)
        }
    }

    @Test
    fun testParseInvalidArcPositionFallsBackToTop() {
        for (invalidPos in listOf("diagonal", "north", "center", "invalid", "")) {
            val json = """
                {
                    "items": [{ "id": "act1", "label": "Act 1" }],
                    "layout": "arc",
                    "arc": { "position": "$invalidPos", "span": 180.0 }
                }
            """.trimIndent()
            val config = MenuConfigParser.parse(json)
            assertNotNull(config.menu.arc)
            assertEquals("top", config.menu.arc?.position)
        }
    }

    @Test
    fun testParseInvalidArcSpanFallsBackTo180() {
        // Span < 30 -> 180.0
        val jsonTooSmall = """
            {
                "items": [{ "id": "act1", "label": "Act 1" }],
                "layout": "arc",
                "arc": { "position": "left", "span": 20.0 }
            }
        """.trimIndent()
        val configSmall = MenuConfigParser.parse(jsonTooSmall)
        assertNotNull(configSmall.menu.arc)
        assertEquals(180.0, configSmall.menu.arc?.span ?: 0.0, DELTA)

        // Span > 300 -> 180.0
        val jsonTooLarge = """
            {
                "items": [{ "id": "act1", "label": "Act 1" }],
                "layout": "arc",
                "arc": { "position": "right", "span": 350.0 }
            }
        """.trimIndent()
        val configLarge = MenuConfigParser.parse(jsonTooLarge)
        assertNotNull(configLarge.menu.arc)
        assertEquals(180.0, configLarge.menu.arc?.span ?: 0.0, DELTA)
    }

    @Test
    fun testParseOrbitWithArcAllowed() {
        val json = """
            {
                "items": [{ "id": "act1", "label": "Act 1" }],
                "layout": "orbit",
                "arc": { "position": "bottom", "span": 90.0 }
            }
        """.trimIndent()
        val config = MenuConfigParser.parse(json)
        assertEquals("orbit", config.menu.layout)
        assertNotNull(config.menu.arc)
        assertEquals("bottom", config.menu.arc?.position)
        assertEquals(90.0, config.menu.arc?.span ?: 0.0, DELTA)
    }
}
