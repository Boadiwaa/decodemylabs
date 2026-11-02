/**
 * On-device inference configuration.
 *
 * EXPO_PUBLIC_ values are compiled into the app bundle, so never put secrets here.
 */

const RUNTIME_OPTIONS = ['auto', 'llama', 'litertlm'];

const rawRuntime = String(process.env.EXPO_PUBLIC_LOCAL_INFERENCE_RUNTIME || 'auto').toLowerCase();

export const LOCAL_INFERENCE_RUNTIME = RUNTIME_OPTIONS.includes(rawRuntime) ? rawRuntime : 'auto';

// Local model filenames
export const LLAMA_MODEL_FILENAME = String(
  process.env.EXPO_PUBLIC_LLAMA_MODEL_FILENAME || 'gemma-4-E2B-it-Q4_0.gguf'
).trim();

export const LLAMA_MMPROJ_FILENAME = String(
  process.env.EXPO_PUBLIC_LLAMA_MMPROJ_FILENAME || 'mmproj-gemma-4-E2B-it-Q8_0.gguf'
).trim();

export const LITERT_MODEL_FILENAME = String(
  process.env.EXPO_PUBLIC_LITERT_MODEL_FILENAME || 'gemma-4-E2B-it.litertlm'
).trim();


/**
 * Where Gemma writes text on Android (photo reading always stays on the CPU):
 * - 'cpu' (default): the tested setup.
 * - 'auto': try the GPU and fall back to the CPU; a phone whose GPU fails or crashes
 *   is remembered and uses the CPU from then on.
 * - 'gpu' / 'gpu_fail_test': testing only; the second simulates a GPU start-up failure.
 * Keep release builds on 'cpu' until 'auto' has been tested on real phones.
 */
const BACKEND_OPTIONS = ['cpu', 'auto', 'gpu', 'gpu_fail_test'];
const rawBackend = String(process.env.EXPO_PUBLIC_LITERT_BACKEND || 'cpu').toLowerCase();
export const LITERT_BACKEND = BACKEND_OPTIONS.includes(rawBackend) ? rawBackend : 'cpu';
