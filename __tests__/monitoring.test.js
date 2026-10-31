import { buildMonitoringList, buildSummaryBullets } from '../src/domain/monitoring';
import { linkedReasons } from '../src/domain/personalization';

const lab = (test_name, numeric_value, unit, severity, normal_range) => ({
  test_name, numeric_value, unit, severity, normal_range,
  result_value: `${numeric_value} ${unit}`, date: '2026-10-27',
});
const trend = (test_name, unit, ...values) => ({
  test_name, unit,
  values: values.map((value, i) => ({ value, isoDate: `2026-0${i + 1}-15` })),
});

describe('buildMonitoringList', () => {
  it('puts out-of-range results first, with what the numbers show', () => {
    const { closely } = buildMonitoringList({
      labResults: [
        lab('ALT', 50, 'U/L', 'warn', '<35 U/L'),
        lab('Glucose', 140, 'mg/dL', 'danger', '70-100 mg/dL'),
      ],
      trends: [trend('ALT', 'U/L', 40, 50)],
    });
    expect(closely.map((i) => i.lab.test_name)).toEqual(['Glucose', 'ALT']);
    expect(closely[0].reasons[0]).toBe('Well above the normal range (normal: 70-100 mg/dL).');
    expect(closely[1].reasons).toContain('Moving further from normal: 40 → 50 U/L (+25%) since 15/01/2026.');
  });

  it('sees a low value that keeps falling as getting worse', () => {
    const { closely } = buildMonitoringList({
      labResults: [lab('Hemoglobin', 10.5, 'g/dL', 'warn', '12-17.5 g/dL')],
      trends: [trend('Hemoglobin', 'g/dL', 12.4, 11.2, 10.5)],
    });
    expect(closely[0].direction).toBe('low');
    expect(closely[0].change.worsening).toBe(true);
    expect(closely[0].reasons[0]).toMatch(/^A little below/);
  });

  it('keeps in-range tests linked to conditions or medicines under "keep tracking"', () => {
    const { closely, tracking } = buildMonitoringList({
      labResults: [lab('Creatinine', 0.9, 'mg/dL', 'safe', '0.6-1.2 mg/dL'), lab('ALT', 20, 'U/L', 'safe', '<35 U/L')],
      conditions: [{ id: 'diabetes_type2', name: 'Type 2 Diabetes' }],
      medications: [{ name: 'Metformin' }],
    });
    expect(closely).toEqual([]);
    expect(tracking.map((i) => i.lab.test_name)).toEqual(['Creatinine']);
    expect(tracking[0].reasons).toEqual([
      'Often checked for people with diabetes.',
      'Often checked for people taking Metformin.',
    ]);
  });

  it('notes a large change even when the result is in range', () => {
    const { tracking } = buildMonitoringList({
      labResults: [lab('Potassium', 5.0, 'mmol/L', 'safe', '3.5-5.1 mmol/L')],
      trends: [trend('Potassium', 'mmol/L', 3.8, 5.0)],
    });
    expect(tracking[0].reasons).toEqual(['Changed +32% since 15/01/2026.']);
  });

  it('leaves out steady in-range results with no link', () => {
    const { closely, tracking } = buildMonitoringList({
      labResults: [lab('ALT', 20, 'U/L', 'safe', '<35 U/L')],
      trends: [trend('ALT', 'U/L', 21, 20)],
    });
    expect(closely).toEqual([]);
    expect(tracking).toEqual([]);
  });
});

it('measures change to the result people see, not the last trend point', () => {
  // One report gave two values (4.03 and 15.3); the shown result is 4.03.
  const { closely } = buildMonitoringList({
    labResults: [lab('Direct Bilirubin', 4.03, 'µmol/L', 'warn', '0 - 3.4 µmol/L')],
    trends: [trend('Direct Bilirubin', 'µmol/L', 5.41, 4.03, 15.3)],
  });
  expect(closely[0].change.to.value).toBe(4.03);
  expect(closely[0].change.worsening).toBe(false);
  expect(closely[0].reasons.join(' ')).not.toMatch(/Moving further/);
});

describe('linkedReasons', () => {
  it('matches free-text conditions and medicine names', () => {
    expect(linkedReasons('ALT', [{ id: 'other_1', name: 'Hepatitis B' }], [{ name: 'Atorvastatin 20mg' }])).toEqual([
      'Often checked for people with liver disease.',
      'Often checked for people taking Atorvastatin 20mg.',
    ]);
  });
});

describe('buildSummaryBullets', () => {
  it('gives short bullets about what needs attention', () => {
    const labResults = [
      lab('Glucose', 140, 'mg/dL', 'danger', '70-100 mg/dL'),
      lab('ALT', 20, 'U/L', 'safe', '<35 U/L'),
      lab('Creatinine', 0.9, 'mg/dL', 'safe', '0.6-1.2 mg/dL'),
    ];
    const monitoring = buildMonitoringList({ labResults, medications: [{ name: 'metformin' }] });
    expect(buildSummaryBullets({ labResults, monitoring })).toEqual([
      '2 of 3 results are within the normal range.',
      'Well outside the normal range: Glucose (high).',
      'Worth keeping track of for your health or medicines: Creatinine.',
    ]);
  });

  it('says so when everything is in range', () => {
    const labResults = [lab('ALT', 20, 'U/L', 'safe', '<35 U/L')];
    expect(buildSummaryBullets({ labResults, monitoring: buildMonitoringList({ labResults }) })).toEqual([
      '1 of 1 result is within the normal range.',
      'Nothing is outside the normal range.',
    ]);
  });
});
