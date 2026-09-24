package dev.orbitkit.native

import org.w3c.dom.Element
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

data class SvgIcon(
    val viewBox: SvgViewBox,
    val strokeColor: String,
    val strokeWidth: Float,
    val commands: List<PathCommand>
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

            val commands = ArrayList<PathCommand>()
            val success = parseChildren(root, commands)
            if (!success) return null

            SvgIcon(
                viewBox = viewBox,
                strokeColor = stroke,
                strokeWidth = strokeWidth,
                commands = commands
            )
        } catch (_: Throwable) {
            null
        }
    }

    private fun parseViewBox(root: Element): SvgViewBox? {
        val vbAttr = root.getAttribute("viewBox")
        if (vbAttr.isNotEmpty()) {
            val parts = vbAttr.split(Regex("[\\s,]+")).filter { it.isNotEmpty() }
            if (parts.size == 4) {
                val minX = parts[0].toFloatOrNull() ?: return null
                val minY = parts[1].toFloatOrNull() ?: return null
                val width = parts[2].toFloatOrNull() ?: return null
                val height = parts[3].toFloatOrNull() ?: return null
                if (width <= 0f || height <= 0f) return null
                return SvgViewBox(minX, minY, width, height)
            }
        }

        // Fallback: width and height attributes on root
        val wAttr = root.getAttribute("width").replace("px", "").trim()
        val hAttr = root.getAttribute("height").replace("px", "").trim()
        if (wAttr.isNotEmpty() && hAttr.isNotEmpty()) {
            val width = wAttr.toFloatOrNull() ?: return null
            val height = hAttr.toFloatOrNull() ?: return null
            if (width <= 0f || height <= 0f) return null
            return SvgViewBox(0f, 0f, width, height)
        }

        return null
    }

    private fun parseStroke(root: Element): String {
        val s = root.getAttribute("stroke").trim()
        return if (s.isNotEmpty() && s.lowercase() != "none") s else "#E6F6FF"
    }

    private fun parseStrokeWidth(root: Element): Float {
        val sw = root.getAttribute("stroke-width").replace("px", "").trim()
        return sw.toFloatOrNull() ?: 2f
    }

    private fun parseChildren(parent: Element, commands: MutableList<PathCommand>): Boolean {
        val children = parent.childNodes
        for (i in 0 until children.length) {
            val node = children.item(i)
            if (node.nodeType != Node.ELEMENT_NODE) continue
            val elem = node as Element
            when (elem.tagName.lowercase()) {
                "path" -> {
                    val d = elem.getAttribute("d")
                    if (!PathParser.parse(d, commands)) return false
                }
                "circle" -> {
                    if (!parseCircle(elem, commands)) return false
                }
                "ellipse" -> {
                    if (!parseEllipse(elem, commands)) return false
                }
                "line" -> {
                    if (!parseLine(elem, commands)) return false
                }
                "rect" -> {
                    if (!parseRect(elem, commands)) return false
                }
                "polyline" -> {
                    if (!parsePolyline(elem, commands)) return false
                }
                "polygon" -> {
                    if (!parsePolygon(elem, commands)) return false
                }
                "g" -> {
                    // Allow transparent group containers without transforms
                    val transform = elem.getAttribute("transform")
                    if (transform.isNotEmpty()) return false
                    if (!parseChildren(elem, commands)) return false
                }
                else -> {
                    // Unsupported element -> return null/false
                    return false
                }
            }
        }
        return true
    }

    private fun parseCircle(elem: Element, commands: MutableList<PathCommand>): Boolean {
        val cx = elem.getAttribute("cx").toFloatOrNull() ?: 0f
        val cy = elem.getAttribute("cy").toFloatOrNull() ?: 0f
        val r = elem.getAttribute("r").toFloatOrNull() ?: return false
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

    private fun parseEllipse(elem: Element, commands: MutableList<PathCommand>): Boolean {
        val cx = elem.getAttribute("cx").toFloatOrNull() ?: 0f
        val cy = elem.getAttribute("cy").toFloatOrNull() ?: 0f
        val rx = elem.getAttribute("rx").toFloatOrNull() ?: return false
        val ry = elem.getAttribute("ry").toFloatOrNull() ?: return false
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

    private fun parseLine(elem: Element, commands: MutableList<PathCommand>): Boolean {
        val x1 = elem.getAttribute("x1").toFloatOrNull() ?: 0f
        val y1 = elem.getAttribute("y1").toFloatOrNull() ?: 0f
        val x2 = elem.getAttribute("x2").toFloatOrNull() ?: 0f
        val y2 = elem.getAttribute("y2").toFloatOrNull() ?: 0f
        commands.add(PathCommand.MoveTo(x1, y1))
        commands.add(PathCommand.LineTo(x2, y2))
        return true
    }

    private fun parseRect(elem: Element, commands: MutableList<PathCommand>): Boolean {
        val x = elem.getAttribute("x").toFloatOrNull() ?: 0f
        val y = elem.getAttribute("y").toFloatOrNull() ?: 0f
        val w = elem.getAttribute("width").toFloatOrNull() ?: return false
        val h = elem.getAttribute("height").toFloatOrNull() ?: return false
        if (w <= 0f || h <= 0f) return false

        var rx = elem.getAttribute("rx").toFloatOrNull() ?: 0f
        var ry = elem.getAttribute("ry").toFloatOrNull() ?: 0f
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

    private fun parsePolyline(elem: Element, commands: MutableList<PathCommand>): Boolean {
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

    private fun parsePolygon(elem: Element, commands: MutableList<PathCommand>): Boolean {
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
