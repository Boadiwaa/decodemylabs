import { requireNativeModule, Platform } from 'expo-modules-core';

let ExpoOcr = null;
try {
  ExpoOcr = requireNativeModule('ExpoOcr');
} catch (e) {
  console.warn('[ExpoOcr] Native module not available — OCR will not work on this device.', e.message);
}

/**
 * Recognize text from an image using on-device OCR.
 * iOS:     Apple Vision framework (VNRecognizeTextRequest)
 * Android: Google ML Kit Text Recognition
 *
 * @param {string} imagePath - file:// URI or absolute path to the image
 * @param {object} [options] - { visionIgnoreThreshold: number } (iOS only)
 * @returns {Promise<string[]>} Array of recognized text strings
 */
export async function recognizeText(imagePath, options = {}) {
  if (!ExpoOcr) {
    throw new Error('OCR is not available — the native ExpoOcr module could not be loaded.');
  }
  return await ExpoOcr.recognizeText(imagePath, options);
}
