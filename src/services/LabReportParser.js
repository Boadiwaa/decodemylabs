/**
 * LabReportParser — extracts structured lab values from uploaded reports.
 *
 * For images: uses on-device OCR (Apple Vision on iOS, ML Kit on Android)
 * via the custom expo-ocr module, then parses the extracted text with
 * Gemma or regex fallback.
 *
 * Returns an array of ParsedLabResult objects that can be stored and displayed.
 */

import llamaService from './LlamaService';
import { recognizeText } from '../../modules/expo-ocr/src/index';
import { REFERENCE_RANGES, classifySeverity, formatNormalRange, normalizeUnit } from '../domain/reference_ranges';
import { toISODate, parseDateFromText } from '../utils/dates';
import {
  EXTRACTION_PROMPT,
  IMAGE_EXTRACTION_PROMPT,
} from '../../prompts/labExtraction';

/**
 * @typedef {Object} ParsedLabResult
 * @property {string} id           - Unique ID
 * @property {string} test_name    - e.g. "Cholesterol", "HbA1c"
 * @property {string} result_value - e.g. "240 mg/dL"
 * @property {number} numeric_value - Parsed numeric, e.g. 240
 * @property {string} unit         - e.g. "mg/dL"
 * @property {string} normal_range - e.g. "<200 mg/dL"
 * @property {string} date         - ISO test date (today when none was found)
 * @property {boolean} date_found  - True when the date was read from the report
 * @property {'safe'|'warn'|'danger'} severity
 * @property {string} source_report_id - Links back to the uploaded report
 */

/**
 * Extract the test date from OCR text. Only dates next to a label such as
 * "Date", "Collected" or "Reported" count; other dates on a report (e.g. a
 * formula's effective date or the date of birth) are ignored. OCR may put the label and the date
 * on separate lines, so the line after a label is checked too. Numeric dates
 * are read day first (DD/MM/YYYY, as in Ghana); see parseDateFromText.
 *
 * @param {string} text - The full OCR text
 * @returns {string|null} ISO date (YYYY-MM-DD), or null when none is found
 */
function extractReportDate(text) {
  if (!text) return null;

  const labelPattern = /\b(?:date|collected|collection|received|reported|sampled)\b[^:\d]*[:\s]*/i;
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const labelMatch = lines[i].match(labelPattern);
    if (!labelMatch || /birth|\bd\.?o\.?b\b/i.test(lines[i])) continue;
    const date = parseDateFromText(lines[i].slice(labelMatch.index + labelMatch[0].length))
      || (/^\W*$/.test(lines[i].slice(labelMatch.index + labelMatch[0].length)) ? parseDateFromText(lines[i + 1]) : null);
    if (date) return date;
  }
  return null;
}

/**
 * Known lab test patterns for regex-based extraction (fallback).
 * Order matters — more specific patterns must come BEFORE broader ones
 * to prevent "Total Bilirubin" matching the "Bilirubin" pattern first.
 */
