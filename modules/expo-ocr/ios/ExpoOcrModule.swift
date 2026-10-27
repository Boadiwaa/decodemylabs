import ExpoModulesCore
import Vision
import UIKit

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

    AsyncFunction("recognizeTextWithBounds") { (imagePath: String, options: [String: Any]?) -> [[String: Any]] in
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

          var output: [[String: Any]] = []
          for (index, observation) in observations.enumerated() {
            guard let candidate = observation.topCandidates(1).first,
                  candidate.confidence >= threshold else { continue }

            let box = observation.boundingBox
            output.append([
              "id": "line_\(index)",
              "text": candidate.string,
              "confidence": candidate.confidence,
              "boundingBox": [
                "x": box.origin.x,
                "y": box.origin.y,
                "width": box.size.width,
                "height": box.size.height,
              ],
            ])
          }

          continuation.resume(returning: output)
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

    AsyncFunction("redactImage") { (imagePath: String, regions: [[String: Any]], options: [String: Any]?) -> [String: Any] in
      let cleanPath = imagePath.hasPrefix("file://") ? String(imagePath.dropFirst(7)) : imagePath

      guard FileManager.default.fileExists(atPath: cleanPath) else {
        throw NSError(domain: "ExpoOcr", code: 10, userInfo: [NSLocalizedDescriptionKey: "Image file not found at path: \(cleanPath)"])
      }

      guard let imageData = try? Data(contentsOf: URL(fileURLWithPath: cleanPath)),
            let uiImage = UIImage(data: imageData) else {
        throw NSError(domain: "ExpoOcr", code: 11, userInfo: [NSLocalizedDescriptionKey: "Could not load image for redaction"])
      }

      let colorHex = options?["color"] as? String
      let redactionColor = self.colorFromHex(colorHex)
      let imageSize = uiImage.size
      let imageBounds = CGRect(origin: .zero, size: imageSize)

      let renderer = UIGraphicsImageRenderer(size: imageSize)
      let redactedImage = renderer.image { context in
        uiImage.draw(in: imageBounds)
        context.cgContext.setFillColor(redactionColor.cgColor)

        for region in regions {
          guard let x = (region["x"] as? NSNumber)?.doubleValue,
                let y = (region["y"] as? NSNumber)?.doubleValue,
                let width = (region["width"] as? NSNumber)?.doubleValue,
                let height = (region["height"] as? NSNumber)?.doubleValue else {
            continue
          }

          var rect: CGRect
          if x <= 1.0 && y <= 1.0 && width <= 1.0 && height <= 1.0 {
            // Vision normalized coordinates use bottom-left origin.
            rect = CGRect(
              x: x * imageSize.width,
              y: (1.0 - y - height) * imageSize.height,
              width: width * imageSize.width,
              height: height * imageSize.height
            )
          } else {
            rect = CGRect(x: x, y: y, width: width, height: height)
          }

          let clamped = rect.intersection(imageBounds)
          if !clamped.isNull && !clamped.isEmpty {
            context.cgContext.fill(clamped)
          }
        }
      }

      guard let jpegData = redactedImage.jpegData(compressionQuality: 0.95) else {
        throw NSError(domain: "ExpoOcr", code: 12, userInfo: [NSLocalizedDescriptionKey: "Could not encode redacted image"])
      }

      let cacheDir = FileManager.default.temporaryDirectory
      let outUrl = cacheDir.appendingPathComponent("redacted_\(UUID().uuidString).jpg")
      try jpegData.write(to: outUrl)

      return [
        "uri": "file://\(outUrl.path)",
        "regionCount": regions.count,
      ]
    }
  }

  private func colorFromHex(_ hex: String?) -> UIColor {
    let fallback = UIColor.black
    guard var value = hex?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return fallback
    }

    if value.hasPrefix("#") {
      value.removeFirst()
    }

    guard value.count == 6, let rgb = UInt64(value, radix: 16) else {
      return fallback
    }

    let red = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
    let green = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
    let blue = CGFloat(rgb & 0x0000FF) / 255.0
    return UIColor(red: red, green: green, blue: blue, alpha: 1.0)
  }
}
