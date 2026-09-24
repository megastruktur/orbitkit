package dev.orbitkit.native

import org.w3c.dom.Element as DomElement
import org.w3c.dom.Node
import java.io.ByteArrayInputStream
import javax.xml.parsers.DocumentBuilderFactory

sealed class PathCommand {
    data class MoveTo(val x: Float, val y: Float) : PathCommand()
    data class LineTo(val x: Float, val y: Float) : PathCommand()
    data class CubicTo(
        val x1: Float, val y1: Float,
        val x2: Float, val y2: Float,
        val x: Float, val y: Float
    ) : PathCommand()
    object Close : PathCommand()
}

data class SvgViewBox(
    val minX: Float,
    val minY: Float,
    val width: Float,
    val height: Float
)

data class Paint(
    val fill: Int?,
    val stroke: Int?,
    val strokeWidth: Float = 1f,
    val cap: String? = null,
    val join: String? = null
) {
    val hasFill: Boolean get() = fill != null
    val hasStroke: Boolean get() = stroke != null
    val fillHex: String? get() = fill?.let { String.format("#%06x", it and 0xFFFFFF) }
    val strokeHex: String? get() = stroke?.let { String.format("#%06x", it and 0xFFFFFF) }
}

data class Element(
    val commands: List<PathCommand>,
    val paint: Paint,
    val matrix: FloatArray = floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f)
) {
    fun matrixDeterminant(): Float {
        return matrix[0] * matrix[4] - matrix[1] * matrix[3]
    }

    fun strokeScale(): Float {
        val det = matrixDeterminant()
        return kotlin.math.sqrt(kotlin.math.abs(det))
    }

    fun toPath(): android.graphics.Path {
        val path = android.graphics.Path()
        for (cmd in commands) {
            when (cmd) {
                is PathCommand.MoveTo -> path.moveTo(cmd.x, cmd.y)
                is PathCommand.LineTo -> path.lineTo(cmd.x, cmd.y)
                is PathCommand.CubicTo -> path.cubicTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)
                is PathCommand.Close -> path.close()
            }
        }
        return path
    }
}

data class SvgIcon(
    val viewBox: SvgViewBox,
    val strokeColor: String,
    val strokeWidth: Float,
    val commands: List<PathCommand>,
    val elements: List<Element> = emptyList()
) {
    fun toPath(): android.graphics.Path {
        val path = android.graphics.Path()
        for (cmd in commands) {
            when (cmd) {
                is PathCommand.MoveTo -> path.moveTo(cmd.x, cmd.y)
                is PathCommand.LineTo -> path.lineTo(cmd.x, cmd.y)
                is PathCommand.CubicTo -> path.cubicTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)
                is PathCommand.Close -> path.close()
            }
        }
        return path
    }
}

object SvgParser {
    private const val KAPPA = 0.55228475f

    fun toFiniteFloatOrNull(str: String?): Float? {
        if (str == null) return null
        val f = str.toFloatOrNull() ?: return null
        return if (f.isFinite()) f else null
    }
    val IDENTITY_MATRIX = floatArrayOf(
        1f, 0f, 0f,
        0f, 1f, 0f,
        0f, 0f, 1f
    )

    fun multiplyMatrices(a: FloatArray, b: FloatArray): FloatArray {
        val res = FloatArray(9)
        for (r in 0..2) {
            for (c in 0..2) {
                res[r * 3 + c] =
                    a[r * 3 + 0] * b[0 * 3 + c] +
                    a[r * 3 + 1] * b[1 * 3 + c] +
                    a[r * 3 + 2] * b[2 * 3 + c]
            }
        }
        return res
    }

