import { getLabGroup, sortByLabGroup, groupByLabGroup, OTHER_GROUP } from '../src/domain/lab_groups';

const r = (test_name) => ({ test_name });

describe('getLabGroup', () => {
  it('puts liver tests under a patient-friendly liver heading', () => {
    ['ALT', 'AST', 'ALP', 'Direct Bilirubin', 'Indirect Bilirubin'].forEach((name) => {
      expect(getLabGroup(name).title).toBe('How well your liver works');
    });
  });

  it('matches names case-insensitively and sends unknown tests to Other', () => {
    expect(getLabGroup('creatinine').key).toBe('kidney');
    expect(getLabGroup('Vitamin D')).toBe(OTHER_GROUP);
  });
});

describe('sortByLabGroup', () => {
  it('orders by body system, then by the order within each group', () => {
    const sorted = sortByLabGroup([
      r('Indirect Bilirubin'), r('Zinc'), r('Glucose'), r('Bilirubin'), r('Sodium'), r('Creatinine'), r('Direct Bilirubin'),
    ]).map((x) => x.test_name);
    expect(sorted).toEqual([
      'Creatinine', 'Sodium', 'Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin', 'Glucose', 'Zinc',
    ]);
  });

  it('does not change the input array', () => {
    const items = [r('Glucose'), r('ALT')];
    sortByLabGroup(items);
    expect(items.map((x) => x.test_name)).toEqual(['Glucose', 'ALT']);
  });
});

describe('groupByLabGroup', () => {
  it('returns only groups that have results, in order', () => {
    const groups = groupByLabGroup([r('HbA1c'), r('ALT'), r('Glucose')]);
    expect(groups.map((g) => g.key)).toEqual(['liver', 'sugar']);
    expect(groups[1].items.map((x) => x.test_name)).toEqual(['Glucose', 'HbA1c']);
  });

  it('can read the name from wrapped rows', () => {
    const groups = groupByLabGroup([{ lab: r('TSH') }], (row) => row.lab.test_name);
    expect(groups[0].title).toBe('How your thyroid works');
  });
});
