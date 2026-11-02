// The parser imports native-backed services; only the pure regex helpers are tested here.
jest.mock('../src/services/LlamaService', () => ({ __esModule: true, default: {} }));
jest.mock('../modules/expo-ocr/src/index', () => ({ recognizeText: jest.fn() }));

import { __testing } from '../src/services/LabReportParser';

const { normalizeTestName, extractWithRegex, extractReportDate } = __testing;

describe('normalizeTestName', () => {
  it.each([
    ['DIRECT BILIRUBIN', 'Direct Bilirubin'],
    ['INDIRECT BILIRUBIN', 'Indirect Bilirubin'],
    ['Unconjugated Bilirubin', 'Indirect Bilirubin'],
    ['Conjugated Bilirubin', 'Direct Bilirubin'],
    ['TOTAL BILIRUBIN', 'Bilirubin'],
    ['Bilirubin, Direct', 'Direct Bilirubin'],
    ['BILIRUBIN (INDIRECT)', 'Indirect Bilirubin'],
    ['Bilirubin - Conjugated', 'Direct Bilirubin'],
    ['Bilirubin, Total', 'Bilirubin'],
    ['UREA', 'Urea'],
    ['Blood Urea Nitrogen', 'BUN'],
    ['BUN', 'BUN'],
    ['SODIUM', 'Sodium'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeTestName(input)).toBe(expected);
  });

  it('title-cases names it does not recognise', () => {
    expect(normalizeTestName('vitamin d')).toBe('Vitamin D');
  });
});

describe('extractWithRegex', () => {
  // OCR-style text based on test_anonymous_lab.jpg.
  const ocrText = [
    'Kidney Function Test (serum) - BUE & CR - Validated',
    'SODIUM 142.6 136 - 146 mmol/L',
    'POTASSIUM 3.60 3.5 - 5.1 mmol/L',
    'UREA 3.6 2.8 - 7.2 mmol/L',
    'TOTAL BILIRUBIN 19.31 5 - 21 umol/L',
    'DIRECT BILIRUBIN 4.03 H 0 - 3.4 umol/L',
    'INDIRECT BILIRUBIN 15.3 1.7 - 17.1 umol/L',
  ].join('\n');

  const byName = (results) => Object.fromEntries(results.map((r) => [r.test_name, r]));

  it('extracts each value under the right test name', () => {
    const results = byName(extractWithRegex(ocrText, 'r1'));

    expect(results.Sodium.numeric_value).toBe(142.6);
    expect(results.Potassium.numeric_value).toBe(3.6);
    expect(results.Urea.numeric_value).toBe(3.6);
    expect(results.Bilirubin.numeric_value).toBe(19.31);
    expect(results['Direct Bilirubin'].numeric_value).toBe(4.03);
    expect(results['Indirect Bilirubin'].numeric_value).toBe(15.3);
  });

  it('classifies severity from reference_ranges', () => {
    const results = byName(extractWithRegex(ocrText, 'r1'));

    expect(results.Sodium.severity).toBe('safe');
    expect(results['Direct Bilirubin'].severity).toBe('warn');
  });

  it('returns nothing for text without lab values', () => {
    expect(extractWithRegex('Patient name withheld\nThank you', 'r2')).toEqual([]);
  });
});

describe('extractReportDate', () => {
  it('reads the labelled date day first', () => {
    expect(extractReportDate('Patient: A\nReport Date: 03/04/2025 09:30\nGlucose 5.4')).toBe('2025-04-03');
  });

  it('returns null when the report has no labelled date', () => {
    expect(extractReportDate('Glucose 5.4 mmol/L 3.9-5.6')).toBeNull();
    expect(extractReportDate('Please note change in eGFR formula. Effective:26/09/2025.')).toBeNull();
  });

  it('ignores the date of birth', () => {
    expect(extractReportDate('Date of Birth: 01/02/1980\nCollected: 16/10/2025')).toBe('2025-10-16');
  });

  it('reads a date on the line after its label', () => {
    expect(extractReportDate('Date created\n16/10/2025 10:14')).toBe('2025-10-16');
  });
});

describe('extractWithRegex dates', () => {
  it('flags results whose date was not found on the report', () => {
    const [first] = extractWithRegex('POTASSIUM 3.60 mmol/L 3.5-5.1', 'r1');
    expect(first.date_found).toBe(false);
  });
});
