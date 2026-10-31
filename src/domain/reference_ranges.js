/**
 * Clinical reference ranges — single source of truth.
 * All severity checks reference this file.
 *
 * Each range supports multiple units. The `altUnits` map holds thresholds
 * for common alternative units; other known units are converted to the
 * base unit (see convertUnit), so the same test can be classified and
 * trended whether the lab reports in mg/dL, mmol/L, umol/L, g/L, etc.
 */

export const REFERENCE_RANGES = {
  Cholesterol: {
    unit: 'mg/dL',
    normal: { min: 0, max: 200 },
    elevated: { min: 200, max: 239 },
    critical: { min: 240, max: Infinity },
    description: 'Total Cholesterol',
    altUnits: {
      'mmol/L': { normal: { min: 0, max: 5.2 }, elevated: { min: 5.2, max: 6.2 }, critical: { min: 6.2, max: Infinity } },
    },
  },
  HbA1c: {
    unit: '%',
    normal: { min: 0, max: 5.7 },
    elevated: { min: 5.7, max: 6.4 },
    critical: { min: 6.5, max: Infinity },
    description: 'Hemoglobin A1c',
  },
  'Blood Pressure': {
    unit: 'mmHg',
    normal: { min: 0, max: 120 },
    elevated: { min: 120, max: 139 },
    critical: { min: 140, max: Infinity },
    description: 'Systolic Blood Pressure',
  },
  Creatinine: {
    unit: 'mg/dL',
    normal: { min: 0.6, max: 1.2 },
    elevated: { min: 1.2, max: 2.0 },
    critical: { min: 2.0, max: Infinity },
    description: 'Serum Creatinine',
    altUnits: {
      'umol/L': { normal: { min: 45, max: 84 }, elevated: { min: 84, max: 177 }, critical: { min: 177, max: Infinity }, lowWarn: 35, lowCritical: 20 },
      'µmol/L': { normal: { min: 45, max: 84 }, elevated: { min: 84, max: 177 }, critical: { min: 177, max: Infinity }, lowWarn: 35, lowCritical: 20 },
    },
  },
  'Lipid Panel': {
    unit: '',
    normal: { min: 0, max: 999 },
    elevated: { min: 999, max: 999 },
    critical: { min: 999, max: Infinity },
    description: 'Comprehensive Lipid Panel',
  },
  // -- Kidney panel --
  Sodium: {
    unit: 'mmol/L',
    normal: { min: 136, max: 146 },
    elevated: { min: 146, max: 155 },
    critical: { min: 155, max: Infinity },
    description: 'Serum Sodium',
    lowWarn: 130,
    lowCritical: 120,
  },
  Potassium: {
    unit: 'mmol/L',
    normal: { min: 3.5, max: 5.1 },
    elevated: { min: 5.1, max: 6.0 },
    critical: { min: 6.0, max: Infinity },
    description: 'Serum Potassium',
    lowWarn: 3.0,
    lowCritical: 2.5,
  },
  Chloride: {
    unit: 'mmol/L',
    normal: { min: 101, max: 109 },
    elevated: { min: 109, max: 115 },
    critical: { min: 115, max: Infinity },
    description: 'Serum Chloride',
  },
  // Urea and BUN are different measurements (BUN counts only the urea's nitrogen),
  // so each keeps the name printed on the report.
  Urea: {
    unit: 'mmol/L',
    normal: { min: 2.8, max: 7.2 },
    elevated: { min: 7.2, max: 10.7 },
    critical: { min: 10.7, max: Infinity },
    description: 'Serum Urea',
    altUnits: {
      'mg/dL': { normal: { min: 17, max: 43 }, elevated: { min: 43, max: 64 }, critical: { min: 64, max: Infinity } },
    },
  },
  BUN: {
    unit: 'mg/dL',
    normal: { min: 7, max: 20 },
    elevated: { min: 20, max: 30 },
    critical: { min: 30, max: Infinity },
    description: 'Blood Urea Nitrogen',
  },
  // -- Liver panel --
  'Total Protein': {
    unit: 'g/L',
    normal: { min: 66, max: 83 },
    elevated: { min: 83, max: 95 },
    critical: { min: 95, max: Infinity },
    description: 'Total Protein',
  },
  Albumin: {
    unit: 'g/L',
    normal: { min: 35, max: 52 },
    elevated: { min: 52, max: 60 },
    critical: { min: 60, max: Infinity },
    description: 'Serum Albumin',
    lowWarn: 30,
    lowCritical: 20,
    altUnits: {
      'g/dL': { normal: { min: 3.5, max: 5.2 }, elevated: { min: 5.2, max: 6.0 }, critical: { min: 6.0, max: Infinity } },
    },
  },
  Globulin: {
    unit: 'g/L',
    normal: { min: 20, max: 35 },
    elevated: { min: 35, max: 45 },
    critical: { min: 45, max: Infinity },
    description: 'Serum Globulin',
  },
  Calcium: {
    unit: 'mg/dL',
    normal: { min: 8.5, max: 10.5 },
    elevated: { min: 10.5, max: 12.0 },
    critical: { min: 12.0, max: Infinity },
    description: 'Serum Calcium',
    altUnits: {
      'mmol/L': { normal: { min: 2.1, max: 2.6 }, elevated: { min: 2.6, max: 3.0 }, critical: { min: 3.0, max: Infinity } },
    },
  },
  Magnesium: {
    unit: 'mg/dL',
    normal: { min: 1.9, max: 2.5 },
    elevated: { min: 2.5, max: 3.1 },
    critical: { min: 3.1, max: Infinity },
    description: 'Serum Magnesium',
    lowWarn: 1.7,
    lowCritical: 1.2,
    altUnits: {
      'mmol/L': {
        normal: { min: 0.78, max: 1.03 },
        elevated: { min: 1.03, max: 1.3 },
        critical: { min: 1.3, max: Infinity },
        lowWarn: 0.7,
        lowCritical: 0.5,
      },
    },
  },
  AST: {
    unit: 'U/L',
    normal: { min: 0, max: 35 },
    elevated: { min: 35, max: 120 },
    critical: { min: 120, max: Infinity },
    description: 'AST (SGOT)',
  },
  ALT: {
    unit: 'U/L',
    normal: { min: 0, max: 35 },
    elevated: { min: 35, max: 120 },
    critical: { min: 120, max: Infinity },
    description: 'ALT (SGPT)',
  },
  ALP: {
    unit: 'U/L',
    normal: { min: 30, max: 120 },
    elevated: { min: 120, max: 200 },
    critical: { min: 200, max: Infinity },
    description: 'Alkaline Phosphatase',
  },
  GGT: {
    unit: 'U/L',
    normal: { min: 0, max: 38 },
    elevated: { min: 38, max: 100 },
    critical: { min: 100, max: Infinity },
    description: 'Gamma-GT',
  },
  Bilirubin: {
    unit: 'umol/L',
    normal: { min: 0, max: 21 },
    elevated: { min: 21, max: 40 },
    critical: { min: 40, max: Infinity },
    description: 'Total Bilirubin',
    altUnits: {
      'mg/dL': { normal: { min: 0, max: 1.2 }, elevated: { min: 1.2, max: 2.5 }, critical: { min: 2.5, max: Infinity } },
    },
  },
  'Direct Bilirubin': {
    unit: 'umol/L',
    normal: { min: 0, max: 3.4 },
    elevated: { min: 3.4, max: 8.0 },
    critical: { min: 8.0, max: Infinity },
    description: 'Direct (Conjugated) Bilirubin',
  },
  'Indirect Bilirubin': {
    unit: 'umol/L',
    normal: { min: 1.7, max: 17.1 },
    elevated: { min: 17.1, max: 30 },
    critical: { min: 30, max: Infinity },
    description: 'Indirect (Unconjugated) Bilirubin',
  },
  // -- Hematology --
  Hemoglobin: {
    unit: 'g/dL',
    normal: { min: 12, max: 17.5 },
    elevated: { min: 17.5, max: 20 },
    critical: { min: 20, max: Infinity },
    description: 'Hemoglobin',
    lowWarn: 10,
    lowCritical: 7,
  },
  WBC: {
    unit: '×10³/µL',
    normal: { min: 4.5, max: 11.0 },
    elevated: { min: 11.0, max: 17.0 },
    critical: { min: 17.0, max: Infinity },
    description: 'White Blood Cell Count',
    lowWarn: 3.5,
    lowCritical: 2.0,
  },
  RBC: {
    unit: '×10⁶/µL',
    normal: { min: 4.0, max: 5.5 },
    elevated: { min: 5.5, max: 6.5 },
    critical: { min: 6.5, max: Infinity },
    description: 'Red Blood Cell Count',
    lowWarn: 3.5,
    lowCritical: 2.5,
  },
  Platelets: {
    unit: '×10³/µL',
    normal: { min: 150, max: 400 },
    elevated: { min: 400, max: 600 },
    critical: { min: 600, max: Infinity },
    description: 'Platelet Count',
    lowWarn: 100,
    lowCritical: 50,
  },
  // -- Thyroid --
  TSH: {
    unit: 'mIU/L',
    normal: { min: 0.4, max: 4.0 },
    elevated: { min: 4.0, max: 10.0 },
    critical: { min: 10.0, max: Infinity },
    description: 'Thyroid Stimulating Hormone',
  },
  // -- Metabolic --
  Glucose: {
    unit: 'mg/dL',
    normal: { min: 70, max: 100 },
    elevated: { min: 100, max: 125 },
    critical: { min: 126, max: Infinity },
    description: 'Fasting Blood Glucose',
    altUnits: {
      'mmol/L': { normal: { min: 3.9, max: 5.6 }, elevated: { min: 5.6, max: 7.0 }, critical: { min: 7.0, max: Infinity } },
    },
  },
  // -- Lipids --
  LDL: {
    unit: 'mg/dL',
    normal: { min: 0, max: 100 },
    elevated: { min: 100, max: 159 },
    critical: { min: 160, max: Infinity },
    description: 'LDL Cholesterol',
    altUnits: {
      'mmol/L': { normal: { min: 0, max: 2.6 }, elevated: { min: 2.6, max: 4.1 }, critical: { min: 4.1, max: Infinity } },
    },
  },
  HDL: {
    unit: 'mg/dL',
    normal: { min: 40, max: 200 },
    elevated: { min: 200, max: 999 },
    critical: { min: 999, max: Infinity },
    description: 'HDL Cholesterol',
    lowWarn: 35,
    lowCritical: 20,
  },
  Triglycerides: {
    unit: 'mg/dL',
    normal: { min: 0, max: 150 },
    elevated: { min: 150, max: 199 },
    critical: { min: 200, max: Infinity },
    description: 'Triglycerides',
    altUnits: {
      'mmol/L': { normal: { min: 0, max: 1.7 }, elevated: { min: 1.7, max: 2.3 }, critical: { min: 2.3, max: Infinity } },
    },
  },
  eGFR: {
    unit: 'mL/min/1.73m2',
    normal: { min: 90, max: Infinity },
    elevated: { min: 60, max: 90 }, // "elevated" here means mildly decreased
    critical: { min: 0, max: 60 },
    description: 'Estimated Glomerular Filtration Rate',
    invertedScale: true, // lower is worse
  },
};

