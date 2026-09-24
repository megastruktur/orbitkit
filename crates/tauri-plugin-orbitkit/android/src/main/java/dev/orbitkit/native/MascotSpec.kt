package dev.orbitkit.native

import org.json.JSONObject

enum class MascotKind {
    SVG,
    IMAGE,
    SPRITE;

    companion object {
        fun fromString(str: String?): MascotKind {
            return when (str?.trim()?.lowercase()) {
                "svg" -> SVG
                "image" -> IMAGE
                "sprite" -> SPRITE
                else -> SVG
            }
        }
    }
}

data class MascotSpec(
    val kind: MascotKind,
    val src: String,
    val size: Int = DEFAULT_SIZE,
    val initialState: String = DEFAULT_INITIAL_STATE,
    val states: Map<String, String> = emptyMap()
) {
    val isFallback: Boolean
        get() = kind == MascotKind.SPRITE || src.isEmpty()

    fun srcFor(state: String): String {
        return states[state] ?: src
    }

    companion object {
        const val DEFAULT_SIZE = 56
        const val DEFAULT_INITIAL_STATE = "idle"

        @JvmStatic
        fun parse(json: JSONObject?): MascotSpec? {
            if (json == null) return null

            val obj = if (json.has("mascotConfig") && !json.isNull("mascotConfig")) {
                json.getJSONObject("mascotConfig")
            } else if (json.has("mascot") && !json.isNull("mascot")) {
                val m = json.get("mascot")
                if (m is JSONObject && (m.has("src") || m.has("kind") || m.has("states"))) {
                    m
                } else {
                    json
                }
            } else {
                json
            }

            if (!obj.has("src") && !obj.has("kind") && !obj.has("states")) {
                return null
            }

            val kindStr = if (obj.has("kind")) obj.getString("kind") else "svg"
            val kind = MascotKind.fromString(kindStr)
            val src = obj.optString("src", "")
            val size = if (obj.has("size") && !obj.isNull("size")) obj.optInt("size", DEFAULT_SIZE) else DEFAULT_SIZE
            val initialState = obj.optString("initialState", DEFAULT_INITIAL_STATE)

            val statesMap = HashMap<String, String>()
            if (obj.has("states") && !obj.isNull("states")) {
                val statesObj = obj.getJSONObject("states")
                val keys = statesObj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val stateVal = statesObj.get(key)
                    if (stateVal is JSONObject) {
                        if (stateVal.has("src")) {
                            statesMap[key] = stateVal.getString("src")
                        }
                    } else if (stateVal is String) {
                        statesMap[key] = stateVal
                    }
                }
            }

            return MascotSpec(
                kind = kind,
                src = src,
                size = size,
                initialState = initialState,
                states = statesMap
            )
        }
    }
}
