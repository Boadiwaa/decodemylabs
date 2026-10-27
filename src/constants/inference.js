/**
 * Inference provider configuration.
 *
 * IMPORTANT:
 * - Do not commit real API keys.
 * - Use EXPO_PUBLIC_ env vars for non-secret config only.
 * - Prefer short-lived server-issued tokens in production.
 */

const RUNTIME_OPTIONS = ['auto', 'llama', 'litertlm'];

const rawProvider = String(process.env.EXPO_PUBLIC_MODEL_PROVIDER || 'local').toLowerCase();
const rawRuntime = String(process.env.EXPO_PUBLIC_LOCAL_INFERENCE_RUNTIME || 'auto').toLowerCase();

export const MODEL_PROVIDER = rawProvider === 'remote' ? 'remote' : 'local';
export const LOCAL_INFERENCE_RUNTIME = RUNTIME_OPTIONS.includes(rawRuntime) ? rawRuntime : 'auto';

// Local model filenames
export const LLAMA_MODEL_FILENAME = String(
  process.env.EXPO_PUBLIC_LLAMA_MODEL_FILENAME || 'medgemma-1.5-4b-it-Q3_K_M.gguf'
).trim();

export const LLAMA_MMPROJ_FILENAME = String(
  process.env.EXPO_PUBLIC_LLAMA_MMPROJ_FILENAME || 'mmproj-F16.gguf'
).trim();

export const LITERT_MODEL_FILENAME = String(
  process.env.EXPO_PUBLIC_LITERT_MODEL_FILENAME || 'gemma-4-E2B-it.litertlm'
).trim();

export const GEMMA_API_BASE_URL = String(process.env.EXPO_PUBLIC_GEMMA_API_BASE_URL || '').trim();
export const GEMMA_API_KEY = String(process.env.EXPO_PUBLIC_GEMMA_API_KEY || '').trim();
export const GEMMA_API_MODEL = String(process.env.EXPO_PUBLIC_GEMMA_API_MODEL || 'gemma-4-E4B-it-GGUF').trim();

export const GEMMA_API_TEXT_ENDPOINT = String(
  process.env.EXPO_PUBLIC_GEMMA_API_TEXT_ENDPOINT || '/v1/gemma/text'
).trim();

export const GEMMA_API_VISION_ENDPOINT = String(
  process.env.EXPO_PUBLIC_GEMMA_API_VISION_ENDPOINT || '/v1/gemma/vision'
).trim();

export const GEMMA_API_DOCUMENT_ENDPOINT = String(
  process.env.EXPO_PUBLIC_GEMMA_API_DOCUMENT_ENDPOINT || '/v1/gemma/document'
).trim();

const timeoutRaw = Number(process.env.EXPO_PUBLIC_GEMMA_API_TIMEOUT_MS || 45000);
export const GEMMA_API_TIMEOUT_MS = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45000;
