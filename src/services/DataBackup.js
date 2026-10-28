/**
 * DataBackup — export a patient's data to a file and restore it.
 *
 * The backup is one JSON file holding the health data from PatientStorage
 * plus the report photos (base64). It is NOT encrypted: the patient chooses
 * where it goes (share sheet) and is warned before exporting. Restoring
 * replaces the signed-in user's data; device settings such as the app lock
 * are not part of a backup.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { readBackupData, writeBackupData } from './PatientStorage';
import { formatDate, toISODate } from '../utils/dates';

export const BACKUP_FORMAT = 'talkinglabs-backup';
export const BACKUP_VERSION = 1;

const REPORTS_DIR = () => `${FileSystem.documentDirectory}lab_reports/`;
const BACKUP_PREFIX = 'TalkingLabs-backup-';

/**
 * Remove earlier backup files from the app's private cache. They are kept
 * until the next export because the app receiving a share (e.g. an email
 * draft) may read the file after the share sheet closes.
 */
async function removeOldBackupFiles() {
  try {
    const names = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    await Promise.all(names
      .filter((name) => name.startsWith(BACKUP_PREFIX))
      .map((name) => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })));
  } catch (e) {
    console.warn('[DataBackup] Could not clear old backups:', e.message);
  }
}

/**
 * Check that parsed JSON is a TalkingLabs backup this version can restore.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT) {
    return { ok: false, reason: "This file isn't a TalkingLabs backup." };
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    return { ok: false, reason: 'This backup was made by a newer version of TalkingLabs. Please update the app first.' };
  }
  if (!backup.data || typeof backup.data !== 'object') {
    return { ok: false, reason: 'This backup is missing its data.' };
  }
  return { ok: true };
}

/** Plain-language counts for the confirmation message. */
export function summarizeBackup(backup) {
  const data = backup?.data || {};
  return {
    exportedOn: backup?.exportedAt ? formatDate(backup.exportedAt) : 'an unknown date',
    reports: (data.labReports || []).length,
    results: (data.labResults?.results || []).length,
    conditions: (data.medicalHx?.conditions || []).length,
    medicines: (data.drugHx?.medications || []).length,
  };
}

/**
 * Build a backup file for the user and open the share sheet so they can
 * save or send it. Returns the summary of what was exported.
 */
export async function exportBackup(userId) {
  const data = await readBackupData(userId);

  // Embed report photos so a restore on a new phone is complete.
  const files = {};
  for (const report of data.labReports || []) {
    try {
      const info = await FileSystem.getInfoAsync(report.uri);
      if (!info.exists) continue;
      files[report.id] = {
        fileName: report.fileName,
        base64: await FileSystem.readAsStringAsync(report.uri, { encoding: FileSystem.EncodingType.Base64 }),
      };
    } catch (e) {
      console.warn('[DataBackup] Skipping report file:', report.id, e.message);
    }
  }

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    files,
  };

  await removeOldBackupFiles();
  const fileUri = `${FileSystem.cacheDirectory}${BACKUP_PREFIX}${toISODate()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your TalkingLabs backup',
    UTI: 'public.json',
  });

  return summarizeBackup(backup);
}

/**
 * Let the user pick a backup file and read it.
 * @returns {Promise<null | { ok: true, backup: object, summary: object } | { ok: false, reason: string }>}
 *   null when the user cancels the picker.
 */
export async function pickBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const uri = result.assets[0].uri;
  let backup;
  try {
    backup = JSON.parse(await FileSystem.readAsStringAsync(uri));
  } catch (e) {
    return { ok: false, reason: "This file couldn't be read as a TalkingLabs backup." };
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }

  const check = validateBackup(backup);
  if (!check.ok) return check;
  return { ok: true, backup, summary: summarizeBackup(backup) };
}

/**
 * Replace the user's data with a validated backup. Report photos are written
 * to this phone's reports folder and the report records point at the new files.
 */
export async function restoreBackup(userId, backup) {
  const data = { ...backup.data };
  const files = backup.files || {};

  const dir = REPORTS_DIR();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const previous = (await readBackupData(userId)).labReports || [];

  const restoredReports = [];
  for (const report of data.labReports || []) {
    const file = files[report.id];
    if (!file?.base64) {
      // Keep the record (its results still count) even if the photo is missing.
      restoredReports.push({ ...report, uri: null });
      continue;
    }
    const safeName = String(file.fileName || 'report.jpg').replace(/[^A-Za-z0-9._-]/g, '_');
    const uri = `${dir}${report.id}_${safeName}`;
    await FileSystem.writeAsStringAsync(uri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
    restoredReports.push({ ...report, uri });
  }
  data.labReports = restoredReports;

  const saved = await writeBackupData(userId, data);
  if (!saved) throw new Error('Could not save the restored data.');

  // Remove photos from the data that was replaced.
  const keep = new Set(restoredReports.map((r) => r.uri));
  for (const report of previous) {
    if (report.uri && !keep.has(report.uri)) {
      await FileSystem.deleteAsync(report.uri, { idempotent: true }).catch(() => {});
    }
  }

  return summarizeBackup(backup);
}
