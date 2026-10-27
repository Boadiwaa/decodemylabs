/**
 * PatientStorage — on-device persistence for all patient data.
 *
 * Every piece of patient information is stored ONLY on-device
 * using AsyncStorage.  Nothing leaves the phone.
 *
 * Key schema:
 *   @ll_profile_{userId}       → PatientProfile (demographics, etc.)
 *   @ll_medical_hx_{userId}    → MedicalHistory[]
 *   @ll_drug_hx_{userId}       → DrugHistory[]
 *   @ll_lab_reports_{userId}   → LabReport[]
 *   @ll_lab_results_{userId}   → ParsedLabResult[]
 *   @ll_explanations_{userId}  → { [cacheKey]: SavedExplanation }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  profile: (uid) => `@ll_profile_${uid}`,
  medicalHx: (uid) => `@ll_medical_hx_${uid}`,
  drugHx: (uid) => `@ll_drug_hx_${uid}`,
  labReports: (uid) => `@ll_lab_reports_${uid}`,
  labResults: (uid) => `@ll_lab_results_${uid}`,
  explanations: (uid) => `@ll_explanations_${uid}`,
};

// --------------- helpers ---------------

async function _get(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[PatientStorage] read error:', e);
    return null;
  }
}

async function _set(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[PatientStorage] write error:', e);
    return false;
  }
}

// --------------- Patient Profile ---------------

/**
 * @typedef {Object} PatientProfile
 * @property {string} dob           - ISO date YYYY-MM-DD
 * @property {'Male'|'Female'|'Other'} sex
 * @property {string} race
 * @property {string} nationality
 * @property {string} residence     - City / region
 * @property {string} [fullName]    - Copied from auth for convenience
 */

export async function saveProfile(userId, profile) {
  return _set(KEYS.profile(userId), { ...profile, updatedAt: new Date().toISOString() });
}

export async function getProfile(userId) {
  return _get(KEYS.profile(userId));
}

// --------------- Medical History ---------------

/**
 * @typedef {Object} MedicalCondition
 * @property {string} id            - Unique slug, e.g. 'diabetes_type2'
 * @property {string} name          - Display label
 * @property {number} years         - How many years the patient has had it
 */

export async function saveMedicalHistory(userId, conditions) {
  return _set(KEYS.medicalHx(userId), { conditions, updatedAt: new Date().toISOString() });
}

export async function getMedicalHistory(userId) {
  const data = await _get(KEYS.medicalHx(userId));
  return data?.conditions || [];
}

// --------------- Drug History ---------------

/**
 * @typedef {Object} Medication
 * @property {string} name
 * @property {string} [dosage]
 * @property {string} [frequency]   - e.g. 'twice daily'
 * @property {number} [years]       - Duration in years
 */

export async function saveDrugHistory(userId, medications) {
  return _set(KEYS.drugHx(userId), { medications, updatedAt: new Date().toISOString() });
}

export async function getDrugHistory(userId) {
  const data = await _get(KEYS.drugHx(userId));
  return data?.medications || [];
}

// --------------- Lab Reports (raw files) ---------------

/**
 * @typedef {Object} LabReport
 * @property {string} id
 * @property {string} uri           - On-device file URI
 * @property {'pdf'|'image'} type
 * @property {string} fileName
 * @property {string} uploadedAt    - ISO timestamp
 */

export async function saveLabReport(userId, report) {
  const existing = await getLabReports(userId);
  existing.push({ ...report, uploadedAt: new Date().toISOString() });
  return _set(KEYS.labReports(userId), existing);
}

export async function getLabReports(userId) {
  return (await _get(KEYS.labReports(userId))) || [];
}

export async function deleteLabReport(userId, reportId) {
  // Remove the report metadata
  const existing = await getLabReports(userId);
  const filtered = existing.filter((r) => r.id !== reportId);
  await _set(KEYS.labReports(userId), filtered);

  // Also remove all lab results linked to this report
  const results = await getLabResults(userId);
  const filteredResults = results.filter((r) => r.source_report_id !== reportId);
  await _set(KEYS.labResults(userId), { results: filteredResults, updatedAt: new Date().toISOString() });
}

// --------------- Parsed Lab Results ---------------

