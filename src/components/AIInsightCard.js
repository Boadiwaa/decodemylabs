/**
 * AIInsightCard — wraps AI-generated content with a visual indicator
 * showing whether the content came from on-device AI or rule-based fallback.
 * Includes a refresh button and confidence badge.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function AIInsightCard({
  isAIGenerated,
  isLoading,
  confidence,
  disclaimer,
  onRefresh,
  children,
}) {
  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRefresh?.();
  };

  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.container}>
      {/* AI badge header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          {isAIGenerated ? (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color={Colors.tealDark} />
              <Text style={styles.aiBadgeText}>Gemma AI</Text>
            </View>
          ) : (
            <View style={styles.fallbackBadge}>
              <Ionicons name="analytics-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.fallbackBadgeText}>Rule-Based</Text>
            </View>
          )}
          {confidence > 0 && (
            <Text style={styles.confidenceText}>
              {Math.round(confidence * 100)}% confidence
            </Text>
          )}
        </View>
        {onRefresh && (
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshBtn}
            accessibilityLabel="Refresh AI analysis"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.tealDark} />
            ) : (
              <Ionicons name="refresh" size={16} color={Colors.tealDark} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.teal} />
          <Text style={styles.loadingText}>Analyzing lab results…</Text>
        </View>
      ) : (
        children
      )}

      {/* Disclaimer */}
      {disclaimer && !isLoading && (
        <View style={styles.disclaimerRow}>
          <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>{disclaimer}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: Colors.tealMuted,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.tealDark,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  fallbackBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  confidenceText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: Colors.tealLight,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  disclaimerText: {
    ...Typography.caption,
    fontSize: 9,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 13,
  },
});