// -- Units --

// Spellings that mean the same unit (after normalizeUnit).
const EQUIVALENT_UNITS = {
  'iu/l': 'u/l',
  '109/l': '103/ul',
  'k/ul': '103/ul',
  '1012/l': '106/ul',
  'm/ul': '106/ul',
  'uiu/ml': 'miu/l',
  'mu/l': 'miu/l',
  'ml/min': 'ml/min/1.73m2',
};

const MMOL_CHOLESTEROL_TO_MG = 38.67;
const MG_BILIRUBIN_TO_UMOL = 17.1;
const G_DL_TO_G_L = 10;

/**
 * Conversions into each test's base unit (REFERENCE_RANGES[test].unit),
 * keyed by normalized source unit. A number is a multiplier.
 */
const UNIT_CONVERSIONS = {
  Cholesterol: { 'mmol/l': MMOL_CHOLESTEROL_TO_MG },
  LDL: { 'mmol/l': MMOL_CHOLESTEROL_TO_MG },
  HDL: { 'mmol/l': MMOL_CHOLESTEROL_TO_MG },
  Triglycerides: { 'mmol/l': 88.57 },
  Glucose: { 'mmol/l': 18.016 },
  Creatinine: { 'umol/l': 1 / 88.42 },
  Urea: { 'mg/dl': 1 / 6.006 },
  BUN: { 'mmol/l': 2.801 },
  Calcium: { 'mmol/l': 4.008 },
  Magnesium: { 'mmol/l': 2.431 },
  'Total Protein': { 'g/dl': G_DL_TO_G_L },
  Albumin: { 'g/dl': G_DL_TO_G_L },
  Globulin: { 'g/dl': G_DL_TO_G_L },
  Bilirubin: { 'mg/dl': MG_BILIRUBIN_TO_UMOL },
  'Direct Bilirubin': { 'mg/dl': MG_BILIRUBIN_TO_UMOL },
  'Indirect Bilirubin': { 'mg/dl': MG_BILIRUBIN_TO_UMOL },
  Hemoglobin: { 'g/l': 1 / G_DL_TO_G_L },
  // IFCC mmol/mol to NGSP % (linear, not a plain multiplier).
  HbA1c: { 'mmol/mol': { toBase: (v) => v * 0.09148 + 2.152, fromBase: (v) => (v - 2.152) / 0.09148 } },
};

