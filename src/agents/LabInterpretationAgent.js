/**
 * LabInterpretationAgent — uses on-device Gemma to interpret lab results.
 * Conforms to the agent interface in types.js.
 *
 * Builds a prompt from patient data + lab context, sends it to the local
 * LLM via LlamaService, and parses the structured JSON response.
 *
 * Falls back to rule-based interpretation if inference fails.
 */

import { createAgentOutput } from './types';
import llamaService from '../services/LlamaService';
import { classifySeverity, deviationFromNormal, REFERENCE_RANGES } from '../domain/reference_ranges';
import { analyzeTrend, assessUrgency } from '../domain/interpretation_rules';
import { buildPersonalizationInsights } from '../domain/personalization';
import { getAge, formatDate } from '../utils/helpers';
import { getFullPatientContext } from '../services/PatientStorage';
import { SAFETY_PHRASE_FR } from '../constants/safety';
import {
  SYSTEM_PROMPT,
  PATIENT_INSTRUCTIONS,
  OUTPUT_INSTRUCTIONS,
  METRIC_OUTPUT_INSTRUCTIONS,
} from '../../prompts/labInterpretation';

const AGENT_NAME = 'LabInterpretationAgent';

/**
 * Format patient context from on-device storage into prompt sections.
 */
function formatPatientContext(ctx) {
  if (!ctx) return '';

  const parts = [];

  // Demographics
  if (ctx.profile) {
    const p = ctx.profile;
    const lines = [];
    if (p.sex) lines.push(`- Sex: ${p.sex}`);
    if (p.dob) lines.push(`- Date of Birth: ${p.dob}`);
    if (p.race) lines.push(`- Race/Ethnicity: ${p.race}`);
    if (p.nationality) lines.push(`- Nationality: ${p.nationality}`);
    if (p.residence) lines.push(`- Place of Residence: ${p.residence}`);
    if (lines.length) {
      parts.push(`**Demographics:**\n${lines.join('\n')}`);
    }
  }

  // Medical history
  if (ctx.medicalHistory?.length) {
    const items = ctx.medicalHistory.map(
      (c) => `- ${c.name}${c.years ? ` (${c.years} year${c.years !== 1 ? 's' : ''})` : ''}`
    );
    parts.push(`**Chronic Conditions:**\n${items.join('\n')}`);
  }

  // Drug history
  if (ctx.drugHistory?.length) {
    const items = ctx.drugHistory.map((d) => {
      let s = `- ${d.name}`;
      if (d.dosage) s += ` ${d.dosage}`;
      if (d.frequency) s += `, ${d.frequency}`;
      if (d.years) s += ` (${d.years} yr${d.years !== 1 ? 's' : ''})`;
      return s;
    });
    parts.push(`**Current Medications:**\n${items.join('\n')}`);
  }

  return parts.length ? '\n\n' + parts.join('\n\n') : '';
}

/**
 * Build the user prompt from patient + lab data.
 * @param {object} opts
 * @param {object} [opts.patientContext] - On-device patient context from PatientStorage
 * @param {string} [opts.outputInstructions] - Output format block (defaults to the full format)
 */