    fun parseTransform(transformStr: String): FloatArray? {
        val trimmed = transformStr.trim()
        if (trimmed.isEmpty()) return IDENTITY_MATRIX.clone()

        val cmdRegex = Regex("""([a-zA-Z]+)\s*\(([^)]*)\)""")
        val matches = cmdRegex.findAll(trimmed).toList()
        if (matches.isEmpty()) return null

        // Reject leading garbage before first command
        if (matches.first().range.first != 0) return null
        // Reject trailing garbage after last command
        if (matches.last().range.last != trimmed.length - 1) return null
        // Reject invalid separators/garbage between commands
        for (i in 0 until matches.size - 1) {
            val between = trimmed.substring(matches[i].range.last + 1, matches[i + 1].range.first)
            if (!between.all { it.isWhitespace() || it == ',' }) {
                return null
            }
        }

        var result = IDENTITY_MATRIX.clone()
        for (match in matches) {
            val name = match.groupValues[1].lowercase()
            val rawArgs = match.groupValues[2].trim()
            val args = if (rawArgs.isEmpty()) emptyList() else {
                rawArgs.split(Regex("[\\s,]+")).filter { it.isNotEmpty() }.map { toFiniteFloatOrNull(it) ?: return null }
            }

            val mat = when (name) {
                "translate" -> {
                    when (args.size) {
                        1 -> floatArrayOf(1f, 0f, args[0], 0f, 1f, 0f, 0f, 0f, 1f)
                        2 -> floatArrayOf(1f, 0f, args[0], 0f, 1f, args[1], 0f, 0f, 1f)
                        else -> return null
                    }
                }
                "scale" -> {
                    when (args.size) {
                        1 -> floatArrayOf(args[0], 0f, 0f, 0f, args[0], 0f, 0f, 0f, 1f)
                        2 -> floatArrayOf(args[0], 0f, 0f, 0f, args[1], 0f, 0f, 0f, 1f)
                        else -> return null
                    }
                }
                "rotate" -> {
                    when (args.size) {
                        1 -> {
                            val rad = Math.toRadians(args[0].toDouble())
                            val cos = Math.cos(rad).toFloat()
                            val sin = Math.sin(rad).toFloat()
                            floatArrayOf(cos, -sin, 0f, sin, cos, 0f, 0f, 0f, 1f)
                        }
                        3 -> {
                            val a = args[0]
                            val cx = args[1]
                            val cy = args[2]
                            val rad = Math.toRadians(a.toDouble())
                            val cos = Math.cos(rad).toFloat()
                            val sin = Math.sin(rad).toFloat()
                            val tx = cx * (1f - cos) + cy * sin
                            val ty = cy * (1f - cos) - cx * sin
                            floatArrayOf(cos, -sin, tx, sin, cos, ty, 0f, 0f, 1f)
                        }
                        else -> return null
                    }
                }
                "matrix" -> {
                    if (args.size != 6) return null
                    // SVG matrix(a, b, c, d, e, f) where x' = a*x + c*y + e, y' = b*x + d*y + f
                    floatArrayOf(
                        args[0], args[2], args[4],
                        args[1], args[3], args[5],
                        0f, 0f, 1f
                    )
                }
                else -> return null
            }
            result = multiplyMatrices(result, mat)
        }
        return result
    }