const TEST_PATTERNS = [
  { pattern: /hba1c|hemoglobin\s*a1c|glycated\s*hemoglobin/i, name: 'HbA1c', unit: '%', range: '<5.7%' },
  { pattern: /blood\s*pressure|bp\b|systolic/i, name: 'Blood Pressure', unit: 'mmHg', range: '<120/80 mmHg' },
  // Bilirubin subtypes BEFORE generic bilirubin
  // \b keeps "indirect"/"unconjugated" from matching the direct pattern.
  { pattern: /\bdirect\s*bilirubin|\bconjugated\s*bilirubin/i, name: 'Direct Bilirubin', unit: 'umol/L', range: '0-3.4 umol/L' },
  { pattern: /\bindirect\s*bilirubin|\bunconjugated\s*bilirubin/i, name: 'Indirect Bilirubin', unit: 'umol/L', range: '1.7-17.1 umol/L' },
  { pattern: /(?:total\s*)?bilirubin/i, name: 'Bilirubin', unit: 'umol/L', range: '0-21 umol/L' },
  // ALT before AST (SGPT before SGOT) — both have "transaminase"
  { pattern: /\balt\b|alanine\s*(?:amino)?transaminase|\bsgpt\b/i, name: 'ALT', unit: 'U/L', range: '0-35 U/L' },
  { pattern: /\bast\b|aspartate\s*(?:amino)?transaminase|\bsgot\b/i, name: 'AST', unit: 'U/L', range: '0-35 U/L' },
  { pattern: /alkaline\s*phosphatase|\balp\b/i, name: 'ALP', unit: 'U/L', range: '30-120 U/L' },
  { pattern: /gamma[\s-]*(?:glutamyl|gt)|\bggt\b/i, name: 'GGT', unit: 'U/L', range: '0-38 U/L' },
  // Protein subtypes
  { pattern: /total\s*protein/i, name: 'Total Protein', unit: 'g/L', range: '66-83 g/L' },
  { pattern: /\balbumin\b/i, name: 'Albumin', unit: 'g/L', range: '35-52 g/L' },
  { pattern: /\bglobulin\b/i, name: 'Globulin', unit: 'g/L', range: '20-35 g/L' },
  // Kidney
  { pattern: /\bcreatinine\b/i, name: 'Creatinine', unit: 'umol/L', range: '45-84 umol/L' },
  { pattern: /\burea\b|blood\s*urea\s*nitrogen|\bbun\b/i, name: 'BUN', unit: 'mmol/L', range: '2.8-7.2 mmol/L' },
  { pattern: /\bsodium\b|\bna\s*\+/i, name: 'Sodium', unit: 'mmol/L', range: '136-146 mmol/L' },
  { pattern: /\bpotassium\b|\bk\s*\+/i, name: 'Potassium', unit: 'mmol/L', range: '3.5-5.1 mmol/L' },
  { pattern: /\bchloride\b|\bcl\b/i, name: 'Chloride', unit: 'mmol/L', range: '101-109 mmol/L' },
  { pattern: /\bcalcium\b|\bca\s*\+?\+?(?!\s*nce)/i, name: 'Calcium', unit: 'mmol/L', range: '2.1-2.6 mmol/L' },
  { pattern: /^(?:\s*(?:mg|mag)\s*[:=]?)|\bmagnesium\b|\bserum\s*mag(?:nesium)?\b/i, name: 'Magnesium', unit: 'mg/dL', range: '1.9-2.5 mg/dL' },
  // Hematology
  { pattern: /hemoglobin(?!\s*a1c)|\bhgb\b|\bhb\b(?!\s*a)/i, name: 'Hemoglobin', unit: 'g/dL', range: '12-17.5 g/dL' },
  { pattern: /\bwbc\b|white\s*blood\s*cell|leucocyte/i, name: 'WBC', unit: '×10³/µL', range: '4.5-11.0 ×10³/µL' },
  { pattern: /\brbc\b|red\s*blood\s*cell|erythrocyte/i, name: 'RBC', unit: '×10⁶/µL', range: '4.5-5.5 ×10⁶/µL' },
  { pattern: /\bplatelet\b|\bplt\b/i, name: 'Platelets', unit: '×10³/µL', range: '150-400 ×10³/µL' },
  // Metabolic / Lipids
  { pattern: /\bcholesterol\b\s*(?:total)?/i, name: 'Cholesterol', unit: 'mmol/L', range: '<5.2 mmol/L' },
  { pattern: /(?:fasting\s*)?glucose|blood\s*sugar|\bfbs\b/i, name: 'Glucose', unit: 'mmol/L', range: '3.9-5.6 mmol/L' },
  { pattern: /\btsh\b|thyroid\s*stimulating/i, name: 'TSH', unit: 'mIU/L', range: '0.4-4.0 mIU/L' },
  { pattern: /\bldl\b/i, name: 'LDL', unit: 'mmol/L', range: '<2.6 mmol/L' },
  { pattern: /\bhdl\b/i, name: 'HDL', unit: 'mmol/L', range: '>1.0 mmol/L' },
  { pattern: /\btriglyceride/i, name: 'Triglycerides', unit: 'mmol/L', range: '<1.7 mmol/L' },
  { pattern: /(?:e)?gfr|glomerular\s*filtration/i, name: 'eGFR', unit: 'mL/min', range: '>60 mL/min' },
];

