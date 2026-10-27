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
