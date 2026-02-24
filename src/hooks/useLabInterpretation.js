/**
 * useLabInterpretation — hook that runs the LabInterpretationAgent
 * for a given patient and returns the AI-generated analysis.
 *
 * Falls back to rule-based output if the model isn't loaded.
 * Caches results to avoid re-running inference on re-renders.
 *
 * Exposes both "demo" (hardcoded mock) and "AI" (model/rule-based)
 * explanations so the UI can show them in separate tabs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import labInterpretationAgent from '../agents/LabInterpretationAgent';
import { useModel } from '../context/ModelContext';
import { useAuth } from '../context/AuthContext';
import { useUserLabData } from './useUserLabData';
import { getFullPatientContext } from '../services/PatientStorage';
import {
  patientExplanations, patientNextSteps,
} from '../data/mockData';

// In-memory cache keyed by `${patientId}-${modelReady}`
const interpretationCache = new Map();

/**
 * Merge multiple interpretation outputs into a single combined result.
 * Concatenates explanations (en/fr/ak) and collects all next_steps.
 */
function mergeInterpretations(results) {
  if (!results || results.length === 0) return null;
  if (results.length === 1) return results[0];

  const merged = {
    summary: results.map(r => r.output?.summary).filter(Boolean).join('\n\n'),
    patient_explanation: { en: '', fr: '', ak: '' },
    next_steps: [],
    recommended_actions: [],
    disclaimer: results[0]?.output?.disclaimer || 'Please consult your healthcare provider for clinical decisions.',
  };

  for (const r of results) {
    const out = r.output || {};
    if (out.patient_explanation?.en) {
      merged.patient_explanation.en += (merged.patient_explanation.en ? '\n\n' : '') + out.patient_explanation.en;
    }
    if (out.patient_explanation?.fr) {
      merged.patient_explanation.fr += (merged.patient_explanation.fr ? '\n\n' : '') + out.patient_explanation.fr;
    }
    if (out.patient_explanation?.ak) {
      merged.patient_explanation.ak += (merged.patient_explanation.ak ? '\n\n' : '') + out.patient_explanation.ak;
    }
    if (out.next_steps?.length) merged.next_steps.push(...out.next_steps);
    if (out.recommended_actions?.length) merged.recommended_actions.push(...out.recommended_actions);
  }

  // Deduplicate next_steps and recommended_actions
  merged.next_steps = [...new Set(merged.next_steps)];
  merged.recommended_actions = [...new Set(merged.recommended_actions)];

  // Use the highest confidence from any sub-result
  const bestConfidence = Math.max(...results.map(r => r.confidence || 0));
  // AI-generated if ANY sub-result is AI
  const anyAI = results.some(r =>
    r.agentName === 'LabInterpretationAgent' &&
    !r.warnings?.some(w => w.toLowerCase().includes('rule-based'))
  );

  return {
    ...results[0],
    output: merged,
    confidence: bestConfidence,
    _isAIGenerated: anyAI,
  };
}