// -- Range text --

/**
 * Patient-facing text for a normal range: "<200 mg/dL", "90 or higher
 * mL/min/1.73m2" (open-ended ranges such as eGFR) or "70-100 mg/dL".
 */
export function formatNormalRange(normal, unit) {
  const suffix = unit ? ` ${unit}` : '';
  if (normal.max === Infinity) return `${normal.min} or higher${suffix}`;
  if (normal.min === 0) return `<${normal.max}${suffix}`;
  return `${normal.min}-${normal.max}${suffix}`;
}

/** Repair range text saved before formatNormalRange existed ("90-Infinity ..."). */
export function tidyRangeText(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/^\s*([\d.]+)\s*-\s*Infinity\b/, '$1 or higher');
}

/**
 * Results saved before Urea and BUN were told apart were all named "BUN".
 * Those in mmol/L were urea (BUN is reported in mg/dL), so give them back the report's name.
 */
export function tidyLegacyResult(result) {
  if (result?.test_name === 'BUN' && normalizeUnit(result.unit) === 'mmol/l') {
    return { ...result, test_name: 'Urea' };
  }
  return result;
}

/** Lower-case, ASCII-only form of a unit so spelling variants compare equal. */
export function normalizeUnit(unit) {
  const u = String(unit || '')
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/¹/g, '1').replace(/²/g, '2').replace(/³/g, '3').replace(/⁶/g, '6').replace(/⁹/g, '9')
    .replace(/[×x*](?=\s*10)/g, '')
    .replace(/[\s^*]/g, '');
  return EQUIVALENT_UNITS[u] || u;
}

