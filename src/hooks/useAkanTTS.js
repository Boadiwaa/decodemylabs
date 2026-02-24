/**
 * useAkanTTS — hook for the Akan (Twi) TTS pipeline.
 *
 * Wraps AkanTTSService with React state for loading indicators,
 * playback control, cleanup, and the translated Akan text.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { speakAkan, clearAkanAudioCache } from '../services/AkanTTSService';

/**
 * @returns {{
 *   speak: (opts: { englishText?: string, akanText?: string }) => Promise<void>,
 *   stop: () => Promise<void>,
 *   status: string,
 *   akanText: string | null,
 *   isLoading: boolean,
 *   isPlaying: boolean,
 * }}
 */
export default function useAkanTTS() {
  const [status, setStatus] = useState('idle');
  // idle | translating | generating | playing | model_loading | done | error
  const [akanText, setAkanText] = useState(null);
  const soundRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
      }
      clearAkanAudioCache();
    };
  }, []);

  const speak = useCallback(async ({ englishText, akanText: inputAkanText }) => {
    // Stop any previous playback
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // ignore cleanup errors
      }
      soundRef.current = null;
    }

    try {
      const result = await speakAkan({
        englishText,
        akanText: inputAkanText,
        onStatus: setStatus,
      });

      soundRef.current = result.sound;
      setAkanText(result.akanText);

      // Listen for playback completion
      result.sound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (playbackStatus.didJustFinish) {
          setStatus('done');
          soundRef.current = null;
          result.sound.unloadAsync().catch(() => {});
        }
      });
    } catch (error) {
      console.error('[useAkanTTS] Pipeline error:', error);
      setStatus('error');
    }
  }, []);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // ignore
      }
      soundRef.current = null;
    }
    setStatus('idle');
  }, []);

  const isLoading = ['translating', 'generating', 'model_loading'].includes(status);
  const isPlaying = status === 'playing';

  return { speak, stop, status, akanText, isLoading, isPlaying };
}
