/**
 * InteractiveReport — Animated, digitized version of a lab report.
 * Transforms raw lab data into an engaging interactive experience.
 *
 * Features:
 * - Animated entrance (results appear one by one)
 * - Color-coded severity (red/amber/green)
 * - Animated gauge bars showing where value falls in range
 * - Pulsing highlights on critical values
 * - Tap to expand for explanation
 * - TTS integration per result
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withDelay, withRepeat, withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Colors from '../constants/colors';

export default function InteractiveReport({ labResults, onResultPress }) {
  const [expandedId, setExpandedId] = useState(null);

  // Sort: critical first, then elevated, then normal
  const sortedResults = [...labResults].sort((a, b) => {
    const order = { danger: 0, warn: 1, safe: 2 };
    return (order[a.severity] || 2) - (order[b.severity] || 2);
  });

  const criticalCount = sortedResults.filter(r => r.severity === 'danger').length;
  const warnCount = sortedResults.filter(r => r.severity === 'warn').length;
  const normalCount = sortedResults.filter(r => r.severity === 'safe').length;

  return (
    <View style={styles.container}>
      {/* Report Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Text style={styles.headerTitle}>📋 Your Lab Results</Text>
        <Text style={styles.headerDate}>{labResults[0]?.date || 'Recent'}</Text>
      </Animated.View>

      {/* Summary Banner */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.summary}>
        {criticalCount > 0 && (
          <View style={[styles.summaryPill, { backgroundColor: Colors.dangerBg }]}>
            <View style={[styles.summaryDot, { backgroundColor: Colors.danger }]} />
            <Text style={[styles.summaryText, { color: Colors.danger }]}> 
              {criticalCount} critical
            </Text>
          </View>
        )}
        {warnCount > 0 && (
          <View style={[styles.summaryPill, { backgroundColor: Colors.warnBg }]}>
            <View style={[styles.summaryDot, { backgroundColor: Colors.warn }]} />
            <Text style={[styles.summaryText, { color: Colors.warn }]}> 
              {warnCount} elevated
            </Text>
          </View>
        )}
        <View style={[styles.summaryPill, { backgroundColor: Colors.safeBg }]}>
          <View style={[styles.summaryDot, { backgroundColor: Colors.safe }]} />
          <Text style={[styles.summaryText, { color: Colors.safe }]}> 
            {normalCount} normal
          </Text>
        </View>
      </Animated.View>

      {/* Individual Result Cards */}
      {sortedResults.map((result, index) => (
        <ResultCard
          key={result.test_name}
          result={result}
          index={index}
          isExpanded={expandedId === result.test_name}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpandedId(expandedId === result.test_name ? null : result.test_name);
            if (typeof onResultPress === 'function') {
              onResultPress(result);
            }
          }}
        />
      ))}

      {/* Disclaimer */}
      <Animated.View entering={FadeIn.delay(sortedResults.length * 150 + 300)} style={styles.disclaimer}>
        <Ionicons name="information-circle" size={14} color="#9ca3af" />
        <Text style={styles.disclaimerText}>
          AI-extracted from your uploaded report. Consult a licensed healthcare provider.
        </Text>
      </Animated.View>
    </View>
  );
}