export function useLabInterpretation(patientId) {
  const { isModelReady } = useModel();
  const { user } = useAuth();
  const { getPatients, getLabResultsFn, getTrends, hasRealData } = useUserLabData();
  const mode = 'patient';

  const [interpretation, setInterpretation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const runIdRef = useRef(0);

  /** Look up patient data from useUserLabData (real or mock) */
  const allPatients = getPatients();
  const patient = allPatients.find(p => p.id === patientId);
  const labResultsForPatient = getLabResultsFn(patientId);
  const trendsForPatient = getTrends(patientId);

  /**
   * Run interpretation for ALL lab results (not just [0]).
   * Runs each through the agent and merges the outputs.
   */
  const runInterpretation = useCallback(async (forceRefresh = false) => {
    if (!patient || labResultsForPatient.length === 0) return;

    // Don't run AI interpretation on mock/demo data — only interpret real uploaded labs
    if (!hasRealData) {
      console.log('[useLabInterpretation] Skipping AI — no real lab data (mock only)');
      return;
    }

    const cacheKey = `${patientId}-${isModelReady}-${labResultsForPatient.length}`;

    // Check cache first (unless forced refresh)
    if (!forceRefresh && interpretationCache.has(cacheKey)) {
      setInterpretation(interpretationCache.get(cacheKey));
      return;
    }

    const currentRunId = ++runIdRef.current;
    setIsLoading(true);
    setError(null);
    setStreamingText('');

    try {
      // Pre-fetch patient context once (demographics, medical hx, drugs)
      let patientContext = null;
      if (user?.id) {
        try {
          patientContext = await getFullPatientContext(user.id);
        } catch (e) {
          console.warn('[useLabInterpretation] Could not load patient context:', e);
        }
      }

      // Run interpretation for each lab result
      const results = [];
      for (let i = 0; i < labResultsForPatient.length; i++) {
        if (runIdRef.current !== currentRunId) break; // Cancelled

        const lab = labResultsForPatient[i];
        const trend = trendsForPatient.find(t => t.test_name === lab.test_name) || trendsForPatient[0];

        const result = await labInterpretationAgent.run({
          patient,
          lab,
          trend,
          mode,
          userId: user?.id,
          patientContext,
          onToken: (token, fullText) => {
            if (runIdRef.current === currentRunId) {
              setStreamingText(`[${i + 1}/${labResultsForPatient.length}] ${fullText}`);
            }
          },
        });

        results.push(result);
      }

      // Only apply if this is still the current run
      if (runIdRef.current === currentRunId) {
        const merged = mergeInterpretations(results);
        setInterpretation(merged);
        interpretationCache.set(cacheKey, merged);
      }
    } catch (err) {
      if (runIdRef.current === currentRunId) {
        console.error('[useLabInterpretation] Error:', err);
        setError(err.message);
      }
    } finally {
      if (runIdRef.current === currentRunId) {
        setIsLoading(false);
        setStreamingText('');
      }
    }
  }, [patient, labResultsForPatient, trendsForPatient, mode, patientId, isModelReady, hasRealData]);

  // Auto-run when patientId, mode, or model readiness changes.
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) runInterpretation();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runInterpretation]);

  // -- Convenience: separate demo vs AI data --

  /** Demo/mock explanations (always available for development) */
  const demoExplanations = patientExplanations[patientId] || null;
  const demoNextSteps = patientNextSteps[patientId] || [];

  /** AI-generated explanations (from model or rule-based fallback for CURRENT results) */
  const aiExplanations = interpretation?.output?.patient_explanation || null;
  const aiNextSteps = interpretation?.output?.next_steps || [];

  /** Combined: prefer AI when available, fall back to demo */
  const explanations = aiExplanations || demoExplanations;
  const nextSteps = aiNextSteps.length > 0 ? aiNextSteps : demoNextSteps;

  /** Whether this result came from AI or fallback */
  const isAIGenerated = interpretation?._isAIGenerated
    ?? (interpretation?.agentName === 'LabInterpretationAgent'
       && !interpretation?.warnings?.some(w => w.toLowerCase().includes('rule-based')));

  /** Whether AI has produced results (even rule-based) for the current data */
  const hasAIResults = !!aiExplanations;

  /** Confidence score */
  const confidence = interpretation?.confidence || 0;

  /** Safety disclaimer */
  const disclaimer = interpretation?.output?.disclaimer
    || 'Please consult your healthcare provider for clinical decisions.';

  return {
    // Raw result
    interpretation,
    // Status
    isLoading,
    error,
    streamingText,
    isAIGenerated,
    hasAIResults,
    hasRealData,
    confidence,
    // Demo data (hardcoded mock — for development tab)
    demoExplanations,
    demoNextSteps,
    // AI data (model or rule-based — for current report)
    aiExplanations,
    aiNextSteps,
    // Combined: AI-first, demo fallback
    explanations,
    nextSteps,
    disclaimer,
    // Actions
    runInterpretation,
    refresh: () => runInterpretation(true),
  };
}