function buildUserPrompt({ patient, lab, trend, mode, patientContext, outputInstructions = OUTPUT_INSTRUCTIONS }) {
  const testName = lab.test_name;
  const numericValue = getNumericLabValue(lab);
  const refRange = REFERENCE_RANGES[testName];
  const severity = isNaN(numericValue) ? 'safe' : classifySeverity(testName, numericValue, lab.unit);
  const deviation = isNaN(numericValue) ? 0 : deviationFromNormal(testName, numericValue, lab.unit);
  const trendAnalysis = trend ? analyzeTrend(trend.values) : { direction: 'stable', percentChange: 0 };
  const personalization = buildPersonalizationInsights({ lab, patientContext });

  const trendData = trend
    ? trend.values.map(v => `  ${v.fullDate || v.date}: ${v.value} ${trend.unit}`).join('\n')
    : '  No trend data available';

  const modeInstructions = PATIENT_INSTRUCTIONS;

  // Extra context from on-device storage (demographics, comorbidities, medications)
  const extraContext = formatPatientContext(patientContext);
  const personalizationContext = personalization?.promptContext
    ? `\n\n**Deterministic Personalization Context:**\n- ${personalization.promptContext}`
    : '';

  // Prefer the stored date of birth; display records may carry a placeholder.
  const dob = patientContext ? patientContext.profile?.dob : patient.dob;
  const age = getAge(dob);
  const ageLine = age != null ? `${age} years` : 'Not provided';

  return `Analyze the following lab result for a patient:

**Patient Profile:**
- Age: ${ageLine}
- Gender: ${patient.gender}
- Medical History: ${patient.profile_description}${extraContext}

**Current Lab Result:**
- Test: ${testName} (${refRange?.description || testName})
- Result: ${lab.result_value}
- Reference Range: ${lab.normal_range}
- Date: ${formatDate(lab.date)}
- Severity Classification: ${severity}
- Deviation from Normal: ${deviation}%

**3-Month Trend:**
${trendData}

**Trend Analysis:**
- Direction: ${trendAnalysis.direction}
- Change: ${trendAnalysis.percentChange}%

${personalizationContext}

**Mode:** ${mode}

${modeInstructions}

${outputInstructions}`;
}

/**
 * Section header patterns — used to split model output into labeled sections.
 * Each pattern strips optional markdown (`**`, `##`) before matching.
 */
const SECTION_DEFS = [
  { key: 'summary',    pattern: /^(?:SUMMARY|CLINICAL\s+SUMMARY|INTERPRETATION)\s*:?\s*$/i },
  { key: 'actions',    pattern: /^(?:RECOMMENDED\s+ACTIONS?|ACTIONS?|CLINICAL\s+ACTIONS?)\s*:?\s*$/i },
  { key: 'next_steps', pattern: /^(?:NEXT\s+STEPS?(?:\s+FOR\s+(?:THE\s+)?PATIENT)?|PATIENT\s+STEPS?)\s*:?\s*$/i },
  { key: 'en',         pattern: /^(?:EXPLANATION(?:\s+IN)?(?:\s+PLAIN)?(?:\s+ENGLISH)?|PLAIN.?LANGUAGE|PATIENT\s+EXPLANATION)\s*:?\s*$/i },
  { key: 'fr',         pattern: /^(?:EXPLICATION(?:\s+EN)?(?:\s+FRAN[ÇC]AIS)?|FRENCH|FRAN[ÇC]AIS)\s*:?\s*$/i },
  { key: 'ak',         pattern: /^(?:NKYER[ƐE]ASE[ƐE](?:\s+W[ƆO])?(?:\s+AKAN)?(?:\s+MU)?|AKAN)\s*:?\s*$/i },
  { key: 'disclaimer', pattern: /^DISCLAIMER\s*:?\s*$/i },
];

/**
 * Check if a line (after stripping markdown) is a known section header.
 * Returns the section key or null.
 */
function identifySectionHeader(rawLine) {
  // Strip bold markers, heading markers, leading/trailing whitespace
  const cleaned = rawLine
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .trim();
  for (const { key, pattern } of SECTION_DEFS) {
    if (pattern.test(cleaned)) return key;
  }
  return null;
}

/**
 * Extract structured data from model output — handles JSON, markdown, or plain text.
 * Never returns null; always produces a usable result from whatever the model gives us.
 */
function parseModelOutput(rawText, { patient, lab, trend, mode }) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return null; // Truly empty — let caller use fallback
  }

  const text = rawText.trim();

  // ---- Attempt 1: Try JSON parsing (ideal case) ----
  const jsonResult = tryParseJSON(text);
  if (jsonResult) return jsonResult;

  // ---- Attempt 2: Extract sections from natural-language output ----
  return extractFromText(text);
}

/**
 * Try to find and parse a JSON object from the text.
 */
function tryParseJSON(text) {
  let cleaned = text;

  // Strip markdown code fences
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Find JSON boundaries
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      if (parsed.summary || parsed.recommended_actions || parsed.next_steps) {
        return parsed;
      }
    } catch (e) {
      // Not valid JSON — continue to text extraction
    }
  }
  return null;
}

