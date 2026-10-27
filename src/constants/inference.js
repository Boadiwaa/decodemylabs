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

