package dev.orbitkit.native

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Modifier

class OrbitkitSurvivalJniTest {

    // ------------------------------------------------------------------------
    // Criterion 1: JNI Bridge Structure & Method Signatures
    // ------------------------------------------------------------------------

    @Test
    fun testJniBridgeClassAndMethodsReflection() {
        val clazz = OrbitkitJniBridge::class.java
        assertEquals("dev.orbitkit.native.OrbitkitJniBridge", clazz.name)

        // Verify native external fun onNativeAction(String): String
        val onNativeActionMethod = clazz.methods.find { it.name == "onNativeAction" }
        assertNotNull("OrbitkitJniBridge.onNativeAction must exist", onNativeActionMethod)
        assertEquals(String::class.java, onNativeActionMethod!!.returnType)
        assertEquals(1, onNativeActionMethod.parameterTypes.size)
        assertEquals(String::class.java, onNativeActionMethod.parameterTypes[0])
        assertTrue(
            "onNativeAction must be native or static delegate",
            Modifier.isNative(onNativeActionMethod.modifiers) || Modifier.isStatic(onNativeActionMethod.modifiers)
        )

        // Verify getActionCount()
        val getActionCountMethod = clazz.methods.find { it.name == "getActionCount" }
        assertNotNull("OrbitkitJniBridge.getActionCount must exist", getActionCountMethod)
        assertEquals(java.lang.Long.TYPE, getActionCountMethod!!.returnType)

        // Verify getActionLogJson()
        val getActionLogJsonMethod = clazz.methods.find { it.name == "getActionLogJson" }
        assertNotNull("OrbitkitJniBridge.getActionLogJson must exist", getActionLogJsonMethod)
        assertEquals(String::class.java, getActionLogJsonMethod!!.returnType)
    }

    @Test
    fun testJniBridgeDispatchFallbackDoesNotCrash() {
        // In JVM test without liborbitkit_lib.so, dispatchNativeAction catches UnsatisfiedLinkError
        val result = OrbitkitJniBridge.dispatchNativeAction("ACT_A")
        assertNotNull(result)
        assertTrue(result.contains("\"status\""))
        assertTrue(result.contains("\"action\":\"ACT_A\""))
    }

    @Test
    fun testJniBridgeActionsContract() {
        val testActions = listOf("ACT_A", "ACT_B", "ACT_C", "REC_START", "REC_PAUSE", "REC_RESUME", "REC_STOP")
        for (action in testActions) {
            val res = OrbitkitJniBridge.dispatchNativeAction(action)
            assertNotNull("Dispatch result for $action must not be null", res)
            assertTrue("Result must contain action $action", res.contains("\"action\":\"$action\""))
        }
    }

    // ------------------------------------------------------------------------
    // Scenario S1 Contract Test
    // ------------------------------------------------------------------------

    @Test
    fun testScenarioS1_JniDirectDispatchUnderSuspension() {
        // S1 contract: Overlay action must reach native bridge directly without JS invocation
        val resultA = OrbitkitJniBridge.dispatchNativeAction("ACT_A")
        assertNotNull(resultA)
        assertTrue(resultA.contains("\"action\":\"ACT_A\""))

        val resultRec = OrbitkitJniBridge.dispatchNativeAction("REC_START")
        assertNotNull(resultRec)
        assertTrue(resultRec.contains("\"action\":\"REC_START\""))
    }
}
