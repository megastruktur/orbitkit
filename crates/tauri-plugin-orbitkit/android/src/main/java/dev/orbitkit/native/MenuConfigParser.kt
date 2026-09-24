package dev.orbitkit.native

import app.tauri.plugin.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.util.regex.Pattern

/**
 * Individual radial menu item parsed from K2 config.
 */
data class NativeMenuItem(
    val id: String,
    val label: String,
    val icon: String? = null,
    val disabled: Boolean = false
)

/**
 * Configuration for arc-style radial menu layout.
 */
data class NativeArcConfig(
    val position: String = DEFAULT_POSITION,
    val span: Double = DEFAULT_SPAN
) {
    companion object {
        const val DEFAULT_POSITION = "top"
        const val DEFAULT_SPAN = 180.0
        const val MIN_SPAN = 30.0
        const val MAX_SPAN = 300.0
        val VALID_POSITIONS = setOf("top", "bottom", "left", "right")
    }
}

/**
 * Complete radial menu configuration parsed from K2 config.
 */
data class NativeMenuConfig(
    val items: List<NativeMenuItem>,
    val radius: Double = DEFAULT_RADIUS,
    val startAngle: Double = DEFAULT_START_ANGLE,
    val endAngle: Double = DEFAULT_END_ANGLE,
    val itemSize: Double = DEFAULT_ITEM_SIZE,
    val trigger: String = DEFAULT_TRIGGER,
    val animation: String = DEFAULT_ANIMATION,
    val layout: String = DEFAULT_LAYOUT,
    val arc: NativeArcConfig? = null
) {
    companion object {
        const val DEFAULT_RADIUS = 96.0
        const val DEFAULT_START_ANGLE = -90.0
        const val DEFAULT_END_ANGLE = 270.0
        const val DEFAULT_ITEM_SIZE = 44.0
        const val DEFAULT_TRIGGER = "click"
        const val DEFAULT_ANIMATION = "spawn"
        const val DEFAULT_LAYOUT = "orbit"
        val VALID_LAYOUTS = setOf("orbit", "arc")
        val ID_PATTERN: Pattern = Pattern.compile("^[a-z0-9][a-z0-9_-]{0,31}$")
        fun isValidId(id: String): Boolean {
            return ID_PATTERN.matcher(id).matches()
        }
    }
}


/**
 * Mascot bubble arguments for overlay display.
 */
data class NativeMascotArgs(
    val size: Double? = null
)

/**
 * Combined overlay configuration received by overlayShow.
 */
data class OverlayConfig(
    val menu: NativeMenuConfig,
    val mascot: NativeMascotArgs? = null,
    val mascotSpec: MascotSpec? = null
)

/**
 * Parses and validates MenuConfig / OverlayConfig from JSON strings, JSONObject, or JSObject.
 * Throws IllegalArgumentException on invalid configurations (invalid item id, count > 12, etc.).
 */
object MenuConfigParser {
    private fun logW(msg: String) {
        try {
            android.util.Log.w("MenuConfigParser", msg)
        } catch (_: Throwable) {
            println("[MenuConfigParser] WARN: $msg")
        }
    }


    @JvmStatic
    fun parse(jsonStr: String): OverlayConfig {
        val trimmed = jsonStr.trim()
        if (trimmed.isEmpty() || trimmed == "null" || trimmed == "{}") {
            throw IllegalArgumentException("Empty or null JSON cannot be parsed as OverlayConfig")
        }
        return parse(JSONObject(trimmed))
    }

    @JvmStatic
    fun parse(obj: JSObject): OverlayConfig {
        return parse(obj as JSONObject)
    }

    @JvmStatic
    fun parse(obj: JSONObject): OverlayConfig {
        val menuJson = if (obj.has("menu") && !obj.isNull("menu")) {
            obj.getJSONObject("menu")
        } else if (obj.has("items")) {
            obj
        } else {
            throw IllegalArgumentException("Missing 'menu' or 'items' field in overlay config")
        }

        val menu = parseMenu(menuJson)

        val mascot = if (obj.has("mascot") && !obj.isNull("mascot")) {
            val mascotObj = obj.getJSONObject("mascot")
            val size = if (mascotObj.has("size") && !mascotObj.isNull("size")) {
                mascotObj.getDouble("size")
            } else null
            NativeMascotArgs(size = size)
        } else null

        val mascotSpec = MascotSpec.parse(obj)
        return OverlayConfig(menu = menu, mascot = mascot, mascotSpec = mascotSpec)
    }

