import { classifySeverity, deviationFromNormal } from '../src/domain/reference_ranges';

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
