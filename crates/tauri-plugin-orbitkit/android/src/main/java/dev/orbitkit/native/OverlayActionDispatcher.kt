package dev.orbitkit.native

import org.json.JSONObject

/**
 * Pure action dispatch unit for overlay radial menu items.
 * Decoupled from Android UI/Views so it can be thoroughly unit-tested without device or robolectric.
 */
object OverlayActionDispatcher {

    /**
     * Pure payload builder for menu actions.
     */
    @JvmStatic
    fun menuActionPayload(id: String): Map<String, String> {
        return mapOf(
            "id" to id,
            "source" to "overlay"
        )
    }

    /**
     * JSON representation of menu action payload.
     */
    @JvmStatic
    fun menuActionPayloadJson(id: String): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("source", "overlay")
        }
    }

    /**
     * Dispatches an action from an overlay item.
     * Takes injectable dispatch functions for JNI, persistence, and optional event emission.
     * Returns true if dispatch succeeded, false if action was ignored (e.g. disabled or blank).
     */
    @JvmStatic
    fun handleAction(
        id: String,
        disabled: Boolean = false,
        jniDispatch: (String) -> String = { OrbitkitJniBridge.dispatchNativeAction(it) },
        recordAction: ((String) -> Unit)? = null,
        emitAction: ((String, Map<String, String>) -> Unit)? = null
    ): Boolean {
        if (disabled) {
            return false
        }
        val trimmedId = id.trim()
        if (trimmedId.isEmpty()) {
            return false
        }

        // 1. Dispatch via JNI to Rust
        jniDispatch(trimmedId)

        // 2. Optional persistence
        recordAction?.invoke(trimmedId)

        // 3. Optional emitter
        emitAction?.invoke("orbitkit://menu-action", menuActionPayload(trimmedId))

        return true
    }
}
