/**
 * ModelContext — React context for managing on-device LLM state.
 * Provides model loading status, initialization, and inference
 * capabilities to the entire component tree.
 *
 * On Android the Gemma model isn't part of the app; when it's missing the
 * context reports needsDownload and exposes the download controls from
 * ModelSetup. Once the download finishes the model loads automatically.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import llamaService from '../services/LlamaService';
import { deleteDownloadedModel, modelDownloader } from '../services/ModelSetup';

const ModelContext = createContext();

export function ModelProvider({ children }) {
  const [modelStatus, setModelStatus] = useState('idle'); // idle | loading | ready | error
  const [modelError, setModelError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [needsDownload, setNeedsDownload] = useState(false);
  const [download, setDownload] = useState(modelDownloader.state);
  const initAttempted = useRef(false);

  // Subscribe to LlamaService status changes
  useEffect(() => {
    const unsubscribe = llamaService.subscribe(({ status, error, progress }) => {
      setModelStatus(status);
      setModelError(error);
      if (status === 'loading') {
        const pct = Math.round((progress || 0) * 100);
        setLoadingPercent(pct);
        setLoadingProgress(
          pct > 0 ? `Loading Gemma model… ${pct}%` : 'Locating model file…'
        );
      }
      if (status === 'ready') { setLoadingProgress(''); setLoadingPercent(100); }
      if (status === 'error') { setLoadingProgress(''); setLoadingPercent(0); }
    });
    return unsubscribe;
  }, []);

  useEffect(() => modelDownloader.subscribe(setDownload), []);

  /**
   * Initialize the model. Safe to call multiple times — will only load once.
   * When the model hasn't been downloaded yet, nothing loads and needsDownload is set.
   * @param {string} [modelPath] - Optional override path
   */
  const initializeModel = useCallback(async (modelPath = null) => {
    if (initAttempted.current && llamaService.isReady) return;

    if (!modelPath && llamaService.checkDeviceCanRunLiteRT().ok && !(await llamaService.isModelDownloaded())) {
      setNeedsDownload(true);
      await modelDownloader.loadSavedProgress();
      return;
    }
    setNeedsDownload(false);
    initAttempted.current = true;

    try {
      setLoadingProgress('Locating model file…');
      await llamaService.initialize(modelPath);
    } catch (error) {
      console.warn('[ModelContext] Model initialization failed:', error.message);
      // Don't rethrow — the app works fine without the model (fallback mode)
    }
  }, []);

  // Load the model as soon as its download finishes.
  useEffect(() => {
    if (download.status === 'done' && needsDownload) initializeModel();
  }, [download.status, needsDownload, initializeModel]);

  const startModelDownload = useCallback(() => modelDownloader.start(), []);
  const pauseModelDownload = useCallback(() => modelDownloader.pause(), []);
  const cancelModelDownload = useCallback(() => modelDownloader.cancel(), []);

  /** Release the model and free memory */
  const releaseModel = useCallback(async () => {
    await llamaService.release();
    initAttempted.current = false;
  }, []);

  /** Remove the downloaded model to free space; explanations fall back to the standard ones. */
  const removeModel = useCallback(async () => {
    await releaseModel();
    await deleteDownloadedModel();
    setNeedsDownload(true);
  }, [releaseModel]);

  /** Whether the model is loaded and ready for inference */
  const isModelReady = modelStatus === 'ready';

  /** Whether we're currently loading the model */
  const isModelLoading = modelStatus === 'loading';

  return (
    <ModelContext.Provider
      value={{
        modelStatus,
        modelError,
        loadingProgress,
        loadingPercent,
        isModelReady,
        isModelLoading,
        initializeModel,
        releaseModel,
        needsDownload,
        download,
        startModelDownload,
        pauseModelDownload,
        cancelModelDownload,
        removeModel,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
