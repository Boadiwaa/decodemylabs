package expo.modules.litert

import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

class ExpoLiteRTModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  private val engine = LiteRTEngine()

  override fun definition() = ModuleDefinition {
    Name("ExpoLiteRT")

    AsyncFunction("initialize") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_INIT") {
        val modelPath = parseModelPathFromPayload(payload)
        engine.initialize(modelPath)
        null
      }
    }

    // Alias for compatibility with JS fallback call path.
    AsyncFunction("init") { modelPath: String, promise: Promise ->
      runAsync(promise, "ERR_INIT") {
        engine.initialize(modelPath)
        null
      }
    }

    AsyncFunction("complete") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_INFER") {
        val parsed = parseTextPayload(payload)
        engine.complete(parsed.prompt, parsed.params)
      }
    }

    AsyncFunction("generateText") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_INFER") {
        val parsed = parseTextPayload(payload)
        engine.complete(parsed.prompt, parsed.params)
      }
    }

    AsyncFunction("inferText") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_INFER") {
        val parsed = parseTextPayload(payload)
        engine.complete(parsed.prompt, parsed.params)
      }
    }

    AsyncFunction("completeWithImage") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_IMAGE") {
        val parsed = parseImagePayload(payload)
        engine.completeWithImage(parsed.systemPrompt, parsed.userText, parsed.imageUri, parsed.params)
      }
    }

    AsyncFunction("inferImage") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_IMAGE") {
        val parsed = parseImagePayload(payload)
        engine.completeWithImage(parsed.systemPrompt, parsed.userText, parsed.imageUri, parsed.params)
      }
    }

    AsyncFunction("analyzeImage") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_IMAGE") {
        val parsed = parseImagePayload(payload)
        engine.completeWithImage(parsed.systemPrompt, parsed.userText, parsed.imageUri, parsed.params)
      }
    }

    AsyncFunction("completeWithPdf") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_PDF") {
        val parsed = parsePdfPayload(payload)
        engine.completeWithPdf(getRequiredContext(), parsed.systemPrompt, parsed.userText, parsed.pdfUri, parsed.params)
      }
    }

    AsyncFunction("inferDocument") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_PDF") {
        val parsed = parsePdfPayload(payload)
        engine.completeWithPdf(getRequiredContext(), parsed.systemPrompt, parsed.userText, parsed.pdfUri, parsed.params)
      }
    }

    AsyncFunction("analyzeDocument") { payload: Map<String, Any?>, promise: Promise ->
      runAsync(promise, "ERR_PDF") {
        val parsed = parsePdfPayload(payload)
        engine.completeWithPdf(getRequiredContext(), parsed.systemPrompt, parsed.userText, parsed.pdfUri, parsed.params)
      }
    }

    AsyncFunction("release") { promise: Promise ->
      runAsync(promise, "ERR_RELEASE") {
        engine.release()
        null
      }
    }

    AsyncFunction("shutdown") { promise: Promise ->
      runAsync(promise, "ERR_RELEASE") {
        engine.release()
        null
      }
    }

    OnDestroy {
      try {
        engine.release()
      } catch (_: Exception) {
      }
      executor.shutdownNow()
    }
  }

  private fun getRequiredContext(): Context {
    return appContext.reactContext
      ?: appContext.throwingActivity?.applicationContext
      ?: throw IllegalStateException("Android application context is unavailable")
  }

  private fun runAsync(promise: Promise, code: String, block: () -> Any?) {
    executor.execute {
      try {
        promise.resolve(block())
      } catch (e: Exception) {
        promise.reject(code, e.message ?: "Native LiteRT module error", e)
      }
    }
  }

  private fun parseModelPathFromPayload(payload: Map<String, Any?>): String {
    val modelPath = payload["modelPath"] as? String
      ?: throw IllegalArgumentException("modelPath is required")
    if (modelPath.isBlank()) {
      throw IllegalArgumentException("modelPath cannot be blank")
    }
    return modelPath
  }

  @Suppress("UNCHECKED_CAST")
  private fun parseParams(payload: Map<String, Any?>): Map<String, Any?> {
    return payload["params"] as? Map<String, Any?> ?: emptyMap()
  }

  private fun parseTextPayload(payload: Map<String, Any?>): TextPayload {
    val prompt = payload["prompt"] as? String
      ?: throw IllegalArgumentException("prompt is required")
    if (prompt.isBlank()) {
      throw IllegalArgumentException("prompt cannot be blank")
    }
    return TextPayload(prompt = prompt, params = parseParams(payload))
  }

  private fun parseImagePayload(payload: Map<String, Any?>): ImagePayload {
    val imageUri = payload["imageUri"] as? String
      ?: throw IllegalArgumentException("imageUri is required")

    val prompt = payload["prompt"] as? String
    val systemPrompt = payload["systemPrompt"] as? String ?: ""
    val userText = payload["userText"] as? String ?: (prompt ?: "")

    if (imageUri.isBlank()) {
      throw IllegalArgumentException("imageUri cannot be blank")
    }

    return ImagePayload(
      systemPrompt = systemPrompt,
      userText = userText,
      imageUri = imageUri,
      params = parseParams(payload)
    )
  }

  private fun parsePdfPayload(payload: Map<String, Any?>): PdfPayload {
    val pdfUri = payload["pdfUri"] as? String
      ?: throw IllegalArgumentException("pdfUri is required")

    val prompt = payload["prompt"] as? String
    val systemPrompt = payload["systemPrompt"] as? String ?: ""
    val userText = payload["userText"] as? String ?: (prompt ?: "")

    if (pdfUri.isBlank()) {
      throw IllegalArgumentException("pdfUri cannot be blank")
    }

    return PdfPayload(
      systemPrompt = systemPrompt,
      userText = userText,
      pdfUri = pdfUri,
      params = parseParams(payload)
    )
  }

  private data class TextPayload(
    val prompt: String,
    val params: Map<String, Any?>,
  )

  private data class ImagePayload(
    val systemPrompt: String,
    val userText: String,
    val imageUri: String,
    val params: Map<String, Any?>,
  )

  private data class PdfPayload(
    val systemPrompt: String,
    val userText: String,
    val pdfUri: String,
    val params: Map<String, Any?>,
  )
}
