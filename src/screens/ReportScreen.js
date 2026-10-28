import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserLabData } from '../hooks/useUserLabData';
import { getSeverityConfig, getTrendChange, formatDate } from '../utils/helpers';
import { groupByLabGroup } from '../domain/lab_groups';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const SEVERITY_WEIGHT = { danger: 3, warn: 2, safe: 1 };

function resolveSeverity(result, fallbackAlert) {
  return result?.severity || fallbackAlert?.severity || 'safe';
}

function getWorstSeverity(labResults, alerts) {
  let highest = 'safe';
  for (let i = 0; i < labResults.length; i++) {
    const severity = resolveSeverity(labResults[i], alerts[i]);
    if ((SEVERITY_WEIGHT[severity] || 1) > (SEVERITY_WEIGHT[highest] || 1)) {
      highest = severity;
    }
  }
  return highest;
}

function buildSummaryText({ total, dangerCount, warnCount }) {
  if (total === 0) return 'No lab values were found in this report yet.';

  if (dangerCount > 0) {
    return `We found ${dangerCount} critical result${dangerCount > 1 ? 's' : ''} in this report. Please prioritize a medical follow-up.`;
  }

  if (warnCount > 0) {
    return `You have ${warnCount} result${warnCount > 1 ? 's' : ''} outside the normal range. A routine follow-up is recommended.`;
  }

  return 'Your values are currently within expected reference ranges.';
}