/**
 * Parse a lab report by sending the image DIRECTLY to Gemma (multimodal).
 * This bypasses OCR entirely and uses Gemma's vision capabilities.
 *
 * @param {string} imageUri   - Local file URI to the lab report image
 * @param {string} reportId   - ID of the source report for linking
 * @param {function} [onProgress] - Progress callback (0-1)
 * @returns {Promise<ParsedLabResult[]>}
 */
export async function parseLabReportFromImage(imageUri, reportId, onProgress) {
  if (!imageUri) {
    console.warn('[LabReportParser] No image URI provided');
    return [];
  }

  onProgress?.(0.1);

  // Check if multimodal (vision) is available
  if (!llamaService.isReady || !llamaService.isMultimodalReady) {
    console.log('[LabReportParser] Multimodal not available, falling back to OCR pipeline');
    return null; // signal caller to fall back
  }

  try {
    console.log('[LabReportParser] Sending image to model for analysis...');
    onProgress?.(0.3);

    const rawOutput = await llamaService.completeWithImage(
      IMAGE_EXTRACTION_PROMPT,
      'Extract all lab test results from this lab report image.',
      imageUri,
      {
        n_predict: 550,
        temperature: 0.1,   // Very low for structured extraction
      }
    );

    onProgress?.(0.7);

    console.log('[LabReportParser] Gemma vision output length:', rawOutput?.length || 0);
    console.log('[LabReportParser] Gemma vision output (first 500):', rawOutput?.slice(0, 500));

    // Read the test date from on-device OCR rather than trusting the model's reading.
    let results = parseModelExtractionOutput(rawOutput, reportId, null, 'gemma_photo');
    if (results.length > 0) {
      const textDate = extractReportDate(await recognizeTextFromImage(imageUri));
      results = parseModelExtractionOutput(rawOutput, reportId, textDate, 'gemma_photo');
      console.log(`[LabReportParser] Vision extracted ${results.length} lab results`);
      onProgress?.(1.0);
      return results;
    }

    console.log('[LabReportParser] Vision found no structured results');
    onProgress?.(1.0);
    return [];
  } catch (e) {
    console.warn('[LabReportParser] Vision-based extraction failed:', e.message);
    return null; // signal caller to fall back
  }
}

/**
 * Parse a lab report using the Gemma model.
 * @param {string} reportText - Extracted text from the report
 * @param {string} reportId   - ID of the source report for linking
 * @param {function} [onProgress] - Progress callback (0-1)
 * @returns {Promise<ParsedLabResult[]>}
 */
export async function parseLabReportWithModel(reportText, reportId, onProgress) {
  if (!reportText || reportText.trim().length < 10) {
    console.warn('[LabReportParser] Text too short for parsing');
    return [];
  }

  // Extract report date from the text upfront for use as fallback
  const textDate = extractReportDate(reportText);

  onProgress?.(0.1);

  // If model is ready, use it for intelligent extraction
  if (llamaService.isReady) {
    try {
      onProgress?.(0.3);

      const userPrompt = `Extract lab results from this report:\n\n${reportText.slice(0, 3000)}`;
      const fullPrompt = llamaService.formatPrompt(EXTRACTION_PROMPT, userPrompt);

      const rawOutput = await llamaService.complete(fullPrompt, {
        n_predict: 550,
        temperature: 0.1, // Very low for structured extraction
      });

      onProgress?.(0.7);

      const results = parseModelExtractionOutput(rawOutput, reportId, textDate, 'gemma_text');
      if (results.length > 0) {
        onProgress?.(1.0);
        return results;
      }

      // Fall through to regex if model didn't find anything
      console.log('[LabReportParser] Model found no results, trying regex fallback');
    } catch (e) {
      console.warn('[LabReportParser] Model extraction failed, using regex:', e);
    }
  }

  // Fallback: regex-based extraction
  onProgress?.(0.5);
  const results = extractWithRegex(reportText, reportId);
  onProgress?.(1.0);
  return results;
}

/**
 * Parse the model's JSON output into structured results.
 * Handles both one-JSON-per-line and JSON array formats.
 * @param {string} rawOutput
 * @param {string} reportId
 * @param {string|null} [textDate] - Test date read from the report text
 * @param {'gemma_photo'|'gemma_text'} readBy - How the values were read, kept with each result
 */
