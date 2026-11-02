import { describeRepeatedTest, findRepeatedTests } from '../src/domain/report_checks';

const r = (id, test, value, report) => ({ id, test_name: test, result_value: value, source_report_id: report });

describe('findRepeatedTests', () => {
  it('finds a test given two different values by one report and keeps both ids', () => {
    const repeated = findRepeatedTests([
      r('a', 'Direct Bilirubin', '4.03 µmol/L', 'rep1'),
      r('b', 'Direct Bilirubin', '15.3 µmol/L', 'rep1'),
      r('c', 'Direct Bilirubin', '5.41 µmol/L', 'rep0'),
      r('d', 'ALT', '30 U/L', 'rep1'),
    ]);
    expect(repeated).toEqual([
      { testName: 'Direct Bilirubin', reportId: 'rep1', values: ['4.03 µmol/L', '15.3 µmol/L'], ids: ['a', 'b'] },
    ]);
    expect(describeRepeatedTest(repeated[0])).toBe('Direct Bilirubin: 4.03 µmol/L and 15.3 µmol/L');
  });

  it('ignores identical repeats and typed values without a report', () => {
    expect(findRepeatedTests([
      r('a', 'ALT', '30 U/L', 'rep1'),
      r('b', 'ALT', '30 U/L', 'rep1'),
      r('c', 'AST', '20 U/L', 'manual'),
      r('d', 'AST', '25 U/L', 'manual'),
    ])).toEqual([]);
  });
});
