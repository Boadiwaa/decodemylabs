/**
 * Which results to keep an eye on, and why. Deterministic, built on the
 * severity from reference_ranges.js, the stored trend, and the patient's
 * conditions and medicines. Used for the report summary and the clinician
 * summary. It never diagnoses: reasons say what the numbers show and why a
 * test is commonly watched, not what is wrong.
 */

import { getAbnormalDirection, linkedReasons } from './personalization';
import { normalizeUnit } from './reference_ranges';
import { formatDate } from '../utils/dates';

// A change this large between the first and latest result is worth a look even in range.
const BIG_CHANGE_PCT = 25;

/**
 * Change from the first point of a trend to the latest result, and whether it
 * moves away from the normal range given the latest result's direction.
 * The end point is the result itself (the value people see), not the trend's
 * last point, which can differ when one report gave two values for a test.
 * @returns {null | { pct: number, from: object, to: object, count: number, worsening: boolean }}
 */
function describeChange(trend, direction, lab) {
  const values = trend?.values || [];
  if (values.length < 2) return null;
  const from = values[0];
  const sameUnit = normalizeUnit(lab?.unit) === normalizeUnit(trend.unit);
  const to = sameUnit && Number.isFinite(Number(lab?.numeric_value))
    ? { value: Number(lab.numeric_value), isoDate: lab.date }
    : values[values.length - 1];
  if (!from.value) return null;
  const pct = Math.round(((to.value - from.value) / from.value) * 100);
  const worsening = (direction === 'high' && pct > 0) || (direction === 'low' && pct < 0);
  return { pct, from, to, count: values.length, worsening };
}

/**
 * Sort results into what to watch.
 * @param {object} input
 * @param {Array} input.labResults - Latest result per test (useUserLabData shape)
 * @param {Array} [input.trends] - Trend per test ({ test_name, unit, values: [{ value, isoDate }] })
 * @param {Array} [input.conditions] - [{ id, name }]
 * @param {Array} [input.medications] - [{ name }]
 * @returns {{ closely: Array, tracking: Array }} items: { lab, severity, direction, change, reasons }
 */
export function buildMonitoringList({ labResults = [], trends = [], conditions = [], medications = [] }) {
  const closely = [];
  const tracking = [];

  for (const lab of labResults) {
    const severity = lab.severity || 'safe';
    const direction = getAbnormalDirection(lab.test_name, Number(lab.numeric_value), lab.unit);
    const trend = trends.find((t) => t.test_name === lab.test_name);
    const change = describeChange(trend, direction, lab);
    const linked = linkedReasons(lab.test_name, conditions, medications);
    const reasons = [];

    const side = direction === 'low' ? 'below' : direction === 'high' ? 'above' : 'outside';
    if (severity === 'danger') reasons.push(`Well ${side} the normal range (normal: ${lab.normal_range}).`);
    else if (severity === 'warn') reasons.push(`A little ${side} the normal range (normal: ${lab.normal_range}).`);

    if (change?.worsening && severity !== 'safe') {
      reasons.push(`Moving further from normal: ${change.from.value} → ${change.to.value} ${trend.unit} `
        + `(${change.pct > 0 ? '+' : ''}${change.pct}%) since ${formatDate(change.from.isoDate)}.`);
    } else if (change && Math.abs(change.pct) >= BIG_CHANGE_PCT) {
      reasons.push(`Changed ${change.pct > 0 ? '+' : ''}${change.pct}% since ${formatDate(change.from.isoDate)}.`);
    }

    reasons.push(...linked);

    const item = { lab, severity, direction, change, reasons };
    if (severity !== 'safe') closely.push(item);
    else if (reasons.length > 0) tracking.push(item);
  }

  const rank = (i) => (i.severity === 'danger' ? 0 : 1) * 10 + (i.change?.worsening ? 0 : 1);
  closely.sort((a, b) => rank(a) - rank(b));
  return { closely, tracking };
}

/**
 * Short, plain bullets for a set of results (report screen and clinician summary).
 * @param {object} input
 * @param {Array} input.labResults
 * @param {{ closely: Array, tracking: Array }} input.monitoring
 * @returns {string[]}
 */
export function buildSummaryBullets({ labResults = [], monitoring }) {
  if (labResults.length === 0) return ['No lab values were found yet.'];
  const { closely = [], tracking = [] } = monitoring || {};
  const bullets = [];
  const danger = closely.filter((i) => i.severity === 'danger');
  const warn = closely.filter((i) => i.severity === 'warn');
  const name = (i) => `${i.lab.test_name}${i.direction === 'high' ? ' (high)' : i.direction === 'low' ? ' (low)' : ''}`;
  const list = (items) => items.map(name).join(', ');

  const inRange = labResults.length - closely.length;
  bullets.push(`${inRange} of ${labResults.length} result${labResults.length === 1 ? ' is' : 's are'} within the normal range.`);
  if (danger.length) bullets.push(`Well outside the normal range: ${list(danger)}.`);
  if (warn.length) bullets.push(`A little outside the normal range: ${list(warn)}.`);

  const worsening = closely.filter((i) => i.change?.worsening);
  if (worsening.length) bullets.push(`Moving further from normal since an earlier report: ${worsening.map((i) => i.lab.test_name).join(', ')}.`);
  if (tracking.length) bullets.push(`Worth keeping track of for your health or medicines: ${tracking.map((i) => i.lab.test_name).join(', ')}.`);
  if (!closely.length) bullets.push('Nothing is outside the normal range.');
  return bullets;
}
