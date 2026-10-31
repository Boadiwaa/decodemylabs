/**
 * RepeatedValuesNotice — shown when one report gave two different values for
 * the same test. Both are kept; the patient is asked to check with the lab.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { describeRepeatedTest, REPEATED_TEST_ADVICE } from '../domain/report_checks';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

/**
 * @param {object} props
 * @param {Array} props.items - From findRepeatedTests
 * @param {object} [props.style]
 */
export default function RepeatedValuesNotice({ items, style }) {
  if (!items?.length) return null;
  const title = items.length === 1
    ? 'This report shows two values for one test'
    : `This report shows two values for ${items.length} tests`;
  const lines = items.map(describeRepeatedTest);

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[styles.card, style]}
      accessible
      accessibilityLabel={`${title}. ${lines.join('. ')}. ${REPEATED_TEST_ADVICE}`}
    >
      <View style={styles.titleRow}>
        <Ionicons name="warning-outline" size={18} color={Colors.warn} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {lines.map((line) => <Text key={line} style={styles.line}>{line}</Text>)}
      <Text style={styles.advice}>{REPEATED_TEST_ADVICE}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.warnBg, borderWidth: 1, borderColor: Colors.warnBorder,
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { ...Typography.bodySmall, fontWeight: '700', color: Colors.navy, flex: 1 },
  line: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  advice: { ...Typography.caption, color: Colors.textSecondary, marginTop: 6 },
});
