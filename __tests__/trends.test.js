jest.mock('@react-native-async-storage/async-storage', () => ({}));

import { buildTrendFromResults } from '../src/services/PatientStorage';

const result = (date, value, unit) => ({ test_name: 'Glucose', date, numeric_value: value, unit });

describe('buildTrendFromResults', () => {
  it('sorts by test date and labels points day first', () => {
    const trend = buildTrendFromResults(
      [result('2026-03-04', 5.8, 'mmol/L'), result('2025-11-20', 5.2, 'mmol/L')],
      'Glucose',
    );
    expect(trend.values.map((v) => v.date)).toEqual(['20/11/25', '04/03/26']);
    expect(trend.values.map((v) => v.fullDate)).toEqual(['20/11/2025', '04/03/2026']);
    expect(trend.values.map((v) => v.value)).toEqual([5.2, 5.8]);
  });

  it('converts older results into the latest unit', () => {
    const trend = buildTrendFromResults(
      [result('2025-01-10', 99, 'mg/dL'), result('2025-06-10', 5.8, 'mmol/L')],
      'Glucose',
    );
    expect(trend.unit).toBe('mmol/L');
    expect(trend.values.map((v) => v.value)).toEqual([5.5, 5.8]);
    expect(trend.convertedCount).toBe(1);
  });

  it('leaves out results whose unit cannot be converted', () => {
    const trend = buildTrendFromResults(
      [result('2025-01-10', 1.2, 'g/L'), result('2025-06-10', 5.8, 'mmol/L')],
      'Glucose',
    );
    expect(trend.values).toHaveLength(1);
    expect(trend.skippedCount).toBe(1);
  });
});
