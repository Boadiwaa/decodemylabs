/**
 * Clinical reference ranges — single source of truth.
 * All severity checks reference this file.
 *
 * Each range supports multiple units. The `units` map contains
 * conversion-specific normal/elevated/critical thresholds so the
 * same test can be classified regardless of whether the lab
 * reports in mg/dL, mmol/L, umol/L, g/L, etc.
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
  BUN: {
    unit: 'mmol/L',
    normal: { min: 2.8, max: 7.2 },
    elevated: { min: 7.2, max: 10.7 },
    critical: { min: 10.7, max: Infinity },
    description: 'Blood Urea Nitrogen',
    altUnits: {
      'mg/dL': { normal: { min: 7, max: 20 }, elevated: { min: 20, max: 30 }, critical: { min: 30, max: Infinity } },
    },
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

function resolveThresholdsForUnit(range, unit) {
  if (!range) return null;

  if (unit && range.altUnits) {
    const normalizedUnit = unit.trim().toLowerCase();
    for (const [altUnit, altThresholds] of Object.entries(range.altUnits)) {
      if (altUnit.toLowerCase() === normalizedUnit) {
        return altThresholds;
      }
    }
  }

  return range;
}

/**
 * Classify severity. Supports both high and low abnormality.
 * @param {string} testName
 * @param {number} value
 * @param {string} [unit] — optional unit to pick alt-unit thresholds
 * @returns {'safe'|'warn'|'danger'}
 */
export function classifySeverity(testName, value, unit) {
  const range = REFERENCE_RANGES[testName];
  if (!range) return 'safe';

  // Pick thresholds: if an alt-unit matches, use those thresholds
  const thresholds = resolveThresholdsForUnit(range, unit);

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

export function deviationFromNormal(testName, value, unit) {
  const range = REFERENCE_RANGES[testName];
  const thresholds = resolveThresholdsForUnit(range, unit);
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