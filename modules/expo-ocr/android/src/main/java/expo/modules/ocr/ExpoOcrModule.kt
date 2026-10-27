package expo.modules.ocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

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
}