function baseUnitOf(testName) {
  return normalizeUnit(REFERENCE_RANGES[testName]?.unit);
}

/**
 * Convert a value between units for a test. An empty unit is taken as the
 * test's base unit. Returns null when the conversion is not known.
 * @returns {number|null}
 */
export function convertUnit(testName, value, fromUnit, toUnit) {
  if (!Number.isFinite(value)) return null;
  const base = baseUnitOf(testName);
  const from = normalizeUnit(fromUnit) || base;
  const to = normalizeUnit(toUnit) || base;
  if (from === to) return value;
  if (!base) return null;

  const conversions = UNIT_CONVERSIONS[testName] || {};
  let baseValue = value;
  if (from !== base) {
    const c = conversions[from];
    if (c == null) return null;
    baseValue = typeof c === 'number' ? value * c : c.toBase(value);
  }
  if (to === base) return baseValue;

  const c = conversions[to];
  if (c == null) return null;
  return typeof c === 'number' ? baseValue / c : c.fromBase(baseValue);
}

/**
 * Pick the thresholds and value to classify with: alt-unit thresholds when
 * the unit has its own, otherwise the value converted to the base unit.
 * Unknown units fall back to the base thresholds unchanged.
 */
function resolveForUnit(testName, range, value, unit) {
  if (!range) return { thresholds: null, value };

  const normalized = normalizeUnit(unit);
  if (normalized && range.altUnits) {
    for (const [altUnit, altThresholds] of Object.entries(range.altUnits)) {
      if (normalizeUnit(altUnit) === normalized) {
        return { thresholds: altThresholds, value };
      }
    }
  }

  const converted = convertUnit(testName, value, unit, range.unit);
  return { thresholds: range, value: converted ?? value };
}

/**
 * Classify severity. Supports both high and low abnormality.
 * @param {string} testName
 * @param {number} value
 * @param {string} [unit] — optional unit to pick alt-unit thresholds
 * @returns {'safe'|'warn'|'danger'}
 */
export function classifySeverity(testName, rawValue, unit) {
  const range = REFERENCE_RANGES[testName];
  if (!range) return 'safe';

  // Alt-unit thresholds when available, otherwise the value in the base unit
  const { thresholds, value } = resolveForUnit(testName, range, rawValue, unit);

  // Inverted scale (eGFR: lower is worse)
  if (range.invertedScale) {
    if (value < (thresholds.critical?.max ?? 60)) return 'danger';
    if (value < (thresholds.elevated?.max ?? 90)) return 'warn';
    return 'safe';
  }

  // High-side classification
  if (value >= (thresholds.critical?.min ?? Infinity)) return 'danger';
  if (value >= (thresholds.elevated?.min ?? Infinity)) return 'warn';

  // Low-side classification (use alt-unit low thresholds if available)
  const lowCrit = thresholds.lowCritical ?? range.lowCritical;
  const lowW = thresholds.lowWarn ?? range.lowWarn;
  if (lowCrit != null && value < lowCrit) return 'danger';
  if (lowW != null && value < lowW) return 'warn';

  // Check normal range boundaries
  if (thresholds.normal && (value < thresholds.normal.min || value > thresholds.normal.max)) return 'warn';

  return 'safe';
}

export function deviationFromNormal(testName, rawValue, unit) {
  const range = REFERENCE_RANGES[testName];
  const { thresholds, value } = resolveForUnit(testName, range, rawValue, unit);
  const normal = thresholds?.normal;

  if (!normal) return 0;

  if (value < normal.min) {
    const denominator = normal.min > 0 ? normal.min : 1;
    return ((normal.min - value) / denominator * 100).toFixed(1);
  }

  if (value > normal.max) {
    const denominator = Number.isFinite(normal.max) && normal.max > 0 ? normal.max : 1;
    return ((value - normal.max) / denominator * 100).toFixed(1);
  }

  return 0;
}