function parseModelExtractionOutput(rawOutput, reportId, textDate, readBy) {
  const results = [];
  if (!rawOutput) return results;

  // Try to parse as a JSON array first (model may output [{...},{...}])
  const jsonArrayMatch = rawOutput.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    try {
      const arr = JSON.parse(jsonArrayMatch[0]);
      if (Array.isArray(arr)) {
        for (const parsed of arr) {
          const result = buildResult(parsed, reportId, results.length, textDate, readBy);
          if (result) results.push(result);
        }
        if (results.length > 0) return results;
      }
    } catch (e) {
      // Not a valid array, fall through to line-by-line
    }
  }

  // Line-by-line JSON parsing
  const lines = rawOutput.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const parsed = JSON.parse(trimmed);
      const result = buildResult(parsed, reportId, results.length, textDate, readBy);
      if (result) results.push(result);
    } catch (e) {
      // Try to extract JSON from the line (model may wrap in extra text)
      const jsonMatch = trimmed.match(/\{[^}]+\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const result = buildResult(parsed, reportId, results.length, textDate, readBy);
          if (result) results.push(result);
        } catch (e2) {
          // skip
        }
      }
    }
  }

  return results;
}

/**
 * Build a single ParsedLabResult from a parsed JSON object.
 * Extracts the numeric value from result_value, stripping any embedded units.
 * Validates that normal_range unit matches the result unit.
 * @param {object} parsed - Parsed JSON from model output
 * @param {string} reportId
 * @param {number} index
 * @param {string|null} [textDate] - Test date read from the report text
 * @param {'gemma_photo'|'gemma_text'} readBy
 */
function buildResult(parsed, reportId, index, textDate, readBy) {
  if (!parsed || !parsed.test_name || parsed.result_value == null) return null;

  const testName = normalizeTestName(parsed.test_name);
  const unit = parsed.unit || '';

  // Extract numeric value (and comparator like > or <) from result_value
  const rawValue = String(parsed.result_value).trim();
  const parsedValue = parseValueWithComparator(rawValue);
  const numericValue = parsedValue?.numericValue ?? NaN;

  if (isNaN(numericValue)) return null;

  // Validate/fix the normal_range — ensure its unit matches the result's unit.
  // If the model returned a range in a different unit (e.g. range in mg/dL but
  // result in umol/L), replace it with the correct unit-aware default range.
  let normalRange = parsed.normal_range;
  if (normalRange && unit) {
    const rangeUnitMatch = normalRange.match(/[a-zA-Zµ/%×³⁶·]+(?:\/[a-zA-Z0-9²³]+)*/g);
    const rangeUnit = rangeUnitMatch ? rangeUnitMatch[rangeUnitMatch.length - 1] : '';
    if (rangeUnit && normalizeUnit(rangeUnit) !== normalizeUnit(unit)) {
      // Unit mismatch — the range is in a different unit than the result.
      // Use the correct unit-aware default instead.
      console.log(`[LabReportParser] Unit mismatch for ${testName}: range has "${rangeUnit}" but result is "${unit}" — using default range`);
      normalRange = null;
    }
  }
  const rangeSource = normalRange ? 'report' : 'app';
  normalRange = normalRange || getDefaultRange(testName, unit);

  // Dates come only from labelled report text, where the day-first rule is applied
  // deterministically; the model's date can't be checked.
  const reportDate = textDate || null;

  return {
    id: `${reportId}_${Date.now()}_${index}`,
    test_name: testName,
    result_value: `${parsedValue?.comparator || ''}${numericValue} ${unit}`.trim(),
    numeric_value: numericValue,
    unit,
    normal_range: normalRange,
    date: reportDate || toISODate(),
    date_found: Boolean(reportDate),
    severity: classifySeverity(testName, numericValue, unit),
    source_report_id: reportId,
    provenance: makeProvenance(readBy, rangeSource),
  };
}

/**
 * How a value was obtained, kept with it for the evidence trail in the clinician summary.
 * @param {'gemma_photo'|'gemma_text'|'text_pattern'|'typed'} readBy
 * @param {'report'|'app'|'typed'} rangeSource - Where the normal range came from
 * @param {object} [extra] - e.g. { replaced: { value, read_by } } for a correction
 */
export function makeProvenance(readBy, rangeSource, extra = {}) {
  return { read_by: readBy, range_source: rangeSource, read_at: new Date().toISOString(), ...extra };
}