/**
 * Line-based section scanner — splits model output at known section headers
 * so headers NEVER bleed into content.  Handles `**HEADER:**`,
 * `## HEADER`, or plain `HEADER:` patterns.
 */
function extractFromText(text) {
  const result = {
    summary: '',
    recommended_actions: [],
    patient_explanation: { en: '', fr: '', ak: '' },
    next_steps: [],
    disclaimer: 'This is AI-generated guidance. Consult a licensed healthcare provider.',
  };

  const lines = text.split('\n');

  // --- Pass 1: find every section header + its line index ---
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const key = identifySectionHeader(lines[i]);
    if (key) sections.push({ key, lineIndex: i });
  }

  // --- Pass 2: extract the content between adjacent headers ---
  const contentMap = {};
  for (let i = 0; i < sections.length; i++) {
    const startLine = sections[i].lineIndex + 1;
    const endLine = i + 1 < sections.length ? sections[i + 1].lineIndex : lines.length;
    const block = lines.slice(startLine, endLine).join('\n').trim();
    // Keep the *first* occurrence of each key
    if (!contentMap[sections[i].key]) {
      contentMap[sections[i].key] = block;
    }
  }

  // --- Pass 3: populate result from contentMap ---
  if (contentMap.summary) {
    result.summary = cleanParagraph(contentMap.summary);
  }
  if (contentMap.actions) {
    result.recommended_actions = extractBulletItems(contentMap.actions);
  }
  if (contentMap.next_steps) {
    result.next_steps = extractBulletItems(contentMap.next_steps);
  }
  if (contentMap.en) {
    result.patient_explanation.en = cleanParagraph(contentMap.en);
  }
  if (contentMap.fr) {
    result.patient_explanation.fr = cleanParagraph(contentMap.fr);
  }
  if (contentMap.ak) {
    result.patient_explanation.ak = cleanParagraph(contentMap.ak);
  }

  // --- Fallback: no headers found → treat whole text as summary ---
  if (!result.summary && sections.length === 0) {
    result.summary = cleanParagraph(text);
  }

  // --- Fallback: no bullets at all → scan entire text for stray bullets ---
  if (!result.recommended_actions.length && !result.next_steps.length) {
    // Only pull bullets from lines that are NOT section headers
    const nonHeaderText = lines
      .filter((l) => !identifySectionHeader(l))
      .join('\n');
    const allBullets = extractBulletItems(nonHeaderText);
    if (allBullets.length > 0) {
      const mid = Math.ceil(allBullets.length / 2);
      result.recommended_actions = allBullets.slice(0, mid);
      result.next_steps = allBullets.slice(mid);
    }
  }

  // --- patient_explanation.en falls back to summary ---
  if (!result.patient_explanation.en && result.summary) {
    result.patient_explanation.en = result.summary;
  }

  return result;
}

/**
 * Extract bullet/numbered list items from a text block.
 * Skips lines that look like section headers.
 */
function extractBulletItems(text) {
  const lines = text.split('\n');
  const items = [];
  for (const line of lines) {
    // Skip anything that matches a section header
    if (identifySectionHeader(line)) continue;

    // Match: - item, • item, * item, 1. item, 1) item
    const match = line.match(/^\s*(?:[-•]|\d+[.)]\s*)\s*(.+)/);
    if (match && match[1].trim().length > 5) {
      items.push(match[1].trim());
      continue;
    }
    // Also match lines starting with a single * that is NOT bold marker
    // e.g. "* Schedule appointment" but not "**bold text**"
    const starMatch = line.match(/^\s*\*(?!\*)\s+(.+)/);
    if (starMatch && starMatch[1].trim().length > 5) {
      items.push(starMatch[1].trim());
    }
  }
  return items;
}

/**
 * Clean a paragraph for TTS / plain display: strips markdown formatting,
 * collapses whitespace, removes stray headers.
 */
