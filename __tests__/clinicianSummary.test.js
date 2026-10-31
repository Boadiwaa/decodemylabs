jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-device', () => ({ modelName: 'Test phone' }));

import { buildClinicianSummary, buildQrText, renderSummaryHtml, DISCLAIMER } from '../src/services/ClinicianSummary';

const lab = (test_name, numeric_value, unit, severity, normal_range, extra = {}) => ({
  test_name, numeric_value, unit, severity, normal_range,
  result_value: `${numeric_value} ${unit}`, date: '2026-10-27', source_report_id: 'r2', ...extra,
});

const reports = [
  { id: 'r1', fileName: 'march.jpg', uploadedAt: '2026-03-02T10:00:00Z' },
  { id: 'r2', fileName: 'october.jpg', uploadedAt: '2026-10-28T09:00:00Z' },
];

const base = () => ({
  patient: { name: 'Ama <b>Mensah</b>', dob: '1985-06-15', gender: 'Female' },
  labResults: [
    lab('Glucose', 140, 'mg/dL', 'danger', '70-100 mg/dL', {
      date_found: true,
      provenance: { read_by: 'gemma_photo', range_source: 'report' },
    }),
    lab('ALT', 20, 'U/L', 'safe', '<35 U/L', {
      date_confirmed: true,
      provenance: { read_by: 'typed', range_source: 'app', replaced: { value: '29 U/L', read_by: 'gemma_photo' } },
    }),
    lab('Creatinine', 0.9, 'mg/dL', 'safe', '0.6-1.2 mg/dL', { source_report_id: 'r1' }),
  ],
  trends: [{ test_name: 'Glucose', unit: 'mg/dL', values: [{ value: 110, isoDate: '2026-03-01' }, { value: 140, isoDate: '2026-10-27' }] }],
  reports,
  conditions: [{ id: 'diabetes_type2', name: 'Type 2 Diabetes' }],
  medications: [{ name: 'Metformin', dosage: '500 mg', frequency: 'twice daily' }],
  now: new Date('2026-10-31T12:00:00Z'),
});

describe('buildClinicianSummary', () => {
  it('covers the period of all results, including earlier trend points', () => {
    const s = buildClinicianSummary(base());
    expect(s.period).toEqual({ from: '2026-03-01', to: '2026-10-27' });
    expect(s.reportCount).toBe(2);
    expect(s.monitoring.closely.map((i) => i.lab.test_name)).toEqual(['Glucose']);
  });

  it('records where every value came from', () => {
    const [glucose, alt, creatinine] = buildClinicianSummary(base()).evidence;
    expect(glucose).toMatchObject({
      report: 'october.jpg (uploaded 28/10/2026)',
      readBy: 'Gemma (AI) read the report photo',
      rangeFrom: 'Printed on the report',
      dateSource: 'Read from the report',
    });
    expect(alt.readBy).toBe('Typed in by the patient');
    expect(alt.dateSource).toBe('Confirmed by the patient');
    expect(alt.note).toBe('Corrected by the patient; first read as 29 U/L (Gemma (AI) read the report photo)');
    expect(creatinine.readBy).toBe('Not recorded (saved before this was tracked)');
    expect(creatinine.report).toBe('march.jpg (uploaded 02/03/2026)');
  });

  it('flags a report that gave two values for one test', () => {
    const input = base();
    input.allResults = [
      ...input.labResults,
      { ...input.labResults[0], result_value: '15.3 mg/dL' },
    ];
    const [glucose, alt] = buildClinicianSummary(input).evidence;
    expect(glucose.note).toBe('This report gave 2 values for this test (140 mg/dL, 15.3 mg/dL). Both were kept; '
      + 'the patient was asked to check with the lab. Please check the original report.');
    expect(alt.note).not.toMatch(/gave 2 values/);
  });

  it('shows a typed date of birth tidily', () => {
    const s = buildClinicianSummary({ ...base(), patient: { name: 'Ama', dob: '15 / 06 / 1985' } });
    expect(s.patient.dob).toBe('15/06/1985');
  });

  it('can leave out conditions and medicines', () => {
    const s = buildClinicianSummary({ ...base(), includeHealthBackground: false });
    expect(s.background).toBeNull();
    expect(renderSummaryHtml(s)).not.toContain('Metformin 500 mg');
  });
});

describe('renderSummaryHtml', () => {
  it('escapes what the patient typed and includes every section', () => {
    const html = renderSummaryHtml(buildClinicianSummary(base()));
    expect(html).toContain('Ama &lt;b&gt;Mensah&lt;/b&gt;');
    expect(html).not.toContain('<b>Mensah</b>');
    for (const heading of ['Summary', 'Monitor closely', 'Trends to watch', 'Keep tracking', 'All latest results', 'Health background (from the patient)', 'Evidence trail']) {
      expect(html).toContain(`${heading}</h2>`);
    }
    expect(html).toContain('Metformin 500 mg twice daily');
    expect(html).toContain('Born 15/06/1985');
    expect(html).toContain('<polyline');
    expect(html).toContain('class="trend"'); // full chart for each result to monitor closely
    expect(html).toContain('Consult a licensed healthcare provider.');
  });
});

describe('buildQrText', () => {
  it('is a short text with what to monitor', () => {
    const text = buildQrText(buildClinicianSummary(base()));
    expect(text).toContain('Monitor closely:\n- Glucose 140 mg/dL H (ref 70-100 mg/dL)');
    expect(text).toContain('Medicines: Metformin');
    expect(text.length).toBeLessThanOrEqual(700);
  });

  it('stays scannable when there is a lot to list', () => {
    const many = Array.from({ length: 30 }, (_, i) => lab(`Test number ${i}`, 999, 'units', 'warn', '1-2 units'));
    const text = buildQrText(buildClinicianSummary({ ...base(), labResults: many, trends: [] }));
    expect(text.length).toBeLessThanOrEqual(700);
    expect(text).toMatch(/\+\d+ more in the PDF/);
    expect(text.endsWith('Not a diagnosis. Full PDF available from the patient.')).toBe(true);
  });
});

it('the disclaimer ends with the required phrase', () => {
  expect(DISCLAIMER.endsWith('Consult a licensed healthcare provider.')).toBe(true);
});
