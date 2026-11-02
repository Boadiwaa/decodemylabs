import { parseRangeBounds, trendChartSvg } from '../src/services/ClinicianSummaryCharts';

describe('parseRangeBounds', () => {
  it.each([
    ['0 - 3.4 µmol/L', { min: 0, max: 3.4 }],
    ['70-100 mg/dL', { min: 70, max: 100 }],
    ['<200 mg/dL', { min: null, max: 200 }],
    ['>1.0 mmol/L', { min: 1, max: null }],
    ['90 or higher mL/min/1.73m2', { min: 90, max: null }],
    ['See reference', null],
  ])('reads %s', (text, expected) => {
    expect(parseRangeBounds(text)).toEqual(expected);
  });
});

describe('trendChartSvg', () => {
  const trend = {
    unit: 'µmol/L',
    values: [
      { value: 5.41, isoDate: '2026-03-01', date: '01 Mar' },
      { value: 4.03, isoDate: '2026-10-27', date: '27 Oct' },
    ],
  };
  const lab = { unit: 'µmol/L', normal_range: '0 - 3.4 µmol/L' };

  it('draws the line, every value and date, and the normal range band', () => {
    const svg = trendChartSvg(trend, lab, 'warn');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<polyline'); // straight between results, so nothing is drawn that wasn't measured
    expect(svg).toContain('>5.41<');
    expect(svg).toContain('>4.03<');
    expect(svg).toContain('>27 Oct<');
    expect(svg).toContain('Normal range');
  });

  it('leaves out the band when the range is in a different unit', () => {
    expect(trendChartSvg(trend, { unit: 'mg/dL', normal_range: '0-0.2 mg/dL' }, 'warn')).not.toContain('Normal range');
  });

  it('draws a single result as a dot without a line', () => {
    const svg = trendChartSvg({ unit: 'U/L', values: [{ value: 60, isoDate: '2026-10-27' }] }, { unit: 'U/L', normal_range: '<35 U/L' }, 'danger');
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<polyline');
  });
});
