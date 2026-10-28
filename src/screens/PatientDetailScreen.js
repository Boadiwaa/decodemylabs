import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserLabData } from '../hooks/useUserLabData';
import { reminders } from '../data/mockData';
import { getSeverityConfig, getTrendChange, getAge, formatDate, daysUntil } from '../utils/helpers';
import TrendChart from '../components/TrendChart';
import TTSPlayer from '../components/TTSPlayer';
import ModelStatusBar from '../components/ModelStatusBar';
import AIInsightCard from '../components/AIInsightCard';
import MarkdownText from '../components/MarkdownText';
import { useLabInterpretation } from '../hooks/useLabInterpretation';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId, reportId } = route.params;
  const { currentPatientId } = useAuth();
  const insets = useSafeAreaInsets();
  const { getPatients, getLabResultsFn, getAlerts, getTrends, getReportSessionData } = useUserLabData();

  // SECURITY: enforce patient can only view their own data
  const effectivePatientId = currentPatientId || patientId;

  // If viewing a specific past report, use that report's data
  const reportData = reportId ? getReportSessionData(reportId) : null;

  // Source all data from useUserLabData (real storage for patients)
  const allPatients = getPatients();
  const p = allPatients.find(pt => pt.id === effectivePatientId) || allPatients[0];
  const patientLabResults = reportData?.labResults || getLabResultsFn(effectivePatientId);
  const patientAlerts = reportData?.alerts || getAlerts(effectivePatientId);
  const patientTrends = reportData?.trends || getTrends(effectivePatientId);

  const alert = patientAlerts[0]; // already sorted: danger first
  const [selectedTrendIdx, setSelectedTrendIdx] = useState(0);
  const trend = patientTrends[selectedTrendIdx] || patientTrends[0];
  const reminder = reminders.find(r => r.patient_id === effectivePatientId);
  const sev = getSeverityConfig(alert?.severity);
  const trendChange = getTrendChange(trend?.values);
  const days = daysUntil(reminder?.due_date);

  // Collect only abnormal alerts for display
  const abnormalAlerts = patientAlerts.filter(a => a.severity !== 'safe');

  // AI-powered lab interpretation (falls back to rule-based if model unavailable)
  const {
    explanations,
    nextSteps,
    demoExplanations,
    demoNextSteps,
    aiExplanations,
    aiNextSteps,
    hasAIResults,
    hasRealData: hasRealLabData,
    isLoading: isAILoading,
    isAIGenerated,
    confidence,
    disclaimer,
    refresh: refreshInterpretation,
  } = useLabInterpretation(effectivePatientId);

  // Tab state for Demo vs AI content
  const [insightTab, setInsightTab] = useState('ai'); // 'demo' | 'ai'

  // Auto-switch to AI tab when AI results arrive
  React.useEffect(() => {
    if (hasAIResults && !isAILoading) {
      setInsightTab('ai');
    }
  }, [hasAIResults, isAILoading]);

  // Resolve which explanations/nextSteps to show based on tab
  // AI tab must NOT fall back to demo data — show null so the UI can display a proper message
  const activeExplanations = insightTab === 'demo' ? demoExplanations : aiExplanations;
  const activeNextSteps = insightTab === 'demo' ? demoNextSteps : aiNextSteps;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={Colors.tealDark} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={[styles.roleBadgeSmall, { backgroundColor: Colors.tealLight }]}>
          <Ionicons name="person" size={14} color={Colors.tealDark} />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* AI Model status */}
        <ModelStatusBar compact />

        {/* Patient info card */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.patientCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[styles.avatar, { backgroundColor: p.color }]}>
              <Text style={styles.avatarText}>{p.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{p.name}</Text>
              <Text style={styles.patientMeta}>
                {p.dob ? `${getAge(p.dob)}y · ` : ''}{p.gender}{p.dob ? ` · DOB: ${formatDate(p.dob)}` : ''}
              </Text>
              <Text style={styles.patientDesc}>{p.profile_description}</Text>
            </View>
          </View>
          {/* Severity badge */}
          <View style={[styles.sevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
            <Ionicons name={sev.icon} size={14} color={sev.color} />
            <Text style={[styles.sevBadgeText, { color: sev.color }]}>{sev.label}</Text>
          </View>
        </Animated.View>

        {/* Lab results card — show ALL results */}
        {patientLabResults.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>
            🧪 Lab Results ({patientLabResults.length})
            {reportId ? ' — Past Report' : ''}
          </Text>
          {patientLabResults.map((lab, i) => {
            const labSev = getSeverityConfig(lab.severity || patientAlerts[i]?.severity || 'safe');
            return (
              <View key={lab.id || i} style={[styles.labRow, i < patientLabResults.length - 1 && styles.labRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labTestName}>{lab.test_name}</Text>
                  <Text style={styles.labDate}>{formatDate(lab.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.labValue, { color: labSev.color }]}>{lab.result_value}</Text>
                  <Text style={styles.labRange}>Normal: {lab.normal_range}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
        )}

        {/* Alert cards — show all abnormal alerts */}
        {abnormalAlerts.length > 0 ? abnormalAlerts.map((a, idx) => {
          const aSev = getSeverityConfig(a.severity);
          return (
            <Animated.View key={a.id} entering={FadeInDown.delay(200 + idx * 60).springify()} style={[styles.alertCard, { backgroundColor: aSev.bg, borderColor: aSev.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={aSev.icon} size={20} color={aSev.color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertLabel, { color: aSev.color }]}>
                    {aSev.label === 'Critical' ? 'Needs Your Attention' : 'Worth Keeping an Eye On'}
                  </Text>
                  <Text style={styles.alertMessage}>{a.alert_message}</Text>
                </View>
              </View>
            </Animated.View>
          );
        }) : (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.alertCard, { backgroundColor: sev.bg, borderColor: sev.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={sev.icon} size={20} color={sev.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertLabel, { color: sev.color }]}>Looking Good!</Text>
                <Text style={styles.alertMessage}>{alert?.alert_message || 'All results are within normal limits.'}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Trend chart with selector */}
        {patientTrends.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.card}>
            {patientTrends.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {patientTrends.map((t, idx) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => { Haptics.selectionAsync(); setSelectedTrendIdx(idx); }}
                    style={[
                      styles.trendTab,
                      idx === selectedTrendIdx && styles.trendTabActive,
                    ]}
                    accessibilityLabel={`Show trend for ${t.test_name}`}
                  >
                    <Text style={[
                      styles.trendTabText,
                      idx === selectedTrendIdx && styles.trendTabTextActive,
                    ]}>
                      {t.test_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TrendChart trend={trend} severity={alert?.severity} />
          </Animated.View>
        )}

        {/* Demo / AI tab toggle + TTS Player */}
        {(activeExplanations || isAILoading) && (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.card}>
            {/* Tab toggle */}
            <View style={styles.insightTabRow}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setInsightTab('demo'); }}
                style={[styles.insightTab, insightTab === 'demo' && styles.insightTabActive]}
                accessibilityLabel="Show demo explanations"
              >
                <Ionicons name="flask-outline" size={14} color={insightTab === 'demo' ? Colors.tealDark : Colors.textMuted} />
                <Text style={[styles.insightTabText, insightTab === 'demo' && styles.insightTabTextActive]}>Demo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setInsightTab('ai'); }}
                style={[styles.insightTab, insightTab === 'ai' && styles.insightTabActive]}
                accessibilityLabel="Show AI explanations"
              >
                <Ionicons name="sparkles-outline" size={14} color={insightTab === 'ai' ? Colors.tealDark : Colors.textMuted} />
                <Text style={[styles.insightTabText, insightTab === 'ai' && styles.insightTabTextActive]}>
                  AI {isAILoading ? '…' : hasAIResults ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>🎧 Listen to Your Results</Text>
            <Text style={{ ...Typography.caption, color: Colors.textSecondary, marginBottom: 8 }}>
              {insightTab === 'demo'
                ? 'Showing demo explanations for development.'
                : 'Explanations based on your extracted lab results.'}
            </Text>
            {isAILoading && insightTab === 'ai' ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ ...Typography.caption, color: Colors.textMuted }}>Generating explanations…</Text>
              </View>
            ) : activeExplanations ? (
              <TTSPlayer explanations={activeExplanations} />
            ) : insightTab === 'ai' ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ ...Typography.caption, color: Colors.textMuted, textAlign: 'center' }}>
                  Upload a lab report to get AI-powered explanations of your results.
                </Text>
              </View>
            ) : null}
          </Animated.View>
        )}

        {/* Next steps — uses same Demo/AI tab selection */}
        {(activeNextSteps.length > 0 || isAILoading) && (
          <AIInsightCard
            isAIGenerated={insightTab === 'ai' && isAIGenerated}
            isLoading={isAILoading && insightTab === 'ai'}
            confidence={insightTab === 'ai' ? confidence : 0}
            disclaimer={insightTab === 'ai' ? disclaimer : 'Demo data — for development only.'}
            onRefresh={insightTab === 'ai' ? refreshInterpretation : undefined}
          >
            <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
              <Text style={styles.cardTitle}>
                {'💡 What You Can Do Next'}
                {insightTab === 'demo' ? ' (Demo)' : ''}
              </Text>
              {activeNextSteps.map((step, i) => (
                <Animated.View key={i} entering={FadeInRight.delay(400 + i * 60)} style={styles.stepRow}>
                  <View style={styles.stepDot} />
                  <MarkdownText style={styles.stepText}>{step}</MarkdownText>
                </Animated.View>
              ))}
            </View>
          </AIInsightCard>
        )}

        {/* Reminder */}
        {reminder && (
          <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.reminderCard}>
            <Ionicons name="calendar-outline" size={18} color={Colors.tealDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>📅 Coming Up: {reminder.test_name}</Text>
              <Text style={styles.reminderSub}>
                {formatDate(reminder.due_date)} · {days > 0 ? `${days} days away — you've got this!` : 'This one\'s overdue — let\'s get it on the books!'}
              </Text>
            </View>
          </Animated.View>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...Typography.body, fontWeight: '700', color: Colors.tealDark },
  patientCard: {
    marginHorizontal: 16, marginTop: 16, padding: 18, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: Typography.sans },
  patientName: { ...Typography.h3, color: Colors.navy },
  patientMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  patientDesc: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 4 },
  sevBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
  },
  sevBadgeText: { ...Typography.pill, letterSpacing: 0.5 },
  card: {
    marginHorizontal: 16, marginTop: 12, padding: 18, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardTitle: { fontFamily: Typography.serif, fontSize: 15, fontWeight: '700', color: Colors.navy, marginBottom: 12 },
  labRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  labRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: 4 },
  labTestName: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  labDate: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  labValue: { fontFamily: Typography.serif, fontSize: 20, fontWeight: '700' },
  labRange: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  trendText: { ...Typography.caption, fontWeight: '700' },
  summaryText: { ...Typography.bodySmall, color: Colors.textPrimary, lineHeight: 20 },
  actionsTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  actionNumber: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.tealMuted, alignItems: 'center', justifyContent: 'center',
  },
  actionNumberText: { fontSize: 12, fontWeight: '800', color: Colors.navy, fontFamily: Typography.sans },
  actionText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  alertCard: {
    marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 20, borderWidth: 1,
  },
  alertLabel: { ...Typography.pill, letterSpacing: 0.5 },
  alertMessage: { ...Typography.bodySmall, color: Colors.textPrimary, marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.tealDark },
  stepText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  reminderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 20,
    backgroundColor: Colors.tealLight, borderWidth: 1, borderColor: Colors.tealMuted,
  },
  reminderTitle: { ...Typography.body, fontWeight: '700', color: Colors.tealDark },
  reminderSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  roleBadgeSmall: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  trendTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.borderLight,
  },
  trendTabActive: {
    backgroundColor: Colors.tealLight, borderColor: Colors.teal,
  },
  trendTabText: {
    ...Typography.pill, color: Colors.textSecondary,
  },
  trendTabTextActive: {
    color: Colors.tealDark, fontWeight: '700',
  },
  insightTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  insightTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  insightTabActive: {
    backgroundColor: Colors.tealLight,
    borderColor: Colors.teal,
  },
  insightTabText: {
    ...Typography.pill,
    color: Colors.textMuted,
  },
  insightTabTextActive: {
    color: Colors.tealDark,
    fontWeight: '700',
  },
});