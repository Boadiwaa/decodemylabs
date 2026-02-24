/**
 * ModelStatusBar — compact indicator showing on-device AI model status.
 * Appears at the top of relevant screens to show loading / ready / error state.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useModel } from '../context/ModelContext';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function ModelStatusBar({ compact = false, onRetry }) {
  const { modelStatus, modelError, isModelLoading, isModelReady, initializeModel } = useModel();

  // Don't show anything when idle (model not attempted yet)
  if (modelStatus === 'idle') return null;

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onRetry) {
      onRetry();
    } else {
      initializeModel();
    }
  };

  if (isModelReady) {
    if (compact) return null; // Don't show when compact and ready
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.readyBar}>
        <Ionicons name="sparkles" size={14} color={Colors.tealDark} />
        <Text style={styles.readyText}>MedGemma AI ready</Text>
      </Animated.View>
    );
  }

  if (isModelLoading) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.loadingBar}>
        <ActivityIndicator size="small" color={Colors.tealDark} />
        <Text style={styles.loadingText}>Loading MedGemma model…</Text>
      </Animated.View>
    );
  }

  if (modelStatus === 'error') {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorBar}>
        <View style={styles.errorContent}>
          <Ionicons name="cloud-offline-outline" size={14} color={Colors.warn} />
          <Text style={styles.errorText}>AI model unavailable — using rule-based analysis</Text>
        </View>
        <TouchableOpacity
          onPress={handleRetry}
          style={styles.retryBtn}
          accessibilityLabel="Retry loading AI model"
        >
          <Ionicons name="refresh" size={14} color={Colors.tealDark} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  readyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: Colors.tealMuted,
  },
  readyText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.tealDark,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.warnBg,
    borderWidth: 1,
    borderColor: Colors.warnBorder,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.warn,
    flex: 1,
  },
  retryBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.tealLight,
  },
});
