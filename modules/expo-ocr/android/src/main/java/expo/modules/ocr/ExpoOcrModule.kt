package expo.modules.ocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class ExpoOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoOcr")

    AsyncFunction("recognizeText") { imagePath: String, options: Map<String, Any>?, promise: Promise ->
      try {
        val threshold = (options?.get("visionIgnoreThreshold") as? Number)?.toFloat() ?: 0.0f

        val cleanPath = cleanPath(imagePath)
        val bitmap = decodeBitmapOrReject(cleanPath, promise) ?: return@AsyncFunction

        // Create ML Kit InputImage
        val image = InputImage.fromBitmap(bitmap, 0)

        // Initialize text recognizer (Latin script — covers English, French)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(image)
          .addOnSuccessListener { visionText ->
            val results = mutableListOf<String>()
            for (block in visionText.textBlocks) {
              for (line in block.lines) {
                // Filter by confidence if threshold is set
                if (line.confidence != null && line.confidence!! < threshold) {
                  continue
                }
                results.add(line.text)
              }
            }
            promise.resolve(results)
            bitmap.recycle()
          }
          .addOnFailureListener { e ->
            promise.reject("ERR_OCR", "Text recognition failed: ${e.message}", e)
            bitmap.recycle()
          }
      } catch (e: Exception) {
        promise.reject("ERR_OCR", "OCR error: ${e.message}", e)
      }
    }

    AsyncFunction("recognizeTextWithBounds") { imagePath: String, options: Map<String, Any>?, promise: Promise ->
      try {
        val threshold = (options?.get("visionIgnoreThreshold") as? Number)?.toFloat() ?: 0.0f
        val cleanPath = cleanPath(imagePath)
        val bitmap = decodeBitmapOrReject(cleanPath, promise) ?: return@AsyncFunction

        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(image)
          .addOnSuccessListener { visionText ->
            val results = mutableListOf<Map<String, Any?>>()
            var index = 0

            for (block in visionText.textBlocks) {
              for (line in block.lines) {
                if (line.confidence != null && line.confidence!! < threshold) {
                  continue
                }

                val box = line.boundingBox
                val boundingBox = if (box != null) {
                  mapOf(
                    "left" to box.left.toDouble(),
                    "top" to box.top.toDouble(),
                    "right" to box.right.toDouble(),
                    "bottom" to box.bottom.toDouble(),
                  )
                } else {
                  null
                }

                val confidence = line.confidence?.toDouble() ?: 1.0
                results.add(
                  mapOf(
                    "id" to "line_$index",
                    "text" to line.text,
                    "confidence" to confidence,
                    "boundingBox" to boundingBox,
                  )
                )
                index += 1
              }
            }

            promise.resolve(results)
            bitmap.recycle()
          }
          .addOnFailureListener { e ->
            promise.reject("ERR_OCR", "Text recognition failed: ${e.message}", e)
            bitmap.recycle()
          }
      } catch (e: Exception) {
        promise.reject("ERR_OCR", "OCR bounds error: ${e.message}", e)
      }
    }

    AsyncFunction("redactImage") { imagePath: String, regions: List<Map<String, Any?>>, options: Map<String, Any>?, promise: Promise ->
      try {
        val cleanPath = cleanPath(imagePath)
        val bitmap = decodeBitmapOrReject(cleanPath, promise) ?: return@AsyncFunction
        val mutableBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, true)
        bitmap.recycle()

        val canvas = Canvas(mutableBitmap)
        val colorHex = options?.get("color") as? String ?: "#000000"
        val paint = Paint().apply {
          style = Paint.Style.FILL
          isAntiAlias = true
          color = parseColorSafe(colorHex)
        }

        val imageWidth = mutableBitmap.width.toFloat()
        val imageHeight = mutableBitmap.height.toFloat()

        for (region in regions) {
          val x = (region["x"] as? Number)?.toFloat() ?: continue
          val y = (region["y"] as? Number)?.toFloat() ?: continue
          val width = (region["width"] as? Number)?.toFloat() ?: continue
          val height = (region["height"] as? Number)?.toFloat() ?: continue

          val rect = if (x <= 1f && y <= 1f && width <= 1f && height <= 1f) {
            RectF(
              x * imageWidth,
              y * imageHeight,
              (x + width) * imageWidth,
              (y + height) * imageHeight,
            )
          } else {
            RectF(
              x,
              y,
              x + width,
              y + height,
            )
          }

          val clampedRect = RectF(
            rect.left.coerceIn(0f, imageWidth),
            rect.top.coerceIn(0f, imageHeight),
            rect.right.coerceIn(0f, imageWidth),
            rect.bottom.coerceIn(0f, imageHeight),
          )

          if (clampedRect.width() > 0f && clampedRect.height() > 0f) {
            canvas.drawRect(clampedRect, paint)
          }
        }

        val outFile = File(appContext.cacheDirectory, "redacted_${System.currentTimeMillis()}_${UUID.randomUUID()}.jpg")
        FileOutputStream(outFile).use { stream ->
          mutableBitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
          stream.flush()
        }

        mutableBitmap.recycle()

        promise.resolve(
          mapOf(
            "uri" to "file://${outFile.absolutePath}",
            "regionCount" to regions.size,
          )
        )
      } catch (e: Exception) {
        promise.reject("ERR_REDACTION", "Image redaction failed: ${e.message}", e)
      }
    }
  }

  private fun cleanPath(imagePath: String): String {
    return if (imagePath.startsWith("file://")) {
      imagePath.removePrefix("file://")
    } else {
      imagePath
    }
  }

  private fun decodeBitmapOrReject(cleanPath: String, promise: Promise): Bitmap? {
    val file = File(cleanPath)
    if (!file.exists()) {
      promise.reject("ERR_FILE_NOT_FOUND", "Image file not found at: $cleanPath", null)
      return null
    }

    val bitmap = BitmapFactory.decodeFile(cleanPath)
        if (bitmap == null) {
          promise.reject("ERR_LOAD_IMAGE", "Could not decode image at: $cleanPath", null)
      return null
    }

    return bitmap
  }

  private fun parseColorSafe(value: String): Int {
    return try {
      Color.parseColor(value)
    } catch (_: Exception) {
      Color.BLACK
    }
  }
}
