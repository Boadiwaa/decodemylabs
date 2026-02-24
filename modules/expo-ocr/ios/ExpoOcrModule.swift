import ExpoModulesCore
import Vision

public class ExpoOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoOcr")

    AsyncFunction("recognizeText") { (imagePath: String, options: [String: Any]?) -> [String] in
      let threshold = (options?["visionIgnoreThreshold"] as? NSNumber)?.floatValue ?? 0.0
      let cleanPath = imagePath.hasPrefix("file://") ? String(imagePath.dropFirst(7)) : imagePath

      guard FileManager.default.fileExists(atPath: cleanPath) else {
        throw NSError(domain: "ExpoOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Image file not found at path: \(cleanPath)"])
      }

      guard let imageData = try? Data(contentsOf: URL(fileURLWithPath: cleanPath)),
            let uiImage = UIImage(data: imageData),
            let cgImage = uiImage.cgImage else {
        throw NSError(domain: "ExpoOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not load image"])
      }

      return try await withCheckedThrowingContinuation { continuation in
        let request = VNRecognizeTextRequest { request, error in
          if let error = error {
            continuation.resume(throwing: error)
            return
          }
          guard let observations = request.results as? [VNRecognizedTextObservation] else {
            continuation.resume(returning: [])
            return
          }
          let texts = observations.compactMap { obs -> String? in
            guard let candidate = obs.topCandidates(1).first,
                  candidate.confidence >= threshold else { return nil }
            return candidate.string
          }
          continuation.resume(returning: texts)
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
          try handler.perform([request])
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }
}
