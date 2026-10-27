/**
 * Akan (Twi) TTS Service
 * Pipeline: English text → MADLAD400 translation → MMS-TTS (Gradio) audio → expo-av playback
 *
 * Uses:
 * - google/madlad400-3b-mt via HF Inference for English → Akan translation
 * - dpc/mmstts Gradio Space for Akan speech synthesis (hosts facebook/mms-tts-*)
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';

// ── Config ──────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_HF_API_TOKEN in .env.local. Do not commit real tokens.
const HF_API_TOKEN = String(process.env.EXPO_PUBLIC_HF_API_TOKEN || '').trim();

const TRANSLATION_MODEL = 'google/madlad400-3b-mt';
const HF_BASE = 'https://router.huggingface.co/hf-inference/models';

// Gradio Space hosting MMS-TTS with 1000+ languages including Akan
const GRADIO_TTS_URL = 'https://dpc-mmstts.hf.space/api/predict';
const GRADIO_FILE_BASE = 'https://dpc-mmstts.hf.space/file=';
const AKAN_LANGUAGE_LABEL = 'Akan (aka)';

const MAX_RETRIES = 2;
const MODEL_LOAD_WAIT_MS = 20000;

// ── Translation Cache ───────────────────────────────────────────────────────
// Avoid re-translating identical text during the session
const translationCache = new Map();
const audioCache = new Map();

/**
 * Build auth headers for HF API
 */
function getHeaders(contentType = 'application/json') {
  const headers = { 'Content-Type': contentType };
  if (HF_API_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_API_TOKEN}`;
  }
  return headers;
}

/**
 * Translate English text to Akan (Twi) using MADLAD400.
 * Uses the <2ak> language-prefix format for Akan translation.
 * Falls back to the original text if translation fails.
 */
export async function translateToAkan(englishText) {
  if (translationCache.has(englishText)) {
    return translationCache.get(englishText);
  }

  // MADLAD400 uses language tag prefixes: "<2ak> text to translate"
  const response = await fetch(`${HF_BASE}/${TRANSLATION_MODEL}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      inputs: `<2ak> ${englishText}`,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 503) {
      throw new Error('MODEL_LOADING');
    }
    throw new Error(`MADLAD400 translation failed (${response.status}): ${errBody}`);
  }

  const result = await response.json();
  const translated = result[0]?.translation_text || englishText;
  translationCache.set(englishText, translated);
  return translated;
}

/**
 * Generate Akan speech audio from Akan text using MMS-TTS via Gradio Space.
 * Two-step process: POST to get file reference, then download the WAV file.
 * Returns a local file URI pointing to the WAV audio.
 */
export async function generateAkanAudio(akanText) {
  if (audioCache.has(akanText)) {
    // Check if cached file still exists
    const cached = audioCache.get(akanText);
    const info = await FileSystem.getInfoAsync(cached);
    if (info.exists) return cached;
  }

  // Step 1: Request TTS from Gradio Space
  const response = await fetch(GRADIO_TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [akanText, AKAN_LANGUAGE_LABEL] }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 503 || response.status === 502) {
      throw new Error('MODEL_LOADING');
    }
    throw new Error(`MMS-TTS Gradio failed (${response.status}): ${errBody}`);
  }

  const result = await response.json();
  const fileRef = result?.data?.[0];

  if (!fileRef?.name) {
    throw new Error('MMS-TTS Gradio returned no audio file reference');
  }

  // Step 2: Download the WAV file from the Gradio Space
  const remoteUrl = `${GRADIO_FILE_BASE}${fileRef.name}`;
  const fileUri = `${FileSystem.cacheDirectory}akan_tts_${Date.now()}.wav`;

  const downloadResult = await FileSystem.downloadAsync(remoteUrl, fileUri);

  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download TTS audio (${downloadResult.status})`);
  }

  audioCache.set(akanText, fileUri);
  return fileUri;
}

/**
 * Full pipeline: text → Akan audio file URI.
 *
 * If `akanText` is provided directly (e.g. from mockData), skips translation.
 * If `englishText` is provided, translates first via MADLAD400.
 *
 * @param {Object} options
 * @param {string} [options.englishText] - English source text to translate
 * @param {string} [options.akanText]    - Pre-existing Akan text (skips NLLB)
 * @param {function} [options.onStatus]  - Status callback: 'translating' | 'generating' | 'playing' | 'done' | 'error' | 'model_loading'
 * @returns {{ audioUri: string, akanText: string, sound: Audio.Sound }}
 */
export async function speakAkan({ englishText, akanText, onStatus }, retryCount = 0) {
  try {
    // Step 1: Get Akan text (translate if needed)
    let textToSpeak = akanText;
    if (!textToSpeak && englishText) {
      onStatus?.('translating');
      textToSpeak = await translateToAkan(englishText);
    }

    if (!textToSpeak) {
      throw new Error('No text provided for Akan TTS');
    }

    // Step 2: Generate audio via MMS-TTS
    onStatus?.('generating');
    const audioUri = await generateAkanAudio(textToSpeak);

    // Step 3: Play audio via expo-av
    onStatus?.('playing');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true }
    );

    // Return sound for external stop/cleanup control
    return { audioUri, akanText: textToSpeak, sound };
  } catch (error) {
    if (error.message === 'MODEL_LOADING' && retryCount < MAX_RETRIES) {
      onStatus?.('model_loading');
      await new Promise((r) => setTimeout(r, MODEL_LOAD_WAIT_MS));
      return speakAkan({ englishText, akanText, onStatus }, retryCount + 1);
    }
    onStatus?.('error');
    throw error;
  }
}

/**
 * Clean up cached audio files (call on unmount or periodically)
 */
export async function clearAkanAudioCache() {
  for (const uri of audioCache.values()) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
  audioCache.clear();
}