function ResultCard({ result, index, isExpanded, onPress }) {
  const gaugeWidth = useSharedValue(0);
  const pulseOpacity = useSharedValue(1);
  const isCritical = result.severity === 'danger';
  const isWarn = result.severity === 'warn';

  const sevColor = isCritical ? Colors.danger
    : isWarn ? Colors.warn
    : Colors.safe;

  const sevBg = isCritical ? Colors.dangerBg
    : isWarn ? Colors.warnBg
    : Colors.safeBg;

  // Animate gauge bar on mount
  useEffect(() => {
    gaugeWidth.value = withDelay(
      index * 150 + 400,
      withSpring(result.gaugePercent || 50, { damping: 15, stiffness: 80 })
    );
  }, []);

  // Pulse animation for critical values
  useEffect(() => {
    if (isCritical) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    }
  }, [isCritical]);

  const gaugeStyle = useAnimatedStyle(() => ({
    width: `${gaugeWidth.value}%`,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const speakResult = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Speech.speak(
      result.explanation || `Your ${result.test_name} is ${result.value} ${result.unit}`,
      { language: 'en-US', rate: 0.85 }
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 150 + 300).springify().damping(18)}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.card, { borderLeftColor: sevColor, borderLeftWidth: 4 }]}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <Animated.View style={[styles.sevIndicator, { backgroundColor: sevColor }, isCritical && pulseStyle]}>
            <Ionicons
              name={isCritical ? 'alert-circle' : isWarn ? 'warning' : 'checkmark-circle'}
              size={16} color="#fff"
            />
          </Animated.View>

          <View style={{ flex: 1 }}>
            <Text style={styles.testName}>{result.test_name}</Text>
            <Text style={styles.flag}>
              <Text style={{ color: sevColor, fontWeight: '800' }}>
                {isCritical ? 'HIGH' : isWarn ? 'ELEVATED' : 'NORMAL'}
              </Text>
              {result.deviation ? ` · ${result.deviation}% above normal` : ''}
            </Text>
          </View>

          <View style={styles.valueContainer}>
            <Text style={[styles.value, { color: sevColor }]}>{result.value}</Text>
            <Text style={styles.unit}>{result.unit}</Text>
          </View>
        </View>

        {/* Animated Gauge Bar */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeLabels}>
            <Text style={styles.gaugeLabel}>{result.rangeLow || '0'}</Text>
            <Text style={[styles.gaugeLabel, { color: sevColor, fontWeight: '700' }]}>
              {result.value} {result.unit}
            </Text>
            <Text style={styles.gaugeLabel}>{result.rangeHigh || ''}</Text>
          </View>
          <View style={styles.gaugeBg}>
            {/* Normal zone indicator */}
            <View style={[styles.normalZone, {
              left: `${result.normalStart || 30}%`,
              width: `${result.normalWidth || 40}%`,
            }]} />
            {/* Value indicator */}
            <Animated.View style={[styles.gaugeFill, { backgroundColor: sevColor }, gaugeStyle]} />
            {/* Value marker */}
            <Animated.View style={[styles.gaugeMarker, {
              backgroundColor: sevColor,
              left: `${Math.min(result.gaugePercent || 50, 95)}%`,
            }, gaugeStyle.width ? {} : {}]}>
              <View style={[styles.markerDot, { backgroundColor: sevColor }]} />
            </Animated.View>
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={styles.rangeLabelSmall}>Low</Text>
            <Text style={styles.rangeLabelSmall}>Normal range</Text>
            <Text style={styles.rangeLabelSmall}>High</Text>
          </View>
        </View>

        {/* Expanded Content */}
        {isExpanded && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.expanded}>
            <View style={[styles.explanationBox, { backgroundColor: sevBg }]}>
              <Text style={styles.explanationText}>
                {result.explanation || `Your ${result.test_name} result is ${result.value} ${result.unit}.`}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={speakResult} style={styles.actionBtn}>
                <Ionicons name="volume-high" size={16} color="#0072e3" />
                <Text style={styles.actionBtnText}>Listen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="information-circle" size={16} color="#0072e3" />
                <Text style={styles.actionBtnText}>Learn more</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Expand indicator */}
        <View style={styles.expandHint}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14} color="#cbd5e1"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  container: { paddingBottom: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  headerDate: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  summary: {
    flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 14, flexWrap: 'wrap',
  },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  summaryText: { fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sevIndicator: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  testName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  flag: { fontSize: 10, color: '#6b7280', marginTop: 1 },
  valueContainer: { alignItems: 'flex-end' },
  value: { fontSize: 22, fontWeight: '900' },
  unit: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },

  gaugeContainer: { marginTop: 12, marginBottom: 4 },
  gaugeLabels: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3,
  },
  gaugeLabel: { fontSize: 9, color: '#9ca3af', fontWeight: '500' },
  gaugeBg: {
    height: 8, backgroundColor: '#f1f5f9', borderRadius: 4,
    overflow: 'hidden', position: 'relative',
  },
  normalZone: {
    position: 'absolute', top: 0, height: 8,
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 4,
  },
  gaugeFill: { height: 8, borderRadius: 4, maxWidth: '100%' },
  gaugeMarker: {
    position: 'absolute', top: -4, width: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    marginLeft: -8,
  },
  markerDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
  rangeLabelSmall: { fontSize: 8, color: '#cbd5e1', fontWeight: '500' },

  expanded: { marginTop: 12 },
  explanationBox: {
    padding: 12, borderRadius: 12, marginBottom: 10,
  },
  explanationText: { fontSize: 13, lineHeight: 20, color: '#374151', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#0072e3' },

  expandHint: { alignItems: 'center', marginTop: 4 },

  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginHorizontal: 16, marginTop: 8, padding: 12,
    backgroundColor: '#f8fafc', borderRadius: 12,
  },
  disclaimerText: { fontSize: 10, color: '#9ca3af', flex: 1, lineHeight: 15 },
});