export default function ReportScreen({ route, navigation }) {
  const { patientId = 'self', reportId } = route.params || {};
  const { currentPatientId } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    getPatients,
    getLabResultsFn,
    getAlerts,
    getTrends,
    getReportSessionData,
    reportSessions,
  } = useUserLabData();

  const effectivePatientId = currentPatientId || patientId;
  const reportData = reportId ? getReportSessionData(reportId) : null;

  const patients = getPatients();
  const patient = patients.find((p) => p.id === effectivePatientId) || patients[0];

  const labResults = reportData?.labResults || getLabResultsFn(effectivePatientId) || [];
  const alerts = reportData?.alerts || getAlerts(effectivePatientId) || [];
  const trends = reportData?.trends || getTrends(effectivePatientId) || [];

  const reportSession = reportId ? reportSessions.find((s) => s.reportId === reportId) : null;

  const summary = useMemo(() => {
    const counts = labResults.reduce((acc, result, idx) => {
      const severity = resolveSeverity(result, alerts[idx]);
      if (severity === 'danger') acc.dangerCount += 1;
      else if (severity === 'warn') acc.warnCount += 1;
      else acc.safeCount += 1;
      return acc;
    }, { dangerCount: 0, warnCount: 0, safeCount: 0 });

    return {
      ...counts,
      total: labResults.length,
      worstSeverity: getWorstSeverity(labResults, alerts),
    };
  }, [labResults, alerts]);

  const summaryText = buildSummaryText(summary);
  const summarySeverity = getSeverityConfig(summary.worstSeverity);

  const keyFindings = alerts.filter((a) => a.severity !== 'safe').slice(0, 3);
  const reportDate = reportSession?.date || labResults?.[0]?.date;
  const reportTitle = reportSession?.fileName || (reportId ? 'Uploaded Lab Report' : 'Latest Results');

  const openMetric = (testName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('MetricDetail', {
      patientId: effectivePatientId,
      reportId,
      testName,
    });
  };

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}> 
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={Colors.tealDark} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerBadge}>
          <Ionicons name="document-text-outline" size={14} color={Colors.tealDark} />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.titleCard}>
          <Text style={styles.reportTitle}>{reportTitle}</Text>
          <Text style={styles.reportSubTitle}>
            {patient?.name || 'Patient'}{reportDate ? ` · ${formatDate(reportDate)}` : ''}
          </Text>
          <View style={[styles.overallBadge, { backgroundColor: summarySeverity.bg, borderColor: summarySeverity.border }]}> 
            <Ionicons name={summarySeverity.icon} size={14} color={summarySeverity.color} />
            <Text style={[styles.overallBadgeText, { color: summarySeverity.color }]}>Overall: {summarySeverity.label}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.summaryRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tests</Text>
            <Text style={styles.statValue}>{summary.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Critical</Text>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{summary.dangerCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Elevated</Text>
            <Text style={[styles.statValue, { color: Colors.warn }]}>{summary.warnCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Normal</Text>
            <Text style={[styles.statValue, { color: Colors.safe }]}>{summary.safeCount}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <Text style={styles.cardBody}>{summaryText}</Text>
          <Text style={styles.disclaimerText}>Consult a licensed healthcare provider.</Text>
        </Animated.View>

        {keyFindings.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Key Findings</Text>
            {keyFindings.map((finding, idx) => {
              const sev = getSeverityConfig(finding.severity);
              return (
                <View key={`${finding.id}_${idx}`} style={styles.findingRow}>
                  <Ionicons name={sev.icon} size={14} color={sev.color} />
                  <Text style={styles.findingText}>{finding.alert_message}</Text>
                </View>
              );
            })}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Your results, by body system</Text>
          {labResults.length === 0 ? (
            <Text style={styles.emptyText}>No metrics are available yet. Upload a report to populate this view.</Text>
          ) : (
            groupByLabGroup(
              labResults.map((lab, idx) => ({ lab, severity: resolveSeverity(lab, alerts[idx]) })),
              (row) => row.lab.test_name,
            ).map((group) => {
              const outOfRange = group.items.filter((row) => row.severity !== 'safe').length;
              return (
                <View key={group.key} style={styles.group}>
                  <View style={styles.groupHeader} accessibilityRole="header">
                    <View style={styles.groupIcon}>
                      <Ionicons name={group.icon} size={16} color={Colors.tealDark} />
                    </View>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <Text style={[styles.groupStatus, outOfRange > 0 && { color: Colors.warn }]}>
                      {outOfRange > 0 ? `${outOfRange} to look at` : 'All in range'}
                    </Text>
                  </View>

                  {group.items.map(({ lab, severity }, idx) => {
                    const sev = getSeverityConfig(severity);
                    const trend = trends.find((t) => t.test_name === lab.test_name);
                    const trendChange = trend?.values?.length ? getTrendChange(trend.values) : null;

                    return (
                      <TouchableOpacity
                        key={`${lab.id || lab.test_name}_${idx}`}
                        style={styles.metricRow}
                        activeOpacity={0.75}
                        accessibilityLabel={`Open ${lab.test_name} details`}
                        onPress={() => openMetric(lab.test_name)}
                      >
                        <View style={styles.metricLeft}>
                          <View style={[styles.metricDot, { backgroundColor: sev.color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metricName}>{lab.test_name}</Text>
                            <Text style={styles.metricRange}>Normal: {lab.normal_range}</Text>
                          </View>
                        </View>

                        <View style={styles.metricRight}>
                          <Text style={[styles.metricValue, { color: sev.color }]}>{lab.result_value}</Text>
                          {trendChange && trendChange.direction !== 'stable' ? (
                            <Text style={styles.metricTrend}>
                              {trendChange.direction === 'up' ? 'Rising' : 'Falling'} {trendChange.pct}%
                            </Text>
                          ) : (
                            <Text style={styles.metricTrend}>Stable trend</Text>
                          )}
                        </View>

                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.tealLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.tealMuted,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...Typography.body, fontWeight: '700', color: Colors.tealDark },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 },
  titleCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reportTitle: { ...Typography.h3, color: Colors.navy },
  reportSubTitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  overallBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  overallBadgeText: { ...Typography.pill },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statLabel: { ...Typography.caption, color: Colors.textMuted },
  statValue: { ...Typography.h3, color: Colors.navy },
  card: {
    marginTop: 12,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 10 },
  cardBody: { ...Typography.bodySmall, color: Colors.textPrimary, lineHeight: 20 },
  disclaimerText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 8 },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  findingText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  emptyText: { ...Typography.bodySmall, color: Colors.textSecondary },
  group: { marginTop: 8 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10,
  },
  groupIcon: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: Colors.tealLight, alignItems: 'center', justifyContent: 'center',
  },
  groupTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy, flex: 1 },
  groupStatus: { ...Typography.caption, fontWeight: '600', color: Colors.safe },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  metricLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  metricName: { ...Typography.bodySmall, fontWeight: '700', color: Colors.navy },
  metricRange: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  metricRight: { alignItems: 'flex-end' },
  metricValue: { ...Typography.body, fontWeight: '700' },
  metricTrend: { ...Typography.caption, color: Colors.textMuted },
});
