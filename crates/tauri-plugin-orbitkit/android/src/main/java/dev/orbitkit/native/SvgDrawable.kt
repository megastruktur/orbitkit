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
    overrideStrokeColor: Int? = null
) : Drawable() {
    private val rawPath: Path by lazy { icon.toPath() }
    private val transformedPath = Path()
    private val matrix = Matrix()

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = overrideStrokeColor ?: parseColorHex(icon.strokeColor)
    }

    private var lastWidth = -1
    private var lastHeight = -1

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
            val scale = if (maxVb > 0f) (discDim * 0.55f) / maxVb else 1f

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
            paint.strokeWidth = icon.strokeWidth * scale
        }

        canvas.drawPath(transformedPath, paint)
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
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
