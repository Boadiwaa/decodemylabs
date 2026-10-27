import { requireNativeModule } from 'expo-modules-core';

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

/** Returns true when native OCR with bounding boxes is available. */
export function hasNativeBoundingBoxOcr() {
  return Boolean(ExpoOcr && typeof ExpoOcr.recognizeTextWithBounds === 'function');
}

/** Returns true when native image redaction support is available. */
export function hasNativeImageRedaction() {
  return Boolean(ExpoOcr && typeof ExpoOcr.redactImage === 'function');
}

/**
 * Recognize text and include bounding boxes when supported by native module.
 * Falls back to text-only output mapped to a simplified shape.
 */
export async function recognizeTextWithBounds(imagePath, options = {}) {
  if (!ExpoOcr) {
    throw new Error('OCR is not available — the native ExpoOcr module could not be loaded.');
  }

  if (typeof ExpoOcr.recognizeTextWithBounds === 'function') {
    return await ExpoOcr.recognizeTextWithBounds(imagePath, options);
  }

  // Fallback shape for platforms where only text OCR is implemented.
  const lines = await recognizeText(imagePath, options);
  return (lines || []).map((text, index) => ({
    id: `line_${index}`,
    text,
    confidence: 1,
    boundingBox: null,
  }));
}

/**
 * Apply pixel-level redaction to the input image for the provided regions.
 * Requires native implementation.
 */
export async function redactImage(imagePath, regions, options = {}) {
  if (!ExpoOcr || typeof ExpoOcr.redactImage !== 'function') {
    throw new Error('Image redaction is unavailable — native redactImage is not implemented yet.');
  }
  return await ExpoOcr.redactImage(imagePath, regions, options);
}
