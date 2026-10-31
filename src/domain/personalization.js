/**
 * Deterministic personalization rules for medication/condition-aware messaging.
 * These rules provide guaranteed context that can be merged with AI output.
 */

import { REFERENCE_RANGES } from './reference_ranges';

const DIRECTION = {
  LOW: 'low',
  HIGH: 'high',
  NORMAL: 'normal',
  UNKNOWN: 'unknown',
};

const MEDICATION_GROUPS = {
  ppi: [
    'omeprazole',
    'esomeprazole',
    'pantoprazole',
    'lansoprazole',
    'rabeprazole',
    'dexlansoprazole',
  ],
};

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMetricName(testName) {
  if (!testName) return '';
  const normalized = normalizeToken(testName);

  if (normalized === 'mg' || normalized === 'mag') return 'Magnesium';

  const known = Object.keys(REFERENCE_RANGES).find(
    (key) => normalizeToken(key) === normalized
  );

  return known || testName;
}

function resolveThresholds(testName, unit) {
  const range = REFERENCE_RANGES[testName];
  if (!range) return null;

  let thresholds = range;
  if (unit && range.altUnits) {
    const normalizedUnit = unit.trim().toLowerCase();
    for (const [altUnit, altThresholds] of Object.entries(range.altUnits)) {
      if (altUnit.toLowerCase() === normalizedUnit) {
        thresholds = altThresholds;
        break;
      }
    }
  }

  return { range, thresholds };
}

export function getAbnormalDirection(testName, numericValue, unit) {
  if (!Number.isFinite(numericValue)) return DIRECTION.UNKNOWN;

  const resolved = resolveThresholds(testName, unit);
  if (!resolved) return DIRECTION.UNKNOWN;

  const { range, thresholds } = resolved;

  if (range.invertedScale) {
    if (numericValue < (thresholds.critical?.max ?? 60)) return DIRECTION.LOW;
    if (numericValue < (thresholds.elevated?.max ?? 90)) return DIRECTION.LOW;
    return DIRECTION.NORMAL;
  }

  const lowCritical = thresholds.lowCritical ?? range.lowCritical;
  const lowWarn = thresholds.lowWarn ?? range.lowWarn;

  if (lowCritical != null && numericValue < lowCritical) return DIRECTION.LOW;
  if (lowWarn != null && numericValue < lowWarn) return DIRECTION.LOW;

  if (thresholds.normal?.min != null && numericValue < thresholds.normal.min) return DIRECTION.LOW;
  if (thresholds.normal?.max != null && numericValue > thresholds.normal.max) return DIRECTION.HIGH;

  return DIRECTION.NORMAL;
}

function getMedicationNames(drugHistory) {
  return (drugHistory || [])
    .map((entry) => entry?.name)
    .filter(Boolean);
}

function matchMedicationGroup(drugHistory, groupKey) {
  const aliases = MEDICATION_GROUPS[groupKey] || [];
  if (!aliases.length) return null;

  const meds = getMedicationNames(drugHistory);
  for (const med of meds) {
    const normalizedMed = normalizeToken(med);
    const matchedAlias = aliases.find((alias) => {
      const normalizedAlias = normalizeToken(alias);
      return normalizedMed === normalizedAlias || normalizedMed.includes(normalizedAlias);
    });

    if (matchedAlias) {
      return med;
    }
  }

  return null;
}

function uniq(items) {
  return [...new Set((items || []).filter(Boolean))];
}

/**
 * Returns deterministic personalization content for a single lab metric.
 */
export function buildPersonalizationInsights({ lab, patientContext }) {
  if (!lab || !patientContext?.drugHistory?.length) return null;

  const metricName = normalizeMetricName(lab.test_name);
  if (!metricName) return null;

  const numericValue = Number.isFinite(lab.numeric_value)
    ? Number(lab.numeric_value)
    : Number.parseFloat(String(lab.result_value || '').replace(/^[^\d-]*/, ''));

  if (!Number.isFinite(numericValue)) return null;

  const direction = getAbnormalDirection(metricName, numericValue, lab.unit);

  // Example user journey requirement:
  // Low magnesium in users on omeprazole (or other PPIs) should be contextualized.
  if (metricName === 'Magnesium' && direction === DIRECTION.LOW) {
    const matchedMedication = matchMedicationGroup(patientContext.drugHistory, 'ppi');
    if (matchedMedication) {
      const summaryNote = `Low magnesium can sometimes happen in people taking proton pump inhibitors such as ${matchedMedication}.`;
      const actionNote = 'Review this result with your healthcare provider in the context of your current medications.';
      const nextStep = `Mention ${matchedMedication} at your next review so your care team can decide whether monitoring or medication adjustments are needed.`;

      return {
        id: 'ppi-low-magnesium',
        metricName,
        direction,
        medication: matchedMedication,
        promptContext: `The patient takes ${matchedMedication}. Low magnesium can occur with proton pump inhibitors in some people. Mention this as possible context only, not as a diagnosis or certainty.`,
        summaryNote,
        recommendedActions: uniq([actionNote]),
        nextSteps: uniq([nextStep]),
        patientNotes: {
          en: `${summaryNote} This does not confirm the cause, but it is worth discussing. Consult a licensed healthcare provider.`,
          fr: `Un magnesium bas peut parfois survenir chez les personnes qui prennent ${matchedMedication}. Cela ne prouve pas la cause, mais il vaut mieux en parler. Consultez un professionnel de sante agree.`,
          ak: `Magnesium a eba fam no tumi ba nnipa a wonom ${matchedMedication} no mu bi mu. Eyi nkyere se eno na ede bae p3p33p3, nanso eho hia se wokasa ho. Consult a licensed healthcare provider.`,
        },
      };
    }
  }

  return null;
}

