jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import {
  saveMedicalHistory, saveDrugHistory, saveAppSettings, getAppSettings,
  readBackupData, writeBackupData, getMedicalHistory, getDrugHistory,
} from '../src/services/PatientStorage';
import { validateBackup, summarizeBackup, BACKUP_FORMAT, BACKUP_VERSION } from '../src/services/DataBackup';

describe('validateBackup', () => {
  it('accepts a current backup', () => {
    expect(validateBackup({ format: BACKUP_FORMAT, version: BACKUP_VERSION, data: {} })).toEqual({ ok: true });
  });

  it('rejects other files, newer versions and missing data', () => {
    expect(validateBackup({ hello: 'world' }).ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, data: {} }).ok).toBe(false);
    expect(validateBackup({ format: BACKUP_FORMAT, version: BACKUP_VERSION }).ok).toBe(false);
  });
});

describe('summarizeBackup', () => {
  it('counts what the backup holds and shows the date day first', () => {
    const summary = summarizeBackup({
      exportedAt: '2026-10-28T10:00:00',
      data: {
        labReports: [{ id: 'a' }, { id: 'b' }],
        labResults: { results: [{}, {}, {}] },
        medicalHx: { conditions: [{ name: 'Gout' }] },
        drugHx: { medications: [] },
      },
    });
    expect(summary).toEqual({ exportedOn: '28/10/2026', reports: 2, results: 3, conditions: 1, medicines: 0 });
  });
});

describe('backup data round trip', () => {
  it('restores health data into another account but leaves device settings alone', async () => {
    await saveMedicalHistory('u1', [{ id: 'custom_gout', name: 'Gout', years: 2 }]);
    await saveDrugHistory('u1', [{ name: 'Metformin' }]);
    await saveAppSettings('u1', { appLock: true });

    const data = await readBackupData('u1');
    expect(data).not.toHaveProperty('settings');

    await saveDrugHistory('u2', [{ name: 'Old medicine' }]);
    await writeBackupData('u2', data);

    expect(await getMedicalHistory('u2')).toEqual([{ id: 'custom_gout', name: 'Gout', years: 2 }]);
    expect(await getDrugHistory('u2')).toEqual([{ name: 'Metformin' }]);
    expect((await getAppSettings('u2')).appLock).toBe(false);
  });

  it('clears entries the backup does not have', async () => {
    await saveDrugHistory('u3', [{ name: 'Aspirin' }]);
    await writeBackupData('u3', { drugHx: null });
    expect(await getDrugHistory('u3')).toEqual([]);
  });
});
