/**
 * LlamaService — singleton service for on-device LLM inference.
 * Wraps local runtimes (llama.rn or LiteRT-LM) and remote provider calls.
 *
 * Local runtime selection:
 * - Android: prefers LiteRT-LM when configured and available.
 * - Fallback: llama.rn GGUF runtime.
 *
 * Usage:
 *   import llamaService from '../services/LlamaService';
 *   await llamaService.initialize('/path/to/model');
 *   const result = await llamaService.complete('Your prompt');
 */

import { initLlama } from 'llama.rn';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, TurboModuleRegistry } from 'react-native';
import {
  LLAMA_MMPROJ_FILENAME,
  LLAMA_MODEL_FILENAME,
  LOCAL_INFERENCE_RUNTIME,
  MODEL_PROVIDER,
} from '../constants/inference';
import liteRTService from './LiteRTService';
import remoteGemmaService from './RemoteGemmaService';

/**
 * Pre-flight check: is the llama.rn native module available?
 * TurboModuleRegistry.get() returns null when the native module
 * failed to link (e.g. iOS simulator without Metal support, or
 * missing bridgeless-mode compat in older llama.rn releases).
 */
const NATIVE_MODULE_AVAILABLE = TurboModuleRegistry.get('RNLlama') != null;

/**
 * Remote model URLs for on-demand download.
 * Set to null to disable on-demand downloading (e.g. in dev builds
 * where the model is bundled or pushed via adb).
 *
 * When a HuggingFace URL is provided, the model is downloaded to
 * documentDirectory on first launch. This avoids bundling a ~3 GB
 * file in the iOS .app or Android APK.
 */
const MODEL_DOWNLOAD_URL = null; // e.g. 'https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_0.gguf'
const MMPROJ_DOWNLOAD_URL = null; // e.g. 'https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/mmproj-gemma-4-E2B-it-Q8_0.gguf'

/** Default inference parameters tuned for medical text generation */
const DEFAULT_PARAMS = {
  n_predict: 1024,
  temperature: 0.3,      // Low temperature for clinical accuracy
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1,
  stop: ['<turn|>', '<eos>'],
  // Apply the chat template stored in the GGUF (Gemma 4) and skip its thinking channel.
  jinja: true,
  enable_thinking: false,
};

/**
 * Model init parameters tuned for mobile.
 * iOS  → Metal GPU, 4 threads
 * Android → CPU-only (Vulkan not yet reliable in llama.rn), 6 threads
 */
const DEFAULT_MODEL_PARAMS = Platform.select({
  ios: {
    n_ctx: 4096,
    n_batch: 512,
    n_threads: 4,
    n_gpu_layers: 99,       // Full Metal GPU offload
    use_mlock: false,
    use_mmap: true,
    ctx_shift: false,       // Required for Gemma multimodal
  },
  android: {
    n_ctx: 2048,            // Balanced context for clinical text
    n_batch: 512,           // PocketPal default — good throughput
    n_threads: 4,           // Conservative thread count
    n_gpu_layers: 0,        // CPU-only — avoids Vulkan driver issues
    use_mlock: false,
    use_mmap: true,         // Safe from app-private documentDirectory
    ctx_shift: false,       // Required for Gemma multimodal
  },
});

const BYTES_PER_GB = 1024 * 1024 * 1024;
const MIN_ANDROID_MODEL_RAM_GB = Number(process.env.EXPO_PUBLIC_MIN_ANDROID_MODEL_RAM_GB || 5.5);
const MIN_ANDROID_MODEL_RAM_BYTES =
  Number.isFinite(MIN_ANDROID_MODEL_RAM_GB) && MIN_ANDROID_MODEL_RAM_GB > 0
    ? MIN_ANDROID_MODEL_RAM_GB * BYTES_PER_GB
    : 0;

const ALLOW_EMULATOR_MODEL_LOAD =
  String(process.env.EXPO_PUBLIC_ALLOW_EMULATOR_MODEL_LOAD || '').toLowerCase() === 'true';

const ALLOW_ANDROID_LLAMA_FALLBACK =
  String(process.env.EXPO_PUBLIC_ALLOW_ANDROID_LLAMA_FALLBACK || '').toLowerCase() === 'true';

const SUPPORTED_ANDROID_ARCH_HINTS = ['arm64', 'armeabi'];

