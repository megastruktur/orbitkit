package dev.orbitkit.native

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

class MascotSpecTest {

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
        fail("Required config file orbitkit.config.json not found in repo!")
        throw AssertionError("Unreachable")
    }

    @Test
    fun testMascotSpecParseFromRealStarterConfig() {
        val file = loadConfigFile()
        assertTrue("Starter config file must exist", file.exists())
        val json = JSONObject(file.readText())
        val spec = MascotSpec.parse(json)

        assertNotNull("MascotSpec must parse from real starter config", spec)
        assertEquals(MascotKind.SVG, spec!!.kind)
        assertEquals(96, spec.size)
        assertEquals("idle", spec.initialState)
        assertFalse("Real starter SVG mascot must not be fallback", spec.isFallback)
        assertTrue("Top-level src must start with <svg", spec.src.trim().startsWith("<svg"))
        assertEquals(2, spec.states.size)
    }

    @Test
    fun testSrcForIdleShowsBlueBody() {
        val file = loadConfigFile()
        val json = JSONObject(file.readText())
        val spec = MascotSpec.parse(json)
        assertNotNull(spec)

        val idleSrc = spec!!.srcFor("idle")
        assertTrue("idle state must contain blue body #4f7cff", idleSrc.contains("#4f7cff"))
        val decoded = IconDecoder.decode(idleSrc)
        assertTrue("idle src must decode to SVG", decoded is DecodedIcon.Svg)
    }

    @Test
    fun testSrcForBusyShowsAmberBody() {
        val file = loadConfigFile()
        val json = JSONObject(file.readText())
        val spec = MascotSpec.parse(json)
        assertNotNull(spec)

        val busySrc = spec!!.srcFor("busy")
        assertTrue("busy state must contain amber body #f59e0b", busySrc.contains("#f59e0b"))
        val decoded = IconDecoder.decode(busySrc)
        assertTrue("busy src must decode to SVG", decoded is DecodedIcon.Svg)
    }

    @Test
    fun testSrcForUnknownStateReturnsTopLevelSrc() {
        val file = loadConfigFile()
        val json = JSONObject(file.readText())
        val spec = MascotSpec.parse(json)
        assertNotNull(spec)

        val unknownSrc = spec!!.srcFor("nonexistent_state_xyz")
        assertEquals("Unknown state must return top-level src", spec.src, unknownSrc)
    }

    @Test
    fun testMissingConfigReturnsNull() {
        assertNull("Null JSONObject returns null MascotSpec", MascotSpec.parse(null))
        assertNull("Empty JSONObject returns null MascotSpec", MascotSpec.parse(JSONObject()))
        assertNull(
            "JSONObject with only menu returns null MascotSpec",
            MascotSpec.parse(JSONObject("""{"menu": {"items": [{"id": "a", "label": "A"}]}}"""))
        )
    }

    @Test
    fun testSpriteKindSetsFallbackFlag() {
        val json = JSONObject(
            """{
                "kind": "sprite",
                "src": "sprite.png",
                "size": 64,
                "initialState": "idle"
            }"""
        )
        val spec = MascotSpec.parse(json)
        assertNotNull("Sprite config parses into MascotSpec", spec)
        assertEquals(MascotKind.SPRITE, spec!!.kind)
        assertTrue("Sprite kind must have isFallback == true", spec.isFallback)
    }

    @Test
    fun testImageKindDecodesBitmap() {
        val json = JSONObject(
            """{
                "kind": "image",
                "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "size": 48
            }"""
        )
        val spec = MascotSpec.parse(json)
        assertNotNull("Image config parses into MascotSpec", spec)
        assertEquals(MascotKind.IMAGE, spec!!.kind)
        assertFalse("Image with valid src is not fallback", spec.isFallback)
    }

    @Test
    fun testMascotConfigPayloadWrapperParsing() {
        val json = JSONObject(
            """{
                "mascotConfig": {
                    "kind": "svg",
                    "src": "<svg id=\"default\"></svg>",
                    "size": 64,
                    "initialState": "idle",
                    "states": {
                        "busy": {
                            "src": "<svg id=\"busy\"></svg>"
                        }
                    }
                }
            }"""
        )
        val spec = MascotSpec.parse(json)
        assertNotNull("Wrapper with mascotConfig must parse", spec)
        assertEquals(64, spec!!.size)
        assertEquals("<svg id=\"busy\"></svg>", spec.srcFor("busy"))
        assertEquals("<svg id=\"default\"></svg>", spec.srcFor("idle"))
    }

    @Test
    fun testOverlayConfigMascotSizeOverride() {
        val json = JSONObject(
            """{
                "menu": {
                    "items": [{"id": "item1", "label": "Item 1"}]
                },
                "mascot": {
                    "size": 72.0
                },
                "mascotConfig": {
                    "kind": "svg",
                    "src": "<svg id=\"test\"></svg>",
                    "size": 96
                }
            }"""
        )
        val overlay = MenuConfigParser.parse(json)
        assertEquals(72.0, overlay.mascot?.size!!, 0.001)
        assertEquals(96, overlay.mascotSpec?.size)
    }

    @Test
    fun testMascotSpecCustomInitialStateAppliedToSrcFor() {
        val json = JSONObject(
            """{
                "kind": "svg",
                "src": "<svg id=\"default\"></svg>",
                "size": 64,
                "initialState": "busy",
                "states": {
                    "busy": {
                        "src": "<svg id=\"busy-initial\"></svg>"
                    },
                    "idle": {
                        "src": "<svg id=\"idle\"></svg>"
                    }
                }
            }"""
        )
        val spec = MascotSpec.parse(json)
        assertNotNull("MascotSpec must parse with custom initialState", spec)
        assertEquals("busy", spec!!.initialState)
        // Verifies that srcFor(spec.initialState) resolves the initial state's asset
        assertEquals("<svg id=\"busy-initial\"></svg>", spec.srcFor(spec.initialState))
    }
}
