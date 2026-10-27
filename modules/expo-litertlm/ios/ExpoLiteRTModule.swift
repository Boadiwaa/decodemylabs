import ExpoModulesCore

public class ExpoLiteRTModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoLiteRT")

    let unsupportedMessage = "ExpoLiteRT is Android-only for now. iOS implementation is not available yet."

    AsyncFunction("initialize") { (_ payload: [String: Any]?) -> Void in
      throw NSError(domain: "ExpoLiteRT", code: 1, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("init") { (_ modelPath: String) -> Void in
      throw NSError(domain: "ExpoLiteRT", code: 1, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("complete") { (_ payload: [String: Any]?) -> String in
      throw NSError(domain: "ExpoLiteRT", code: 2, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("generateText") { (_ payload: [String: Any]?) -> String in
      throw NSError(domain: "ExpoLiteRT", code: 2, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("inferText") { (_ payload: [String: Any]?) -> String in
      throw NSError(domain: "ExpoLiteRT", code: 2, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("completeWithImage") { (_ payload: [String: Any]?) -> String in
      throw NSError(domain: "ExpoLiteRT", code: 3, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("inferImage") { (_ payload: [String: Any]?) -> String in
      throw NSError(domain: "ExpoLiteRT", code: 3, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("analyzeImage") { (_ payload: [String: Any]?) -> String in
      throw NSError(domain: "ExpoLiteRT", code: 3, userInfo: [NSLocalizedDescriptionKey: unsupportedMessage])
    }

    AsyncFunction("release") { () -> Void in
      return
    }

    AsyncFunction("shutdown") { () -> Void in
      return
    }
  }
}