class LlamaService {
  constructor() {
    this._context = null;
    this._status = 'idle';    // idle | loading | ready | error
    this._error = null;
    this._modelPath = null;
    this._listeners = new Set();

    // Concurrency guard — llama.rn context only supports one completion at a time
    this._busy = false;
    this._abortCurrent = null;   // abort() fn for the in-flight completion
    this._queue = [];            // waiting callers: [{ resolve, reject, args }]

    // Multimodal state
    this._multimodalReady = false;
    this._mmprojPath = null;

    // Loading progress (0–1) emitted by initLlama
    this._loadProgress = 0;

    // Inference provider mode: local llama.rn (default) or remote API.
    this._provider = MODEL_PROVIDER === 'remote' ? 'remote' : 'local';

    // Active local runtime when provider=local: llama | litertlm
    this._localRuntime = 'llama';
  }

  // -- Status management --

  get status() { return this._status; }
  get error() { return this._error; }
  get provider() { return this._provider; }
  get localRuntime() { return this._localRuntime; }
  get isReady() { return this._status === 'ready'; }
  get isMultimodalReady() {
    // Remote provider advertises multimodal readiness through overall readiness.
    if (this._provider === 'remote') return this.isReady;
    if (this._localRuntime === 'litertlm') return this.isReady;
    return this._multimodalReady;
  }
  get loadProgress() { return this._loadProgress; }

