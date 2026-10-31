jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/files/',
  cacheDirectory: 'file:///data/cache/',
  deleteAsync: jest.fn(() => Promise.resolve()),
  readDirectoryAsync: jest.fn(() => Promise.resolve(['akan_tts_1.wav', 'gemma-4-E2B-it.litertlm', 'other.txt'])),
}));
jest.mock('../src/services/PatientStorage', () => ({
  getLabReports: jest.fn(() => Promise.resolve([
    { id: 'r1', uri: 'file:///data/files/lab_reports/1_report.jpg' },
    { id: 'r2', uri: 'content://somewhere/else.jpg' },
  ])),
  clearAllPatientData: jest.fn(() => Promise.resolve(true)),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { clearAllPatientData } from '../src/services/PatientStorage';
import { deleteMyData } from '../src/services/DataDeletion';

describe('deleteMyData', () => {
  it('removes report photos, stored data, shared files and temporary copies', async () => {
    const result = await deleteMyData('u1');
    const deleted = FileSystem.deleteAsync.mock.calls.map(([uri]) => uri);

    expect(result).toEqual({ ok: true, photos: 1 });
    expect(clearAllPatientData).toHaveBeenCalledWith('u1');
    expect(deleted).toEqual(expect.arrayContaining([
      'file:///data/files/lab_reports/1_report.jpg',
      'file:///data/files/shared/',
      'file:///data/cache/ImagePicker/',
      'file:///data/cache/akan_tts_1.wav',
    ]));
    // Only the app's own files: not photos elsewhere, not the model, not unrelated cache files.
    expect(deleted).not.toContain('content://somewhere/else.jpg');
    expect(deleted.some((uri) => uri.includes('litertlm') || uri.includes('other.txt'))).toBe(false);
  });
});
