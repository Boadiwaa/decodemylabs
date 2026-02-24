/**
 * Expo Config Plugin — withAppConfig
 *
 * Applies platform-specific configuration that must survive `npx expo prebuild --clean`:
 *
 * iOS:
 *   - Extended virtual addressing entitlement (for loading large ~3 GB models)
 *   - Increased memory limit entitlement
 *   - LSMinimumSystemVersion set to 15.1 (matching Podfile)
 *   - Descriptive camera/photo permission strings
 *
 * Android:
 *   - android:largeHeap="true" on <application>
 *
 * Usage in app.json:
 *   "./plugins/withAppConfig"
 */

const {
  withEntitlementsPlist,
  withInfoPlist,
  withAndroidManifest,
} = require('expo/config-plugins');

function withAppConfig(config) {
  // ──── iOS: Entitlements ────
  config = withEntitlementsPlist(config, (mod) => {
    // Extended virtual addressing — enables large address space on A12+ (iPhone XS+)
    // Critical for loading 2.8 GB GGUF models without OOM
    mod.modResults['com.apple.developer.kernel.extended-virtual-addressing'] = true;

    // Increased memory limit — raises per-process memory ceiling
    mod.modResults['com.apple.developer.kernel.increased-memory-limit'] = true;

    return mod;
  });

  // ──── iOS: Info.plist ────
  config = withInfoPlist(config, (mod) => {
    // Match the Podfile deployment target (15.1)
    mod.modResults.LSMinimumSystemVersion = '15.1';

    // Descriptive permission strings for App Store review
    mod.modResults.NSCameraUsageDescription =
      '$(PRODUCT_NAME) uses your camera to scan lab reports for instant interpretation.';
    mod.modResults.NSPhotoLibraryUsageDescription =
      '$(PRODUCT_NAME) needs access to your photos so you can upload lab report images.';

    return mod;
  });

  // ──── Android: largeHeap ────
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const application = manifest.manifest?.application?.[0];
    if (application) {
      application.$['android:largeHeap'] = 'true';
    }
    return mod;
  });

  return config;
}

module.exports = withAppConfig;
