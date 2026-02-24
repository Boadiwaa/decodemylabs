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

export function assessUrgency(testName, currentValue, trendValues) {
  const severity = classifySeverity(testName, currentValue);
  const trend = analyzeTrend(trendValues);
  const deviation = deviationFromNormal(testName, currentValue);

  if (severity === 'danger' && trend.direction === 'up' && trend.percentChange > 10) {
    return { urgent: true, reason: `${testName} critically elevated and rising (+${trend.percentChange}% over 3mo)` };
  }
  if (severity === 'danger') {
    return { urgent: true, reason: `${testName} is ${deviation}% above normal` };
  }
  if (severity === 'warn' && trend.direction === 'up') {
    return { urgent: false, reason: `${testName} elevated and trending upward` };
  }
  return { urgent: false, reason: `${testName} within acceptable parameters` };
}