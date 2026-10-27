/**
 * ModelContext — React context for managing on-device LLM state.
 * Provides model loading status, initialization, and inference
 * capabilities to the entire component tree.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import llamaService from '../services/LlamaService';

const ModelContext = createContext();

export function ModelProvider({ children }) {
  const [modelStatus, setModelStatus] = useState('idle'); // idle | loading | ready | error
  const [modelError, setModelError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [loadingPercent, setLoadingPercent] = useState(0);
  const initAttempted = useRef(false);

  // Subscribe to LlamaService status changes
  useEffect(() => {
    const unsubscribe = llamaService.subscribe(({ status, error, progress }) => {
      setModelStatus(status);
      setModelError(error);
      if (status === 'loading') {
        const isRemote = llamaService.provider === 'remote';
        const pct = Math.round((progress || 0) * 100);
        setLoadingPercent(pct);
        setLoadingProgress(
          pct > 0
            ? (isRemote ? `Connecting to Gemma API… ${pct}%` : `Loading MedGemma model… ${pct}%`)
            : (isRemote ? 'Checking Gemma API configuration…' : 'Locating model file…')
        );
      }
      if (status === 'ready') { setLoadingProgress(''); setLoadingPercent(100); }
      if (status === 'error') { setLoadingProgress(''); setLoadingPercent(0); }
    });
    return unsubscribe;
  }, []);

  /**
   * Initialize the model. Safe to call multiple times — will only load once.
   * @param {string} [modelPath] - Optional override path
   */
  const initializeModel = useCallback(async (modelPath = null) => {
    if (initAttempted.current && llamaService.isReady) return;
    initAttempted.current = true;

    try {
      setLoadingProgress(
        llamaService.provider === 'remote'
          ? 'Checking Gemma API configuration…'
          : 'Locating model file…'
      );
      await llamaService.initialize(modelPath);
    } catch (error) {
      console.warn('[ModelContext] Model initialization failed:', error.message);
      // Don't rethrow — the app works fine without the model (fallback mode)
    }
  }, []);

  /** Release the model and free memory */
  const releaseModel = useCallback(async () => {
    await llamaService.release();
    initAttempted.current = false;
  }, []);

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
