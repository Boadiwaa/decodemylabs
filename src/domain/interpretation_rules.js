/**
 * Rule-based interpretation engine.
 * Deterministic — no LLM needed. Used to validate LLM outputs.
 */

import { classifySeverity, deviationFromNormal } from './reference_ranges';

export function analyzeTrend(values) {
  if (!values || values.length < 2) return { direction: 'stable', percentChange: 0 };
  const first = values[0].value;
  const last = values[values.length - 1].value;
  const pct = ((last - first) / first) * 100;
  return {
    direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'stable',
    percentChange: Math.abs(pct.toFixed(1)),
  };
}

export function assessUrgency(testName, currentValue, trendValues, unit) {
  const severity = classifySeverity(testName, currentValue, unit);
  const trend = analyzeTrend(trendValues);
  const deviation = deviationFromNormal(testName, currentValue, unit);

  if (severity === 'danger' && trend.direction === 'up' && trend.percentChange > 10) {
    return { urgent: true, reason: `${testName} critically elevated and rising (+${trend.percentChange}% over 3mo)` };
  }
  if (severity === 'danger') {
    return { urgent: true, reason: `${testName} is ${deviation}% outside normal range` };
  }
  if (severity === 'warn' && trend.direction === 'up') {
    return { urgent: false, reason: `${testName} elevated and trending upward` };
  }
  return { urgent: false, reason: `${testName} within acceptable parameters` };
}
const OUT_OF_RANGE_WORDS = /\b(high|higher|low|lower|above|below|outside|elevated|raised|increased|decreased|reduced|abnormal)\b/i;
const OUT_OF_RANGE_CLAIMS = /\b(above|below|outside)\s+(?:of\s+)?(?:the\s+|your\s+)?(?:normal|expected|reference|healthy)\s+range\b|\babnormal\b/i;
const IN_RANGE_CLAIMS = /\b(?:within|in)\s+(?:the\s+)?(?:normal|expected|reference|healthy)\s+range\b|\bis\s+(?:completely\s+|perfectly\s+)?normal\b|\bnothing\s+to\s+worry\s+about\b/i;

/**
 * Cross-check model-written explanation text against the deterministic severity
 * from reference_ranges.js. Returns false when the text contradicts it, e.g. calls
 * an out-of-range value normal, so callers can fall back to rule-based wording.
 */
export function isExplanationConsistentWithSeverity(text, severity) {
  const body = String(text || '');
  if (!body.trim()) return false;
  if (severity === 'danger' || severity === 'warn') {
    return OUT_OF_RANGE_WORDS.test(body) && !IN_RANGE_CLAIMS.test(body);
  }
  return !OUT_OF_RANGE_CLAIMS.test(body);
}
