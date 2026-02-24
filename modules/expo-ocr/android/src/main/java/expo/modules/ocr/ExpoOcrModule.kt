package expo.modules.ocr

import android.graphics.BitmapFactory
import android.net.Uri
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

        // Strip file:// prefix if present
        val cleanPath = if (imagePath.startsWith("file://")) {
          imagePath.removePrefix("file://")
        } else {
          imagePath
        }

        val file = File(cleanPath)
        if (!file.exists()) {
          promise.reject("ERR_FILE_NOT_FOUND", "Image file not found at: $cleanPath", null)
          return@AsyncFunction
        }

        // Load bitmap
        val bitmap = BitmapFactory.decodeFile(cleanPath)
        if (bitmap == null) {
          promise.reject("ERR_LOAD_IMAGE", "Could not decode image at: $cleanPath", null)
          return@AsyncFunction
        }

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
  }
}
