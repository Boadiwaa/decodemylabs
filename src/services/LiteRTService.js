/**
 * LiteRTService — Android local adapter for Gemma LiteRT-LM runtime.
 *
 * This service is intentionally defensive:
 * - It detects whether a LiteRT native bridge exists in the current build.
 * - It resolves the .litertlm model file from known app/device locations.
 * - It provides a stable JS interface matching existing LlamaService methods.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requireNativeModule } from 'expo-modules-core';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { LITERT_BACKEND, LITERT_MODEL_FILENAME } from '../constants/inference';

const CANDIDATE_NATIVE_MODULES = [
  'TalkingLabsLiteRT',
  'AndroidLiteRT',
  'ExpoLiteRT',
  'ExpoLiteRTModule',
  'LiteRTGemma',
  'LiteRTModule',
];

const NATIVE_RESOLVE_TIMEOUT_MS = 2500;
const NATIVE_RESOLVE_RETRY_MS = 100;

// Native model loading can abort the whole process (SIGABRT), which JS cannot
// catch. A marker is written before the native init call and cleared after it
// returns; if it survives to the next launch, that load crashed the app.
const INIT_MARKER_KEY = '@talkinglabs/litert_init_in_progress';
// Bump when the litertlm-android dependency changes so a previously crashing
// model gets one fresh attempt on the new runtime.
const LITERT_RUNTIME_VERSION = '0.10.2';

// Per phone: whether the GPU can run the model ({ status: 'ok' | 'unsafe', reason, modelSize, runtimeVersion }).
// Kept until the model or runtime changes, so a GPU that failed once isn't retried on every launch.
const GPU_STATUS_KEY = '@talkinglabs/litert_gpu_status';

function resolveNativeModule() {
  try {
    const expoModule = requireNativeModule('ExpoLiteRT');
    if (expoModule) {
      return { module: expoModule, name: 'ExpoLiteRT' };
    }
  } catch (_) {
    // Ignore and fall through to legacy probes.
  }

  for (const name of CANDIDATE_NATIVE_MODULES) {
    const turbo = TurboModuleRegistry.get(name);
    if (turbo) {
      return { module: turbo, name };
    }

    const legacy = NativeModules?.[name];
    if (legacy) {
      return { module: legacy, name };
    }
  }

  return { module: null, name: null };
}

function getDetectedNativeCandidates() {
  return CANDIDATE_NATIVE_MODULES.filter((name) => {
    if (NativeModules?.[name]) return true;
    try {
      return Boolean(TurboModuleRegistry.get(name));
    } catch (_) {
      return false;
    }
  });
}

function normalizeToFileUri(pathOrUri) {
  if (!pathOrUri) return pathOrUri;
  if (pathOrUri.startsWith('file://') || pathOrUri.startsWith('data:')) return pathOrUri;
  if (pathOrUri.startsWith('/')) return `file://${pathOrUri}`;
  return pathOrUri;
}

function toRawPath(pathOrUri) {
  if (!pathOrUri) return pathOrUri;
  return pathOrUri.startsWith('file://') ? pathOrUri.slice(7) : pathOrUri;
}

class LiteRTService {
  constructor() {
    this._ready = false;
    this._modelPath = null;
    this._nativeModule = null;
    this._nativeModuleName = null;
    this._backend = 'cpu';
    this._gpuTrial = null; // marker while the GPU writes its first answer on this phone

    this.refreshNativeBinding();
  }

  get isReady() {
    return this._ready;
  }

  /** Backend running text generation: 'gpu' or 'cpu'. */
  get backend() {
    return this._backend;
  }

  get modelPath() {
    return this._modelPath;
  }

  get isNativeAvailable() {
    return Boolean(this._nativeModule);
  }

  get nativeModuleName() {
    return this._nativeModuleName;
  }

  refreshNativeBinding() {
    const resolved = resolveNativeModule();
    this._nativeModule = resolved.module;
    this._nativeModuleName = resolved.name;
  }

  async _waitForNativeBinding(timeoutMs = NATIVE_RESOLVE_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      this.refreshNativeBinding();
      if (this._nativeModule) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, NATIVE_RESOLVE_RETRY_MS));
    }

    this.refreshNativeBinding();
    return Boolean(this._nativeModule);
  }

  getDocumentsModelPath() {
    return `${FileSystem.documentDirectory}${LITERT_MODEL_FILENAME}`;
  }

  async _migrateModel(fromUri, toUri) {
    try {
      const destInfo = await FileSystem.getInfoAsync(toUri);
      if (destInfo.exists) return true;

      await FileSystem.copyAsync({ from: fromUri, to: toUri });
      const verify = await FileSystem.getInfoAsync(toUri);
      return verify.exists;
    } catch (error) {
      console.warn('[LiteRTService] Model migration failed:', error.message);
      return false;
    }
  }

  async findModelPath(explicitPath = null) {
    if (explicitPath) {
      const normalized = normalizeToFileUri(explicitPath);
      const info = await FileSystem.getInfoAsync(normalized);
      if (info.exists) return normalized;
    }

    if (FileSystem.bundleDirectory) {
      const bundlePath = `${FileSystem.bundleDirectory}${LITERT_MODEL_FILENAME}`;
      const info = await FileSystem.getInfoAsync(bundlePath);
      if (info.exists) return bundlePath;
    }

    const docsPath = this.getDocumentsModelPath();
    const docsInfo = await FileSystem.getInfoAsync(docsPath);
    if (docsInfo.exists) return docsPath;

    if (Platform.OS === 'android' && FileSystem.cacheDirectory) {
      const cachePath = `${FileSystem.cacheDirectory}${LITERT_MODEL_FILENAME}`;
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      if (cacheInfo.exists) return cachePath;
    }

    if (Platform.OS === 'android') {
      const tmpRawPath = `/data/local/tmp/${LITERT_MODEL_FILENAME}`;
      const tmpUri = `file://${tmpRawPath}`;
      try {
        const tmpInfo = await FileSystem.getInfoAsync(tmpUri);
        if (tmpInfo.exists) {
          const migrated = await this._migrateModel(tmpUri, docsPath);
          if (migrated) {
            try { await FileSystem.deleteAsync(tmpUri, { idempotent: true }); } catch (_) {}
            return docsPath;
          }
          return tmpUri;
        }
      } catch (_) {
        // /data/local/tmp is not always readable from app process; ignore.
      }

      const externalPath = `file:///sdcard/Download/${LITERT_MODEL_FILENAME}`;
      try {
        const externalInfo = await FileSystem.getInfoAsync(externalPath);
        if (externalInfo.exists) return externalPath;
      } catch (_) {
        // Ignore permission/storage access failures in non-dev installs.
      }
    }

    return null;
  }

  _extractText(result) {
    if (typeof result === 'string') return result;
    if (typeof result?.text === 'string') return result.text;
    if (typeof result?.outputText === 'string') return result.outputText;
    if (typeof result?.output_text === 'string') return result.output_text;
    return '';
  }

  async _invokeNative(methodNames, payloadVariants) {
    this.refreshNativeBinding();
    if (!this._nativeModule) {
      throw new Error('LiteRT native module is not available in this build.');
    }

    // The first call is the real attempt; later payload shapes usually fail only on their argument types.
    let firstError = null;

    for (const methodName of methodNames) {
      const fn = this._nativeModule?.[methodName];
      if (typeof fn !== 'function') continue;

      for (const payload of payloadVariants) {
        try {
          const response = await fn.call(this._nativeModule, payload);
          const text = this._extractText(response);
          if (text) return text;

          if (response === null || response === undefined) {
            continue;
          }

          if (typeof response === 'object') {
            return JSON.stringify(response);
          }
        } catch (error) {
          if (!firstError) firstError = error;
        }
      }
    }

    if (firstError) throw firstError;
    throw new Error('No compatible LiteRT native inference method was found.');
  }

  async initialize(explicitPath = null) {
    this.refreshNativeBinding();

    if (!this._nativeModule) {
      const becameAvailable = await this._waitForNativeBinding();
      if (!becameAvailable) {
        const detected = getDetectedNativeCandidates();
        const detectedLabel = detected.length ? detected.join(', ') : 'none';
        throw new Error(
          'LiteRT native module is missing. Add the Android LiteRT bridge module first. ' +
          `Detected native candidates: ${detectedLabel}.`
        );
      }
    }

    const resolvedPath = await this.findModelPath(explicitPath);
    if (!resolvedPath) {
      throw new Error(
        `LiteRT model "${LITERT_MODEL_FILENAME}" not found. Place it in models/, ` +
        'then push it to Android with ./push-model-android.sh.'
      );
    }

    const rawPath = toRawPath(resolvedPath);
    const initFn = this._nativeModule.initialize || this._nativeModule.init;
    if (typeof initFn !== 'function') {
      throw new Error('LiteRT native module does not expose initialize/init.');
    }

    const baseMarker = await this._buildInitMarker(resolvedPath);
    await this._assertNoPriorCrash(baseMarker);
    const requested = await this._chooseBackend(baseMarker);
    const marker = { ...baseMarker, backend: requested === 'cpu' ? 'cpu' : 'gpu', phase: 'load' };
    await this._writeInitMarker(marker);

    const startedAt = Date.now();
    let result = null;
    try {
      result = await initFn.call(this._nativeModule, { modelPath: rawPath, backend: requested });
    } catch (firstError) {
      try {
        await initFn.call(this._nativeModule, rawPath);
      } catch (secondError) {
        await this.clearCrashMarker();
        // The first call is the real attempt; the plain-string retry usually fails only on its argument type.
        const details = firstError?.message || secondError?.message || 'unknown initialization error';
        throw new Error(`LiteRT initialization failed: ${details}`);
      }
    }

    this._backend = result?.backend === 'gpu' ? 'gpu' : 'cpu';
    console.log(`[LiteRTService] Model ready on ${this._backend} in ${Date.now() - startedAt} ms`);
    // Only a build that reports its backend can say the GPU failed; older builds return nothing.
    if (marker.backend === 'gpu' && result?.backend === 'cpu') {
      console.warn('[LiteRTService] GPU unavailable, using the CPU:', result?.gpuError || 'unknown reason');
      await this._saveGpuStatus(baseMarker, 'unsafe', result?.gpuError || 'GPU did not start');
    }

    await this.clearCrashMarker();
    // Trust the GPU only after its first answer: some drivers crash while generating, not while loading.
    this._gpuTrial = this._backend === 'gpu' && (await this._readGpuStatus(baseMarker))?.status !== 'ok'
      ? { ...marker, phase: 'first_run' }
      : null;

    this._ready = true;
    this._modelPath = resolvedPath;
    return resolvedPath;
  }

  // -- Backend choice --

  async _chooseBackend(baseMarker) {
    if (LITERT_BACKEND === 'cpu') return 'cpu';
    if (LITERT_BACKEND !== 'auto') return LITERT_BACKEND; // forced, for testing
    const saved = await this._readGpuStatus(baseMarker);
    return saved?.status === 'unsafe' ? 'cpu' : 'gpu';
  }

  /** Saved GPU result for this model and runtime, or null. */
  async _readGpuStatus(baseMarker) {
    try {
      const saved = JSON.parse((await AsyncStorage.getItem(GPU_STATUS_KEY)) || 'null');
      if (saved && saved.modelSize === baseMarker.modelSize && saved.runtimeVersion === baseMarker.runtimeVersion) {
        return saved;
      }
    } catch (_) {
      // Treated as untested.
    }
    return null;
  }

  async _saveGpuStatus(baseMarker, status, reason = null) {
    try {
      await AsyncStorage.setItem(GPU_STATUS_KEY, JSON.stringify({
        status,
        reason,
        modelSize: baseMarker.modelSize,
        runtimeVersion: baseMarker.runtimeVersion,
        at: new Date().toISOString(),
      }));
    } catch (error) {
      console.warn('[LiteRTService] Could not save GPU status:', error.message);
    }
  }

  /** While the GPU is on trial, mark the answer in progress so a crash during it is recognised next launch. */
  async _beforeAnswer() {
    if (this._gpuTrial) await this._writeInitMarker(this._gpuTrial);
    return Date.now();
  }

  /**
   * The GPU failed its first answer (it can start but still be unable to generate,
   * e.g. "Can not find OpenCL library"). Remember that, and restart on the CPU now
   * so the answer can be retried straight away.
   * @returns {Promise<boolean>} true when it switched to the CPU and the answer should be retried
   */
  async _fallBackToCpu(error) {
    if (!this._gpuTrial) return false;
    const trial = this._gpuTrial;
    this._gpuTrial = null;
    await this._saveGpuStatus(trial, 'unsafe', `First answer failed: ${error?.message || 'unknown error'}`);
    await this.clearCrashMarker();
    console.warn('[LiteRTService] GPU failed its first answer; switching to the CPU:', error?.message);
    try {
      const initFn = this._nativeModule.initialize || this._nativeModule.init;
      await initFn.call(this._nativeModule, { modelPath: toRawPath(trial.modelPath), backend: 'cpu' });
      this._backend = 'cpu';
      return true;
    } catch (restartError) {
      console.warn('[LiteRTService] Could not restart on the CPU:', restartError.message);
      this._ready = false;
      return false;
    }
  }

  /** Run one answer: time it, and on a GPU trial failure retry once on the CPU. */
  async _answer(kind, methodNames, payloadVariants) {
    const startedAt = await this._beforeAnswer();
    let text;
    try {
      text = await this._invokeNative(methodNames, payloadVariants);
    } catch (error) {
      if (!(await this._fallBackToCpu(error))) throw error;
      text = await this._invokeNative(methodNames, payloadVariants);
    }
    await this._afterAnswer(kind, startedAt, text);
    return text;
  }

  /** After a successful answer: time it, and end the GPU's trial if it's on one. */
  async _afterAnswer(kind, startedAt, text) {
    console.log(`[LiteRTService] ${kind} on ${this._backend}: ${Date.now() - startedAt} ms, ${String(text || '').length} characters`);
    if (this._gpuTrial) {
      await this._saveGpuStatus(this._gpuTrial, 'ok');
      this._gpuTrial = null;
      await this.clearCrashMarker();
    }
  }

  // -- Crash guard --

  async _buildInitMarker(resolvedPath) {
    let modelSize = null;
    try {
      const info = await FileSystem.getInfoAsync(resolvedPath);
      modelSize = info?.size ?? null;
    } catch (_) {
      // Size is only used to detect a replaced model file.
    }
    return { modelPath: resolvedPath, modelSize, runtimeVersion: LITERT_RUNTIME_VERSION };
  }

  async _assertNoPriorCrash(marker) {
    let previous = null;
    try {
      const raw = await AsyncStorage.getItem(INIT_MARKER_KEY);
      previous = raw ? JSON.parse(raw) : null;
    } catch (_) {
      return;
    }
    if (!previous) return;

    const sameAttempt =
      previous.modelPath === marker.modelPath &&
      previous.modelSize === marker.modelSize &&
      previous.runtimeVersion === marker.runtimeVersion;

    if (sameAttempt && previous.backend === 'gpu') {
      // The GPU crashed the app (while loading or on its first answer): use the CPU on this phone from now on.
      console.warn(`[LiteRTService] The GPU crashed the app during ${previous.phase || 'load'}; using the CPU from now on.`);
      await this._saveGpuStatus(marker, 'unsafe', `Crashed during ${previous.phase || 'load'}`);
      await this.clearCrashMarker();
      return;
    }

    if (sameAttempt) {
      throw new Error(
        'LiteRT model loading crashed the app last time, so it is skipped to keep the app usable. ' +
        'Update the model or runtime, or clear the marker with liteRTService.clearCrashMarker().'
      );
    }

    // Model or runtime changed since the crash: allow one fresh attempt.
    await this.clearCrashMarker();
  }

  async _writeInitMarker(marker) {
    try {
      await AsyncStorage.setItem(
        INIT_MARKER_KEY,
        JSON.stringify({ ...marker, startedAt: new Date().toISOString() })
      );
    } catch (error) {
      console.warn('[LiteRTService] Could not write init marker:', error.message);
    }
  }

  async clearCrashMarker() {
    try {
      await AsyncStorage.removeItem(INIT_MARKER_KEY);
    } catch (_) {
      // Non-fatal: the next launch will simply re-check.
    }
  }

  async complete(prompt, params = {}, onToken = null) {
    if (!this._ready) {
      throw new Error('LiteRT runtime is not initialized. Call initialize() first.');
    }

    const text = await this._answer(
      'Text',
      ['complete', 'generateText', 'inferText'],
      [
        { prompt, params },
        { prompt, ...params },
        prompt,
      ]
    );

    if (typeof onToken === 'function' && text) {
      onToken(text, text);
    }

    return text;
  }

  async completeWithImage(systemPrompt, userText, imageUri, params = {}) {
    if (!this._ready) {
      throw new Error('LiteRT runtime is not initialized. Call initialize() first.');
    }

    const normalizedImageUri = normalizeToFileUri(imageUri);
    return this._answer(
      'Photo',
      ['completeWithImage', 'inferImage', 'analyzeImage'],
      [
        { systemPrompt, userText, imageUri: normalizedImageUri, params },
        { prompt: `${systemPrompt}\n\n${userText}`, imageUri: normalizedImageUri, params },
        [systemPrompt, userText, normalizedImageUri, params],
      ]
    );
  }

  async release() {
    try {
      this.refreshNativeBinding();
      const releaseFn = this._nativeModule?.release || this._nativeModule?.shutdown;
      if (typeof releaseFn === 'function') {
        await releaseFn.call(this._nativeModule);
      }
    } catch (error) {
      console.warn('[LiteRTService] Release failed:', error.message);
    } finally {
      this._ready = false;
      this._modelPath = null;
      this._backend = 'cpu';
      this._gpuTrial = null;
    }
  }
}

const liteRTService = new LiteRTService();
export default liteRTService;
