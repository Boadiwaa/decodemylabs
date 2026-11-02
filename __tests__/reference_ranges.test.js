import { classifySeverity, deviationFromNormal, formatNormalRange, tidyRangeText, tidyLegacyResult, REFERENCE_RANGES } from '../src/domain/reference_ranges';

describe('classifySeverity', () => {
  it('classifies cholesterol in mg/dL at threshold boundaries', () => {
    expect(classifySeverity('Cholesterol', 199, 'mg/dL')).toBe('safe');
    expect(classifySeverity('Cholesterol', 200, 'mg/dL')).toBe('warn');
    expect(classifySeverity('Cholesterol', 240, 'mg/dL')).toBe('danger');
  });

  it('uses alternate-unit thresholds for cholesterol in mmol/L', () => {
    expect(classifySeverity('Cholesterol', 3.6, 'mmol/L')).toBe('safe');
    expect(classifySeverity('Cholesterol', 5.5, 'mmol/L')).toBe('warn');
    expect(classifySeverity('Cholesterol', 6.5, 'mmol/L')).toBe('danger');
  });

  it('does not treat normal creatinine in umol/L as mg/dL', () => {
    expect(classifySeverity('Creatinine', 66.1, 'umol/L')).toBe('safe');
    expect(classifySeverity('Creatinine', 66.1, 'µmol/L')).toBe('safe');
  });

  it('flags low potassium on the low side', () => {
    expect(classifySeverity('Potassium', 4.0, 'mmol/L')).toBe('safe');
    expect(classifySeverity('Potassium', 2.8, 'mmol/L')).toBe('warn');
    expect(classifySeverity('Potassium', 2.0, 'mmol/L')).toBe('danger');
  });

  it('treats eGFR as an inverted scale where lower is worse', () => {
    expect(classifySeverity('eGFR', 95)).toBe('safe');
    expect(classifySeverity('eGFR', 75)).toBe('warn');
    expect(classifySeverity('eGFR', 45)).toBe('danger');
  });

  it('classifies direct bilirubin above range as warn', () => {
    expect(classifySeverity('Direct Bilirubin', 4.03, 'umol/L')).toBe('warn');
  });

  it('keeps Urea and BUN as separate tests with their own units', () => {
    expect(classifySeverity('Urea', 3.6, 'mmol/L')).toBe('safe');
    expect(classifySeverity('Urea', 8.5, 'mmol/L')).toBe('warn');
    expect(classifySeverity('BUN', 14, 'mg/dL')).toBe('safe');
    expect(classifySeverity('BUN', 25, 'mg/dL')).toBe('warn');
  });

  it('renames results saved as BUN in mmol/L to Urea', () => {
    expect(tidyLegacyResult({ test_name: 'BUN', unit: 'mmol/L' }).test_name).toBe('Urea');
    expect(tidyLegacyResult({ test_name: 'BUN', unit: 'mg/dL' }).test_name).toBe('BUN');
  });

  it('returns safe for tests without a reference range', () => {
    expect(classifySeverity('Unknown Test', 9999)).toBe('safe');
  });
});

describe('deviationFromNormal', () => {
  it('returns 0 inside the normal range', () => {
    expect(deviationFromNormal('Cholesterol', 150, 'mg/dL')).toBe(0);
  });

  it('returns percent above the normal maximum', () => {
    expect(deviationFromNormal('Cholesterol', 240, 'mg/dL')).toBe('20.0');
  });

  it('returns percent below the normal minimum', () => {
    expect(deviationFromNormal('Potassium', 3.15, 'mmol/L')).toBe('10.0');
  });
});

describe('convertUnit', () => {
  const { convertUnit, normalizeUnit } = require('../src/domain/reference_ranges');

  it('treats spelling variants as the same unit', () => {
    expect(normalizeUnit('µmol/L')).toBe(normalizeUnit('umol/l'));
    expect(normalizeUnit('x10^9/L')).toBe(normalizeUnit('×10³/µL'));
    expect(convertUnit('WBC', 6.2, '10^9/L', '×10³/µL')).toBe(6.2);
  });

  it('converts between mg/dL and mmol/L in both directions', () => {
    expect(convertUnit('Glucose', 5.5, 'mmol/L', 'mg/dL')).toBeCloseTo(99.1, 1);
    expect(convertUnit('Glucose', 99, 'mg/dL', 'mmol/L')).toBeCloseTo(5.5, 1);
    expect(convertUnit('Creatinine', 88.42, 'µmol/L', 'mg/dL')).toBeCloseTo(1, 3);
  });

  it('converts HbA1c between mmol/mol and %', () => {
    expect(convertUnit('HbA1c', 48, 'mmol/mol', '%')).toBeCloseTo(6.5, 1);
    expect(convertUnit('HbA1c', 6.5, '%', 'mmol/mol')).toBeCloseTo(48, 0);
  });

  it('returns null when the conversion is unknown', () => {
    expect(convertUnit('Glucose', 5, 'g/L', 'mg/dL')).toBeNull();
    expect(convertUnit('Unknown Test', 5, 'mg/dL', 'mmol/L')).toBeNull();
  });
});

describe('classifySeverity with converted units', () => {
  it('converts units without their own thresholds to the base unit', () => {
    expect(classifySeverity('Hemoglobin', 135, 'g/L')).toBe('safe');
    expect(classifySeverity('Hemoglobin', 65, 'g/L')).toBe('danger');
    expect(classifySeverity('HbA1c', 53, 'mmol/mol')).toBe('danger');
  });
});

describe('range text', () => {
  it('formats open-ended, upper-only and two-sided ranges', () => {
    expect(formatNormalRange(REFERENCE_RANGES.eGFR.normal, 'mL/min/1.73m2')).toBe('90 or higher mL/min/1.73m2');
    expect(formatNormalRange({ min: 0, max: 200 }, 'mg/dL')).toBe('<200 mg/dL');
    expect(formatNormalRange({ min: 70, max: 100 }, 'mg/dL')).toBe('70-100 mg/dL');
  });

  it('repairs range text saved with Infinity', () => {
    expect(tidyRangeText('90-Infinity mL/min/1.73m2')).toBe('90 or higher mL/min/1.73m2');
    expect(tidyRangeText('<200 mg/dL')).toBe('<200 mg/dL');
    expect(tidyRangeText(undefined)).toBeUndefined();
  });
});