    @JvmStatic
    fun parseMenu(obj: JSONObject): NativeMenuConfig {
        if (!obj.has("items")) {
            throw IllegalArgumentException("MenuConfig missing required 'items' field")
        }
        val itemsArray = obj.getJSONArray("items")
        val count = itemsArray.length()
        if (count < 1 || count > 12) {
            throw IllegalArgumentException("MenuConfig items count must be between 1 and 12 (got $count)")
        }

        val items = ArrayList<NativeMenuItem>(count)
        for (i in 0 until count) {
            val itemObj = itemsArray.getJSONObject(i)
            if (!itemObj.has("id")) {
                throw IllegalArgumentException("MenuItem at index $i missing required 'id'")
            }
            val id = itemObj.getString("id")
            if (!NativeMenuConfig.isValidId(id)) {
                throw IllegalArgumentException(
                    "MenuItem id '$id' is invalid: must match ^[a-z0-9][a-z0-9_-]{0,31}$"
                )
            }
            if (!itemObj.has("label")) {
                throw IllegalArgumentException("MenuItem at index $i missing required 'label'")
            }
            val label = itemObj.getString("label")
            val icon = if (itemObj.has("icon") && !itemObj.isNull("icon")) {
                itemObj.getString("icon")
            } else null
            val disabled = if (itemObj.has("disabled") && !itemObj.isNull("disabled")) {
                itemObj.getBoolean("disabled")
            } else false

            items.add(
                NativeMenuItem(
                    id = id,
                    label = label,
                    icon = icon,
                    disabled = disabled
                )
            )
        }

        val radius = if (obj.has("radius") && !obj.isNull("radius")) {
            obj.getDouble("radius")
        } else {
            NativeMenuConfig.DEFAULT_RADIUS
        }

        val startAngle = if (obj.has("startAngle") && !obj.isNull("startAngle")) {
            obj.getDouble("startAngle")
        } else {
            NativeMenuConfig.DEFAULT_START_ANGLE
        }

        val endAngle = if (obj.has("endAngle") && !obj.isNull("endAngle")) {
            obj.getDouble("endAngle")
        } else {
            NativeMenuConfig.DEFAULT_END_ANGLE
        }

        val itemSize = if (obj.has("itemSize") && !obj.isNull("itemSize")) {
            obj.getDouble("itemSize")
        } else {
            NativeMenuConfig.DEFAULT_ITEM_SIZE
        }

        val trigger = if (obj.has("trigger") && !obj.isNull("trigger")) {
            val t = obj.getString("trigger")
            if (t != "click" && t != "hover") {
                throw IllegalArgumentException("Invalid trigger '$t': must be 'click' or 'hover'")
            }
            t
        } else {
            NativeMenuConfig.DEFAULT_TRIGGER
        }
        val animation = if (obj.has("animation") && !obj.isNull("animation")) {
            val raw = obj.getString("animation")
            val normalized = raw.lowercase().trim()
            if (normalized == "none") {
                "none"
            } else if (normalized == "spawn") {
                "spawn"
            } else {
                logW("Unknown animation '$raw', falling back to 'spawn'")
                "spawn"
            }
        } else {
            NativeMenuConfig.DEFAULT_ANIMATION
        }
        val layout = if (obj.has("layout") && !obj.isNull("layout")) {
            val raw = obj.optString("layout", NativeMenuConfig.DEFAULT_LAYOUT).trim().lowercase()
            if (NativeMenuConfig.VALID_LAYOUTS.contains(raw)) {
                raw
            } else {
                logW("Unknown or invalid layout '$raw', falling back to '${NativeMenuConfig.DEFAULT_LAYOUT}'")
                NativeMenuConfig.DEFAULT_LAYOUT
            }
        } else {
            NativeMenuConfig.DEFAULT_LAYOUT
        }

        val arc = if (obj.has("arc") && !obj.isNull("arc")) {
            val arcObj = obj.optJSONObject("arc")
            if (arcObj != null) {
                val rawPosition = if (arcObj.has("position") && !arcObj.isNull("position")) {
                    arcObj.optString("position", NativeArcConfig.DEFAULT_POSITION).trim().lowercase()
                } else {
                    NativeArcConfig.DEFAULT_POSITION
                }
                val position = if (NativeArcConfig.VALID_POSITIONS.contains(rawPosition)) {
                    rawPosition
                } else {
                    logW("Unknown or invalid arc.position '$rawPosition', falling back to '${NativeArcConfig.DEFAULT_POSITION}'")
                    NativeArcConfig.DEFAULT_POSITION
                }

                val rawSpan = if (arcObj.has("span") && !arcObj.isNull("span")) {
                    arcObj.optDouble("span", NativeArcConfig.DEFAULT_SPAN)
                } else {
                    NativeArcConfig.DEFAULT_SPAN
                }
                val span = if (rawSpan.isNaN() || rawSpan < NativeArcConfig.MIN_SPAN || rawSpan > NativeArcConfig.MAX_SPAN) {
                    logW("Invalid arc.span $rawSpan (must be between ${NativeArcConfig.MIN_SPAN} and ${NativeArcConfig.MAX_SPAN}), falling back to ${NativeArcConfig.DEFAULT_SPAN}")
                    NativeArcConfig.DEFAULT_SPAN
                } else {
                    rawSpan
                }
                NativeArcConfig(position = position, span = span)
            } else {
                logW("Invalid arc configuration (not a JSON object), falling back to default")
                NativeArcConfig()
            }
        } else {
            null
        }

        return NativeMenuConfig(
            items = items,
            radius = radius,
            startAngle = startAngle,
            endAngle = endAngle,
            itemSize = itemSize,
            trigger = trigger,
            animation = animation,
            layout = layout,
            arc = arc
        )
    }
}
