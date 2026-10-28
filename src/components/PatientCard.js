import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getSeverityConfig, getTrendChange } from '../utils/helpers';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

/**
 * PatientCard — shows a patient summary on the dashboard.
 * Receives ALL data via props; no longer imports mock data directly.
 *
 * @param {object} patient - Patient object (id, name, initials, color, etc.)
 * @param {object[]} labResults - Lab results for this patient
 * @param {object[]} patientAlerts - Alerts for this patient
 * @param {object[]} patientTrends - Trends for this patient
 * @param {number} index - Index for staggered animation
 * @param {function} onPress
 */
export default function PatientCard({ patient, labResults, patientAlerts, patientTrends, index, onPress }) {
  const lab = labResults?.[0] || null;
  const alert = patientAlerts?.[0] || null;
  const trend = patientTrends?.[0] || null;
  const sev = getSeverityConfig(alert?.severity);
  const trendChange = getTrendChange(trend?.values);
  const abnormalCount = patientAlerts?.filter(a => a.severity !== 'safe').length || 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(patient);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(18)}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={styles.card}
        accessibilityLabel={`View results for ${patient.name}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: patient.color }]}>
            <Text style={styles.avatarText}>{patient.initials}</Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name} numberOfLines={1}>{patient.name}</Text>
              <View style={[styles.statusDot, { backgroundColor: sev.color, shadowColor: sev.color }]} />
              <Text style={[styles.sevLabel, { color: sev.color }]}>{sev.label}</Text>
            </View>
            {lab && (
              <Text style={styles.detail} numberOfLines={1}>
                {lab.test_name}: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{lab.result_value}</Text>
                {abnormalCount > 1 && (
                  <Text style={{ color: Colors.textMuted }}> · {abnormalCount} abnormal</Text>
                )}
              </Text>
            )}

            <Text style={styles.desc} numberOfLines={1}>{patient.profile_description}</Text>
          </View>

          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 20, padding: 16,
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: Typography.serif },
  name: { ...Typography.body, fontWeight: '700', color: Colors.navy, flexShrink: 1 },
  statusDot: {
    width: 7, height: 7, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4,
  },
  sevLabel: { ...Typography.pill, letterSpacing: 0.5 },
  detail: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  desc: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontFamily: Typography.sans },
  sevBarBg: { flex: 1, height: 3, backgroundColor: Colors.borderLight, borderRadius: 2 },
  sevBarFill: { height: 3, borderRadius: 2 },
  reminderBadge: {
    backgroundColor: Colors.tealLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  reminderBadgeText: { ...Typography.pill, color: Colors.tealDark },
});