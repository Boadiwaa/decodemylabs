import { analyzeTrend, assessUrgency } from '../src/domain/interpretation_rules';

describe('analyzeTrend', () => {
  it('is stable with fewer than two points', () => {
    expect(analyzeTrend([])).toEqual({ direction: 'stable', percentChange: 0 });
    expect(analyzeTrend([{ value: 5 }])).toEqual({ direction: 'stable', percentChange: 0 });
  });

  it('detects upward and downward trends from first to last value', () => {
    expect(analyzeTrend([{ value: 200 }, { value: 220 }])).toEqual({ direction: 'up', percentChange: 10 });
    expect(analyzeTrend([{ value: 200 }, { value: 180 }])).toEqual({ direction: 'down', percentChange: 10 });
  });

  it('treats changes within 1% as stable', () => {
    expect(analyzeTrend([{ value: 100 }, { value: 100.5 }]).direction).toBe('stable');
  });
});

describe('assessUrgency', () => {
  it('is urgent when critical and rising more than 10%', () => {
    const result = assessUrgency('Cholesterol', 260, [{ value: 220 }, { value: 260 }], 'mg/dL');
    expect(result.urgent).toBe(true);
    expect(result.reason).toMatch(/rising/);
  });

  it('is urgent when critical even without a trend', () => {
    expect(assessUrgency('Cholesterol', 240, [], 'mg/dL').urgent).toBe(true);
  });

  it('is not urgent for a normal value', () => {
    expect(assessUrgency('Cholesterol', 150, [], 'mg/dL')).toEqual({
      urgent: false,
      reason: 'Cholesterol within acceptable parameters',
    });
  });
});

describe('isExplanationConsistentWithSeverity', () => {
  const { isExplanationConsistentWithSeverity } = require('../src/domain/interpretation_rules');

  it('accepts out-of-range wording for warn and danger results', () => {
    expect(isExplanationConsistentWithSeverity('Your value is above the normal range.', 'danger')).toBe(true);
    expect(isExplanationConsistentWithSeverity('This is slightly low for most adults.', 'warn')).toBe(true);
  });

  it('rejects text that calls an out-of-range result normal', () => {
    expect(isExplanationConsistentWithSeverity('Your result is within the normal range.', 'danger')).toBe(false);
    expect(isExplanationConsistentWithSeverity('Your result is normal and there is nothing to worry about.', 'warn')).toBe(false);
    expect(isExplanationConsistentWithSeverity('Your result was measured today.', 'warn')).toBe(false);
  });

  it('rejects text that calls a safe result out of range', () => {
    expect(isExplanationConsistentWithSeverity('Your value is within the expected range.', 'safe')).toBe(true);
    expect(isExplanationConsistentWithSeverity('Your value is above the reference range.', 'safe')).toBe(false);
    expect(isExplanationConsistentWithSeverity('This result is abnormal.', 'safe')).toBe(false);
  });

  it('rejects empty text', () => {
    expect(isExplanationConsistentWithSeverity('', 'safe')).toBe(false);
  });
});
