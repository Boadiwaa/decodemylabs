/**
 * PatientStorage — on-device persistence for all patient data.
 *
 * Every piece of patient information is stored on-device using
 * AsyncStorage (not encrypted). It leaves the phone only in a backup file
 * the patient chooses to export, or as explanation text for Akan playback.
 *
 * Key schema:
 *   @ll_profile_{userId}       → PatientProfile (demographics, etc.)
 *   @ll_medical_hx_{userId}    → MedicalHistory[]
 *   @ll_drug_hx_{userId}       → DrugHistory[]
 *   @ll_lab_reports_{userId}   → LabReport[]
 *   @ll_lab_results_{userId}   → ParsedLabResult[]
 *   @ll_explanations_{userId}  → { [cacheKey]: SavedExplanation }
 *   @ll_settings_{userId}      → AppSettings (this device only; not backed up)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { convertUnit, tidyLegacyResult } from '../domain/reference_ranges';
import { formatDate, formatShortDate } from '../utils/dates';

const KEYS = {
  profile: (uid) => `@ll_profile_${uid}`,
  medicalHx: (uid) => `@ll_medical_hx_${uid}`,
  drugHx: (uid) => `@ll_drug_hx_${uid}`,
  labReports: (uid) => `@ll_lab_reports_${uid}`,
  labResults: (uid) => `@ll_lab_results_${uid}`,
  explanations: (uid) => `@ll_explanations_${uid}`,
  settings: (uid) => `@ll_settings_${uid}`,
  explanationRatings: (uid) => `@ll_explanation_ratings_${uid}`,
};

// Health data included in backups. Settings (e.g. app lock) stay with the device.
const BACKUP_KEYS = ['profile', 'medicalHx', 'drugHx', 'labReports', 'labResults', 'explanations'];

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
  return (data?.results || []).map(tidyLegacyResult);
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
    // Results already saved for the same test from the same report are replaced
    // (a typed correction replaces every value read for it, including repeats).
    existing
      .filter((r) => r.test_name === newResult.test_name && r.source_report_id === newResult.source_report_id && r.id !== newResult.id)
      .forEach((r) => resultMap.delete(r.id));
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

/** Rounding for converted values: fewer decimals for larger numbers. */
function roundConverted(value) {
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return Number(value.toFixed(decimals));
}

/**
 * Build trend data from stored lab results for a given test name.
 * Returns the last N data points sorted by test date, all in the unit of the
 * most recent result. Points whose unit cannot be converted are left out.
 */
export function buildTrendFromResults(allResults, testName, maxPoints = 6) {
  const matching = allResults
    .filter((r) => r.test_name === testName && r.numeric_value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (matching.length === 0) return null;

  const unit = matching[matching.length - 1].unit || '';
  let convertedCount = 0;
  let skippedCount = 0;
  const values = [];

  for (const r of matching) {
    const converted = convertUnit(testName, r.numeric_value, r.unit, unit);
    if (converted == null) {
      skippedCount += 1;
      continue;
    }
    const changed = converted !== r.numeric_value;
    if (changed) convertedCount += 1;
    values.push({
      date: formatShortDate(r.date),
      fullDate: formatDate(r.date),
      isoDate: r.date,
      value: changed ? roundConverted(converted) : r.numeric_value,
    });
  }

  return {
    test_name: testName,
    unit,
    values: values.slice(-maxPoints),
    convertedCount,
    skippedCount,
  };
}

/**
 * Set the test date on every result from one report, e.g. after the patient
 * confirms or corrects the date read from the report.
 */
export async function updateReportResultsDate(userId, reportId, date) {
  const existing = await getLabResults(userId);
  const updated = existing.map((r) => (
    r.source_report_id === reportId ? { ...r, date, date_confirmed: true } : r
  ));
  return saveLabResults(userId, updated);
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

// --------------- App settings ---------------

/**
 * @typedef {Object} AppSettings
 * @property {boolean} appLock - Ask for biometrics / device PIN when opening the app
 */

const DEFAULT_SETTINGS = { appLock: false };

export async function getAppSettings(userId) {
  return { ...DEFAULT_SETTINGS, ...((await _get(KEYS.settings(userId))) || {}) };
}

export async function saveAppSettings(userId, changes) {
  const current = await getAppSettings(userId);
  return _set(KEYS.settings(userId), { ...current, ...changes });
}

// --------------- Explanation ratings ---------------

/**
 * "Was this helpful?" answers, keyed by result id. Kept on this phone only;
 * the feedback message includes just the counts, never the results.
 * @returns {Promise<Object<string, { helpful: boolean, source: 'gemma'|'standard', at: string }>>}
 */
export async function getExplanationRatings(userId) {
  return (await _get(KEYS.explanationRatings(userId))) || {};
}

/** Save (or with rating = null, clear) the answer for one result's explanation. */
export async function saveExplanationRating(userId, resultId, rating) {
  const all = await getExplanationRatings(userId);
  if (rating) all[resultId] = { ...rating, at: new Date().toISOString() };
  else delete all[resultId];
  return _set(KEYS.explanationRatings(userId), all);
}

/** Counts for the feedback message, split by explanation source. */
export function summarizeExplanationRatings(ratings) {
  const summary = {
    gemma: { helpful: 0, notHelpful: 0 },
    standard: { helpful: 0, notHelpful: 0 },
  };
  for (const r of Object.values(ratings || {})) {
    const bucket = summary[r.source === 'gemma' ? 'gemma' : 'standard'];
    bucket[r.helpful ? 'helpful' : 'notHelpful'] += 1;
  }
  return summary;
}

// --------------- Backup ---------------

/** All of a user's health data, keyed by BACKUP_KEYS name (missing entries are null). */
export async function readBackupData(userId) {
  const entries = await Promise.all(BACKUP_KEYS.map(async (name) => [name, await _get(KEYS[name](userId))]));
  return Object.fromEntries(entries);
}

/** Replace a user's health data with backup data. Names not in BACKUP_KEYS are ignored. */
export async function writeBackupData(userId, data) {
  const toSet = [];
  const toRemove = [];
  for (const name of BACKUP_KEYS) {
    const value = data?.[name];
    if (value == null) toRemove.push(KEYS[name](userId));
    else toSet.push([KEYS[name](userId), JSON.stringify(value)]);
  }
  try {
    if (toSet.length) await AsyncStorage.multiSet(toSet);
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    return true;
  } catch (e) {
    console.warn('[PatientStorage] restore error:', e);
    return false;
  }
}