// -- Tests worth tracking for a patient's conditions and medicines --

// Tests commonly checked for a condition (keys are MedicalHistoryScreen ids;
// `match` catches free-text "other" conditions).
const CONDITION_LINKS = [
  { ids: ['diabetes_type1', 'diabetes_type2'], match: /diabet/i, label: 'diabetes',
    tests: ['Glucose', 'HbA1c', 'Creatinine', 'eGFR', 'Cholesterol', 'LDL', 'Triglycerides'] },
  { ids: ['hypertension'], match: /hypertension|blood pressure/i, label: 'high blood pressure',
    tests: ['Creatinine', 'eGFR', 'Potassium', 'Sodium'] },
  { ids: ['ckd'], match: /kidney|renal/i, label: 'kidney disease',
    tests: ['Creatinine', 'eGFR', 'BUN', 'Urea', 'Potassium', 'Sodium', 'Bicarbonate', 'Phosphate', 'Calcium', 'Hemoglobin'] },
  { ids: ['liver_disease'], match: /liver|hepatitis|cirrhosis/i, label: 'liver disease',
    tests: ['ALT', 'AST', 'ALP', 'GGT', 'Bilirubin', 'Direct Bilirubin', 'Albumin'] },
  { ids: ['heart_disease', 'high_cholesterol', 'stroke'], match: /heart|cholesterol|stroke/i, label: 'heart and blood vessel health',
    tests: ['Cholesterol', 'LDL', 'HDL', 'Triglycerides'] },
  { ids: ['sickle_cell'], match: /sickle/i, label: 'sickle cell disease',
    tests: ['Hemoglobin', 'Bilirubin', 'Indirect Bilirubin', 'Creatinine'] },
  { ids: ['thyroid'], match: /thyroid/i, label: 'thyroid disease', tests: ['TSH'] },
];

// Tests commonly checked for people taking a medicine.
const MEDICINE_LINKS = [
  { names: ['metformin'], tests: ['Creatinine', 'eGFR'] },
  { names: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin'], tests: ['ALT', 'AST', 'Cholesterol', 'LDL'] },
  { names: ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril', 'losartan', 'valsartan', 'telmisartan', 'candesartan', 'irbesartan'],
    tests: ['Potassium', 'Creatinine', 'eGFR'] },
  { names: ['hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'furosemide', 'bumetanide', 'spironolactone'],
    tests: ['Sodium', 'Potassium', 'Creatinine'] },
  { names: ['omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'], tests: ['Magnesium'] },
  { names: ['levothyroxine', 'carbimazole', 'methimazole'], tests: ['TSH'] },
  { names: ['tenofovir'], tests: ['Creatinine', 'eGFR', 'Phosphate'] },
];

/**
 * Reasons a test is commonly watched for this patient's conditions and medicines
 * (used by monitoring.js). Phrased as "often checked", never as a cause.
 */
export function linkedReasons(testName, conditions = [], medications = []) {
  const reasons = [];
  for (const link of CONDITION_LINKS) {
    if (!link.tests.includes(testName)) continue;
    const has = conditions.some((c) => link.ids.includes(c?.id) || link.match.test(String(c?.name || '')));
    if (has) reasons.push(`Often checked for people with ${link.label}.`);
  }
  for (const link of MEDICINE_LINKS) {
    if (!link.tests.includes(testName)) continue;
    const med = medications.find((m) => link.names.some((n) => String(m?.name || '').toLowerCase().includes(n)));
    if (med) reasons.push(`Often checked for people taking ${med.name}.`);
  }
  return reasons;
}
