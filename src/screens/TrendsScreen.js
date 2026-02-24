import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { patients, trends, alerts } from '../data/mockData';
import { getSeverityConfig } from '../utils/helpers';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const screenWidth = Dimensions.get('window').width;

export default function TrendsScreen({ navigation }) {
  const { currentPatientId, getPatientProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Patient only sees their own trends
  const visiblePatients = patients.filter(p => p.id === currentPatientId).map(getPatientProfile);

  const [selectedPatient, setSelectedPatient] = useState(currentPatientId);

  const trend = trends.find(t => t.patient_id === selectedPatient);
  const alert = alerts.find(a => a.patient_id === selectedPatient);
  const patient = getPatientProfile(patients.find(p => p.id === selectedPatient));
  const sev = getSeverityConfig(alert?.severity);

  const labels = trend?.values.map(v => v.date) || [];
  const dataValues = trend?.values.map(v => v.value) || [0];

  const first = dataValues[0];
  const last = dataValues[dataValues.length - 1];
  const changePercent = first ? (((last - first) / first) * 100).toFixed(1) : 0;
  const direction = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable';

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View>
          <Text style={styles.headerTitle}>Trends</Text>
          <Text style={styles.headerSub}>
            YOUR LAB TRENDS
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: Colors.tealLight }]}>
          <Ionicons
            name="person"
            size={14}
            color={Colors.tealDark}
          />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Patient selector */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {visiblePatients.map((p) => {
              const isActive = p.id === selectedPatient;
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPatient(p.id);
                  }}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <View style={[styles.chipAvatar, { backgroundColor: p.color }]}>
                    <Text style={styles.chipAvatarText}>{p.initials}</Text>
                  </View>
                  <Text style={[styles.chipName, isActive && styles.chipNameActive]}>
                    {p.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Main chart card */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>{trend?.test_name}</Text>
              <Text style={styles.chartPatient}>{patient?.name}</Text>
            </View>
            <View style={[styles.changeBadge, {
              backgroundColor: direction === 'up' ? Colors.dangerBg : direction === 'down' ? Colors.safeBg : Colors.bgSecondary,
            }]}>
              {direction !== 'stable' && (
                <Ionicons
                  name={direction === 'up' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={direction === 'up' ? Colors.danger : Colors.safe}
                />
              )}
              <Text style={[styles.changeText, {
                color: direction === 'up' ? Colors.danger : direction === 'down' ? Colors.safe : Colors.textMuted,
              }]}>
                {Math.abs(changePercent)}%
              </Text>
            </View>
          </View>

          <LineChart
            data={{
              labels,
              datasets: [{ data: dataValues, color: () => sev.color, strokeWidth: 3 }],
            }}
            width={screenWidth - 72}
            height={200}
            chartConfig={{
              backgroundColor: Colors.white,
              backgroundGradientFrom: Colors.white,
              backgroundGradientTo: Colors.white,
              decimalCount: trend?.unit === '%' ? 1 : 0,
              color: () => sev.color,
              labelColor: () => Colors.textMuted,
              propsForDots: {
                r: '6', strokeWidth: '3', stroke: Colors.white, fill: sev.color,
              },
              propsForBackgroundLines: {
                strokeDasharray: '4,8', stroke: Colors.borderLight, strokeWidth: 1,
              },
              propsForLabels: { fontSize: 11, fontWeight: '600' },
              fillShadowGradientFrom: sev.color,
              fillShadowGradientTo: Colors.white,
              fillShadowGradientFromOpacity: 0.12,
              fillShadowGradientToOpacity: 0,
            }}
            bezier
            withInnerLines
            withOuterLines={false}
            withVerticalLines={false}
            withShadow
            style={{ borderRadius: 14, marginLeft: -8 }}
            formatYLabel={(y) => `${y}${trend?.unit === '%' ? '%' : ''}`}
          />

          <View style={styles.chartFooter}>
            <View style={styles.chartStat}>
              <Text style={styles.chartStatLabel}>FIRST</Text>
              <Text style={styles.chartStatValue}>{first} {trend?.unit}</Text>
            </View>
            <View style={styles.chartStatDivider} />
            <View style={styles.chartStat}>
              <Text style={styles.chartStatLabel}>LATEST</Text>
              <Text style={[styles.chartStatValue, { color: sev.color }]}>{last} {trend?.unit}</Text>
            </View>
            <View style={styles.chartStatDivider} />
            <View style={styles.chartStat}>
              <Text style={styles.chartStatLabel}>CHANGE</Text>
              <Text style={[styles.chartStatValue, {
                color: direction === 'up' ? Colors.danger : direction === 'down' ? Colors.safe : Colors.textPrimary,
              }]}>{changePercent > 0 ? '+' : ''}{changePercent}%</Text>
            </View>
          </View>
        </Animated.View>

        {/* All patients overview — ENFORCED: patient sees only own data */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.overviewSection}>
          <Text style={styles.overviewTitle}>Your Lab Summary</Text>
          {visiblePatients.map((p, i) => {
            const t = trends.find(tr => tr.patient_id === p.id);
            const a = alerts.find(al => al.patient_id === p.id);
            const s = getSeverityConfig(a?.severity);
            const vals = t?.values || [];
            const f = vals[0]?.value || 0;
            const l = vals[vals.length - 1]?.value || 0;
            const pct = f ? (((l - f) / f) * 100).toFixed(1) : 0;
            const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable';

            return (
              <Animated.View key={p.id} entering={FadeInDown.delay(300 + i * 60).springify()}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('PatientDetail', { patientId: p.id });
                  }}
                  style={styles.overviewRow}
                >
                  <View style={[styles.overviewAvatar, { backgroundColor: p.color }]}>
                    <Text style={styles.overviewAvatarText}>{p.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overviewName}>{p.name}</Text>
                    <Text style={styles.overviewTest}>{t?.test_name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {dir !== 'stable' && (
                        <Ionicons
                          name={dir === 'up' ? 'arrow-up' : 'arrow-down'}
                          size={11}
                          color={dir === 'up' ? Colors.danger : Colors.safe}
                        />
                      )}
                      <Text style={[styles.overviewPct, {
                        color: dir === 'up' ? Colors.danger : dir === 'down' ? Colors.safe : Colors.textMuted,
                      }]}>{Math.abs(pct)}%</Text>
                    </View>
                    <View style={[styles.overviewSevDot, { backgroundColor: s.color }]} />
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: Colors.tealLight,
    borderBottomWidth: 1, borderBottomColor: Colors.tealMuted,
  },
  headerTitle: { ...Typography.h3, color: Colors.navy },
  headerSub: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: 2 },
  roleBadge: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  chipRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 50,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  chipActive: { backgroundColor: Colors.tealLight, borderColor: Colors.teal },
  chipAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chipName: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary },
  chipNameActive: { color: Colors.tealDark, fontWeight: '700' },

  chartCard: {
    marginHorizontal: 16, padding: 20, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  chartTitle: { fontFamily: Typography.serif, fontSize: 17, fontWeight: '700', color: Colors.navy },
  chartPatient: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  changeText: { ...Typography.pill, fontSize: 11 },

  chartFooter: {
    flexDirection: 'row', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  chartStat: { flex: 1, alignItems: 'center' },
  chartStatLabel: { ...Typography.labelSmall, color: Colors.textMuted },
  chartStatValue: { fontFamily: Typography.serif, fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: 4 },
  chartStatDivider: { width: 1, backgroundColor: Colors.borderLight },

  overviewSection: { marginHorizontal: 16, marginTop: 24 },
  overviewTitle: { ...Typography.label, color: Colors.navy, marginBottom: 12 },
  overviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  overviewAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  overviewAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  overviewName: { ...Typography.body, fontWeight: '600', color: Colors.navy },
  overviewTest: { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  overviewPct: { ...Typography.caption, fontWeight: '700' },
  overviewSevDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
});
