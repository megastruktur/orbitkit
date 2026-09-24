package dev.orbitkit.native

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import kotlin.math.max
import kotlin.math.min

class SvgDrawable(
    private val icon: SvgIcon,
    private val overrideStrokeColor: Int? = null,
    private val fraction: Float = 0.55f
) : Drawable() {
    private val rawPath: Path by lazy { icon.toPath() }
    private val transformedPath = Path()
    private val matrix = Matrix()
    private val elemMatrix = Matrix()
    private val compositeMatrix = Matrix()

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = overrideStrokeColor ?: parseColorHex(icon.strokeColor)
    }

    private val elementPaths by lazy {
        icon.elements.map { it to it.toPath() }
    }

    private var lastWidth = -1
    private var lastHeight = -1
    private var currentScale = 1f

    override fun draw(canvas: Canvas) {
        val b = bounds
        val w = b.width()
        val h = b.height()
        if (w <= 0 || h <= 0) return

        if (w != lastWidth || h != lastHeight) {
            lastWidth = w
            lastHeight = h

            val discDim = min(w, h).toFloat()
            val maxVb = max(icon.viewBox.width, icon.viewBox.height)
            val scale = if (maxVb > 0f) (discDim * fraction) / maxVb else 1f
            currentScale = scale

            val cx = b.left + w / 2f
            val cy = b.top + h / 2f
            val vbCenterX = icon.viewBox.minX + icon.viewBox.width / 2f
            val vbCenterY = icon.viewBox.minY + icon.viewBox.height / 2f

            val tx = cx - vbCenterX * scale
            val ty = cy - vbCenterY * scale

            matrix.reset()
            matrix.postScale(scale, scale)
            matrix.postTranslate(tx, ty)

            transformedPath.reset()
            rawPath.transform(matrix, transformedPath)
            strokePaint.strokeWidth = icon.strokeWidth * scale
        }

        if (icon.elements.isEmpty()) {
            canvas.drawPath(transformedPath, strokePaint)
            return
        }

        for ((element, elemPath) in elementPaths) {
            elemMatrix.setValues(element.matrix)
            compositeMatrix.set(matrix)
            compositeMatrix.preConcat(elemMatrix)

            transformedPath.reset()
            elemPath.transform(compositeMatrix, transformedPath)

            val paintSpec = element.paint

            if (paintSpec.hasFill && paintSpec.fill != null) {
                fillPaint.color = paintSpec.fill
                canvas.drawPath(transformedPath, fillPaint)
            }

            if (paintSpec.hasStroke && paintSpec.stroke != null) {
                strokePaint.color = overrideStrokeColor ?: paintSpec.stroke
                strokePaint.strokeWidth = paintSpec.strokeWidth * currentScale * element.strokeScale()
                strokePaint.strokeCap = when (paintSpec.cap?.lowercase()) {
                    "butt" -> Paint.Cap.BUTT
                    "square" -> Paint.Cap.SQUARE
                    else -> Paint.Cap.ROUND
                }
                strokePaint.strokeJoin = when (paintSpec.join?.lowercase()) {
                    "miter" -> Paint.Join.MITER
                    "bevel" -> Paint.Join.BEVEL
                    else -> Paint.Join.ROUND
                }
                canvas.drawPath(transformedPath, strokePaint)
            }
        }
    }

    override fun setAlpha(alpha: Int) {
        fillPaint.alpha = alpha
        strokePaint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        fillPaint.colorFilter = colorFilter
        strokePaint.colorFilter = colorFilter
    }
    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    companion object {
        fun parseColorHex(hex: String): Int {
            return try {
                val s = hex.trim()
                if (s.startsWith("#")) {
                    val raw = s.substring(1)
                    when (raw.length) {
                        3 -> {
                            val r = raw[0].toString().repeat(2).toInt(16)
                            val g = raw[1].toString().repeat(2).toInt(16)
                            val b = raw[2].toString().repeat(2).toInt(16)
                            (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                        }
                        6 -> {
                            (0xFF shl 24) or raw.toLong(16).toInt()
                        }
                        8 -> {
                            raw.toLong(16).toInt()
                        }
                        else -> 0xFFE6F6FF.toInt()
                    }
                } else {
                    Color.parseColor(hex)
                }
            } catch (_: Throwable) {
                0xFFE6F6FF.toInt()
            }
        }
    }
}

class TextDrawable(
    private val text: String,
    private val textColor: Int = Color.WHITE,
    private val textSizeSp: Float = 14f,
    private val density: Float = 1f
) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = textColor
        textSize = textSizeSp * density
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }

    override fun draw(canvas: Canvas) {
        val b = bounds
        if (b.width() <= 0 || b.height() <= 0) return
        val x = b.exactCenterX()
        val y = b.exactCenterY() - (paint.descent() + paint.ascent()) / 2f
        canvas.drawText(text, x, y, paint)
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