/**
 * Regex-based extraction fallback — splits OCR text into lines and matches
 * each line against known test patterns. This avoids the problem of picking
 * up a value from a neighbouring row in tabular lab reports.
 */
function extractWithRegex(text, reportId) {
  const results = [];
  const matchedNames = new Set();

  // Extract report date using the robust date parser
  const reportDate = extractReportDate(text);

  // Split text into lines — each OCR line typically corresponds to one row
  const lines = text.split(/\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    for (const tp of TEST_PATTERNS) {
      // Skip if already matched (prevents duplicate extraction)
      if (matchedNames.has(tp.name)) continue;

      const testMatch = line.match(tp.pattern);
      if (!testMatch) continue;

      // Look for a numeric value on the SAME line, after the test name
      const afterName = line.slice(testMatch.index + testMatch[0].length);
      let parsedValue = extractValueFromText(afterName);
      let rangeFromLine = extractRangeFromLine(line, testMatch.index + testMatch[0].length);

      // Some OCR formats wrap values/ranges to the next line. Allow one-line lookahead
      // only if the next line is not itself another known test label.
      if (!parsedValue && lineIndex + 1 < lines.length) {
        const nextLine = lines[lineIndex + 1];
        const nextLineHasTestLabel = TEST_PATTERNS.some((candidate) => candidate.pattern.test(nextLine));

        if (!nextLineHasTestLabel) {
          const nextValue = extractValueFromText(nextLine);
          const nextRange = extractRangeFromLine(nextLine, 0);

          // Guard against accidental capture from unrelated metadata lines.
          if (nextValue && (nextValue.unitToken || nextRange)) {
            parsedValue = nextValue;
            if (!rangeFromLine) rangeFromLine = nextRange;
          }
        }
      }

      if (parsedValue) {
        const comparator = parsedValue.comparator;
        const numericValue = parsedValue.numericValue;

        // Use unit from text when valid; ignore flag markers like H/L.
        const extractedUnit = parsedValue.unitToken;
        const unitFromRange = extractUnitFromRange(rangeFromLine);
        const unit = extractedUnit || unitFromRange || tp.unit;
        const normalRange = rangeFromLine || getDefaultRange(tp.name, unit);

        matchedNames.add(tp.name);
        results.push({
          id: `${reportId}_${Date.now()}_${results.length}`,
          test_name: tp.name,
          result_value: `${comparator}${numericValue} ${unit}`.trim(),
          numeric_value: numericValue,
          unit,
          normal_range: normalRange,
          date: reportDate || toISODate(),
          date_found: Boolean(reportDate),
          severity: classifySeverity(tp.name, numericValue, unit),
          source_report_id: reportId,
          provenance: makeProvenance('text_pattern', rangeFromLine ? 'report' : 'app'),
        });
      }
    }
  }

  return results;
}

function parseValueWithComparator(rawValue) {
  if (!rawValue) return null;

  const normalized = String(rawValue).replace(/,/g, '');
  const match = normalized.match(/([<>]=?)?\s*(-?\d+\.?\d*)/);
  if (!match) return null;

  return {
    comparator: (match[1] || '').trim(),
    numericValue: parseFloat(match[2]),
  };
}

function extractValueFromText(textFragment) {
  if (!textFragment) return null;

  const normalized = stripInlineMetadata(String(textFragment)).replace(/,/g, '');
  const valueMatch = normalized.match(/[\s:=]*([<>]=?)?\s*(-?\d+\.?\d*)\s*([A-Za-z%µ³⁶²×·/0-9.]*)/);
  if (!valueMatch) return null;

  const numericValue = parseFloat(valueMatch[2]);
  if (isNaN(numericValue)) return null;

  return {
    comparator: (valueMatch[1] || '').trim(),
    numericValue,
    unitToken: sanitizeExtractedUnit(valueMatch[3]),
  };
}

function stripInlineMetadata(text) {
  if (!text) return '';
  // Remove parenthetical descriptors like (CKD-EPI 2021) so years are not parsed as results.
  return text.replace(/\([^)]*\)/g, ' ');
}

