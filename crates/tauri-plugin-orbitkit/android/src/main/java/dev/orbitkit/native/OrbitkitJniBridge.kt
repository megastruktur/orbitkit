package dev.orbitkit.native

import android.util.Log

object OrbitkitJniBridge {
    private const val TAG = "OrbitkitJniBridge"

    private fun logI(msg: String) {
        try { Log.i(TAG, msg) } catch (_: Throwable) { println("[$TAG] $msg") }
    }
    private fun logW(msg: String) {
        try { Log.w(TAG, msg) } catch (_: Throwable) { println("[$TAG] WARN: $msg") }
    }
    private fun logE(msg: String, tr: Throwable? = null) {
        try { Log.e(TAG, msg, tr) } catch (_: Throwable) { println("[$TAG] ERROR: $msg ${tr?.message ?: ""}") }
    }

    @Volatile
    private var isLibraryLoaded = false

    init {
        ensureLoaded()
    }

    /**
     * Ensure the native shared library (liborbitkit_lib.so) is loaded into the JVM process.
     * Safe to call multiple times. In Android instrumented/runtime apps, loads liborbitkit_lib.
     * In plain JVM unit test environments, gracefully handles UnsatisfiedLinkError.
     */
    fun ensureLoaded(): Boolean {
        if (isLibraryLoaded) return true
        return synchronized(this) {
            if (isLibraryLoaded) return true
            try {
                System.loadLibrary("orbitkit_lib")
                isLibraryLoaded = true
                logI("Successfully loaded native library 'orbitkit_lib'")
                true
            } catch (e: UnsatisfiedLinkError) {
                // Expected when running pure JUnit tests on host JVM without Android NDK target
                logW("orbitkit_lib not loaded via System.loadLibrary: ${e.message}")
                false
            } catch (e: Throwable) {
                logE("Unexpected error loading orbitkit_lib: ${e.message}", e)
                false
            }
        }
    }

    /**
     * Direct JNI export implemented in Rust:
     * `Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction`
     *
     * Dispatches action directly to Rust native layer without involving the Tauri WebView JS.
     * Operates normally even when the WebView is throttled or suspended.
     */
    @JvmStatic
    external fun onNativeAction(action: String): String

    /**
     * JNI export to query count of actions processed by Rust native bridge.
     */
    @JvmStatic
    external fun getActionCount(): Long

    /**
     * JNI export to query entire action history log as JSON from Rust native bridge.
     */
    @JvmStatic
    external fun getActionLogJson(): String

    /**
     * Safe dispatch helper with error handling and logging.
     */
    fun dispatchNativeAction(action: String): String {
        return try {
            ensureLoaded()
            val result = onNativeAction(action)
            logI("[JNI-DISPATCH] action='$action' -> Rust result: $result")
            result
        } catch (e: UnsatisfiedLinkError) {
            val fallback = "{\"status\":\"MOCK_JNI\",\"action\":\"$action\",\"reason\":\"Native library not loaded in JVM\"}"
            logW("[JNI-FALLBACK] action='$action' (UnsatisfiedLinkError) -> $fallback")
            fallback
        } catch (e: Throwable) {
            val err = "{\"status\":\"ERROR\",\"action\":\"$action\",\"error\":\"${e.message}\"}"
            logE("[JNI-ERROR] action='$action' -> $err", e)
            err
        }
    }
}
