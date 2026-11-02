import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUserLabData } from '../hooks/useUserLabData';
import { getSeverityConfig } from '../utils/helpers';
import { getLabGroup, sortByLabGroup } from '../domain/lab_groups';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const screenWidth = Dimensions.get('window').width;

export default function TrendsScreen({ navigation }) {
  const { currentPatientId } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    getPatients, getTrends, getAlerts, getLabResultsFn, hasRealData, isLoading, refresh,
  } = useUserLabData();

  // Reload when the tab is shown so new uploads appear
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const visiblePatients = getPatients();
  const firstPatientId = visiblePatients[0]?.id;
  const [selectedPatient, setSelectedPatient] = useState(currentPatientId || firstPatientId || 'self');
  const [selectedTrendIdx, setSelectedTrendIdx] = useState(0);

  useEffect(() => {
    if (!selectedPatient && firstPatientId) {
      setSelectedPatient(firstPatientId);
    }
  }, [selectedPatient, firstPatientId]);

  const patient = visiblePatients.find((p) => p.id === selectedPatient) || visiblePatients[0];
  // Ordered by body system so related tests sit together (see domain/lab_groups.js).
  const patientTrends = sortByLabGroup(getTrends(selectedPatient) || []);
  const patientAlerts = getAlerts(selectedPatient) || [];
  const patientLabResults = getLabResultsFn(selectedPatient) || [];

  useEffect(() => {
    if (selectedTrendIdx > 0 && selectedTrendIdx >= patientTrends.length) {
      setSelectedTrendIdx(0);
    }
  }, [patientTrends.length, selectedTrendIdx]);

  const trend = patientTrends[selectedTrendIdx] || patientTrends[0] || null;
  const trendResult = trend
    ? patientLabResults.find((item) => item.test_name === trend.test_name)
    : null;
  const trendAlert = patientAlerts.find((a) => {
    if (!trend) return false;
    return String(a.alert_message || '').toLowerCase().includes(String(trend.test_name).toLowerCase());
  });
  const resolvedSeverity = trendResult?.severity || trendAlert?.severity || patientAlerts[0]?.severity || 'safe';
  const sev = getSeverityConfig(resolvedSeverity);

  const labels = trend?.values?.map((v) => v.date) || [];
  const dataValues = trend?.values?.map((v) => v.value) || [0];

  const first = dataValues[0];
  const last = dataValues[dataValues.length - 1];
  const changePercent = first ? (((last - first) / first) * 100).toFixed(1) : 0;
  const direction = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable';

  const metricSummary = useMemo(() => {
    return patientTrends.map((metricTrend) => {
      const values = metricTrend.values || [];
      const metricFirst = values[0]?.value || 0;
      const metricLast = values[values.length - 1]?.value || 0;
      const pct = metricFirst ? (((metricLast - metricFirst) / metricFirst) * 100).toFixed(1) : 0;
      const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable';
      const matchingResult = patientLabResults.find((l) => l.test_name === metricTrend.test_name);
      const severity = matchingResult?.severity || 'safe';

      return {
        trend: metricTrend,
        pct,
        direction: dir,
        severity,
      };
    });
  }, [patientTrends, patientLabResults]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View>
          <Text style={styles.headerTitle}>Trends</Text>
          <Text style={styles.headerSub}>
            Your lab trends
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
        {!hasRealData ? (
          !isLoading && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={40} color={Colors.teal} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No trends yet</Text>
              <Text style={styles.emptySub}>
                Upload a lab report to see your results here. Each new report adds a point,
                so you can see how your values change over time.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('Home', { screen: 'LabUpload' });
                }}
                accessibilityRole="button"
                accessibilityLabel="Upload a lab report"
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Upload lab report</Text>
              </TouchableOpacity>
            </Animated.View>
          )
        ) : (
        <>
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
        {trend ? (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.chartCard}>
            {patientTrends.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.metricTabs}
                contentContainerStyle={{ gap: 8 }}
              >
                {patientTrends.map((metricTrend, idx) => {
                  const isActive = idx === selectedTrendIdx;
                  return (
                    <TouchableOpacity
                      key={`${metricTrend.test_name}_${idx}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedTrendIdx(idx);
                      }}
                      style={[styles.metricTab, isActive && styles.metricTabActive]}
                      accessibilityLabel={`Show ${metricTrend.test_name} trend`}
                    >
                      <Text style={[styles.metricTabText, isActive && styles.metricTabTextActive]}>
                        {metricTrend.test_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

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
                propsForLabels: { fontSize: 12, fontWeight: '600', fontFamily: Typography.sans },
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
                <Text style={styles.chartStatLabel}>First</Text>
                <Text style={styles.chartStatValue}>{first} {trend?.unit}</Text>
              </View>
              <View style={styles.chartStatDivider} />
              <View style={styles.chartStat}>
                <Text style={styles.chartStatLabel}>Latest</Text>
                <Text style={[styles.chartStatValue, { color: sev.color }]}>{last} {trend?.unit}</Text>
              </View>
              <View style={styles.chartStatDivider} />
              <View style={styles.chartStat}>
                <Text style={styles.chartStatLabel}>Change</Text>
                <Text style={[styles.chartStatValue, {
                  color: direction === 'up' ? Colors.danger : direction === 'down' ? Colors.safe : Colors.textPrimary,
                }]}>{changePercent > 0 ? '+' : ''}{changePercent}%</Text>
              </View>
            </View>
            {trend?.convertedCount > 0 && (
              <Text style={styles.chartNote}>
                Some earlier results were converted to {trend.unit} so they can be compared.
              </Text>
            )}
            {trend?.skippedCount > 0 && (
              <Text style={styles.chartNote}>
                {trend.skippedCount} earlier result{trend.skippedCount !== 1 ? 's' : ''} used a unit we can't convert, so {trend.skippedCount !== 1 ? "they aren't" : "it isn't"} shown.
              </Text>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.chartCard}>
            <Text style={styles.chartTitle}>No trend data yet</Text>
            <Text style={styles.chartPatient}>Upload more reports to build trend lines over time.</Text>
          </Animated.View>
        )}

        {/* Metric overview for selected patient */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.overviewSection}>
          <View style={styles.overviewHeaderRow}>
            <Text style={styles.overviewTitle}>Metrics At A Glance</Text>
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Report', { patientId: selectedPatient });
              }}
              accessibilityLabel="Open full report"
            >
              <Ionicons name="document-text-outline" size={13} color={Colors.tealDark} />
              <Text style={styles.reportBtnText}>Open report</Text>
            </TouchableOpacity>
          </View>

          {metricSummary.map((entry, i) => {
            const { trend: metricTrend, pct, direction: metricDirection, severity } = entry;
            const s = getSeverityConfig(severity);
            const group = getLabGroup(metricTrend.test_name);
            const startsGroup = i === 0 || getLabGroup(metricSummary[i - 1].trend.test_name).key !== group.key;

            return (
              <Animated.View key={`${metricTrend.test_name}_${i}`} entering={FadeInDown.delay(300 + i * 60).springify()}>
                {startsGroup && (
                  <Text style={styles.groupLabel} accessibilityRole="header">{group.title}</Text>
                )}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('MetricDetail', {
                      patientId: selectedPatient,
                      testName: metricTrend.test_name,
                    });
                  }}
                  style={styles.overviewRow}
                  accessibilityLabel={`Open ${metricTrend.test_name} details`}
                >
                  <View style={[styles.overviewAvatar, { backgroundColor: Colors.teal }]}> 
                    <Text style={styles.overviewAvatarText}>{String(metricTrend.test_name || '').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overviewName}>{metricTrend.test_name}</Text>
                    <Text style={styles.overviewTest}>Latest: {metricTrend.values?.[metricTrend.values.length - 1]?.value} {metricTrend.unit}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {metricDirection !== 'stable' && (
                        <Ionicons
                          name={metricDirection === 'up' ? 'arrow-up' : 'arrow-down'}
                          size={11}
                          color={metricDirection === 'up' ? Colors.danger : Colors.safe}
                        />
                      )}
                      <Text style={[styles.overviewPct, {
                        color: metricDirection === 'up' ? Colors.danger : metricDirection === 'down' ? Colors.safe : Colors.textMuted,
                      }]}>{Math.abs(pct)}%</Text>
                    </View>
                    <View style={[styles.overviewSevDot, { backgroundColor: s.color }]} />
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {metricSummary.length === 0 && (
            <Text style={styles.chartPatient}>No metric trends available yet.</Text>
          )}
        </Animated.View>
        </>
        )}
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
  chipAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: Typography.sans },
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
  emptyCard: {
    marginHorizontal: 16, marginTop: 16, padding: 32, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  emptyTitle: { ...Typography.h3, color: Colors.navy, marginBottom: 6 },
  emptySub: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.teal, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  emptyBtnText: { ...Typography.button, color: '#fff', fontSize: 14 },
  chartTitle: { fontFamily: Typography.serif, fontSize: 17, fontWeight: '700', color: Colors.navy },
  chartPatient: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  metricTabs: { marginBottom: 12 },
  metricTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  metricTabActive: {
    backgroundColor: Colors.tealLight,
    borderColor: Colors.teal,
  },
  metricTabText: { ...Typography.caption, color: Colors.textSecondary },
  metricTabTextActive: { color: Colors.tealDark, fontWeight: '700' },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  changeText: { ...Typography.pill },

  chartFooter: {
    flexDirection: 'row', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  chartStat: { flex: 1, alignItems: 'center' },
  chartNote: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: 10 },
  chartStatLabel: { ...Typography.labelSmall, color: Colors.textMuted },
  chartStatValue: { fontFamily: Typography.serif, fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: 4 },
  chartStatDivider: { width: 1, backgroundColor: Colors.borderLight },

  overviewSection: { marginHorizontal: 16, marginTop: 24 },
  overviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewTitle: { ...Typography.label, color: Colors.navy },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.tealLight,
    borderWidth: 1,
    borderColor: Colors.tealMuted,
  },
  reportBtnText: { ...Typography.caption, color: Colors.tealDark, fontWeight: '700' },
  groupLabel: {
    ...Typography.bodySmall, fontWeight: '700', color: Colors.tealDark,
    marginTop: 14, marginBottom: 6, marginHorizontal: 4,
  },
  overviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  overviewAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  overviewAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: Typography.sans },
  overviewName: { ...Typography.body, fontWeight: '600', color: Colors.navy },
  overviewTest: { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  overviewPct: { ...Typography.caption, fontWeight: '700' },
  overviewSevDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
});