function sanitizeExtractedUnit(unitToken) {
  if (!unitToken) return '';

  const cleaned = String(unitToken)
    .trim()
    .replace(/^[()]+|[()]+$/g, '')
    .replace(/[,:;.]$/, '');
  if (!cleaned) return '';
  if (/^[HL]$/i.test(cleaned)) return '';
  if (/^\d+(?:\.\d+)?$/.test(cleaned)) return '';

  return cleaned;
}

function extractUnitFromRange(rangeText) {
  if (!rangeText) return '';

  const match = rangeText.match(/[A-Za-z%µ²³⁶×·/0-9.]+(?:\s*[A-Za-z0-9²³.]+)*$/);
  return match ? match[0].trim() : '';
}

/**
 * Try to extract a reference range from the same OCR line.
 * Lab reports typically show ranges like "136 - 146 mmol/L" or "0-35 U/L"
 * after the result value on the same row/line.
 *
 * @param {string} line - The full OCR text line
 * @param {number} afterIndex - Start searching after this character index
 * @returns {string|null} The extracted range string, or null if not found
 */
function extractRangeFromLine(line, afterIndex) {
  const remainder = line.slice(afterIndex);
  // Match patterns like: "136 - 146 mmol/L", "0-35 U/L", "45 - 84 umol/L", ">= 90"
  const rangeMatch = remainder.match(
    /(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*([A-Za-z%µ²³⁶×·/0-9.]+(?:\s*[A-Za-z0-9²³.]+)*)/
  );
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} ${rangeMatch[3]}`;
  }
  // Match threshold patterns: ">60 mL/min", "<200 mg/dL", ">=90 mL/min"
  const threshMatch = remainder.match(
    /([<>]=?\s*\d+\.?\d*)\s*([A-Za-z%µ²³⁶×·/0-9.]+(?:\s*[A-Za-z0-9²³.]+)*)/
  );
  if (threshMatch) {
    return `${threshMatch[1].replace(/\s/g, '')} ${threshMatch[2]}`;
  }
  return null;
}

/**
 * Normalize test names from model output to match our reference ranges.
 */
function normalizeTestName(name) {
  const lower = name.toLowerCase().trim();
  for (const tp of TEST_PATTERNS) {
    if (tp.pattern.test(lower)) return tp.name;
  }
  // Capitalize first letter of each word
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get default normal range for a test name.
 * If a unit is provided and it matches an altUnit, use those thresholds.
 */
function getDefaultRange(testName, unit) {
  const ref = REFERENCE_RANGES[testName];
  if (ref) {
    // Check if the result's unit matches an alt-unit entry
    if (unit && ref.altUnits) {
      const normUnit = unit.trim().toLowerCase();
      for (const [altKey, altThresh] of Object.entries(ref.altUnits)) {
        if (altKey.toLowerCase() === normUnit) return formatNormalRange(altThresh.normal, altKey);
      }
    }
    // Fall back to primary unit
    return formatNormalRange(ref.normal, ref.unit);
  }
  const tp = TEST_PATTERNS.find((p) => p.name === testName);
  return tp?.range || 'See reference';
}

/**
 * For images: uses on-device OCR (Apple Vision on iOS, ML Kit on Android).
 * Returns the recognized text from the image, or empty string on failure.
 */
export async function recognizeTextFromImage(imageUri) {
  try {
    // expo-ocr: Apple Vision (iOS) / ML Kit (Android) for on-device OCR
    const results = await recognizeText(imageUri, {
      visionIgnoreThreshold: 0.3,
    });

    if (results && results.length > 0) {
      const fullText = results.join('\n');
      console.log('[LabReportParser] OCR extracted', fullText.length, 'chars from image');
      return fullText;
    }
    console.log('[LabReportParser] OCR returned no text');
    return '';
  } catch (e) {
    console.warn('[LabReportParser] OCR failed:', e.message);
    return '';
  }
}

export function createManualEntryPrompt(testName, value, unit) {
  return {
    test_name: testName,
    result_value: `${value} ${unit}`,
    numeric_value: parseFloat(value) || 0,
    unit,
  };
}

export default {
  parseLabReportFromImage,
  parseLabReportWithModel,
  recognizeTextFromImage,
  createManualEntryPrompt,
};

// Internal helpers exposed for unit tests only.
export const __testing = { normalizeTestName, extractWithRegex, extractReportDate };
