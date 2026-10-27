import { requireNativeModule } from 'expo-modules-core';

let ExpoLiteRT = null;
try {
  ExpoLiteRT = requireNativeModule('ExpoLiteRT');
} catch (error) {
  console.warn('[ExpoLiteRT] Native module unavailable.', error?.message || error);
}

function ensureModule() {
  if (!ExpoLiteRT) {
    throw new Error('ExpoLiteRT native module is not available in this build.');
  }
  return ExpoLiteRT;
}

export function hasNativeLiteRT() {
  return Boolean(ExpoLiteRT);
}

export async function initializeLiteRT(modelPath) {
  const module = ensureModule();
  if (typeof module.initialize === 'function') {
    return module.initialize({ modelPath });
  }
  if (typeof module.init === 'function') {
    return module.init(modelPath);
  }
  throw new Error('ExpoLiteRT initialize/init method is missing.');
}

export async function completeLiteRT(prompt, params = {}) {
  const module = ensureModule();
  if (typeof module.complete === 'function') {
    return module.complete({ prompt, params });
  }
  if (typeof module.generateText === 'function') {
    return module.generateText({ prompt, params });
  }
  if (typeof module.inferText === 'function') {
    return module.inferText({ prompt, params });
  }
  throw new Error('ExpoLiteRT text inference method is missing.');
}

export async function completeLiteRTWithImage(systemPrompt, userText, imageUri, params = {}) {
  const module = ensureModule();
  const payload = { systemPrompt, userText, imageUri, params };

  if (typeof module.completeWithImage === 'function') {
    return module.completeWithImage(payload);
  }
  if (typeof module.inferImage === 'function') {
    return module.inferImage(payload);
  }
  if (typeof module.analyzeImage === 'function') {
    return module.analyzeImage(payload);
  }
  throw new Error('ExpoLiteRT image inference method is missing.');
}

export async function completeLiteRTWithPdf(systemPrompt, userText, pdfUri, params = {}) {
  const module = ensureModule();
  const payload = { systemPrompt, userText, pdfUri, params };

  if (typeof module.completeWithPdf === 'function') {
    return module.completeWithPdf(payload);
  }
  if (typeof module.inferDocument === 'function') {
    return module.inferDocument(payload);
  }
  if (typeof module.analyzeDocument === 'function') {
    return module.analyzeDocument(payload);
  }
  throw new Error('ExpoLiteRT PDF inference method is missing.');
}

export async function releaseLiteRT() {
  const module = ensureModule();
  if (typeof module.release === 'function') {
    return module.release();
  }
  if (typeof module.shutdown === 'function') {
    return module.shutdown();
  }
  return null;
}

export default ExpoLiteRT;
