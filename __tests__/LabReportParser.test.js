// The parser imports native-backed services; only the pure regex helpers are tested here.
jest.mock('../src/services/LlamaService', () => ({ __esModule: true, default: {} }));
jest.mock('../modules/expo-ocr/src/index', () => ({ recognizeText: jest.fn() }));

import { __testing } from '../src/services/LabReportParser';

const { normalizeTestName, extractWithRegex } = __testing;

describe('normalizeTestName', () => {
  it.each([
    ['DIRECT BILIRUBIN', 'Direct Bilirubin'],
    ['INDIRECT BILIRUBIN', 'Indirect Bilirubin'],
    ['Unconjugated Bilirubin', 'Indirect Bilirubin'],
    ['Conjugated Bilirubin', 'Direct Bilirubin'],
    ['TOTAL BILIRUBIN', 'Bilirubin'],
    ['UREA', 'BUN'],
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
    expect(results.BUN.numeric_value).toBe(3.6);
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
