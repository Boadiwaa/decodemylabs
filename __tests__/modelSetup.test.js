const mockFiles = {};
let mockFree = 10e9;
let mockDownload;

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async (uri) => (uri in mockFiles
    ? { exists: true, size: mockFiles[uri] } : { exists: false })),
  getFreeDiskStorageAsync: jest.fn(async () => mockFree),
  readDirectoryAsync: jest.fn(async () => Object.keys(mockFiles).map((uri) => uri.replace('file:///docs/', ''))),
  deleteAsync: jest.fn(async (uri) => { delete mockFiles[uri]; }),
  moveAsync: jest.fn(async ({ from, to }) => { mockFiles[to] = mockFiles[from]; delete mockFiles[from]; }),
  createDownloadResumable: jest.fn((url, fileUri, options, onProgress, resumeData) => {
    const start = async () => mockDownload({ fileUri, onProgress, resumeData });
    return { downloadAsync: start, resumeAsync: start, pauseAsync: jest.fn() };
  }),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { deleteDownloadedModel, modelDownloader, MODEL_DOWNLOAD, formatGB } from '../src/services/ModelSetup';

const PART = 'file:///docs/gemma-4-E2B-it.litertlm.part';
const MODEL = 'file:///docs/gemma-4-E2B-it.litertlm';

beforeEach(async () => {
  Object.keys(mockFiles).forEach((k) => delete mockFiles[k]);
  mockFree = 10e9;
  FileSystem.createDownloadResumable.mockClear();
  await modelDownloader.cancel();
});

describe('model download', () => {
  it('downloads to a .part file and moves it into place when the size matches', async () => {
    mockDownload = async ({ fileUri }) => { mockFiles[fileUri] = MODEL_DOWNLOAD.bytes; return { uri: fileUri, status: 200 }; };
    await modelDownloader.start();
    expect(modelDownloader.state.status).toBe('done');
    expect(mockFiles[MODEL]).toBe(MODEL_DOWNLOAD.bytes);
    expect(PART in mockFiles).toBe(false);
  });

  it('continues from the bytes already saved', async () => {
    mockFiles[PART] = 1000;
    mockDownload = async ({ fileUri, resumeData }) => {
      expect(resumeData).toBe('1000');
      mockFiles[fileUri] = MODEL_DOWNLOAD.bytes;
      return { uri: fileUri, status: 206 };
    };
    await modelDownloader.start();
    expect(modelDownloader.state.status).toBe('done');
  });

  it('throws away a download with the wrong size instead of loading it', async () => {
    mockDownload = async ({ fileUri }) => { mockFiles[fileUri] = 12345; return { uri: fileUri, status: 200 }; };
    await modelDownloader.start();
    expect(modelDownloader.state.status).toBe('error');
    expect(MODEL in mockFiles).toBe(false);
    expect(PART in mockFiles).toBe(false);
  });

  it('keeps the partial file when the connection drops, so Resume can continue', async () => {
    mockDownload = async ({ fileUri }) => { mockFiles[fileUri] = 5000; throw new Error('Network lost'); };
    await modelDownloader.start();
    expect(modelDownloader.state.status).toBe('error');
    expect(modelDownloader.state.bytesWritten).toBe(5000);
    expect(mockFiles[PART]).toBe(5000);
  });

  it("doesn't start when the phone lacks space", async () => {
    mockFree = 1e9;
    await modelDownloader.start();
    expect(modelDownloader.state.status).toBe('error');
    expect(modelDownloader.state.error).toMatch(/free space/);
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
  });

  it('removing the model also removes its cache files', async () => {
    mockFiles[MODEL] = MODEL_DOWNLOAD.bytes;
    mockFiles[`${MODEL}.xnnpack_cache_1_2`] = 788412736;
    mockFiles[`${MODEL}.vision_encoder.xnnpack_cache`] = 217562184;
    mockFiles[`${MODEL}.gpu_cache`] = 1000;
    mockFiles['file:///docs/other.txt'] = 10;
    await deleteDownloadedModel();
    expect(Object.keys(mockFiles)).toEqual(['file:///docs/other.txt']);
  });

  it('formats sizes for patients', () => {
    expect(formatGB(MODEL_DOWNLOAD.bytes)).toBe('2.6 GB');
  });
});
