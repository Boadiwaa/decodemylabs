/**
 * ModelSetup — downloads the Gemma 4 LiteRT model the first time it's needed (Android).
 *
 * The model (~2.6 GB) is too large to ship inside the app, so it's fetched once
 * from Hugging Face, pinned to a fixed revision, into the folder LiteRTService
 * already checks. The download is a plain file request: nothing about the
 * patient is sent.
 *
 * It downloads to a ".part" file first and only moves it into place once the
 * size matches, so a half-finished file is never loaded. If the download
 * stops (paused, connection lost, app closed), it carries on from the bytes
 * already saved the next time it starts.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { LITERT_MODEL_FILENAME } from '../constants/inference';

const MODEL_REPO = 'litert-community/gemma-4-E2B-it-litert-lm';
// The 1 April 2026 upload: the file tested on device (sha256 ab7838cd…27e42).
// Uploads from May 2026 on add a multi-size vision encoder that litertlm-android
// 0.10.2 refuses ("Vision Encoder model must have exactly one signature but got 3").
// Only move this forward together with a LiteRT upgrade, and test on a phone.
const MODEL_REVISION = '7fa1d78473894f7e736a21d920c3aa80f950c0db';

export const MODEL_DOWNLOAD = {
  url: `https://huggingface.co/${MODEL_REPO}/resolve/${MODEL_REVISION}/gemma-4-E2B-it.litertlm`,
  bytes: 2583085056,
};

// Leave room on the phone after the download so other apps keep working.
const SPACE_MARGIN_BYTES = 500 * 1024 * 1024;

const targetPath = () => `${FileSystem.documentDirectory}${LITERT_MODEL_FILENAME}`;
const partPath = () => `${targetPath()}.part`;

/** "2.6 GB" style size for patient-facing text. */
export function formatGB(bytes) {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

async function fileSize(uri) {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? info.size || 0 : 0;
}

/**
 * Download state shared with the UI.
 * status: idle | downloading | paused | done | error
 */
class ModelDownloader {
  constructor() {
    this._state = { status: 'idle', bytesWritten: 0, totalBytes: MODEL_DOWNLOAD.bytes, error: null };
    this._listeners = new Set();
    this._resumable = null;
    this._pausing = false;
    this._lastNotifiedAt = 0;
  }

  get state() {
    return this._state;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    fn(this._state);
    return () => this._listeners.delete(fn);
  }

  _set(patch) {
    this._state = { ...this._state, ...patch };
    this._listeners.forEach((fn) => {
      try { fn(this._state); } catch (_) {}
    });
  }

  /** Bytes already saved from an earlier, unfinished download (shown as "paused"). */
  async loadSavedProgress() {
    if (this._state.status !== 'idle') return;
    const saved = await fileSize(partPath());
    if (saved > 0) this._set({ status: 'paused', bytesWritten: saved });
  }

  /** Start, or continue, the download. Resolves when it finishes, pauses or fails. */
  async start() {
    if (this._state.status === 'downloading') return;
    this._pausing = false;

    const already = await fileSize(partPath());
    const free = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
    const needed = MODEL_DOWNLOAD.bytes - already + SPACE_MARGIN_BYTES;
    if (free != null && free < needed) {
      this._set({
        status: 'error',
        bytesWritten: already,
        error: `This needs about ${formatGB(needed)} of free space and your phone has ${formatGB(free)}. `
          + 'Free up some space, then try again.',
      });
      return;
    }

    this._set({ status: 'downloading', bytesWritten: already, error: null });

    const onProgress = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      // Android already adds the resumed bytes; guard in case a platform counts only new ones.
      const resumedCount = totalBytesExpectedToWrite > 0 && totalBytesExpectedToWrite < MODEL_DOWNLOAD.bytes - 1;
      const written = resumedCount ? already + totalBytesWritten : totalBytesWritten;
      const now = Date.now();
      if (now - this._lastNotifiedAt < 500) return;
      this._lastNotifiedAt = now;
      this._set({ bytesWritten: Math.min(written, MODEL_DOWNLOAD.bytes) });
    };

    try {
      // Android continues from resumeData = bytes already on disk (sent as a Range request).
      this._resumable = FileSystem.createDownloadResumable(
        MODEL_DOWNLOAD.url,
        partPath(),
        {},
        onProgress,
        already > 0 ? String(already) : undefined,
      );
      const result = already > 0 ? await this._resumable.resumeAsync() : await this._resumable.downloadAsync();
      this._resumable = null;

      if (this._pausing || !result) {
        this._set({ status: 'paused', bytesWritten: await fileSize(partPath()) });
        return;
      }

      const size = await fileSize(partPath());
      if (size !== MODEL_DOWNLOAD.bytes) {
        // A wrong size means the pieces don't line up; start again rather than load a broken file.
        await FileSystem.deleteAsync(partPath(), { idempotent: true });
        this._set({
          status: 'error',
          bytesWritten: 0,
          error: "The download didn't finish properly. Please try again.",
        });
        return;
      }

      await FileSystem.deleteAsync(targetPath(), { idempotent: true });
      await FileSystem.moveAsync({ from: partPath(), to: targetPath() });
      this._set({ status: 'done', bytesWritten: MODEL_DOWNLOAD.bytes });
    } catch (e) {
      this._resumable = null;
      if (this._pausing) {
        this._set({ status: 'paused', bytesWritten: await fileSize(partPath()) });
        return;
      }
      console.warn('[ModelSetup] Download stopped:', e.message);
      this._set({
        status: 'error',
        bytesWritten: await fileSize(partPath()),
        error: 'The download stopped. Check your internet connection, then tap Resume. '
          + "You won't lose what's already downloaded.",
      });
    }
  }

  /** Pause; what's downloaded so far is kept. */
  async pause() {
    if (!this._resumable) return;
    this._pausing = true;
    try {
      await this._resumable.pauseAsync();
    } catch (e) {
      console.warn('[ModelSetup] Pause failed:', e.message);
    }
  }

  /** Stop and delete the unfinished download. */
  async cancel() {
    await this.pause();
    await FileSystem.deleteAsync(partPath(), { idempotent: true });
    this._set({ status: 'idle', bytesWritten: 0, error: null });
  }
}

export const modelDownloader = new ModelDownloader();

/**
 * Delete the downloaded model to free space. The app falls back to standard explanations.
 * LiteRT also writes cache files next to the model (about 1 GB); they belong to
 * this model file, so they go too.
 */
export async function deleteDownloadedModel() {
  await modelDownloader.cancel();
  await FileSystem.deleteAsync(targetPath(), { idempotent: true });
  try {
    const names = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    await Promise.all(names
      .filter((name) => name.startsWith(LITERT_MODEL_FILENAME) && name.includes('xnnpack_cache'))
      .map((name) => FileSystem.deleteAsync(`${FileSystem.documentDirectory}${name}`, { idempotent: true })));
  } catch (e) {
    console.warn('[ModelSetup] Could not clear model cache files:', e.message);
  }
}
