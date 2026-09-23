package dev.orbitkit.native

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Modifier

class OrbitkitNativePluginTest {

    @Test
    fun testPackageAndClassHierarchy() {
        val clazz = OrbitkitNativePlugin::class.java
        assertEquals("dev.orbitkit.native.OrbitkitNativePlugin", clazz.name)
        assertTrue(
            "OrbitkitNativePlugin must extend app.tauri.plugin.Plugin",
            Plugin::class.java.isAssignableFrom(clazz)
        )
    }

    @Test
    fun testTauriPluginAnnotation() {
        val clazz = OrbitkitNativePlugin::class.java
        val annotation = clazz.getAnnotation(TauriPlugin::class.java)
        assertNotNull("OrbitkitNativePlugin must be annotated with @TauriPlugin", annotation)
    }

    @Test
    fun testActivityConstructor() {
        val clazz = OrbitkitNativePlugin::class.java
        val ctor = clazz.getConstructor(Activity::class.java)
        assertNotNull("OrbitkitNativePlugin must have public (Activity) constructor", ctor)
        assertTrue("Constructor must be public", Modifier.isPublic(ctor.modifiers))
    }

    @Test
    fun testC2CommandsPresentAndAnnotated() {
        val clazz = OrbitkitNativePlugin::class.java
        val requiredCommands = listOf(
            "isOverlayPermissionGranted",
            "requestOverlayPermission",
            "overlayShow",
            "overlayHide"
        )

        for (cmdName in requiredCommands) {
            val method = clazz.getMethod(cmdName, Invoke::class.java)
            assertNotNull("Method $cmdName(Invoke) must exist on OrbitkitNativePlugin", method)
            assertTrue("Method $cmdName must be public", Modifier.isPublic(method.modifiers))
            val cmdAnnotation = method.getAnnotation(Command::class.java)
            assertNotNull("Method $cmdName must be annotated with @Command", cmdAnnotation)
        }
    }

    @Test
    fun testOverlayShowArgsHasInvokeArg() {
        val clazz = OverlayShowArgs::class.java
        val annotation = clazz.getAnnotation(InvokeArg::class.java)
        assertNotNull("OverlayShowArgs must be annotated @InvokeArg", annotation)
    }

    @Test
    fun testC2RecorderCommandsPresentAndAnnotated() {
        val clazz = OrbitkitNativePlugin::class.java
        val requiredRecorderCommands = listOf(
            "recorderStartForeground",
            "recorderPause",
            "recorderResume",
            "recorderStop",
            "recorderState",
            "recorderGetPersistedState",
            "recorderRecoverState"
        )

        for (cmdName in requiredRecorderCommands) {
            val method = clazz.getMethod(cmdName, Invoke::class.java)
            assertNotNull("Method $cmdName(Invoke) must exist on OrbitkitNativePlugin", method)
            assertTrue("Method $cmdName must be public", Modifier.isPublic(method.modifiers))
            val cmdAnnotation = method.getAnnotation(Command::class.java)
            assertNotNull("Method $cmdName must be annotated with @Command", cmdAnnotation)
        }
    }

    @Test
    fun testJniBridgeClassAndMethodsReflection() {
        val clazz = OrbitkitJniBridge::class.java
        assertEquals("dev.orbitkit.native.OrbitkitJniBridge", clazz.name)

        val onNativeActionMethod = clazz.getMethod("onNativeAction", String::class.java)
        assertNotNull("onNativeAction(String) must exist", onNativeActionMethod)
        assertTrue(Modifier.isPublic(onNativeActionMethod.modifiers))

        val getCountMethod = clazz.getMethod("getActionCount")
        assertNotNull("getActionCount() must exist", getCountMethod)

        val getLogJsonMethod = clazz.getMethod("getActionLogJson")
        assertNotNull("getActionLogJson() must exist", getLogJsonMethod)
    }

    @Test
    fun testJniBridgeDispatchFallbackDoesNotCrash() {
        val res = OrbitkitJniBridge.dispatchNativeAction("TEST_ACTION")
        assertNotNull("dispatchNativeAction must return non-null result", res)
        assertTrue("Result must contain action name", res.contains("TEST_ACTION"))
    }
}
