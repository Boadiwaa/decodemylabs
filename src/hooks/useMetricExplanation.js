/**
 * useMetricExplanation — Gemma-written explanation for one lab value.
 *
 * Runs LabInterpretationAgent in its short 'metric' format once the model is
 * ready. Results are saved on-device, so reopening a value is instant, and only
 * one explanation is generated at a time (the native runtimes handle a single
 * request). Model text is cross-checked against the deterministic severity
 * before use; when it fails, callers keep their rule-based explanation.
 *
 * status: 'idle' | 'waiting' (model not ready) | 'generating' | 'ready' | 'unavailable'
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModel } from '../context/ModelContext';
import labInterpretationAgent from '../agents/LabInterpretationAgent';
import { isExplanationConsistentWithSeverity } from '../domain/interpretation_rules';
import { getSavedExplanation, saveExplanation } from '../services/PatientStorage';

const SAFETY_PHRASE = 'Consult a licensed healthcare provider.';
const CACHE_VERSION = 'v1';

let queue = Promise.resolve();
const inFlight = new Map();

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/** Remove any copies of the safety phrase and end the text with exactly one. */
export function withSafetyPhrase(text) {
  const body = String(text || '')
    .split(SAFETY_PHRASE)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return body ? `${body} ${SAFETY_PHRASE}` : '';
}

/**
 * Key that changes whenever the inputs to the explanation change: the value,
 * its trend, and the patient's demographics, conditions, and medicines.
 */
export function buildExplanationCacheKey(lab, trend, patientContext) {
  const trendValues = (trend?.values || []).map((v) => v.value).join(',');
  const profile = patientContext?.profile || {};
  const conditions = (patientContext?.medicalHistory || []).map((c) => c.name).sort().join(',');
  const medicines = (patientContext?.drugHistory || []).map((d) => d.name).sort().join(',');
  return [
    CACHE_VERSION,
    lab.source_report_id || '',
    lab.test_name,
    lab.result_value,
    trendValues,
    profile.dob || '',
    profile.sex || '',
    conditions,
    medicines,
  ].join('|');
}

function generate(userId, cacheKey, input) {
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = enqueue(async () => {
    const result = await labInterpretationAgent.run({ ...input, mode: 'patient', format: 'metric' });
    const output = result?.output;
    if (output?.source !== 'model') return null;

    const en = withSafetyPhrase(output.patient_explanation?.en);
    if (!isExplanationConsistentWithSeverity(en, input.severity)) {
      console.warn('[useMetricExplanation] Model text contradicts severity; keeping rule-based text');
      return null;
    }

    const explanation = { en, fr: withSafetyPhrase(output.patient_explanation?.fr) };
    await saveExplanation(userId, cacheKey, explanation);
    return explanation;
  }).finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, promise);
  return promise;
}

/**
 * @param {object} opts
 * @param {object|null} opts.lab - Selected lab result
 * @param {object|null} [opts.trend] - Trend for the same test
 * @param {object|null} opts.patient - Display patient record
 * @param {object|null} opts.patientContext - Context from PatientStorage.getFullPatientContext
 * @param {boolean} opts.contextLoaded - True once patientContext has been fetched
 * @param {string} opts.severity - Deterministic severity from reference_ranges.js
 * @returns {{ status: string, explanation: { en: string, fr: string } | null }}
 */
export function useMetricExplanation({ lab, trend, patient, patientContext, contextLoaded, severity }) {
  const { user } = useAuth();
  const { isModelReady } = useModel();
  const [state, setState] = useState({ status: 'idle', explanation: null });

  // Latest object inputs; the effect below re-runs only when the cache key changes.
  const inputRef = useRef(null);
  inputRef.current = { lab, trend, patient, patientContext, severity };

  const cacheKey = lab && user?.id && contextLoaded
    ? buildExplanationCacheKey(lab, trend, patientContext)
    : null;

  useEffect(() => {
    if (!cacheKey) return undefined;
    let active = true;

    (async () => {
      const saved = await getSavedExplanation(user.id, cacheKey);
      if (!active) return;
      if (saved) {
        setState({ status: 'ready', explanation: saved });
        return;
      }
      if (!isModelReady) {
        setState({ status: 'waiting', explanation: null });
        return;
      }

      setState({ status: 'generating', explanation: null });
      try {
        const explanation = await generate(user.id, cacheKey, inputRef.current);
        if (!active) return;
        setState(explanation
          ? { status: 'ready', explanation }
          : { status: 'unavailable', explanation: null });
      } catch (e) {
        console.warn('[useMetricExplanation] Generation failed:', e);
        if (active) setState({ status: 'unavailable', explanation: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [cacheKey, isModelReady, user?.id]);

  return state;
}

export default useMetricExplanation;
