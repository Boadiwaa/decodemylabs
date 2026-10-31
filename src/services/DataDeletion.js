/**
 * DataDeletion — "Delete my data": removes everything the app keeps about a
 * patient on this phone. The account itself is removed by AuthContext.
 *
 * Removed: report photos, stored health data (profile, conditions, medicines,
 * reports, results, explanations, ratings, settings), files waiting to be
 * shared (summary PDF, backup), and temporary copies (photo picker, Akan audio).
 * Kept: the Gemma model, which holds no personal data. Backups the patient
 * saved elsewhere are outside the app and can't be reached.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { clearAllPatientData, getLabReports } from './PatientStorage';
import { SHARE_DIR } from '../utils/shareFiles';

const REPORTS_DIR = () => `${FileSystem.documentDirectory}lab_reports/`;
const PICKER_CACHE_DIR = () => `${FileSystem.cacheDirectory}ImagePicker/`;
const TTS_CACHE_PREFIX = 'akan_tts_';

async function remove(uri) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch (e) {
    console.warn('[DataDeletion] Could not delete', uri, e.message);
    return false;
  }
}

async function removeFromCache(prefix) {
  if (!FileSystem.cacheDirectory) return;
  try {
    const names = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    await Promise.all(names.filter((n) => n.startsWith(prefix)).map((n) => remove(`${FileSystem.cacheDirectory}${n}`)));
  } catch (e) {
    console.warn('[DataDeletion] Could not read the cache folder:', e.message);
  }
}

/**
 * Delete a patient's data from this phone.
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, photos: number }>} ok is false if stored data could not be cleared
 */
export async function deleteMyData(userId) {
  const reports = await getLabReports(userId);
  // Only files inside the app's own report folder; never anything the uri might point to elsewhere.
  const photos = reports.map((r) => r.uri).filter((uri) => typeof uri === 'string' && uri.startsWith(REPORTS_DIR()));
  const removed = await Promise.all(photos.map(remove));

  const ok = await clearAllPatientData(userId);
  await remove(SHARE_DIR());
  await remove(PICKER_CACHE_DIR());
  await removeFromCache(TTS_CACHE_PREFIX);

  return { ok, photos: removed.filter(Boolean).length };
}
