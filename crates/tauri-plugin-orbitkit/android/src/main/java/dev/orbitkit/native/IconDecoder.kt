package dev.orbitkit.native

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.net.URLDecoder

fun interface BitmapDecoder {
    fun decode(bytes: ByteArray): Bitmap?
}

object DefaultBitmapDecoder : BitmapDecoder {
    override fun decode(bytes: ByteArray): Bitmap? {
        return try {
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Throwable) {
            null
        }
    }
}

sealed class DecodedIcon {
    data class Svg(val icon: SvgIcon) : DecodedIcon()
    data class Bitmap(val bitmap: android.graphics.Bitmap) : DecodedIcon()
    data class Text(val text: String) : DecodedIcon()
}

object IconDecoder {
    private const val SVG_BASE64_PREFIX = "data:image/svg+xml;base64,"
    private const val SVG_URL_PREFIX = "data:image/svg+xml,"
    private const val SVG_UTF8_PREFIX = "data:image/svg+xml;utf8,"
    private const val SVG_CHARSET_PREFIX = "data:image/svg+xml;charset=utf-8,"

    fun decodeBase64(input: String): ByteArray? {
        val clean = StringBuilder()
        for (ch in input) {
            if (!ch.isWhitespace()) {
                clean.append(ch)
            }
        }
        val str = clean.toString()
        if (str.isEmpty()) return ByteArray(0)

        val len = str.length
        var pad = 0
        if (str.endsWith("==")) pad = 2
        else if (str.endsWith("=")) pad = 1

        val outLen = (len * 3) / 4 - pad
        if (outLen < 0) return null
        val out = ByteArray(outLen)

        var outIdx = 0
        var buf = 0
        var bits = 0

        for (i in 0 until len) {
            val c = str[i]
            if (c == '=') break
            val v = when (c) {
                in 'A'..'Z' -> c - 'A'
                in 'a'..'z' -> c - 'a' + 26
                in '0'..'9' -> c - '0' + 52
                '+', '-' -> 62
                '/', '_' -> 63
                else -> return null
            }
            buf = (buf shl 6) or v
            bits += 6
            if (bits >= 8) {
                bits -= 8
                if (outIdx < outLen) {
                    out[outIdx++] = ((buf shr bits) and 0xFF).toByte()
                }
            }
        }
        return if (outIdx == outLen) out else null
    }

    fun decode(raw: String?, bitmapDecoder: BitmapDecoder = DefaultBitmapDecoder): DecodedIcon? {
        if (raw == null) return null
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null

        if (trimmed.startsWith("<svg", ignoreCase = true)) {
            val icon = SvgParser.parse(trimmed) ?: return null
            return DecodedIcon.Svg(icon)
        }
        if (trimmed.startsWith("data:", ignoreCase = true)) {
            // "Never display a string that starts with data:"
            when {
                trimmed.startsWith(SVG_BASE64_PREFIX, ignoreCase = true) -> {
                    val payload = trimmed.substring(SVG_BASE64_PREFIX.length).trim()
                    val bytes = decodeBase64(payload) ?: return null
                    val svgStr = String(bytes, Charsets.UTF_8)
                    val icon = SvgParser.parse(svgStr) ?: return null
                    return DecodedIcon.Svg(icon)
                }
                trimmed.startsWith(SVG_URL_PREFIX, ignoreCase = true) -> {
                    val payload = trimmed.substring(SVG_URL_PREFIX.length).trim()
                    val svgStr = try {
                        URLDecoder.decode(payload, "UTF-8")
                    } catch (_: Throwable) {
                        return null
                    }
                    val icon = SvgParser.parse(svgStr) ?: return null
                    return DecodedIcon.Svg(icon)
                }
                trimmed.startsWith(SVG_UTF8_PREFIX, ignoreCase = true) -> {
                    val payload = trimmed.substring(SVG_UTF8_PREFIX.length).trim()
                    val svgStr = try {
                        URLDecoder.decode(payload, "UTF-8")
                    } catch (_: Throwable) {
                        return null
                    }
                    val icon = SvgParser.parse(svgStr) ?: return null
                    return DecodedIcon.Svg(icon)
                }
                trimmed.startsWith(SVG_CHARSET_PREFIX, ignoreCase = true) -> {
                    val payload = trimmed.substring(SVG_CHARSET_PREFIX.length).trim()
                    val svgStr = try {
                        URLDecoder.decode(payload, "UTF-8")
                    } catch (_: Throwable) {
                        return null
                    }
                    val icon = SvgParser.parse(svgStr) ?: return null
                    return DecodedIcon.Svg(icon)
                }
                isBitmapDataUrl(trimmed) -> {
                    val commaIdx = trimmed.indexOf(',')
                    if (commaIdx < 0) return null
                    val payload = trimmed.substring(commaIdx + 1).trim()
                    val bytes = decodeBase64(payload) ?: return null
                    val bmp = bitmapDecoder.decode(bytes) ?: return null
                    return DecodedIcon.Bitmap(bmp)
                }
                else -> {
                    // Any unsupported data: URL -> null
                    return null
                }
            }
        }

        // Non-data text (e.g. emoji or short text)
        return DecodedIcon.Text(trimmed)
    }

    /**
     * Resolves an icon for a menu item.
     * Attempts to decode [icon] first; if [icon] is null or fails to decode (e.g. malformed data URL
     * or unsupported SVG element), falls back to decoding [label] as text/emoji so the item is never blank.
     */
    fun resolveItemIcon(
        icon: String?,
        label: String?,
        bitmapDecoder: BitmapDecoder = DefaultBitmapDecoder
    ): DecodedIcon? {
        val decoded = if (icon != null) decode(icon, bitmapDecoder) else null
        return decoded ?: if (label != null) decode(label, bitmapDecoder) else null
    }

    private fun isBitmapDataUrl(url: String): Boolean {
        val lower = url.lowercase()
        return lower.startsWith("data:image/png;base64,") ||
                lower.startsWith("data:image/jpeg;base64,") ||
                lower.startsWith("data:image/jpg;base64,") ||
                lower.startsWith("data:image/webp;base64,")
    }
}