export async function saveLabResults(userId, results) {
  return _set(KEYS.labResults(userId), { results, updatedAt: new Date().toISOString() });
}

export async function getLabResults(userId) {
  const data = await _get(KEYS.labResults(userId));
  return data?.results || [];
}

/**
 * Append newly parsed lab results to existing stored results.
 * Avoids duplicates by id. If a result with the same test_name already exists
 * from the same report, the new result replaces the old one (upsert behavior).
 */
export async function appendLabResults(userId, newResults) {
  const existing = await getLabResults(userId);
  // Build a map for fast lookup
  const resultMap = new Map(existing.map((r) => [r.id, r]));

  for (const newResult of newResults) {
    // Check if a result with the same test_name already exists from the same report
    const duplicate = existing.find(
      (r) => r.test_name === newResult.test_name && r.source_report_id === newResult.source_report_id && r.id !== newResult.id
    );
    if (duplicate) {
      // Remove the old one — manual entry replaces extracted value
      resultMap.delete(duplicate.id);
    }
    resultMap.set(newResult.id, newResult);
  }

  return saveLabResults(userId, Array.from(resultMap.values()));
}

/**
 * Delete a single lab result by its ID.
 */
export async function deleteLabResultById(userId, resultId) {
  const existing = await getLabResults(userId);
  const filtered = existing.filter((r) => r.id !== resultId);
  return saveLabResults(userId, filtered);
}

/**
 * Delete all parsed results linked to a specific report.
 */
export async function deleteLabResultsByReport(userId, reportId) {
  const existing = await getLabResults(userId);
  const filtered = existing.filter((r) => r.source_report_id !== reportId);
  return saveLabResults(userId, filtered);
}

/**
 * Build trend data from stored lab results for a given test name.
 * Returns the last N data points sorted by date.
 */
export function buildTrendFromResults(allResults, testName, maxPoints = 6) {
  const matching = allResults
    .filter((r) => r.test_name === testName && r.numeric_value > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxPoints);

  if (matching.length === 0) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return {
    test_name: testName,
    unit: matching[0].unit || '',
    values: matching.map((r) => {
      const d = new Date(r.date);
      return {
        date: monthNames[d.getMonth()] || r.date,
        value: r.numeric_value,
      };
    }),
  };
}

// --------------- Saved AI explanations ---------------

const MAX_SAVED_EXPLANATIONS = 100;

/**
 * @typedef {Object} SavedExplanation
 * @property {string} en
 * @property {string} fr
 * @property {string} savedAt - ISO timestamp
 */

/** Look up a previously generated explanation by cache key. */
export async function getSavedExplanation(userId, cacheKey) {
  const all = (await _get(KEYS.explanations(userId))) || {};
  return all[cacheKey] || null;
}

/** Save a generated explanation, keeping only the most recent entries. */
export async function saveExplanation(userId, cacheKey, explanation) {
  const all = (await _get(KEYS.explanations(userId))) || {};
  all[cacheKey] = { ...explanation, savedAt: new Date().toISOString() };
  const keys = Object.keys(all);
  if (keys.length > MAX_SAVED_EXPLANATIONS) {
    keys
      .sort((a, b) => (all[a].savedAt || '').localeCompare(all[b].savedAt || ''))
      .slice(0, keys.length - MAX_SAVED_EXPLANATIONS)
      .forEach((k) => { delete all[k]; });
  }
  return _set(KEYS.explanations(userId), all);
}

// --------------- Aggregate for model prompt ---------------

/**
 * Build a full patient context object for prompt injection.
 * Returns null if no profile is saved yet.
 */
export async function getFullPatientContext(userId) {
  const [profile, conditions, medications, labReports] = await Promise.all([
    getProfile(userId),
    getMedicalHistory(userId),
    getDrugHistory(userId),
    getLabReports(userId),
  ]);

  if (!profile) return null;

  return {
    profile,
    medicalHistory: conditions,
    drugHistory: medications,
    labReportCount: labReports.length,
  };
}

// --------------- Wipe all data for a user ---------------

export async function clearAllPatientData(userId) {
  const keys = Object.values(KEYS).map((fn) => fn(userId));
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (e) {
    console.warn('[PatientStorage] clear error:', e);
    return false;
  }
}
