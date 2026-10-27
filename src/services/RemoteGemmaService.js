import * as FileSystem from 'expo-file-system/legacy';
import {
  GEMMA_API_BASE_URL,
  GEMMA_API_KEY,
  GEMMA_API_MODEL,
  GEMMA_API_TEXT_ENDPOINT,
  GEMMA_API_VISION_ENDPOINT,
  GEMMA_API_DOCUMENT_ENDPOINT,
  GEMMA_API_TIMEOUT_MS,
} from '../constants/inference';

function normalizeFileUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('data:')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

function inferImageMimeType(uri) {
  const lower = String(uri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function inferDocumentMimeType(uri) {
  const lower = String(uri || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function joinUrl(baseUrl, endpoint) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const path = String(endpoint || '').startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

function extractModelText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;

  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (typeof payload.outputText === 'string') return payload.outputText;
  if (typeof payload.output?.text === 'string') return payload.output.text;

  const candidates = payload.candidates || payload.output?.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const first = candidates[0];
    if (typeof first?.text === 'string') return first.text;
    if (typeof first?.output_text === 'string') return first.output_text;

    const parts = first?.content?.parts;
    if (Array.isArray(parts)) {
      const partText = parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n');
      if (partText) return partText;
    }
  }

  return '';
}

class RemoteGemmaService {
  constructor() {
    this._baseUrl = GEMMA_API_BASE_URL;
    this._apiKey = GEMMA_API_KEY;
    this._model = GEMMA_API_MODEL;
  }

  get isConfigured() {
    return Boolean(this._baseUrl && this._apiKey);
  }

  async initialize() {
    if (!this.isConfigured) {
      throw new Error(
        'Remote Gemma is not configured. Set EXPO_PUBLIC_GEMMA_API_BASE_URL and EXPO_PUBLIC_GEMMA_API_KEY.'
      );
    }
    return true;
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this._apiKey}`,
    };
  }

  async _postJson(endpoint, payload, timeoutMs = GEMMA_API_TIMEOUT_MS) {
    const url = joinUrl(this._baseUrl, endpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_) {
        data = { text: raw };
      }

      if (!response.ok) {
        const message = data?.error?.message || data?.error || raw || `Gemma API error (${response.status})`;
        throw new Error(String(message).slice(0, 300));
      }

      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Gemma API timeout after ${timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async complete(prompt, params = {}, onToken = null) {
    await this.initialize();

    const payload = {
      model: this._model,
      input: {
        type: 'text',
        prompt,
      },
      generationConfig: {
        maxOutputTokens: params.n_predict || 1024,
        temperature: params.temperature ?? 0.3,
        topP: params.top_p ?? 0.9,
        topK: params.top_k ?? 40,
      },
    };

    const response = await this._postJson(GEMMA_API_TEXT_ENDPOINT, payload, GEMMA_API_TIMEOUT_MS);
    const text = extractModelText(response);

    if (!text) {
      throw new Error('Gemma API returned an empty text response');
    }

    if (onToken) {
      // API path is non-streaming for now; emit once for compatibility.
      onToken(text, text);
    }

    return text;
  }

  async completeWithImage(systemPrompt, userText, imageUri, params = {}) {
    await this.initialize();

    const normalizedUri = normalizeFileUri(imageUri);
    const imageData = await FileSystem.readAsStringAsync(normalizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!imageData) {
      throw new Error('Could not read image data for remote Gemma request');
    }

    const payload = {
      model: this._model,
      input: {
        type: 'multimodal',
        systemPrompt,
        userText,
        image: {
          mimeType: inferImageMimeType(normalizedUri),
          data: imageData,
        },
      },
      generationConfig: {
        maxOutputTokens: params.n_predict || 1536,
        temperature: params.temperature ?? 0.1,
        topP: params.top_p ?? 0.9,
        topK: params.top_k ?? 40,
      },
    };

    const response = await this._postJson(GEMMA_API_VISION_ENDPOINT, payload, GEMMA_API_TIMEOUT_MS);
    const text = extractModelText(response);

    if (!text) {
      throw new Error('Gemma API returned an empty multimodal response');
    }

    return text;
  }

  async completeWithPdf(systemPrompt, userText, pdfUri, params = {}) {
    await this.initialize();

    const normalizedUri = normalizeFileUri(pdfUri);
    const documentData = await FileSystem.readAsStringAsync(normalizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!documentData) {
      throw new Error('Could not read PDF data for remote Gemma request');
    }

    const mimeType = inferDocumentMimeType(normalizedUri);
    const payload = {
      model: this._model,
      input: {
        type: 'multimodal',
        systemPrompt,
        userText,
        document: {
          mimeType,
          data: documentData,
        },
      },
      generationConfig: {
        maxOutputTokens: params.n_predict || 1800,
        temperature: params.temperature ?? 0.1,
        topP: params.top_p ?? 0.9,
        topK: params.top_k ?? 40,
      },
    };

    const endpoint = GEMMA_API_DOCUMENT_ENDPOINT || GEMMA_API_VISION_ENDPOINT;
    const response = await this._postJson(endpoint, payload, GEMMA_API_TIMEOUT_MS);
    const text = extractModelText(response);

    if (!text) {
      throw new Error('Gemma API returned an empty PDF multimodal response');
    }

    return text;
  }
}

const remoteGemmaService = new RemoteGemmaService();
export default remoteGemmaService;