function cleanParagraph(text) {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s*/g, '')      // Remove heading markers
    .replace(/\n{2,}/g, '\n')       // Collapse multiple newlines
    .split('\n')
    .filter((l) => !identifySectionHeader(l)) // Drop leaked headers
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join(' ')
    .trim();
}

function getNumericLabValue(lab) {
  if (typeof lab?.numeric_value === 'number' && !Number.isNaN(lab.numeric_value)) {
    return lab.numeric_value;
  }

  const match = String(lab?.result_value || '').match(/-?\d+\.?\d*/);
  return match ? Number.parseFloat(match[0]) : NaN;
}

function uniqueItems(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function appendSentence(base, sentence) {
  if (!sentence) return base || '';
  if (!base) return sentence;

  const baseLower = base.toLowerCase();
  const sentenceLower = sentence.toLowerCase();
  if (baseLower.includes(sentenceLower)) return base;

  return `${base.trim()} ${sentence.trim()}`.trim();
}

function applyPersonalization(output, personalization) {
  if (!personalization) return output;

  const nextSteps = uniqueItems([...(output.next_steps || []), ...(personalization.nextSteps || [])]);
  const recommendedActions = uniqueItems([
    ...(output.recommended_actions || []),
    ...(personalization.recommendedActions || []),
  ]);

  const patientExplanation = output.patient_explanation || { en: '', fr: '', ak: '' };

  return {
    ...output,
    summary: appendSentence(output.summary, personalization.summaryNote),
    next_steps: nextSteps,
    recommended_actions: recommendedActions,
    patient_explanation: {
      en: appendSentence(patientExplanation.en, personalization.patientNotes?.en),
      fr: appendSentence(patientExplanation.fr, personalization.patientNotes?.fr),
      ak: appendSentence(patientExplanation.ak, personalization.patientNotes?.ak),
    },
  };
}

/**
 * Build a rule-based fallback interpretation when LLM is unavailable.
 * Incorporates patient context (demographics, conditions, drugs) when available.
 */
function buildFallbackInterpretation({ patient, lab, trend, mode, patientContext }) {
  const testName = lab.test_name;
  const numericValue = getNumericLabValue(lab);
  const severity = isNaN(numericValue) ? 'safe' : classifySeverity(testName, numericValue, lab.unit);
  const deviation = isNaN(numericValue) ? 0 : deviationFromNormal(testName, numericValue, lab.unit);
  const trendAnalysis = trend ? analyzeTrend(trend.values) : { direction: 'stable', percentChange: 0 };
  const urgency = trend
    ? assessUrgency(testName, numericValue, trend.values, lab.unit)
    : { urgent: false, reason: `${testName} assessment pending` };
  const personalization = buildPersonalizationInsights({ lab, patientContext });

  const summaryParts = [];
  if (severity === 'danger') {
    summaryParts.push(`${testName} at ${lab.result_value} is critically elevated (${deviation}% above normal range of ${lab.normal_range}).`);
  } else if (severity === 'warn') {
    summaryParts.push(`${testName} at ${lab.result_value} is elevated above the normal range of ${lab.normal_range}.`);
  } else {
    summaryParts.push(`${testName} at ${lab.result_value} is within normal limits (${lab.normal_range}).`);
  }

  if (trendAnalysis.direction !== 'stable') {
    summaryParts.push(`Trending ${trendAnalysis.direction} with ${trendAnalysis.percentChange}% change over 3 months.`);
  }

  summaryParts.push(`Patient has: ${patient.profile_description}`);

  // Include chronic conditions in the summary when available
  if (patientContext?.medicalHistory?.length) {
    const conditions = patientContext.medicalHistory.map(c => c.name).join(', ');
    summaryParts.push(`Known conditions: ${conditions}.`);
  }

  // Include current medications in the summary when available
  if (patientContext?.drugHistory?.length) {
    const meds = patientContext.drugHistory.map(d => d.name).join(', ');
    summaryParts.push(`Current medications: ${meds}.`);
  }

  // Build context-aware next steps
  const nextSteps = [
    severity !== 'safe' ? 'Schedule an appointment with your doctor this week' : 'Continue your current health routine',
    'Keep track of any symptoms you notice',
    'Bring this report to your next appointment',
  ];

  // Add medication-aware next steps
  if (patientContext?.drugHistory?.length) {
    nextSteps.push('Discuss your current medications with your doctor in relation to this result');
  }
  if (patientContext?.medicalHistory?.length) {
    nextSteps.push('Mention your existing conditions when discussing this result');
  }

  // Build context-aware explanations
  const conditionNote = patientContext?.medicalHistory?.length
    ? ` Given your medical history, your doctor may want to review this in context.`
    : '';
  const medNote = patientContext?.drugHistory?.length
    ? ` Some medications can affect lab values, so mention your current medicines to your doctor.`
    : '';

  const fallback = {
    summary: summaryParts.join(' '),
    severity,
    trend_direction: trendAnalysis.direction,
    percent_change: parseFloat(trendAnalysis.percentChange),
    recommended_actions: [
      `Follow up on ${testName} result with healthcare provider`,
      urgency.urgent ? 'Schedule priority appointment' : 'Schedule routine follow-up',
      'Review current medications',
      'Consider lifestyle modifications',
    ],
    patient_explanation: {
      en: `Your ${testName} result is ${lab.result_value}. The normal range is ${lab.normal_range}. ${severity !== 'safe' ? 'This is outside the normal range, so it is important to talk with your doctor.' : 'This is within normal range — keep up the good work!'}${conditionNote}${medNote} Consult a licensed healthcare provider.`,
      fr: `Votre resultat de ${testName} est ${lab.result_value}. La plage normale est ${lab.normal_range}. ${severity !== 'safe' ? 'Ce resultat est en dehors de la plage normale. Veuillez consulter votre medecin.' : 'Ce resultat est normal. Continuez ainsi!'}${conditionNote ? ' Compte tenu de vos antecedents medicaux, votre medecin pourrait vouloir examiner cela en contexte.' : ''}${medNote ? ' Certains medicaments peuvent affecter les resultats. Mentionnez vos medicaments actuels a votre medecin.' : ''} ${SAFETY_PHRASE_FR}`,
      ak: `Wo ${testName} result ye ${lab.result_value}. Normal range no ye ${lab.normal_range}. ${severity !== 'safe' ? 'Eyi wo normal range no akyi. Ka ho asem kyer3 wo doctor.' : 'Eyi ye normal. Toa so saa ara!'}${conditionNote ? ' Wo yaree a ewo ho no nti, wo doctor b3hw3 mu yie.' : ''}${medNote ? ' Nnuro bi tumi sesa lab results. Ka wo nnuro ho asem kyer3 wo doctor.' : ''} Consult a licensed healthcare provider.`,
    },
    next_steps: nextSteps,
    confidence: 0.6,
    disclaimer: 'Rule-based analysis — not AI-generated. Consult a licensed healthcare provider.',
    source: 'rules',
  };

  return applyPersonalization(fallback, personalization);
}

/**
 * The main agent class. Conforms to { name, run(input) } interface
 * expected by AgentOrchestrator.
 */
export class LabInterpretationAgent {
  constructor() {
    this.name = AGENT_NAME;
  }

  /**
   * Run lab interpretation.
   * @param {object} input
   * @param {object} input.patient - Patient record from mockData
   * @param {object} input.lab - Lab result record
   * @param {object} [input.trend] - Trend data
   * @param {string} input.mode - 'patient'
   * @param {function} [input.onToken] - Streaming token callback
   * @param {object} [input.patientContext] - Pre-fetched patient context (demographics, medical hx, drugs)
   * @param {'full'|'metric'} [input.format='full'] - 'metric' asks only for a short EN/FR explanation
   * @returns {Promise<AgentOutput>} output.source is 'model' or 'rules'
   */
  async run(input) {
    const {
      patient, lab, trend, mode, onToken, userId, patientContext: preloadedCtx, format = 'full',
    } = input;

    // Resolve patient context: use pre-loaded if available, otherwise fetch
    let patientContext = preloadedCtx || null;
    if (!patientContext && userId) {
      try {
        patientContext = await getFullPatientContext(userId);
      } catch (e) {
        console.warn('[LabInterpretationAgent] Could not load patient context:', e);
      }
    }

    const personalization = buildPersonalizationInsights({ lab, patientContext });

    // If model is not ready, use fallback (still includes patient context)
    if (!llamaService.isReady) {
      console.log('[LabInterpretationAgent] Model not ready, using rule-based fallback');
      const fallback = buildFallbackInterpretation({ patient, lab, trend, mode, patientContext, personalization });
      return createAgentOutput(AGENT_NAME, fallback, {
        confidence: fallback.confidence,
        reasoning: 'Rule-based fallback — LLM not available',
        warnings: [
          'Using rule-based analysis (AI model not loaded)',
          'Prototype output — not for clinical use',
        ],
      });
    }

    try {

      // Build prompt
      const isMetric = format === 'metric';
      const userPrompt = buildUserPrompt({
        patient,
        lab,
        trend,
        mode,
        patientContext,
        outputInstructions: isMetric ? METRIC_OUTPUT_INSTRUCTIONS : OUTPUT_INSTRUCTIONS,
      });
      const fullPrompt = llamaService.formatPrompt(SYSTEM_PROMPT, userPrompt);

      // Run inference
      const rawOutput = await llamaService.complete(fullPrompt, {
        n_predict: isMetric ? 512 : 1024,
        temperature: 0.3,
      }, onToken);

      console.log('[LabInterpretationAgent] Raw output type:', typeof rawOutput, 'length:', rawOutput?.length);
      console.log('[LabInterpretationAgent] Raw output preview:', rawOutput?.slice(0, 300));

      // Parse structured output — resilient to any format
      const parsed = parseModelOutput(rawOutput, { patient, lab, trend, mode });

      if (!parsed) {
        // Truly empty output — fall back to rule-based
        console.warn('[LabInterpretationAgent] Empty model output, using fallback');
        const fallback = buildFallbackInterpretation({ patient, lab, trend, mode, patientContext, personalization });
        return createAgentOutput(AGENT_NAME, fallback, {
          confidence: fallback.confidence,
          reasoning: 'Model produced no output. Showing rule-based fallback.',
          warnings: [
            'Using rule-based analysis (AI returned empty output)',
            'Prototype output — not for clinical use',
          ],
        });
      }

      // Validate severity against domain rules
      const numericValue = getNumericLabValue(lab);
      const domainSeverity = isNaN(numericValue) ? 'safe' : classifySeverity(lab.test_name, numericValue, lab.unit);
      if (parsed.severity && parsed.severity !== domainSeverity) {
        console.warn(`[LabInterpretationAgent] Model severity "${parsed.severity}" differs from domain rules "${domainSeverity}". Using domain rules.`);
        parsed.severity = domainSeverity;
      }

      // Ensure safety disclaimer
      if (!parsed.disclaimer) {
        parsed.disclaimer = 'This is AI-generated guidance. Consult a licensed healthcare provider.';
      }

      const personalizedParsed = { ...applyPersonalization(parsed, personalization), source: 'model' };

      return createAgentOutput(AGENT_NAME, personalizedParsed, {
        confidence: personalizedParsed.confidence || 0.8,
        reasoning: `Gemma on-device inference for ${lab.test_name}`,
        warnings: ['Prototype output — not for clinical use'],
      });
    } catch (error) {
      console.error('[LabInterpretationAgent] Inference error:', error);
      const fallback = buildFallbackInterpretation({ patient, lab, trend, mode, patientContext, personalization });
      return createAgentOutput(AGENT_NAME, fallback, {
        confidence: fallback.confidence,
        reasoning: `Inference failed: ${error.message}. Using rule-based fallback.`,
        warnings: [
          `AI inference error: ${error.message}`,
          'Prototype output — not for clinical use',
        ],
      });
    }
  }
}

// Export a singleton instance
const labInterpretationAgent = new LabInterpretationAgent();
export default labInterpretationAgent;
