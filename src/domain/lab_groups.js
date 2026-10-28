/**
 * Groups lab tests by the body system they describe, with patient-friendly
 * titles, so result lists read as "How well your liver works" rather than a
 * flat list. Group order and test order within a group are fixed, so the same
 * report always reads the same way.
 */

export const LAB_GROUPS = [
  {
    key: 'kidney',
    title: 'How well your kidneys work',
    icon: 'water-outline',
    tests: ['Creatinine', 'eGFR', 'BUN', 'Urea'],
  },
  {
    key: 'salts',
    title: 'Body salts and minerals',
    icon: 'flask-outline',
    tests: ['Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'Anion Gap', 'Calcium', 'Magnesium', 'Phosphate'],
  },
  {
    key: 'liver',
    title: 'How well your liver works',
    icon: 'leaf-outline',
    tests: [
      'ALT', 'AST', 'ALP', 'GGT',
      'Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin',
      'Total Protein', 'Albumin', 'Globulin',
    ],
  },
  {
    key: 'sugar',
    title: 'Your blood sugar',
    icon: 'cube-outline',
    tests: ['Glucose', 'HbA1c'],
  },
  {
    key: 'fats',
    title: 'Cholesterol and blood fats',
    icon: 'heart-outline',
    tests: ['Cholesterol', 'LDL', 'HDL', 'Triglycerides', 'Lipid Panel'],
  },
  {
    key: 'blood',
    title: 'Your blood cells',
    icon: 'ellipse-outline',
    tests: ['Hemoglobin', 'WBC', 'RBC', 'Platelets'],
  },
  {
    key: 'thyroid',
    title: 'How your thyroid works',
    icon: 'pulse-outline',
    tests: ['TSH'],
  },
  {
    key: 'pressure',
    title: 'Blood pressure',
    icon: 'speedometer-outline',
    tests: ['Blood Pressure'],
  },
];

export const OTHER_GROUP = { key: 'other', title: 'Other tests', icon: 'list-outline', tests: [] };

const normalize = (name) => String(name || '').trim().toLowerCase();

// test name → { group, position }
const TEST_INDEX = new Map();
LAB_GROUPS.forEach((group, groupIndex) => {
  group.tests.forEach((test, position) => {
    TEST_INDEX.set(normalize(test), { group, groupIndex, position });
  });
});

/** The group a test belongs to (OTHER_GROUP when unknown). */
export function getLabGroup(testName) {
  return TEST_INDEX.get(normalize(testName))?.group || OTHER_GROUP;
}

/**
 * Sort items by group order, then by the test's position within its group.
 * Unknown tests go last, alphabetically.
 * @param {Array} items
 * @param {(item) => string} [getName] - Reads the test name (default: item.test_name)
 */
export function sortByLabGroup(items, getName = (item) => item.test_name) {
  const rank = (item) => {
    const hit = TEST_INDEX.get(normalize(getName(item)));
    return hit ? [hit.groupIndex, hit.position] : [LAB_GROUPS.length, 0];
  };
  return [...items].sort((a, b) => {
    const [ga, pa] = rank(a);
    const [gb, pb] = rank(b);
    if (ga !== gb) return ga - gb;
    if (pa !== pb) return pa - pb;
    return normalize(getName(a)).localeCompare(normalize(getName(b)));
  });
}

/**
 * Split items into ordered groups for display; empty groups are dropped.
 * @param {Array} items
 * @param {(item) => string} [getName] - Reads the test name (default: item.test_name)
 * @returns {Array<{ key: string, title: string, icon: string, items: Array }>}
 */
export function groupByLabGroup(items, getName = (item) => item.test_name) {
  const groups = new Map();
  for (const item of sortByLabGroup(items, getName)) {
    const group = getLabGroup(getName(item));
    if (!groups.has(group.key)) groups.set(group.key, { ...group, items: [] });
    groups.get(group.key).items.push(item);
  }
  return [...groups.values()].map(({ tests, ...group }) => group);
}
