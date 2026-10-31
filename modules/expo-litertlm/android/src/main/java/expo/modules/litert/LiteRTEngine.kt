package expo.modules.litert

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import java.io.File

class LiteRTEngine {
  private val lock = Any()

  private var initialized = false
  private var loadedModelPath: String? = null
  private var engine: Engine? = null

  /** Backend running text generation: "gpu" or "cpu". */
  var activeBackend: String = "cpu"
    private set

  /** Why the GPU didn't start, when it was asked for and the CPU was used instead. */
  var gpuError: String? = null
    private set

  /**
   * Start the engine. With preferredBackend "gpu", text generation runs on the GPU,
   * falling back to the CPU when GPU start-up throws (no driver, unsupported chip).
   * A driver that crashes the process can't be caught here; LiteRTService handles that.
   * "gpu_fail_test" simulates a GPU start-up failure, for testing the fallback.
   * Photo reading always stays on the CPU.
   * @return the backend in use: "gpu" or "cpu"
   */
  fun initialize(modelPath: String, preferredBackend: String = "cpu"): String {
    val normalizedModelPath = normalizePath(modelPath)
    val modelFile = File(normalizedModelPath)
    if (!modelFile.exists()) {
      throw IllegalArgumentException("LiteRT model file not found at: $normalizedModelPath")
    }
    val wantsGpu = preferredBackend == "gpu" || preferredBackend == "gpu_fail_test"

    synchronized(lock) {
      if (initialized && loadedModelPath == normalizedModelPath && (activeBackend == "gpu") == wantsGpu) {
        return activeBackend
      }

      releaseLocked()
      gpuError = null

      if (wantsGpu) {
        try {
          if (preferredBackend == "gpu_fail_test") {
            throw IllegalStateException("Simulated GPU start-up failure")
          }
          startLocked(normalizedModelPath, Backend.GPU())
          activeBackend = "gpu"
          return activeBackend
        } catch (e: Exception) {
          gpuError = e.message ?: e.javaClass.simpleName
          releaseLocked()
        }
      }

      startLocked(normalizedModelPath, Backend.CPU())
      activeBackend = "cpu"
      return activeBackend
    }
  }

  private fun startLocked(modelPath: String, textBackend: Backend) {
    val engineConfig = EngineConfig(
      modelPath = modelPath,
      backend = textBackend,
      // Without a vision backend the engine segfaults on image input.
      // Images are sent one per message.
      visionBackend = Backend.CPU(),
      maxNumImages = 1,
    )
    val activeEngine = Engine(engineConfig)
    try {
      activeEngine.initialize()
    } catch (e: Exception) {
      try { activeEngine.close() } catch (_: Exception) {}
      throw e
    }

    engine = activeEngine
    loadedModelPath = modelPath
    initialized = true
  }

  fun complete(prompt: String, params: Map<String, Any?>): String {
    val normalizedPrompt = prompt.trim()
    if (normalizedPrompt.isEmpty()) {
      throw IllegalArgumentException("Prompt cannot be empty")
    }

    synchronized(lock) {
      val activeEngine = requireEngine()
      return activeEngine.createConversation().use { conversation ->
        val response = conversation.sendMessage(Message.Companion.of(normalizedPrompt))
        extractText(response)
      }
    }
  }

  fun completeWithImage(systemPrompt: String, userText: String, imageUri: String, params: Map<String, Any?>): String {
    val imagePath = normalizePath(imageUri)
    val imageFile = File(imagePath)
    if (!imageFile.exists()) {
      throw IllegalArgumentException("Image file not found at: $imagePath")
    }

    val prompt = composePrompt(systemPrompt, userText)
    if (prompt.isBlank()) {
      throw IllegalArgumentException("Prompt cannot be empty for image inference")
    }

    synchronized(lock) {
      val activeEngine = requireEngine()
      return activeEngine.createConversation().use { conversation ->
        val response = conversation.sendMessage(
          Message.Companion.of(
            Content.ImageFile(imagePath),
            Content.Text(prompt),
          )
        )
        extractText(response)
      }
    }
  }

  fun release() {
    synchronized(lock) {
      releaseLocked()
    }
  }

  private fun releaseLocked() {
    try {
      engine?.close()
    } finally {
      engine = null
      initialized = false
      loadedModelPath = null
    }
  }

  private fun requireEngine(): Engine {
    val activeEngine = engine
    if (!initialized || activeEngine == null) {
      throw IllegalStateException("LiteRT runtime is not initialized")
    }
    return activeEngine
  }

  private fun normalizePath(pathOrUri: String): String {
    if (pathOrUri.startsWith("file://")) {
      return pathOrUri.removePrefix("file://")
    }
    return pathOrUri
  }

  private fun composePrompt(systemPrompt: String, userText: String): String {
    val system = systemPrompt.trim()
    val user = userText.trim()

    return when {
      system.isNotEmpty() && user.isNotEmpty() -> "$system\n\n$user"
      system.isNotEmpty() -> system
      else -> user
    }
  }

  private fun extractText(message: Message): String {
    val text = message.contents.contents
      .mapNotNull { content ->
        when (content) {
          is Content.Text -> content.text.trim()
          else -> null
        }
      }
      .filter { it.isNotBlank() }
      .joinToString("\n")

    if (text.isNotBlank()) {
      return text
    }

    return message.toString().trim().ifBlank {
      throw IllegalStateException("LiteRT returned an empty response")
    }
  }
}
