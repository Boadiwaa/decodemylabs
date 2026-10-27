import {
  hasNativeBoundingBoxOcr,
  hasNativeImageRedaction,
  recognizeTextWithBounds,
  redactImage,
} from '../../modules/expo-ocr/src/index';

const PII_LABEL_HINTS = [
  /patient\s*name/i,
  /\bname\b/i,
  /date\s*of\s*birth/i,
  /\bdob\b/i,
  /\baddress\b/i,
  /\bphone\b/i,
  /\bmobile\b/i,
  /\bmrn\b/i,
  /\bnhis\b/i,
  /\bpassport\b/i,
  /\bpatient\s*id\b/i,
  /\bmember\s*id\b/i,
  /\binsurance\b/i,
];

const PII_VALUE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}\b/,
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, // SSN-like
  /\b(?:DOB|D\.O\.B)[:\s-]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i,
  /\b(?:ID|MRN|PATIENT\s*ID|REPORT\s*NO\.?|ACCESSION\s*NO\.?)[:\s-]*[A-Z0-9-]{4,}\b/i,
];

function isLikelyPiiText(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  if (PII_LABEL_HINTS.some((re) => re.test(value))) return true;
  if (PII_VALUE_PATTERNS.some((re) => re.test(value))) return true;

  return false;
}

function hasBoundingBox(item) {
  const box = item?.boundingBox;
  if (!box) return false;

  const hasRectKeys =
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height);

  const hasLTRBKeys =
    Number.isFinite(box.left) &&
    Number.isFinite(box.top) &&
    Number.isFinite(box.right) &&
    Number.isFinite(box.bottom);

  return hasRectKeys || hasLTRBKeys;
}

function toRedactionRegion(item) {
  const box = item?.boundingBox;
  if (!box) return null;

  if (Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width) && Number.isFinite(box.height)) {
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      text: item.text,
      reason: 'pii',
    };
  }

  if (Number.isFinite(box.left) && Number.isFinite(box.top) && Number.isFinite(box.right) && Number.isFinite(box.bottom)) {
    return {
      x: box.left,
      y: box.top,
      width: box.right - box.left,
      height: box.bottom - box.top,
      text: item.text,
      reason: 'pii',
    };
  }

  return null;
}

/**
 * Redact likely PII regions before remote multimodal upload.
 * Fails closed when native redaction capability is unavailable.
 */
export async function redactLabImageForRemoteInference(imageUri) {
  if (!imageUri) {
    return { success: false, reason: 'missing-image-uri' };
  }

  if (!hasNativeBoundingBoxOcr()) {
    return { success: false, reason: 'ocr-bounding-box-unavailable' };
  }

  if (!hasNativeImageRedaction()) {
    return { success: false, reason: 'native-image-redaction-unavailable' };
  }

  let observations = [];
  try {
    observations = await recognizeTextWithBounds(imageUri, { visionIgnoreThreshold: 0.3 });
  } catch (error) {
    return { success: false, reason: `ocr-failed: ${error.message}` };
  }

  const piiRegions = (observations || [])
    .filter((item) => isLikelyPiiText(item?.text) && hasBoundingBox(item))
    .map(toRedactionRegion)
    .filter(Boolean);

  if (piiRegions.length === 0) {
    return {
      success: true,
      redactedUri: imageUri,
      redactionApplied: false,
      piiRegions: [],
    };
  }

  try {
    const redacted = await redactImage(imageUri, piiRegions, {
      mode: 'blackout',
      color: '#000000',
    });

    const redactedUri = typeof redacted === 'string' ? redacted : redacted?.uri;
    if (!redactedUri) {
      return { success: false, reason: 'redaction-no-output' };
    }

    return {
      success: true,
      redactedUri,
      redactionApplied: true,
      piiRegions,
    };
  } catch (error) {
    return { success: false, reason: `redaction-failed: ${error.message}` };
  }
}

/**
 * Remove likely PII from OCR text before remote text-model parsing.
 * Keeps clinical rows and strips obvious identifier lines/tokens.
 */
export function sanitizeOcrTextForRemoteInference(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = lines
    .filter((line) => !isLikelyPiiText(line))
    .map((line) =>
      line
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
        .replace(/\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}\b/g, '[REDACTED_PHONE]')
        .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[REDACTED_ID]')
    );

  return filtered.join('\n').trim();
}
