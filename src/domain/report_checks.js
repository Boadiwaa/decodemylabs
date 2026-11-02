/**
 * Checks on what was read from one report. A report should give one value per
 * test; when two different values were stored for the same test, both are kept
 * (we can't tell which is right) and the patient is asked to check with the lab.
 */

export const REPEATED_TEST_ADVICE = "We've kept both values. Please let the lab that did your test know, so they can "
  + 'check which one is right. Once you know, you can remove the wrong one.';

/**
 * Tests that have more than one different value from the same report.
 * Typed values without a report ('manual') are not compared.
 * @param {Array} results - Stored results ({ test_name, result_value, source_report_id })
 * @returns {Array<{ testName: string, reportId: string, values: string[], ids: string[] }>}
 */
export function findRepeatedTests(results = []) {
  const groups = new Map();
  for (const r of results) {
    if (!r?.source_report_id || r.source_report_id === 'manual') continue;
    const key = `${r.source_report_id}|${r.test_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const repeated = [];
  for (const items of groups.values()) {
    const values = [...new Set(items.map((r) => String(r.result_value).trim()))];
    if (values.length < 2) continue;
    repeated.push({
      testName: items[0].test_name,
      reportId: items[0].source_report_id,
      values,
      ids: items.map((r) => r.id),
    });
  }
  return repeated;
}

/** "Direct Bilirubin: 4.03 µmol/L and 15.3 µmol/L" */
export function describeRepeatedTest(item) {
  const values = item.values.length > 2
    ? `${item.values.slice(0, -1).join(', ')} and ${item.values[item.values.length - 1]}`
    : item.values.join(' and ');
  return `${item.testName}: ${values}`;
}
