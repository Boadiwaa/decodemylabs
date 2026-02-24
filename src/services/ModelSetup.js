/**
 * Model setup utilities for development.
 *
 * During development, the GGUF model needs to be accessible on the device.
 * This module provides helpers to:
 * 1. Check if the model exists in the app's documents directory
 * 2. Copy the model from a source path (for dev/testing)
 * 3. Report model file info
 *
 * In production, the model would be downloaded from a CDN on first launch.
 */

import * as FileSystem from 'expo-file-system/legacy';

const MODEL_FILENAME = 'medgemma-1.5-4b-it-Q5_K_M.gguf';

/** Get the target path where the model should live */
export function getModelTargetPath() {
  return `${FileSystem.documentDirectory}${MODEL_FILENAME}`;
}

/** Check if the model is already in the documents directory */
export async function isModelAvailable() {
  const path = getModelTargetPath();
  const info = await FileSystem.getInfoAsync(path);
  return {
    exists: info.exists,
    path,
    size: info.exists ? info.size : 0,
    sizeGB: info.exists ? (info.size / (1024 * 1024 * 1024)).toFixed(2) : '0',
  };
}

/**
 * Copy the model from a source URI to the documents directory.
 * Useful for development when the model file is on the host machine.
 *
 * @param {string} sourceUri - file:// URI or http(s):// URL
 * @param {function} [onProgress] - Progress callback ({ totalBytesWritten, totalBytesExpectedToWrite })
 * @returns {Promise<string>} The destination path
 */
export async function copyModelToDocuments(sourceUri, onProgress = null) {
  const target = getModelTargetPath();

  // Check if already exists
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) {
    console.log('[ModelSetup] Model already exists at:', target);
    return target;
  }

  if (sourceUri.startsWith('http')) {
    // Download from URL
    const downloadResumable = FileSystem.createDownloadResumable(
      sourceUri,
      target,
      {},
      onProgress
        ? (progress) => onProgress({
            totalBytesWritten: progress.totalBytesWritten,
            totalBytesExpectedToWrite: progress.totalBytesExpectedToWrite,
            percent: ((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100).toFixed(1),
          })
        : undefined
    );
    const result = await downloadResumable.downloadAsync();
    return result.uri;
  } else {
    // Copy from local file
    await FileSystem.copyAsync({ from: sourceUri, to: target });
    return target;
  }
}

/** Delete the model from documents directory (free space) */
export async function deleteModel() {
  const target = getModelTargetPath();
  const info = await FileSystem.getInfoAsync(target);
  if (info.exists) {
    await FileSystem.deleteAsync(target);
    console.log('[ModelSetup] Model deleted from:', target);
  }
}

/** Get model info for debugging */
export async function getModelInfo() {
  const targetInfo = await isModelAvailable();
  return {
    filename: MODEL_FILENAME,
    documentsDir: FileSystem.documentDirectory,
    ...targetInfo,
  };
}