  /** Subscribe to status changes. Returns unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _setStatus(status, error = null) {
    this._status = status;
    this._error = error;
    this._listeners.forEach(fn => {
      try { fn({ status, error, progress: this._loadProgress }); } catch (e) { /* ignore */ }
    });
  }

  _hasSupportedAndroidArchitecture() {
    const archs = Array.isArray(Device.supportedCpuArchitectures)
      ? Device.supportedCpuArchitectures.filter(Boolean)
      : [];

    if (archs.length === 0) {
      // Some environments don't expose arch metadata; avoid false negatives.
      return true;
    }

    return archs.some((arch) => {
      const lower = String(arch).toLowerCase();
      return SUPPORTED_ANDROID_ARCH_HINTS.some((hint) => lower.includes(hint));
    });
  }

  _enforceAndroidGuardrails() {
    if (this._provider !== 'local' || Platform.OS !== 'android') {
      return;
    }

    if (Device.isDevice === false && !ALLOW_EMULATOR_MODEL_LOAD) {
      throw new Error(
        'Local model loading is disabled on Android emulators to reduce native crash risk. ' +
        'Use a physical Android device or set EXPO_PUBLIC_ALLOW_EMULATOR_MODEL_LOAD=true to override.'
      );
    }

    if (!this._hasSupportedAndroidArchitecture()) {
      const archLabel = Array.isArray(Device.supportedCpuArchitectures)
        ? Device.supportedCpuArchitectures.join(', ')
        : 'unknown';

      throw new Error(
        `Unsupported Android CPU architecture for local model runtime (${archLabel}). ` +
        'Use an ARM64 Android device for on-device AI.'
      );
    }

    const shouldCheckMemory = LOCAL_INFERENCE_RUNTIME !== 'litertlm';
    const totalMemory = Number(Device.totalMemory || 0);
    if (
      shouldCheckMemory &&
      MIN_ANDROID_MODEL_RAM_BYTES > 0 &&
      totalMemory > 0 &&
      totalMemory < MIN_ANDROID_MODEL_RAM_BYTES
    ) {
      const availableGb = (totalMemory / BYTES_PER_GB).toFixed(1);
      throw new Error(
        `This device reports ${availableGb} GB RAM. Local GGUF loading is disabled below ` +
        `${MIN_ANDROID_MODEL_RAM_GB} GB to reduce crash risk. Continue in rule-based mode or use remote provider.`
      );
    }
  }

  // -- Model discovery --

  /**
   * Find the model file. Checks (in order):
   * 1. Provided explicit path
   * 2. App bundle (iOS — bundled via withModelAsset config plugin)
   * 3. Documents directory (downloaded / copied / migrated models)
   * 4. Cache directory (Android)
   * 5. /data/local/tmp/ (Android dev — auto-migrates to documentDirectory)
   * 6. /sdcard/Download/ (Android — alternate dev location)
   */
  async findModelPath(explicitPath = null) {
    // 1. Explicit path
    if (explicitPath) {
      const info = await FileSystem.getInfoAsync(explicitPath);
      if (info.exists) {
        console.log('[LlamaService] Model found at explicit path');
        return explicitPath;
      }
    }

    // 2. Bundle directory (model included in native build via config plugin)
    if (FileSystem.bundleDirectory) {
      const bundlePath = `${FileSystem.bundleDirectory}${LLAMA_MODEL_FILENAME}`;
      const bundleInfo = await FileSystem.getInfoAsync(bundlePath);
      if (bundleInfo.exists) {
        console.log('[LlamaService] Model found in app bundle');
        return bundlePath;
      }
    }

    // 3. Documents directory (manually copied or downloaded)
    const docsPath = `${FileSystem.documentDirectory}${LLAMA_MODEL_FILENAME}`;
    const docsInfo = await FileSystem.getInfoAsync(docsPath);
    if (docsInfo.exists) {
      console.log('[LlamaService] Model found in documents directory');
      return docsPath;
    }

    // 4. Android: cache directory (alternative push location)
    if (Platform.OS === 'android' && FileSystem.cacheDirectory) {
      const cachePath = `${FileSystem.cacheDirectory}${LLAMA_MODEL_FILENAME}`;
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      if (cacheInfo.exists) {
        console.log('[LlamaService] Model found in cache directory (Android)');
        return cachePath;
      }
    }

    // 5. Android: /data/local/tmp/ (dev only — adb push target)
    //    ALWAYS migrate to documentDirectory because /data/local/tmp/ is not
    //    reliably readable from app processes due to Android sandboxing/SELinux.
    if (Platform.OS === 'android') {
      const tmpRawPath = `/data/local/tmp/${LLAMA_MODEL_FILENAME}`;
      const tmpUri = `file://${tmpRawPath}`;
      try {
        const tmpInfo = await FileSystem.getInfoAsync(tmpUri);
        if (tmpInfo.exists) {
          console.log('[LlamaService] Model found in /data/local/tmp/ — migrating to documents…');
          const migrated = await this._migrateModel(tmpUri, docsPath);
          if (migrated) {
            // Clean up /data/local/tmp/ copy to save space
            try { await FileSystem.deleteAsync(tmpUri, { idempotent: true }); } catch (_) {}
            return docsPath;
          }
          // Migration failed — still try the raw path as last resort
          console.warn('[LlamaService] Migration failed, attempting raw path (may fail in production)');
          return tmpRawPath;
        }
      } catch (e) {
        console.log('[LlamaService] Cannot access /data/local/tmp/ from app process (expected on production)');
      }
    }

    // 6. Android: external storage /sdcard/Download/ (dev push via adb)
    if (Platform.OS === 'android') {
      const extPath = `file:///sdcard/Download/${LLAMA_MODEL_FILENAME}`;
      try {
        const extInfo = await FileSystem.getInfoAsync(extPath);
        if (extInfo.exists) {
          console.log('[LlamaService] Model found in /sdcard/Download/ (dev)');
          return extPath;
        }
      } catch (e) {
        console.log('[LlamaService] Could not check /sdcard/Download/:', e.message);
      }
    }

    // 7. On-demand download (both platforms — last resort)
    if (MODEL_DOWNLOAD_URL) {
      console.log('[LlamaService] Model not found locally — attempting on-demand download…');
      const downloaded = await this._downloadModel(MODEL_DOWNLOAD_URL, LLAMA_MODEL_FILENAME);
      if (downloaded) return downloaded;
    }

    console.warn(
      `[LlamaService] Model "${LLAMA_MODEL_FILENAME}" not found anywhere.\n` +
      `  Searched: bundleDir, documentDir, cacheDir` +
      (Platform.OS === 'android' ? ', /data/local/tmp/, /sdcard/Download/' : '') + '\n' +
      (Platform.OS === 'android'
        ? '  Run: ./push-model-android.sh   (auto-runs with npm run android)'
        : '  Ensure the model is bundled via the withModelAsset config plugin.')
    );
    return null;
  }

  /**
   * Find the mmproj (multimodal projector) file for vision support.
   * Searches the same locations as findModelPath.
   */
  async findMmprojPath() {
    // 1. Bundle directory
    if (FileSystem.bundleDirectory) {
      const bundlePath = `${FileSystem.bundleDirectory}${LLAMA_MMPROJ_FILENAME}`;
      const info = await FileSystem.getInfoAsync(bundlePath);
      if (info.exists) {
        console.log('[LlamaService] mmproj found in app bundle');
        return bundlePath;
      }
    }

    // 2. Documents directory
    const docsPath = `${FileSystem.documentDirectory}${LLAMA_MMPROJ_FILENAME}`;
    const docsInfo = await FileSystem.getInfoAsync(docsPath);
    if (docsInfo.exists) {
      console.log('[LlamaService] mmproj found in documents directory');
      return docsPath;
    }

    // 3. Android: cache directory
    if (Platform.OS === 'android' && FileSystem.cacheDirectory) {
      const cachePath = `${FileSystem.cacheDirectory}${LLAMA_MMPROJ_FILENAME}`;
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      if (cacheInfo.exists) {
        console.log('[LlamaService] mmproj found in cache directory (Android)');
        return cachePath;
      }
    }

    // 4. Android: /data/local/tmp/ (dev only — migrate to documents, same as model)
    if (Platform.OS === 'android') {
      const tmpRawPath = `/data/local/tmp/${LLAMA_MMPROJ_FILENAME}`;
      const tmpUri = `file://${tmpRawPath}`;
      try {
        const tmpInfo = await FileSystem.getInfoAsync(tmpUri);
        if (tmpInfo.exists) {
          console.log('[LlamaService] mmproj found in /data/local/tmp/ — migrating…');
          const migrated = await this._migrateModel(tmpUri, docsPath);
          if (migrated) {
            try { await FileSystem.deleteAsync(tmpUri, { idempotent: true }); } catch (_) {}
            return docsPath;
          }
          return tmpRawPath;
        }
      } catch (e) {
        console.log('[LlamaService] Cannot access /data/local/tmp/ for mmproj from app process');
      }
    }

    // 5. Android: /sdcard/Download/
    if (Platform.OS === 'android') {
      const extPath = `file:///sdcard/Download/${LLAMA_MMPROJ_FILENAME}`;
      try {
        const extInfo = await FileSystem.getInfoAsync(extPath);
        if (extInfo.exists) {
          console.log('[LlamaService] mmproj found in /sdcard/Download/ (dev)');
          return extPath;
        }
      } catch (e) {
        console.log('[LlamaService] Could not check /sdcard/Download/ for mmproj:', e.message);
      }
    }

    // 6. On-demand download
    if (MMPROJ_DOWNLOAD_URL) {
      console.log('[LlamaService] mmproj not found locally — attempting on-demand download…');
      const downloaded = await this._downloadModel(MMPROJ_DOWNLOAD_URL, LLAMA_MMPROJ_FILENAME);
      if (downloaded) return downloaded;
    }

    console.warn('[LlamaService] mmproj file not found — vision will be unavailable');
    return null;
  }

  /**
   * Migrate (copy) a model from a temporary location to the documents directory.
   * Runs in the background; returns true on success.
   */
  async _migrateModel(fromUri, toUri) {
    try {
      const destInfo = await FileSystem.getInfoAsync(toUri);
      if (destInfo.exists) {
        console.log('[LlamaService] Model already in documents dir, skipping migration');
        return true;
      }
      console.log(`[LlamaService] Copying model to documents dir…`);
      await FileSystem.copyAsync({ from: fromUri, to: toUri });
      const verify = await FileSystem.getInfoAsync(toUri);
      if (verify.exists) {
        console.log('[LlamaService] ✅ Model migrated to documents directory');
        return true;
      }
    } catch (e) {
      console.warn('[LlamaService] Migration failed (model still usable from source):', e.message);
    }
    return false;
  }

  /**
   * Download a model file from a remote URL to documentDirectory.
   * Reports progress via the service's status listeners.
   *
   * @param {string} url - Remote URL
   * @param {string} filename - Local filename (e.g. MODEL_FILENAME)
   * @returns {string|null} - Local path on success, null on failure
   */
  async _downloadModel(url, filename) {
    if (!url) return null;

    const destPath = `${FileSystem.documentDirectory}${filename}`;

    // Check if already downloaded
    const existing = await FileSystem.getInfoAsync(destPath, { size: true });
    if (existing.exists && existing.size > 1024 * 1024) {
      console.log(`[LlamaService] ${filename} already downloaded (${(existing.size / 1024 / 1024).toFixed(0)} MB)`);
      return destPath;
    }

    console.log(`[LlamaService] Downloading ${filename} from ${url}…`);
    this._setStatus('loading');
    this._loadProgress = 0;

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        destPath,
        {},
        (downloadProgress) => {
          const pct = downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
            : 0;
          this._loadProgress = pct * 0.9; // Reserve 10% for model init
          this._listeners.forEach(fn => {
            try {
              fn({ status: 'loading', error: null, progress: this._loadProgress });
            } catch (_) {}
          });
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        const verify = await FileSystem.getInfoAsync(result.uri, { size: true });
        if (verify.exists && verify.size > 1024 * 1024) {
          console.log(`[LlamaService] ✅ Downloaded ${filename} (${(verify.size / 1024 / 1024).toFixed(0)} MB)`);
          return result.uri;
        }
      }
      console.warn(`[LlamaService] Download of ${filename} succeeded but file is invalid`);
      return null;
    } catch (e) {
      console.warn(`[LlamaService] Download of ${filename} failed:`, e.message);
      // Clean up partial file
      try { await FileSystem.deleteAsync(destPath, { idempotent: true }); } catch (_) {}
      return null;
    }
  }

  // -- Initialization --

  /**
   * Initialize the LLM context. Call once on app startup.
   * @param {string} [modelPath] - Override path to GGUF file
   * @param {object} [params] - Override model params
   */
  async initialize(modelPath = null, params = {}) {
    if (this._status === 'loading') {
      console.warn('[LlamaService] Already loading, skipping duplicate init');
      return;
    }
    if (this._status === 'ready' && this._context) {
      console.log('[LlamaService] Already initialized');
      return;
    }

    this._setStatus('loading');

    try {
      this._enforceAndroidGuardrails();
      this._localRuntime = 'llama';

      if (this._provider === 'remote') {
        await remoteGemmaService.initialize();
        this._loadProgress = 1;
        this._multimodalReady = true;
        this._localRuntime = 'remote';
        this._setStatus('ready');
        console.log('[LlamaService] Remote Gemma provider initialized');
        return;
      }

      const shouldTryLiteRT =
        Platform.OS === 'android' &&
        LOCAL_INFERENCE_RUNTIME !== 'llama';

      if (shouldTryLiteRT) {
        try {
          const liteRTPath = await liteRTService.initialize(modelPath);
          this._context = null;
          this._modelPath = liteRTPath;
          this._multimodalReady = true;
          this._loadProgress = 1;
          this._localRuntime = 'litertlm';
          this._setStatus('ready');
          console.log(`[LlamaService] LiteRT local runtime initialized (${liteRTPath})`);
          return;
        } catch (liteError) {
          if (LOCAL_INFERENCE_RUNTIME === 'litertlm') {
            throw liteError;
          }

          if (
            Platform.OS === 'android' &&
            LOCAL_INFERENCE_RUNTIME === 'auto' &&
            !ALLOW_ANDROID_LLAMA_FALLBACK
          ) {
            const message = liteError?.message || 'LiteRT initialization failed';
            throw new Error(
              `LiteRT unavailable in auto mode (${message}). Android fallback to llama.rn is disabled by default ` +
              'to reduce model-load crash risk. Continue in rule-based mode or set ' +
              'EXPO_PUBLIC_ALLOW_ANDROID_LLAMA_FALLBACK=true to force fallback.'
            );
          }

          console.warn(
            '[LlamaService] LiteRT unavailable in auto mode, falling back to llama.rn:',
            liteError.message
          );
        }
      }

      // Pre-flight: check that the llama.rn native module is available.
      // On iOS simulator or if bridgeless-mode compat is broken, the
      // TurboModule may not be registered and initLlama() would crash
      // with "Cannot read property 'install' of null".
      if (!NATIVE_MODULE_AVAILABLE) {
        throw new Error(
          'llama.rn native module is not available on this device. ' +
          (Platform.OS === 'ios'
            ? 'The iOS Simulator does not support Metal GPU acceleration required by llama.rn. ' +
              'Please test on a physical iOS device.'
            : 'Ensure the native build includes the llama.rn library. Try: npx expo prebuild --clean && npx expo run:android')
        );
      }

      // Find the model
      const resolvedPath = await this.findModelPath(modelPath);
      if (!resolvedPath) {
        throw new Error(
          `Model file "${LLAMA_MODEL_FILENAME}" not found. ` +
          `Place it in the app documents directory or provide an explicit path.`
        );
      }

      this._modelPath = resolvedPath;
      console.log(`[LlamaService] Loading model from: ${resolvedPath}`);

      // Normalize path for expo-file-system (needs file:// URI) vs llama.rn (needs raw path)
      const fsPath = resolvedPath.startsWith('/') ? `file://${resolvedPath}` : resolvedPath;
      const llamaPath = resolvedPath.startsWith('file://') ? resolvedPath.slice(7) : resolvedPath;

      // Pre-flight: check file size vs available memory
      try {
        const fileInfo = await FileSystem.getInfoAsync(fsPath, { size: true });
        const fileSizeMB = (fileInfo.size || 0) / (1024 * 1024);
        console.log(`[LlamaService] Model file size: ${fileSizeMB.toFixed(0)} MB`);
        if (fileSizeMB > 2000) {
          console.warn(
            `[LlamaService] Large model (${fileSizeMB.toFixed(0)} MB). ` +
            (Platform.OS === 'ios'
              ? 'Ensure the device has enough RAM. A12+ (iPhone XS and later) recommended for models this size.'
              : 'If the app crashes, the device may not have enough RAM.')
          );
        }
      } catch (e) {
        console.log('[LlamaService] Could not check file size:', e.message);
      }

      // Initialize llama.rn context (always pass raw filesystem path)
      // Wrap in a timeout — loading a 2 GB model can hang on low-end devices
      const LOAD_TIMEOUT_MS = 120_000; // 2 minutes
      this._loadProgress = 0;
      console.log(`[LlamaService] Calling initLlama (timeout ${LOAD_TIMEOUT_MS / 1000}s)…`);
      console.log(`[LlamaService] Model path for llama.rn: ${llamaPath}`);

      // CRITICAL: use_progress_callback + callback prevents crashes on many
      // Android devices/versions (see llama.rn issue #85).
      const initPromise = initLlama(
        {
          model: llamaPath,
          ...DEFAULT_MODEL_PARAMS,
          ...params,
          use_progress_callback: true,
        },
        (progress) => {
          // progress can be 0–1 float OR 0–100 int depending on llama.rn version.
          // Normalise to 0–1.
          const norm = progress > 1 ? progress / 100 : progress;
          this._loadProgress = norm;
          const pct = Math.round(norm * 100);
          if (pct % 10 === 0) {
            console.log(`[LlamaService] Loading: ${pct}%`);
          }
          // Notify listeners so UI can show progress
          this._listeners.forEach(fn => {
            try { fn({ status: 'loading', error: null, progress: norm }); } catch (_) {}
          });
        }
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          `Model loading timed out after ${LOAD_TIMEOUT_MS / 1000}s. ` +
          `The model may be too large for this device's available RAM.`
        )), LOAD_TIMEOUT_MS)
      );

      this._context = await Promise.race([initPromise, timeoutPromise]);
      this._loadProgress = 1;

      this._setStatus('ready');
      this._localRuntime = 'llama';
      console.log('[LlamaService] Model loaded successfully');

      // Try to initialize multimodal (vision) support
      await this._tryInitMultimodal();
    } catch (error) {
      console.error('[LlamaService] Initialization failed:', error);
      this._setStatus('error', error.message || 'Failed to load model');
      throw error;
    }
  }

  /**
   * Try to initialize multimodal (vision) projector.
   * Non-fatal — if mmproj isn't available, text-only mode still works.
   */
  async _tryInitMultimodal() {
    if (!this._context) return;

    try {
      const mmprojPath = await this.findMmprojPath();
      if (!mmprojPath) {
        console.log('[LlamaService] No mmproj file — running in text-only mode');
        return;
      }

      console.log(`[LlamaService] Initializing multimodal with: ${mmprojPath}`);
      // Normalize path — llama.rn expects raw filesystem paths
      const llamaMmprojPath = mmprojPath.startsWith('file://') ? mmprojPath.slice(7) : mmprojPath;
      await this._context.initMultimodal({
        path: llamaMmprojPath,
        use_gpu: Platform.OS === 'ios',   // Metal on iOS, CPU on Android
      });

      // Verify
      const enabled = await this._context.isMultimodalEnabled();
      if (enabled) {
        this._multimodalReady = true;
        this._mmprojPath = mmprojPath;
        console.log('[LlamaService] Multimodal (vision) initialized successfully');
      } else {
        console.warn('[LlamaService] initMultimodal completed but isMultimodalEnabled=false');
      }
    } catch (e) {
      console.warn('[LlamaService] Multimodal init failed (text-only mode):', e.message);
      this._multimodalReady = false;
    }
  }

  // -- Inference --

  /**
   * Run a completion with the loaded model.
   * @param {string} prompt - The full formatted prompt
   * @param {object} [params] - Override inference params
   * @param {function} [onToken] - Streaming callback (receives partial text)
   * @returns {Promise<string>} The model's generated text
   */
  async complete(prompt, params = {}, onToken = null) {
    if (this._provider === 'remote') {
      if (this._status !== 'ready') {
        throw new Error('Remote provider not initialized. Call initialize() first.');
      }
      return remoteGemmaService.complete(prompt, params, onToken);
    }

    if (this._localRuntime === 'litertlm') {
      if (this._status !== 'ready') {
        throw new Error('LiteRT provider not initialized. Call initialize() first.');
      }
      return liteRTService.complete(prompt, params, onToken);
    }

    if (!this._context || this._status !== 'ready') {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    // ---- Concurrency guard ----
    // If a completion is already running, abort it and wait for it to finish
    if (this._busy) {
      console.log('[LlamaService] Context busy — aborting previous completion');
      if (this._abortCurrent) {
        try { this._abortCurrent(); } catch (_) { /* ignore */ }
      }
      // Wait for the busy flag to clear (previous completion to finish/error)
      await new Promise((resolve) => {
        const check = () => {
          if (!this._busy) return resolve();
          setTimeout(check, 50);
        };
        check();
      });
    }

    this._busy = true;
    this._abortCurrent = null;

    const completionParams = {
      messages: [{ role: 'user', content: prompt }],
      ...DEFAULT_PARAMS,
      ...params,
    };

    try {
      if (onToken) {
        // Streaming mode
        let fullText = '';
        const completionResult = this._context.completion(
          completionParams,
          (data) => {
            fullText += data.token;
            onToken(data.token, fullText);
          }
        );
        // Capture the abort handle
        if (completionResult?.abort) {
          this._abortCurrent = completionResult.abort;
        }
        // Handle both { promise } wrapper and direct promise
        const result = completionResult?.promise
          ? await completionResult.promise
          : await completionResult;
        const text = result?.text ?? fullText;
        console.log('[LlamaService] Streaming completion done, length:', text.length);
        return text;
      } else {
        // Non-streaming mode
        const completionResult = this._context.completion(completionParams);
        // Capture the abort handle
        if (completionResult?.abort) {
          this._abortCurrent = completionResult.abort;
        }
        // Handle both { promise } wrapper and direct promise
        const result = completionResult?.promise
          ? await completionResult.promise
          : await completionResult;
        console.log('[LlamaService] Completion result keys:', result ? Object.keys(result) : 'null');
        console.log('[LlamaService] Completion result:', JSON.stringify(result)?.slice(0, 500));
        // llama.rn may return text on .text, .content, or the result itself
        const text = result?.text ?? result?.content ?? (typeof result === 'string' ? result : '');
        console.log('[LlamaService] Extracted text length:', text.length);
        return text;
      }
    } catch (error) {
      // Aborted completions throw — don't rethrow if it was an intentional abort
      if (error?.message?.includes('aborted') || error?.message?.includes('cancelled')) {
        console.log('[LlamaService] Completion was aborted');
        return '';
      }
      console.error('[LlamaService] Completion failed:', error);
      throw error;
    } finally {
      this._busy = false;
      this._abortCurrent = null;
    }
  }

  /**
   * Combine system instructions and the user message into one user turn.
   * Each runtime applies the model's own chat template (llama.rn via jinja,
   * LiteRT-LM via its Conversation API), so no turn markers are added here.
   * @param {string} systemPrompt - System instructions
   * @param {string} userMessage - User's query
   * @returns {string} Prompt text
   */
  formatPrompt(systemPrompt, userMessage) {
    return `${systemPrompt}\n\n${userMessage}`;
  }

  /**
   * Run a completion with an image (multimodal).
   * Uses OpenAI-compatible messages format with image_url.
   * @param {string} systemPrompt - System instructions
   * @param {string} userText - User's text prompt
   * @param {string} imageUri - Local file:// URI to the image
   * @param {object} [params] - Override inference params
   * @returns {Promise<string>} The model's generated text
   */
  async completeWithImage(systemPrompt, userText, imageUri, params = {}) {
    if (this._provider === 'remote') {
      if (this._status !== 'ready') {
        throw new Error('Remote provider not initialized. Call initialize() first.');
      }
      return remoteGemmaService.completeWithImage(systemPrompt, userText, imageUri, params);
    }

    if (this._localRuntime === 'litertlm') {
      if (this._status !== 'ready') {
        throw new Error('LiteRT provider not initialized. Call initialize() first.');
      }
      return liteRTService.completeWithImage(systemPrompt, userText, imageUri, params);
    }

    if (!this._context || this._status !== 'ready') {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    if (!this._multimodalReady) {
      throw new Error('Multimodal (vision) not initialized. mmproj file may be missing.');
    }

    // Normalize the image URI for llama.rn
    let normalizedUri = imageUri;
    if (!normalizedUri.startsWith('file://') && !normalizedUri.startsWith('data:')) {
      normalizedUri = `file://${normalizedUri}`;
    }

    console.log('[LlamaService] completeWithImage, image:', normalizedUri.slice(0, 80));

    // Concurrency guard — same as complete()
    if (this._busy) {
      console.log('[LlamaService] Context busy — aborting previous completion for image');
      if (this._abortCurrent) {
        try { this._abortCurrent(); } catch (_) { /* ignore */ }
      }
      await new Promise((resolve) => {
        const check = () => {
          if (!this._busy) return resolve();
          setTimeout(check, 50);
        };
        check();
      });
    }

    this._busy = true;
    this._abortCurrent = null;

    try {
      // Use OpenAI-compatible messages format
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${systemPrompt}\n\n${userText}` },
            {
              type: 'image_url',
              image_url: { url: normalizedUri },
            },
          ],
        },
      ];

      const completionParams = {
        messages,
        ...DEFAULT_PARAMS,
        ...params,
        n_predict: params.n_predict || 1536,  // More tokens for image analysis
      };

      const completionResult = this._context.completion(completionParams);
      if (completionResult?.abort) {
        this._abortCurrent = completionResult.abort;
      }
      const result = completionResult?.promise
        ? await completionResult.promise
        : await completionResult;

      const text = result?.text ?? result?.content ?? (typeof result === 'string' ? result : '');
      console.log('[LlamaService] Image completion done, length:', text.length);
      return text;
    } catch (error) {
      if (error?.message?.includes('aborted') || error?.message?.includes('cancelled')) {
        console.log('[LlamaService] Image completion was aborted');
        return '';
      }
      console.error('[LlamaService] Image completion failed:', error);
      throw error;
    } finally {
      this._busy = false;
      this._abortCurrent = null;
    }
  }

  /**
   * Run a completion with a PDF document.
   * Remote provider sends PDF bytes directly as multimodal input.
   * Local provider attempts direct multimodal parsing via the same completion path.
   * @param {string} systemPrompt
   * @param {string} userText
   * @param {string} pdfUri
   * @param {object} [params]
   * @returns {Promise<string>}
   */
  async completeWithPdf(systemPrompt, userText, pdfUri, params = {}) {
    if (this._provider === 'remote') {
      if (this._status !== 'ready') {
        throw new Error('Remote provider not initialized. Call initialize() first.');
      }
      return remoteGemmaService.completeWithPdf(systemPrompt, userText, pdfUri, params);
    }

    if (this._localRuntime === 'litertlm') {
      if (this._status !== 'ready') {
        throw new Error('LiteRT provider not initialized. Call initialize() first.');
      }
      return liteRTService.completeWithPdf(systemPrompt, userText, pdfUri, params);
    }

    // Best-effort local path: route to multimodal completion with the PDF URI.
    // Some runtimes will reject non-image URLs; parser handles fallback paths.
    return this.completeWithImage(systemPrompt, userText, pdfUri, params);
  }

  // -- Cleanup --

  /** Release the model and free memory */
  async release() {
    if (this._provider === 'remote') {
      this._busy = false;
      this._abortCurrent = null;
      this._multimodalReady = false;
      this._setStatus('idle');
      return;
    }

    if (this._localRuntime === 'litertlm') {
      await liteRTService.release();
      this._localRuntime = 'llama';
      this._multimodalReady = false;
      this._modelPath = null;
      this._setStatus('idle');
      return;
    }

    // Abort any in-flight completion first
    if (this._abortCurrent) {
      try { this._abortCurrent(); } catch (_) { /* ignore */ }
    }
    this._busy = false;
    this._abortCurrent = null;

    // Release multimodal projector first
    if (this._multimodalReady && this._context) {
      try {
        await this._context.releaseMultimodal();
      } catch (e) {
        console.warn('[LlamaService] releaseMultimodal error:', e);
      }
      this._multimodalReady = false;
      this._mmprojPath = null;
    }

    if (this._context) {
      try {
        await this._context.release();
      } catch (e) {
        console.warn('[LlamaService] Release error:', e);
      }
      this._context = null;
    }
    this._setStatus('idle');
  }

  // -- Model management helpers --

  /** Check if model exists on device (documents dir or external storage) */
  async isModelDownloaded() {
    if (this._provider === 'remote') {
      return remoteGemmaService.isConfigured;
    }

    if (Platform.OS === 'android' && LOCAL_INFERENCE_RUNTIME !== 'llama') {
      const liteRTPath = await liteRTService.findModelPath();
      if (liteRTPath) return true;
      if (LOCAL_INFERENCE_RUNTIME === 'litertlm') return false;
    }

    const path = await this.findModelPath();
    return path !== null;
  }

  /** Get the expected model path in documents directory */
  getDocumentsModelPath() {
    if (Platform.OS === 'android' && LOCAL_INFERENCE_RUNTIME !== 'llama') {
      return liteRTService.getDocumentsModelPath();
    }

    return `${FileSystem.documentDirectory}${LLAMA_MODEL_FILENAME}`;
  }
}

// Export singleton instance
const llamaService = new LlamaService();
export default llamaService;