    fun parseColor(colorStr: String?, rootStroke: Int? = null): Int? {
        if (colorStr == null) return null
        val s = colorStr.trim().lowercase()
        if (s.isEmpty() || s == "none") return null
        if (s == "currentcolor") {
            return rootStroke ?: 0xFFE6F6FF.toInt()
        }
        if (s == "white") return 0xFFFFFFFF.toInt()
        if (s == "black") return 0xFF000000.toInt()
        val hex = s.removePrefix("#")
        return try {
            when (hex.length) {
                3 -> {
                    val r = hex[0].toString().repeat(2).toInt(16)
                    val g = hex[1].toString().repeat(2).toInt(16)
                    val b = hex[2].toString().repeat(2).toInt(16)
                    (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                }
                6 -> {
                    (0xFF shl 24) or hex.toLong(16).toInt()
                }
                8 -> {
                    hex.toLong(16).toInt()
                }
                else -> null
            }
        } catch (_: Throwable) {
            null
        }
    }

    fun parse(svgXml: String): SvgIcon? {
        return try {
            val dbf = DocumentBuilderFactory.newInstance().apply {
                isNamespaceAware = false
                try {
                    setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
                    setFeature("http://xml.org/sax/features/external-general-entities", false)
                    setFeature("http://xml.org/sax/features/external-parameter-entities", false)
                } catch (_: Throwable) {
                    // Ignored on platforms where some features are unsupported
                }
            }
            val builder = dbf.newDocumentBuilder()
            val doc = builder.parse(ByteArrayInputStream(svgXml.toByteArray(Charsets.UTF_8)))
            val root = doc.documentElement ?: return null
            if (root.tagName.lowercase() != "svg") return null

            val viewBox = parseViewBox(root) ?: return null
            val stroke = parseStroke(root)
            val strokeWidth = parseStrokeWidth(root)

            val rootStroke = if (root.hasAttribute("stroke")) {
                parseColor(root.getAttribute("stroke"))
            } else null

            val rootFill = if (root.hasAttribute("fill")) {
                val f = root.getAttribute("fill").trim()
                if (f.equals("none", ignoreCase = true)) null else parseColor(f, rootStroke)
            } else {
                // Default fill per SVG specification is black
                0xFF000000.toInt()
            }

            val rootCap = if (root.hasAttribute("stroke-linecap")) root.getAttribute("stroke-linecap").trim() else null
            val rootJoin = if (root.hasAttribute("stroke-linejoin")) root.getAttribute("stroke-linejoin").trim() else null

            val initialPaint = Paint(
                fill = rootFill,
                stroke = rootStroke,
                strokeWidth = strokeWidth,
                cap = rootCap,
                join = rootJoin
            )

            val commands = ArrayList<PathCommand>()
            val elements = ArrayList<Element>()
            val success = parseElementChildren(root, initialPaint, IDENTITY_MATRIX, rootStroke, commands, elements)
            if (!success) return null

            SvgIcon(
                viewBox = viewBox,
                strokeColor = stroke,
                strokeWidth = strokeWidth,
                commands = commands,
                elements = elements
            )
        } catch (_: Throwable) {
            null
        }
    }

    private fun parseViewBox(root: DomElement): SvgViewBox? {
        val vbAttr = root.getAttribute("viewBox")
        if (vbAttr.isNotEmpty()) {
            val parts = vbAttr.split(Regex("[\\s,]+")).filter { it.isNotEmpty() }
            if (parts.size == 4) {
                val minX = toFiniteFloatOrNull(parts[0]) ?: return null
                val minY = toFiniteFloatOrNull(parts[1]) ?: return null
                val width = toFiniteFloatOrNull(parts[2]) ?: return null
                val height = toFiniteFloatOrNull(parts[3]) ?: return null
                if (width <= 0f || height <= 0f) return null
                return SvgViewBox(minX, minY, width, height)
            }
        }

        // Fallback: width and height attributes on root
        val wAttr = root.getAttribute("width").replace("px", "").trim()
        val hAttr = root.getAttribute("height").replace("px", "").trim()
        if (wAttr.isNotEmpty() && hAttr.isNotEmpty()) {
            val width = toFiniteFloatOrNull(wAttr) ?: return null
            val height = toFiniteFloatOrNull(hAttr) ?: return null
            if (width <= 0f || height <= 0f) return null
            return SvgViewBox(0f, 0f, width, height)
        }

        return null
    }

    private fun parseStroke(root: DomElement): String {
        val s = root.getAttribute("stroke").trim()
        return if (s.isNotEmpty() && s.lowercase() != "none") s else "#E6F6FF"
    }

    private fun parseStrokeWidth(root: DomElement): Float {
        val sw = toFiniteFloatOrNull(root.getAttribute("stroke-width").replace("px", "").trim()) ?: 2f
        return if (sw.isFinite()) sw else 2f
    }

    private fun parseElementChildren(
        parent: DomElement,
        currentPaint: Paint,
        currentMatrix: FloatArray,
        rootStroke: Int?,
        allCommands: MutableList<PathCommand>,
        elements: MutableList<Element>
    ): Boolean {
        val children = parent.childNodes
        for (i in 0 until children.length) {
            val node = children.item(i)
            if (node.nodeType != Node.ELEMENT_NODE) continue
            val elem = node as DomElement

            val elemMatrix = if (elem.hasAttribute("transform")) {
                val t = parseTransform(elem.getAttribute("transform")) ?: return false
                multiplyMatrices(currentMatrix, t)
            } else {
                currentMatrix
            }

            val elemFill = if (elem.hasAttribute("fill")) {
                val f = elem.getAttribute("fill").trim()
                if (f.equals("none", ignoreCase = true)) null else (parseColor(f, rootStroke) ?: return false)
            } else {
                currentPaint.fill
            }

            val elemStroke = if (elem.hasAttribute("stroke")) {
                val s = elem.getAttribute("stroke").trim()
                if (s.equals("none", ignoreCase = true)) null else (parseColor(s, rootStroke) ?: return false)
            } else {
                currentPaint.stroke
            }

            val elemStrokeWidth = if (elem.hasAttribute("stroke-width")) {
                toFiniteFloatOrNull(elem.getAttribute("stroke-width").replace("px", "").trim()) ?: return false
            } else {
                currentPaint.strokeWidth
            }

            val elemCap = if (elem.hasAttribute("stroke-linecap")) {
                elem.getAttribute("stroke-linecap").trim()
            } else {
                currentPaint.cap
            }

            val elemJoin = if (elem.hasAttribute("stroke-linejoin")) {
                elem.getAttribute("stroke-linejoin").trim()
            } else {
                currentPaint.join
            }

            val elemPaint = Paint(
                fill = elemFill,
                stroke = elemStroke,
                strokeWidth = elemStrokeWidth,
                cap = elemCap,
                join = elemJoin
            )

            when (elem.tagName.lowercase()) {
                "g" -> {
                    if (!parseElementChildren(elem, elemPaint, elemMatrix, rootStroke, allCommands, elements)) {
                        return false
                    }
                }
                "path" -> {
                    val d = elem.getAttribute("d")
                    val cmds = ArrayList<PathCommand>()
                    if (!PathParser.parse(d, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                "circle" -> {
                    val cmds = ArrayList<PathCommand>()
                    if (!parseCircle(elem, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                "ellipse" -> {
                    val cmds = ArrayList<PathCommand>()
                    if (!parseEllipse(elem, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                "line" -> {
                    val cmds = ArrayList<PathCommand>()
                    if (!parseLine(elem, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                "rect" -> {
                    val cmds = ArrayList<PathCommand>()
                    if (!parseRect(elem, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                "polyline" -> {
                    val cmds = ArrayList<PathCommand>()
                    if (!parsePolyline(elem, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                "polygon" -> {
                    val cmds = ArrayList<PathCommand>()
                    if (!parsePolygon(elem, cmds)) return false
                    elements.add(Element(cmds, elemPaint, elemMatrix))
                    allCommands.addAll(cmds)
                }
                else -> {
                    return false
                }
            }
        }
        return true
    }

    private fun parseCircle(elem: DomElement, commands: MutableList<PathCommand>): Boolean {
        val cx = if (elem.hasAttribute("cx")) (toFiniteFloatOrNull(elem.getAttribute("cx")) ?: return false) else 0f
        val cy = if (elem.hasAttribute("cy")) (toFiniteFloatOrNull(elem.getAttribute("cy")) ?: return false) else 0f
        val r = toFiniteFloatOrNull(elem.getAttribute("r")) ?: return false
        if (r <= 0f) return false

        val k = KAPPA * r
        commands.add(PathCommand.MoveTo(cx + r, cy))
        commands.add(PathCommand.CubicTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r))
        commands.add(PathCommand.CubicTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy))
        commands.add(PathCommand.CubicTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r))
        commands.add(PathCommand.CubicTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy))
        commands.add(PathCommand.Close)
        return true
    }

    private fun parseEllipse(elem: DomElement, commands: MutableList<PathCommand>): Boolean {
        val cx = if (elem.hasAttribute("cx")) (toFiniteFloatOrNull(elem.getAttribute("cx")) ?: return false) else 0f
        val cy = if (elem.hasAttribute("cy")) (toFiniteFloatOrNull(elem.getAttribute("cy")) ?: return false) else 0f
        val rx = toFiniteFloatOrNull(elem.getAttribute("rx")) ?: return false
        val ry = toFiniteFloatOrNull(elem.getAttribute("ry")) ?: return false
        if (rx <= 0f || ry <= 0f) return false

        val kx = KAPPA * rx
        val ky = KAPPA * ry
        commands.add(PathCommand.MoveTo(cx + rx, cy))
        commands.add(PathCommand.CubicTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry))
        commands.add(PathCommand.CubicTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy))
        commands.add(PathCommand.CubicTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry))
        commands.add(PathCommand.CubicTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy))
        commands.add(PathCommand.Close)
        return true
    }

    private fun parseLine(elem: DomElement, commands: MutableList<PathCommand>): Boolean {
        val x1 = if (elem.hasAttribute("x1")) (toFiniteFloatOrNull(elem.getAttribute("x1")) ?: return false) else 0f
        val y1 = if (elem.hasAttribute("y1")) (toFiniteFloatOrNull(elem.getAttribute("y1")) ?: return false) else 0f
        val x2 = if (elem.hasAttribute("x2")) (toFiniteFloatOrNull(elem.getAttribute("x2")) ?: return false) else 0f
        val y2 = if (elem.hasAttribute("y2")) (toFiniteFloatOrNull(elem.getAttribute("y2")) ?: return false) else 0f
        commands.add(PathCommand.MoveTo(x1, y1))
        commands.add(PathCommand.LineTo(x2, y2))
        return true
    }

    private fun parseRect(elem: DomElement, commands: MutableList<PathCommand>): Boolean {
        val x = if (elem.hasAttribute("x")) (toFiniteFloatOrNull(elem.getAttribute("x")) ?: return false) else 0f
        val y = if (elem.hasAttribute("y")) (toFiniteFloatOrNull(elem.getAttribute("y")) ?: return false) else 0f
        val w = toFiniteFloatOrNull(elem.getAttribute("width")) ?: return false
        val h = toFiniteFloatOrNull(elem.getAttribute("height")) ?: return false
        if (w <= 0f || h <= 0f) return false

        var rx = if (elem.hasAttribute("rx")) (toFiniteFloatOrNull(elem.getAttribute("rx")) ?: return false) else 0f
        var ry = if (elem.hasAttribute("ry")) (toFiniteFloatOrNull(elem.getAttribute("ry")) ?: return false) else 0f
        if (rx > 0f && ry <= 0f) ry = rx
        if (ry > 0f && rx <= 0f) rx = ry
        rx = rx.coerceAtMost(w / 2f)
        ry = ry.coerceAtMost(h / 2f)

        if (rx <= 0f || ry <= 0f) {
            commands.add(PathCommand.MoveTo(x, y))
            commands.add(PathCommand.LineTo(x + w, y))
            commands.add(PathCommand.LineTo(x + w, y + h))
            commands.add(PathCommand.LineTo(x, y + h))
            commands.add(PathCommand.Close)
        } else {
            val kx = KAPPA * rx
            val ky = KAPPA * ry
            commands.add(PathCommand.MoveTo(x + rx, y))
            commands.add(PathCommand.LineTo(x + w - rx, y))
            commands.add(PathCommand.CubicTo(x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry))
            commands.add(PathCommand.LineTo(x + w, y + h - ry))
            commands.add(PathCommand.CubicTo(x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h))
            commands.add(PathCommand.LineTo(x + rx, y + h))
            commands.add(PathCommand.CubicTo(x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry))
            commands.add(PathCommand.LineTo(x, y + ry))
            commands.add(PathCommand.CubicTo(x, y + ry - ky, x + rx - kx, y, x + rx, y))
            commands.add(PathCommand.Close)
        }
        return true
    }

    private fun parsePolyline(elem: DomElement, commands: MutableList<PathCommand>): Boolean {
        val pts = parsePoints(elem.getAttribute("points")) ?: return false
        if (pts.size < 2 || pts.size % 2 != 0) return false
        commands.add(PathCommand.MoveTo(pts[0], pts[1]))
        var i = 2
        while (i < pts.size) {
            commands.add(PathCommand.LineTo(pts[i], pts[i + 1]))
            i += 2
        }
        return true
    }

    private fun parsePolygon(elem: DomElement, commands: MutableList<PathCommand>): Boolean {
        val pts = parsePoints(elem.getAttribute("points")) ?: return false
        if (pts.size < 2 || pts.size % 2 != 0) return false
        commands.add(PathCommand.MoveTo(pts[0], pts[1]))
        var i = 2
        while (i < pts.size) {
            commands.add(PathCommand.LineTo(pts[i], pts[i + 1]))
            i += 2
        }
        commands.add(PathCommand.Close)
        return true
    }

    private fun parsePoints(pointsStr: String): List<Float>? {
        val tokenizer = PathTokenizer(pointsStr)
        val list = ArrayList<Float>()
        while (tokenizer.hasMore()) {
            val f = tokenizer.nextFloat() ?: return null
            list.add(f)
        }
        return list
    }
}

class PathTokenizer(private val text: String) {
    private var i = 0
    private val len = text.length

    fun hasMore(): Boolean {
        skipWhitespaceAndCommas()
        return i < len
    }

    private fun skipWhitespaceAndCommas() {
        while (i < len) {
            val c = text[i]
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == ',') {
                i++
            } else {
                break
            }
        }
    }

    fun isCommand(): Boolean {
        skipWhitespaceAndCommas()
        if (i >= len) return false
        val c = text[i]
        return ((c in 'A'..'Z') || (c in 'a'..'z')) && c != 'e' && c != 'E'
    }

    fun nextCommand(): Char? {
        skipWhitespaceAndCommas()
        if (i >= len) return null
        val c = text[i]
        if (((c in 'A'..'Z') || (c in 'a'..'z')) && c != 'e' && c != 'E') {
            i++
            return c
        }
        return null
    }

    fun nextFlag(): Int? {
        skipWhitespaceAndCommas()
        if (i >= len) return null
        val c = text[i]
        if (c == '0' || c == '1') {
            i++
            return c - '0'
        }
        return null
    }

    fun nextFloat(): Float? {
        skipWhitespaceAndCommas()
        if (i >= len) return null
        val start = i
        var c = text[i]
        if (c == '+' || c == '-') {
            i++
            if (i >= len) {
                i = start
                return null
            }
            c = text[i]
        }
        var hasDigits = false
        while (i < len && text[i].isDigit()) {
            hasDigits = true
            i++
        }
        if (i < len && text[i] == '.') {
            i++
            while (i < len && text[i].isDigit()) {
                hasDigits = true
                i++
            }
        }
        if (!hasDigits) {
            i = start
            return null
        }
        if (i < len && (text[i] == 'e' || text[i] == 'E')) {
            val eStart = i
            i++
            if (i < len && (text[i] == '+' || text[i] == '-')) {
                i++
            }
            var hasExpDigits = false
            while (i < len && text[i].isDigit()) {
                hasExpDigits = true
                i++
            }
            if (!hasExpDigits) {
                i = eStart
            }
        }
        val token = text.substring(start, i)
        return try {
            val v = token.toFloat()
            if (v.isInfinite() || v.isNaN()) {
                i = start
                null
            } else {
                v
            }
        } catch (_: Exception) {
            i = start
            null
        }
    }
}

object PathParser {
    fun parse(d: String, commands: MutableList<PathCommand>): Boolean {
        val tokenizer = PathTokenizer(d)
        var currentX = 0f
        var currentY = 0f
        var startX = 0f
        var startY = 0f
        var lastControlX: Float? = null
        var lastControlY: Float? = null
        var lastCommand: Char? = null

        var currentMode: Char? = null
        var isFirstCommand = true

        while (tokenizer.hasMore()) {
            val cmd = if (tokenizer.isCommand()) {
                val c = tokenizer.nextCommand() ?: return false
                currentMode = c
                c
            } else {
                val mode = currentMode ?: return false
                when (mode) {
                    'M' -> 'L'
                    'm' -> 'l'
                    else -> mode
                }
            }

            if (isFirstCommand) {
                if (cmd != 'M' && cmd != 'm') return false
                isFirstCommand = false
            }

            when (cmd) {
                'M' -> {
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    commands.add(PathCommand.MoveTo(x, y))
                    currentX = x
                    currentY = y
                    startX = x
                    startY = y
                    lastControlX = null
                    lastControlY = null
                    currentMode = 'L'
                    lastCommand = 'M'
                }
                'm' -> {
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val x = currentX + dx
                    val y = currentY + dy
                    commands.add(PathCommand.MoveTo(x, y))
                    currentX = x
                    currentY = y
                    startX = x
                    startY = y
                    lastControlX = null
                    lastControlY = null
                    currentMode = 'l'
                    lastCommand = 'm'
                }
                'L' -> {
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    commands.add(PathCommand.LineTo(x, y))
                    currentX = x
                    currentY = y
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'L'
                }
                'l' -> {
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val x = currentX + dx
                    val y = currentY + dy
                    commands.add(PathCommand.LineTo(x, y))
                    currentX = x
                    currentY = y
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'l'
                }
                'H' -> {
                    val x = tokenizer.nextFloat() ?: return false
                    commands.add(PathCommand.LineTo(x, currentY))
                    currentX = x
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'H'
                }
                'h' -> {
                    val dx = tokenizer.nextFloat() ?: return false
                    val x = currentX + dx
                    commands.add(PathCommand.LineTo(x, currentY))
                    currentX = x
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'h'
                }
                'V' -> {
                    val y = tokenizer.nextFloat() ?: return false
                    commands.add(PathCommand.LineTo(currentX, y))
                    currentY = y
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'V'
                }
                'v' -> {
                    val dy = tokenizer.nextFloat() ?: return false
                    val y = currentY + dy
                    commands.add(PathCommand.LineTo(currentX, y))
                    currentY = y
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'v'
                }
                'C' -> {
                    val x1 = tokenizer.nextFloat() ?: return false
                    val y1 = tokenizer.nextFloat() ?: return false
                    val x2 = tokenizer.nextFloat() ?: return false
                    val y2 = tokenizer.nextFloat() ?: return false
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    commands.add(PathCommand.CubicTo(x1, y1, x2, y2, x, y))
                    lastControlX = x2
                    lastControlY = y2
                    currentX = x
                    currentY = y
                    lastCommand = 'C'
                }
                'c' -> {
                    val dx1 = tokenizer.nextFloat() ?: return false
                    val dy1 = tokenizer.nextFloat() ?: return false
                    val dx2 = tokenizer.nextFloat() ?: return false
                    val dy2 = tokenizer.nextFloat() ?: return false
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val x1 = currentX + dx1
                    val y1 = currentY + dy1
                    val x2 = currentX + dx2
                    val y2 = currentY + dy2
                    val x = currentX + dx
                    val y = currentY + dy
                    commands.add(PathCommand.CubicTo(x1, y1, x2, y2, x, y))
                    lastControlX = x2
                    lastControlY = y2
                    currentX = x
                    currentY = y
                    lastCommand = 'c'
                }
                'S' -> {
                    val x2 = tokenizer.nextFloat() ?: return false
                    val y2 = tokenizer.nextFloat() ?: return false
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    val (x1, y1) = if (lastCommand in listOf('C', 'c', 'S', 's') && lastControlX != null && lastControlY != null) {
                        Pair(2f * currentX - lastControlX, 2f * currentY - lastControlY)
                    } else {
                        Pair(currentX, currentY)
                    }
                    commands.add(PathCommand.CubicTo(x1, y1, x2, y2, x, y))
                    lastControlX = x2
                    lastControlY = y2
                    currentX = x
                    currentY = y
                    lastCommand = 'S'
                }
                's' -> {
                    val dx2 = tokenizer.nextFloat() ?: return false
                    val dy2 = tokenizer.nextFloat() ?: return false
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val (x1, y1) = if (lastCommand in listOf('C', 'c', 'S', 's') && lastControlX != null && lastControlY != null) {
                        Pair(2f * currentX - lastControlX, 2f * currentY - lastControlY)
                    } else {
                        Pair(currentX, currentY)
                    }
                    val x2 = currentX + dx2
                    val y2 = currentY + dy2
                    val x = currentX + dx
                    val y = currentY + dy
                    commands.add(PathCommand.CubicTo(x1, y1, x2, y2, x, y))
                    lastControlX = x2
                    lastControlY = y2
                    currentX = x
                    currentY = y
                    lastCommand = 's'
                }
                'Q' -> {
                    val qx1 = tokenizer.nextFloat() ?: return false
                    val qy1 = tokenizer.nextFloat() ?: return false
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    val cx1 = currentX + (2f / 3f) * (qx1 - currentX)
                    val cy1 = currentY + (2f / 3f) * (qy1 - currentY)
                    val cx2 = x + (2f / 3f) * (qx1 - x)
                    val cy2 = y + (2f / 3f) * (qy1 - y)
                    commands.add(PathCommand.CubicTo(cx1, cy1, cx2, cy2, x, y))
                    lastControlX = qx1
                    lastControlY = qy1
                    currentX = x
                    currentY = y
                    lastCommand = 'Q'
                }
                'q' -> {
                    val dqx1 = tokenizer.nextFloat() ?: return false
                    val dqy1 = tokenizer.nextFloat() ?: return false
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val qx1 = currentX + dqx1
                    val qy1 = currentY + dqy1
                    val x = currentX + dx
                    val y = currentY + dy
                    val cx1 = currentX + (2f / 3f) * (qx1 - currentX)
                    val cy1 = currentY + (2f / 3f) * (qy1 - currentY)
                    val cx2 = x + (2f / 3f) * (qx1 - x)
                    val cy2 = y + (2f / 3f) * (qy1 - y)
                    commands.add(PathCommand.CubicTo(cx1, cy1, cx2, cy2, x, y))
                    lastControlX = qx1
                    lastControlY = qy1
                    currentX = x
                    currentY = y
                    lastCommand = 'q'
                }
                'T' -> {
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    val (qx1, qy1) = if (lastCommand in listOf('Q', 'q', 'T', 't') && lastControlX != null && lastControlY != null) {
                        Pair(2f * currentX - lastControlX, 2f * currentY - lastControlY)
                    } else {
                        Pair(currentX, currentY)
                    }
                    val cx1 = currentX + (2f / 3f) * (qx1 - currentX)
                    val cy1 = currentY + (2f / 3f) * (qy1 - currentY)
                    val cx2 = x + (2f / 3f) * (qx1 - x)
                    val cy2 = y + (2f / 3f) * (qy1 - y)
                    commands.add(PathCommand.CubicTo(cx1, cy1, cx2, cy2, x, y))
                    lastControlX = qx1
                    lastControlY = qy1
                    currentX = x
                    currentY = y
                    lastCommand = 'T'
                }
                't' -> {
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val x = currentX + dx
                    val y = currentY + dy
                    val (qx1, qy1) = if (lastCommand in listOf('Q', 'q', 'T', 't') && lastControlX != null && lastControlY != null) {
                        Pair(2f * currentX - lastControlX, 2f * currentY - lastControlY)
                    } else {
                        Pair(currentX, currentY)
                    }
                    val cx1 = currentX + (2f / 3f) * (qx1 - currentX)
                    val cy1 = currentY + (2f / 3f) * (qy1 - currentY)
                    val cx2 = x + (2f / 3f) * (qx1 - x)
                    val cy2 = y + (2f / 3f) * (qy1 - y)
                    commands.add(PathCommand.CubicTo(cx1, cy1, cx2, cy2, x, y))
                    lastControlX = qx1
                    lastControlY = qy1
                    currentX = x
                    currentY = y
                    lastCommand = 't'
                }
                'A' -> {
                    val rx = tokenizer.nextFloat() ?: return false
                    val ry = tokenizer.nextFloat() ?: return false
                    val rot = tokenizer.nextFloat() ?: return false
                    val largeArc = (tokenizer.nextFlag() ?: return false) != 0
                    val sweep = (tokenizer.nextFlag() ?: return false) != 0
                    val x = tokenizer.nextFloat() ?: return false
                    val y = tokenizer.nextFloat() ?: return false
                    val cubics = arcToCubics(
                        currentX.toDouble(), currentY.toDouble(),
                        rx.toDouble(), ry.toDouble(),
                        rot.toDouble(),
                        largeArc, sweep,
                        x.toDouble(), y.toDouble()
                    )
                    commands.addAll(cubics)
                    currentX = x
                    currentY = y
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'A'
                }
                'a' -> {
                    val rx = tokenizer.nextFloat() ?: return false
                    val ry = tokenizer.nextFloat() ?: return false
                    val rot = tokenizer.nextFloat() ?: return false
                    val largeArc = (tokenizer.nextFlag() ?: return false) != 0
                    val sweep = (tokenizer.nextFlag() ?: return false) != 0
                    val dx = tokenizer.nextFloat() ?: return false
                    val dy = tokenizer.nextFloat() ?: return false
                    val x = currentX + dx
                    val y = currentY + dy
                    val cubics = arcToCubics(
                        currentX.toDouble(), currentY.toDouble(),
                        rx.toDouble(), ry.toDouble(),
                        rot.toDouble(),
                        largeArc, sweep,
                        x.toDouble(), y.toDouble()
                    )
                    commands.addAll(cubics)
                    currentX = x
                    currentY = y
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'a'
                }
                'Z', 'z' -> {
                    commands.add(PathCommand.Close)
                    currentX = startX
                    currentY = startY
                    lastControlX = null
                    lastControlY = null
                    lastCommand = 'Z'
                }
                else -> {
                    return false
                }
            }
        }
        return true
    }

    private fun arcToCubics(
        x1: Double, y1: Double,
        rxIn: Double, ryIn: Double,
        phiDeg: Double,
        largeArc: Boolean, sweep: Boolean,
        x2: Double, y2: Double
    ): List<PathCommand.CubicTo> {
        if (x1 == x2 && y1 == y2) return emptyList()
        var rx = Math.abs(rxIn)
        var ry = Math.abs(ryIn)
        if (rx == 0.0 || ry == 0.0) {
            val cp1x = (x1 * 2 + x2) / 3.0
            val cp1y = (y1 * 2 + y2) / 3.0
            val cp2x = (x1 + x2 * 2) / 3.0
            val cp2y = (y1 + y2 * 2) / 3.0
            return listOf(
                PathCommand.CubicTo(
                    cp1x.toFloat(), cp1y.toFloat(),
                    cp2x.toFloat(), cp2y.toFloat(),
                    x2.toFloat(), y2.toFloat()
                )
            )
        }

        val phi = Math.toRadians(phiDeg % 360.0)
        val cosPhi = Math.cos(phi)
        val sinPhi = Math.sin(phi)

        val dx = (x1 - x2) / 2.0
        val dy = (y1 - y2) / 2.0
        val x1Prime = cosPhi * dx + sinPhi * dy
        val y1Prime = -sinPhi * dx + cosPhi * dy

        val lambda = (x1Prime * x1Prime) / (rx * rx) + (y1Prime * y1Prime) / (ry * ry)
        if (lambda > 1.0) {
            val sqrtLambda = Math.sqrt(lambda)
            rx *= sqrtLambda
            ry *= sqrtLambda
        }

        val rxSq = rx * rx
        val rySq = ry * ry
        val x1PrimeSq = x1Prime * x1Prime
        val y1PrimeSq = y1Prime * y1Prime

        val num = rxSq * rySq - rxSq * y1PrimeSq - rySq * x1PrimeSq
        val den = rxSq * y1PrimeSq + rySq * x1PrimeSq
        var factor = if (den == 0.0) 0.0 else Math.sqrt(Math.max(0.0, num / den))
        if (largeArc == sweep) {
            factor = -factor
        }

        val cxPrime = factor * (rx * y1Prime / ry)
        val cyPrime = factor * (-ry * x1Prime / rx)

        val cx = cosPhi * cxPrime - sinPhi * cyPrime + (x1 + x2) / 2.0
        val cy = sinPhi * cxPrime + cosPhi * cyPrime + (y1 + y2) / 2.0

        fun vectorAngle(ux: Double, uy: Double, vx: Double, vy: Double): Double {
            val dot = ux * vx + uy * vy
            val len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy)
            if (len == 0.0) return 0.0
            val cos = Math.max(-1.0, Math.min(1.0, dot / len))
            val angle = Math.acos(cos)
            return if (ux * vy - uy * vx < 0) -angle else angle
        }

        val v1x = (x1Prime - cxPrime) / rx
        val v1y = (y1Prime - cyPrime) / ry
        val v2x = (-x1Prime - cxPrime) / rx
        val v2y = (-y1Prime - cyPrime) / ry

        val theta1 = vectorAngle(1.0, 0.0, v1x, v1y)
        var deltaTheta = vectorAngle(v1x, v1y, v2x, v2y) % (2.0 * Math.PI)

        if (!sweep && deltaTheta > 0.0) {
            deltaTheta -= 2.0 * Math.PI
        } else if (sweep && deltaTheta < 0.0) {
            deltaTheta += 2.0 * Math.PI
        }

        val numSegments = Math.max(1, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2.0)).toInt())
        val segSweep = deltaTheta / numSegments
        val alpha = (4.0 / 3.0) * Math.tan(segSweep / 4.0)

        val result = ArrayList<PathCommand.CubicTo>()
        var currentAngle = theta1

        fun toPoint(cosA: Double, sinA: Double): Pair<Double, Double> {
            val px = cx + cosPhi * rx * cosA - sinPhi * ry * sinA
            val py = cy + sinPhi * rx * cosA + cosPhi * ry * sinA
            return Pair(px, py)
        }

        for (i in 0 until numSegments) {
            val nextAngle = currentAngle + segSweep

            val cosCur = Math.cos(currentAngle)
            val sinCur = Math.sin(currentAngle)
            val cosNext = Math.cos(nextAngle)
            val sinNext = Math.sin(nextAngle)

            val cp1UnitX = cosCur - alpha * sinCur
            val cp1UnitY = sinCur + alpha * cosCur
            val cp2UnitX = cosNext + alpha * sinNext
            val cp2UnitY = sinNext - alpha * cosNext

            val cp1 = toPoint(cp1UnitX, cp1UnitY)
            val cp2 = toPoint(cp2UnitX, cp2UnitY)
            val p2 = if (i == numSegments - 1) Pair(x2, y2) else toPoint(cosNext, sinNext)

            result.add(
                PathCommand.CubicTo(
                    cp1.first.toFloat(), cp1.second.toFloat(),
                    cp2.first.toFloat(), cp2.second.toFloat(),
                    p2.first.toFloat(), p2.second.toFloat()
                )
            )
            currentAngle = nextAngle
        }

        return result
    }
}
