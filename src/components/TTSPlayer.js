import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getLanguageLabel } from '../utils/helpers';
import useAkanTTS from '../hooks/useAkanTTS';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const LANGUAGES = ['en', 'fr', 'ak'];
const LANG_CODES = { en: 'en-US', fr: 'fr-FR' };

const AKAN_STATUS_LABELS = {
  translating: 'Translating to Twi…',
  generating: 'Generating Twi audio…',
  model_loading: 'Loading model (first time)…',
  error: 'Akan TTS failed — tap to retry',
};

export default function TTSPlayer({ explanations }) {
  const [selectedLang, setSelectedLang] = useState('en');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const waveAnim = useSharedValue(1);

  // Akan TTS pipeline (HF API: NLLB translation + MMS-TTS audio)
  const akan = useAkanTTS();

  // Unified playing state: either expo-speech or akan pipeline
  const effectivePlaying = selectedLang === 'ak' ? akan.isPlaying : isPlaying;
  const effectiveLoading = selectedLang === 'ak' && akan.isLoading;

  // Set up audio session on mount — required for physical iOS devices
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        setAudioReady(true);
      } catch (e) {
        console.warn('[TTS] Audio session setup error:', e);
        setAudioReady(true);
      }
    };
    setupAudio();
    return () => { Speech.stop(); };
  }, []);

  useEffect(() => {
    if (effectivePlaying) {
      waveAnim.value = withRepeat(withTiming(1.4, { duration: 400 }), -1, true);
    } else {
      cancelAnimation(waveAnim);
      waveAnim.value = withTiming(1, { duration: 200 });
    }
  }, [effectivePlaying]);

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: waveAnim.value }],
  }));

  // ── Akan playback (HF API pipeline) ────────────────────────────────────
  const handlePlayAkan = async () => {
    if (akan.isPlaying) {
      akan.stop();
      return;
    }

    const akanText = explanations.ak;
    const englishText = explanations.en;

    // If we have pre-written Akan text in mockData, use it directly (skip NLLB).
    // Otherwise, translate from English via NLLB.
    await akan.speak({
      akanText: akanText || undefined,
      englishText: !akanText ? englishText : undefined,
    });
  };

  // ── English / French playback (expo-speech) ────────────────────────────
  const handlePlaySpeech = async () => {
    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
      return;
    }

    const rawText = explanations[selectedLang] || explanations.en;
    const text = rawText.replace(/\*\*/g, '').replace(/\*/g, '');

    // Re-ensure audio session before speaking (physical device workaround)
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (_) {}

    setIsPlaying(true);

    let langCode = LANG_CODES[selectedLang];
    try {
      const voices = await Speech.getAvailableVoicesAsync();

      // On physical iOS devices, prefer Enhanced voice if available
      if (Platform.OS === 'ios') {
        const preferredVoice = voices.find(
          v => v.language === langCode && v.quality === 'Enhanced'
        ) || voices.find(
          v => v.language === langCode
        );
        if (preferredVoice) {
          Speech.speak(text, {
            voice: preferredVoice.identifier,
            rate: 0.85,
            pitch: 1.0,
            onDone: () => setIsPlaying(false),
            onError: (e) => { console.warn('[TTS] error:', e); setIsPlaying(false); },
            onStopped: () => setIsPlaying(false),
          });
          return;
        }
      }
    } catch (e) {
      console.warn('[TTS] Voice enumeration error:', e);
    }

    // Fallback: use language code directly
    Speech.speak(text, {
      language: langCode,
      rate: 0.85,
      pitch: 1.0,
      onDone: () => setIsPlaying(false),
      onError: (e) => { console.warn('[TTS] error:', e); setIsPlaying(false); },
      onStopped: () => setIsPlaying(false),
    });
  };

  // ── Unified play handler ───────────────────────────────────────────────
  const handlePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (selectedLang === 'ak') {
      await handlePlayAkan();
    } else {
      await handlePlaySpeech();
    }
  };

  const selectLang = (lang) => {
    // Stop whatever is currently playing
    if (isPlaying) { Speech.stop(); setIsPlaying(false); }
    if (akan.isPlaying || akan.isLoading) { akan.stop(); }
    Haptics.selectionAsync();
    setSelectedLang(lang);
  };

  // ── Button label ──────────────────────────────────────────────────────
  const getButtonLabel = () => {
    if (selectedLang === 'ak') {
      if (akan.isLoading) return AKAN_STATUS_LABELS[akan.status] || 'Preparing…';
      if (akan.isPlaying) return 'Stop';
      if (akan.status === 'error') return AKAN_STATUS_LABELS.error;
      return 'Play in Akan (Twi)';
    }
    return effectivePlaying ? 'Stop' : `Play in ${getLanguageLabel(selectedLang)}`;
  };

  return (
    <Animated.View entering={FadeIn.delay(300)} style={styles.container}>
      <Text style={styles.title}>🔊 Listen to Explanation</Text>

      {/* Language selector */}
      <View style={styles.langRow}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang}
            onPress={() => selectLang(lang)}
            style={[styles.langBtn, selectedLang === lang && styles.langBtnActive]}
            accessibilityLabel={`Select ${getLanguageLabel(lang)}`}
          >
            <Text style={[styles.langBtnText, selectedLang === lang && styles.langBtnTextActive]}>
              {lang === 'en' ? '🇬🇧' : lang === 'fr' ? '🇫🇷' : '🇬🇭'} {getLanguageLabel(lang)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Explanation text */}
      <View style={styles.textBox}>
        <Text style={styles.explanationText}>
          {explanations[selectedLang] || explanations.en}
        </Text>
      </View>

      {/* Play button */}
      <TouchableOpacity
        onPress={handlePlay}
        activeOpacity={0.8}
        disabled={effectiveLoading}
        style={[
          styles.playBtn,
          effectivePlaying && styles.playBtnActive,
          effectiveLoading && styles.playBtnLoading,
        ]}
        accessibilityLabel={
          effectivePlaying ? 'Stop playback' : `Play explanation in ${getLanguageLabel(selectedLang)}`
        }
        accessibilityRole="button"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {effectiveLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={effectivePlaying ? 'stop' : 'play'} size={20} color="#fff" />
          )}
          <Text style={styles.playBtnText}>
            {getButtonLabel()}
          </Text>
          {effectivePlaying && (
            <Animated.View style={[styles.waveContainer, waveStyle]}>
              {[8, 16, 12, 20, 10].map((h, i) => (
                <View key={i} style={[styles.waveBar, { height: h }]} />
              ))}
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>

      {/* Akan subtitle — show translated text while playing */}
      {selectedLang === 'ak' && akan.akanText && akan.isPlaying && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.akanSubtitle}>
          <Text style={styles.akanSubtitleLabel}>🇬🇭 Twi text:</Text>
          <Text style={styles.akanSubtitleText}>{akan.akanText}</Text>
        </Animated.View>
      )}

      {selectedLang === 'ak' && !akan.isPlaying && !akan.isLoading && (
        <Text style={styles.akanNote}>
          ⓘ Akan speech is generated via AI — requires internet connection.
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.tealLight, borderRadius: 20, padding: 18,
    marginHorizontal: 16, marginTop: 12,
    borderWidth: 1, borderColor: Colors.tealMuted,
  },
  title: { fontFamily: Typography.serif, fontSize: 15, fontWeight: '700', color: Colors.navy, marginBottom: 12 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  langBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  langBtnActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  langBtnText: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
  langBtnTextActive: { color: '#fff' },
  textBox: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 12,
  },
  explanationText: { ...Typography.bodySmall, color: Colors.textPrimary, fontWeight: '500', lineHeight: 20 },
  playBtn: {
    backgroundColor: Colors.tealDark, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.tealDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  playBtnActive: { backgroundColor: Colors.danger },
  playBtnLoading: { backgroundColor: Colors.textMuted, opacity: 0.85 },
  playBtnText: { ...Typography.button, color: '#fff', fontSize: 15 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.8)' },
  akanSubtitle: {
    marginTop: 10, backgroundColor: Colors.white, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.tealMuted,
  },
  akanSubtitleLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.tealDark, marginBottom: 4,
  },
  akanSubtitleText: {
    ...Typography.bodySmall, color: Colors.textPrimary, lineHeight: 20,
  },
  akanNote: { ...Typography.caption, color: Colors.textSecondary, fontSize: 10, marginTop: 8, fontStyle: 'italic', textAlign: 'center' },
});