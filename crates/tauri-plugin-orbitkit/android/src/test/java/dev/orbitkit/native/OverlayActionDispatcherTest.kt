package dev.orbitkit.native

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class OverlayActionDispatcherTest {

    @Test
    fun testMenuActionPayloadBuildsCorrectMap() {
        val payload = OverlayActionDispatcher.menuActionPayload("act_test_1")
        assertEquals("act_test_1", payload["id"])
        assertEquals("overlay", payload["source"])
    }

    @Test
    fun testMenuActionPayloadJsonBuildsCorrectJson() {
        val json = OverlayActionDispatcher.menuActionPayloadJson("act_test_json")
        assertEquals("act_test_json", json.getString("id"))
        assertEquals("overlay", json.getString("source"))
    }

    @Test
    fun testHandleActionCallsJniDispatchOnceWithExactId() {
        val jniCallCount = AtomicInteger(0)
        var receivedId: String? = null

        val result = OverlayActionDispatcher.handleAction(
            id = "custom_action_id",
            disabled = false,
            jniDispatch = { id ->
                jniCallCount.incrementAndGet()
                receivedId = id
                "{\"status\":\"OK\"}"
            }
        )

        assertTrue("handleAction must return true for enabled item", result)
        assertEquals("JNI dispatch must be called exactly once", 1, jniCallCount.get())
        assertEquals("JNI dispatch must receive exact action id", "custom_action_id", receivedId)
    }

    @Test
    fun testHandleActionDisabledItemDoesNotDispatchJni() {
        val jniCallCount = AtomicInteger(0)
        var persistenceCalled = false

        val result = OverlayActionDispatcher.handleAction(
            id = "disabled_action_id",
            disabled = true,
            jniDispatch = { _ ->
                jniCallCount.incrementAndGet()
                "{\"status\":\"OK\"}"
            },
            recordAction = { _ ->
                persistenceCalled = true
            }
        )

        assertFalse("handleAction must return false for disabled item", result)
        assertEquals("JNI dispatch must NOT be called for disabled item", 0, jniCallCount.get())
        assertFalse("recordAction must NOT be called for disabled item", persistenceCalled)
    }

    @Test
    fun testHandleActionWithInjectableEmitter() {
        val jniCallCount = AtomicInteger(0)
        var emittedEvent: String? = null
        var emittedPayload: Map<String, String>? = null

        val result = OverlayActionDispatcher.handleAction(
            id = "action_emit_test",
            disabled = false,
            jniDispatch = { _ ->
                jniCallCount.incrementAndGet()
                "{\"status\":\"OK\"}"
            },
            emitAction = { event, payload ->
                emittedEvent = event
                emittedPayload = payload
            }
        )

        assertTrue(result)
        assertEquals(1, jniCallCount.get())
        assertEquals("orbitkit://menu-action", emittedEvent)
        assertEquals("action_emit_test", emittedPayload?.get("id"))
        assertEquals("overlay", emittedPayload?.get("source"))
    }

    @Test
    fun testHandleActionIgnoresBlankId() {
        val jniCallCount = AtomicInteger(0)
        val result = OverlayActionDispatcher.handleAction(
            id = "   ",
            disabled = false,
            jniDispatch = { _ ->
                jniCallCount.incrementAndGet()
                "{\"status\":\"OK\"}"
            }
        )
        assertFalse("handleAction must return false for blank id", result)
        assertEquals(0, jniCallCount.get())
    }
}
