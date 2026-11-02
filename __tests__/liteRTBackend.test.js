// GPU / CPU choice in LiteRTService: try the GPU, fall back to the CPU, and remember a GPU
// that fails or crashes so the phone keeps using the CPU.

const MODEL = 'file:///docs/gemma-4-E2B-it.litertlm';
const SIZE = 2583085056;
const GPU_STATUS_KEY = '@talkinglabs/litert_gpu_status';
const MARKER_KEY = '@talkinglabs/litert_init_in_progress';

let mockNative;
// One store shared by every fresh copy of the service, like the phone's storage across launches.
const mockStore = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (k) => (mockStore.has(k) ? mockStore.get(k) : null),
  setItem: async (k, v) => { mockStore.set(k, v); },
  removeItem: async (k) => { mockStore.delete(k); },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(async (uri) => (uri === 'file:///docs/gemma-4-E2B-it.litertlm'
    ? { exists: true, size: 2583085056 } : { exists: false })),
}));
jest.mock('expo-modules-core', () => ({ requireNativeModule: () => mockNative }));
jest.mock('../src/constants/inference', () => ({
  LITERT_BACKEND: 'auto',
  LITERT_MODEL_FILENAME: 'gemma-4-E2B-it.litertlm',
}));

/** A fresh copy of the service, as after an app restart. */
function load() {
  let service;
  jest.isolateModules(() => {
    service = require('../src/services/LiteRTService').default;
  });
  return { service };
}

const storage = { setItem: async (k, v) => { mockStore.set(k, v); } };
const read = async (_storage, key) => JSON.parse(mockStore.get(key) || 'null');

beforeEach(async () => {
  mockNative = {
    initialize: jest.fn(async ({ backend }) => ({ backend: backend === 'gpu' ? 'gpu' : 'cpu', gpuError: null })),
    complete: jest.fn(async () => 'An explanation.'),
  };
  mockStore.clear();
});

describe('LiteRT backend choice', () => {
  it('starts on the GPU and trusts it after the first answer', async () => {
    const { service } = load();
    await service.initialize();
    expect(mockNative.initialize).toHaveBeenCalledWith({ modelPath: '/docs/gemma-4-E2B-it.litertlm', backend: 'gpu' });
    expect(service.backend).toBe('gpu');
    expect(await read(storage, MARKER_KEY)).toBeNull(); // nothing pending until an answer starts

    await service.complete('Explain');
    expect((await read(storage, GPU_STATUS_KEY)).status).toBe('ok');
    expect(await read(storage, MARKER_KEY)).toBeNull();
  });

  it('falls back to the CPU when the GPU will not start, and remembers it', async () => {
    mockNative.initialize = jest.fn(async () => ({ backend: 'cpu', gpuError: 'No OpenCL' }));
    let { service } = load();
    await service.initialize();
    expect(service.backend).toBe('cpu');
    expect(await read(storage, GPU_STATUS_KEY)).toMatchObject({ status: 'unsafe', reason: 'No OpenCL' });

    ({ service } = load());
    await service.initialize();
    expect(mockNative.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ backend: 'cpu' }));
  });

  it('uses the CPU after the GPU crashed the app while loading', async () => {
    await storage.setItem(MARKER_KEY, JSON.stringify({
      modelPath: MODEL, modelSize: SIZE, runtimeVersion: '0.10.2', backend: 'gpu', phase: 'load',
    }));
    const { service } = load();
    await service.initialize();
    expect(mockNative.initialize).toHaveBeenCalledWith(expect.objectContaining({ backend: 'cpu' }));
    expect((await read(storage, GPU_STATUS_KEY)).reason).toBe('Crashed during load');
  });

  it('uses the CPU after the GPU crashed the app during its first answer', async () => {
    let { service } = load();
    await service.initialize();
    mockNative.complete = jest.fn(() => new Promise(() => {})); // never returns: the app "dies" here
    service.complete('Explain');
    await new Promise((r) => setTimeout(r, 0));
    expect((await read(storage, MARKER_KEY)).phase).toBe('first_run');

    ({ service } = load());
    await service.initialize();
    expect(service.backend).toBe('cpu');
    expect((await read(storage, GPU_STATUS_KEY)).reason).toBe('Crashed during first_run');
  });

  it('switches to the CPU and retries when the GPU fails its first answer', async () => {
    mockNative.complete = jest.fn(async () => {
      if (mockNative.initialize.mock.calls.at(-1)[0].backend === 'gpu') {
        throw new Error('Can not find OpenCL library on this device');
      }
      return 'An explanation.';
    });
    const { service } = load();
    await service.initialize();
    await expect(service.complete('Explain')).resolves.toBe('An explanation.');
    expect(service.backend).toBe('cpu');
    expect(mockNative.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ backend: 'cpu' }));
    expect((await read(null, GPU_STATUS_KEY)).reason).toMatch(/OpenCL/);
    expect(await read(null, MARKER_KEY)).toBeNull();
  });

  it('passes on errors that happen on a trusted backend', async () => {
    mockNative.complete = jest.fn(async () => { throw new Error('Prompt too long'); });
    mockNative.initialize = jest.fn(async () => ({ backend: 'cpu', gpuError: 'No GPU' }));
    const { service } = load();
    await service.initialize();
    await expect(service.complete('Explain')).rejects.toThrow('Prompt too long');
    expect(mockNative.initialize).toHaveBeenCalledTimes(1);
  });

  it("doesn't blame the GPU when the app build can't report a backend", async () => {
    mockNative.initialize = jest.fn(async () => null);
    const { service } = load();
    await service.initialize();
    expect(service.backend).toBe('cpu');
    expect(await read(null, GPU_STATUS_KEY)).toBeNull();
  });

  it('still skips the model after a crash on the CPU', async () => {
    await storage.setItem(MARKER_KEY, JSON.stringify({
      modelPath: MODEL, modelSize: SIZE, runtimeVersion: '0.10.2', backend: 'cpu', phase: 'load',
    }));
    const { service } = load();
    await expect(service.initialize()).rejects.toThrow(/crashed the app last time/);
  });
});
