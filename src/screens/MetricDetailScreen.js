import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserLabData } from '../hooks/useUserLabData';
import { useMetricExplanation } from '../hooks/useMetricExplanation';
import { getFullPatientContext } from '../services/PatientStorage';
import { classifySeverity } from '../domain/reference_ranges';
import { analyzeTrend } from '../domain/interpretation_rules';
import { buildPersonalizationInsights } from '../domain/personalization';
import { getSeverityConfig, formatDate } from '../utils/helpers';
import TrendChart from '../components/TrendChart';
import TTSPlayer from '../components/TTSPlayer';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

function getNumericValue(result) {
  if (!result) return NaN;
  if (typeof result.numeric_value === 'number' && !Number.isNaN(result.numeric_value)) {
    return result.numeric_value;
  }
  const match = String(result.result_value || '').match(/-?\d+\.?\d*/);
  return match ? Number.parseFloat(match[0]) : NaN;
}

function buildEnglishExplanation({ result, severity, trendAnalysis, personalization }) {
  if (!result) return 'No metric data is available for this selection. Consult a licensed healthcare provider.';

  const parts = [];

  if (severity === 'danger') {
    parts.push(`Your ${result.test_name} value is ${result.result_value}, which is outside the expected range (${result.normal_range}).`);
    parts.push('This result needs prompt medical follow-up.');
  } else if (severity === 'warn') {
    parts.push(`Your ${result.test_name} value is ${result.result_value}, which is mildly outside the expected range (${result.normal_range}).`);
    parts.push('This should be reviewed at your next clinical follow-up.');
  } else {
    parts.push(`Your ${result.test_name} value is ${result.result_value}, which is within the expected range (${result.normal_range}).`);
    parts.push('This is generally reassuring, while still worth tracking over time.');
  }

  if (trendAnalysis?.direction === 'up') {
    parts.push(`Recent trend data shows this metric is rising by about ${trendAnalysis.percentChange}% over the last points we have.`);
  } else if (trendAnalysis?.direction === 'down') {
    parts.push(`Recent trend data shows this metric is falling by about ${trendAnalysis.percentChange}% over the last points we have.`);
  }

  if (personalization?.summaryNote) {
    parts.push(personalization.summaryNote);
  }

  parts.push('Consult a licensed healthcare provider.');
  return parts.join(' ');
}

function buildFrenchExplanation({ result, severity, personalization }) {
  if (!result) return 'Aucune donnee de test disponible. Consult a licensed healthcare provider.';

  const statusSentence = severity === 'danger'
    ? 'Ce resultat est en dehors de la plage attendue et doit etre discute rapidement.'
    : severity === 'warn'
      ? 'Ce resultat est legerement hors de la plage attendue et merite un suivi.'
      : 'Ce resultat est dans la plage attendue.';

  const personalizationNote = personalization?.patientNotes?.fr ? ` ${personalization.patientNotes.fr}` : '';

  return `Votre resultat ${result.test_name} est ${result.result_value}. Plage de reference: ${result.normal_range}. ${statusSentence}${personalizationNote} Consult a licensed healthcare provider.`;
}

function buildAkanExplanation({ result, severity, personalization }) {
  if (!result) return 'Test data nni h0. Consult a licensed healthcare provider.';

  const statusSentence = severity === 'danger'
    ? 'Eyi firi normal range no mu paa, enti eho hia se wokasa ho ntentem.'
    : severity === 'warn'
      ? 'Eyi firi normal range no mu kakra, enti eye se wob3hw3 bio.'
      : 'Eyi w0 normal range no mu.';

  const personalizationNote = personalization?.patientNotes?.ak ? ` ${personalization.patientNotes.ak}` : '';

  return `Wo ${result.test_name} result no ye ${result.result_value}. Normal range: ${result.normal_range}. ${statusSentence}${personalizationNote} Consult a licensed healthcare provider.`;
}

function buildNextSteps({ severity, trendAnalysis, personalization }) {
  const steps = [];

  if (severity === 'danger') {
    steps.push('Contact your healthcare provider soon to review this result.');
  } else if (severity === 'warn') {
    steps.push('Discuss this result at your next medical visit.');
  } else {
    steps.push('Continue your routine care and periodic lab follow-up.');
  }

  if (trendAnalysis?.direction === 'up' && severity !== 'safe') {
    steps.push('Ask whether repeat testing is needed sooner because the trend is rising.');
  }

  if (trendAnalysis?.direction === 'down' && severity === 'safe') {
    steps.push('Keep monitoring this trend over time to make sure values stay stable.');
  }

  if (personalization?.nextSteps?.length) {
    steps.push(...personalization.nextSteps);
  }

  steps.push('Bring your medications and this report to your next appointment.');
  steps.push('Consult a licensed healthcare provider.');

  return [...new Set(steps)];
}

export default function MetricDetailScreen({ route, navigation }) {
  const { patientId = 'self', reportId, testName } = route.params || {};
  const { user, currentPatientId } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    getPatients,
    getLabResultsFn,
    getAlerts,
    getTrends,
    getReportSessionData,
  } = useUserLabData();

  const [patientContext, setPatientContext] = useState(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  const effectivePatientId = currentPatientId || patientId;
  const reportData = reportId ? getReportSessionData(reportId) : null;

  const patients = getPatients();
  const patient = patients.find((p) => p.id === effectivePatientId) || patients[0];

  const labResults = reportData?.labResults || getLabResultsFn(effectivePatientId) || [];
  const alerts = reportData?.alerts || getAlerts(effectivePatientId) || [];
  const trends = reportData?.trends || getTrends(effectivePatientId) || [];

  const selectedResult = useMemo(() => {
    if (testName) {
      const match = labResults.find((item) => item.test_name === testName);
      if (match) return match;
    }
    return labResults[0] || null;
  }, [labResults, testName]);

  const selectedIndex = selectedResult
    ? labResults.findIndex((item) => item.id === selectedResult.id || item.test_name === selectedResult.test_name)
    : -1;

  const fallbackNumericValue = getNumericValue(selectedResult);
  const fallbackSeverity = selectedResult && Number.isFinite(fallbackNumericValue)
    ? classifySeverity(selectedResult.test_name, fallbackNumericValue, selectedResult.unit)
    : 'safe';

  const alertSeverity = selectedIndex >= 0 ? alerts[selectedIndex]?.severity : null;
  const severity = selectedResult?.severity || alertSeverity || fallbackSeverity;
  const severityConfig = getSeverityConfig(severity);

  const trend = selectedResult
    ? trends.find((item) => item.test_name === selectedResult.test_name)
    : null;
  const trendAnalysis = trend?.values?.length ? analyzeTrend(trend.values) : null;

  const personalization = useMemo(() => {
    if (!selectedResult) return null;
    return buildPersonalizationInsights({ lab: selectedResult, patientContext });
  }, [selectedResult, patientContext]);

  const ruleExplanations = useMemo(() => {
    const en = buildEnglishExplanation({
      result: selectedResult,
      severity,
      trendAnalysis,
      personalization,
    });

    return {
      en,
      fr: buildFrenchExplanation({
        result: selectedResult,
        severity,
        personalization,
      }),
      ak: buildAkanExplanation({
        result: selectedResult,
        severity,
        personalization,
      }),
    };
  }, [selectedResult, severity, trendAnalysis, personalization]);

  const aiExplanation = useMetricExplanation({
    lab: selectedResult,
    trend,
    patient,
    patientContext,
    contextLoaded,
    severity,
  });

  // Prefer Gemma's text; Akan audio is then translated from the AI English text.
  const ai = aiExplanation.status === 'ready' ? aiExplanation.explanation : null;
  const explanations = ai
    ? { en: ai.en, fr: ai.fr || ruleExplanations.fr }
    : ruleExplanations;
  const sourceLabels = ai
    ? {
        en: 'AI explanation · Gemma',
        fr: ai.fr ? 'AI explanation · Gemma' : 'Standard explanation',
        ak: 'AI explanation · translated to Twi when played',
      }
    : null;
  const statusText = aiExplanation.status === 'generating'
    ? 'Gemma is writing a personal explanation. This can take a minute.'
    : null;

  const nextSteps = useMemo(() => {
    return buildNextSteps({ severity, trendAnalysis, personalization });
  }, [severity, trendAnalysis, personalization]);

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!user?.id) return;
      try {
        const context = await getFullPatientContext(user.id);
        if (mounted) setPatientContext(context);
      } catch (e) {
        if (mounted) setPatientContext(null);
      } finally {
        if (mounted) setContextLoaded(true);
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (!selectedResult) {
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
        </Animated.View>

        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No Metric Found</Text>
          <Text style={styles.emptyText}>This metric is not available in the selected report yet.</Text>
        </View>
      </View>
    );
  }

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
          <Ionicons name="analytics-outline" size={14} color={Colors.tealDark} />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(30).springify()} style={styles.heroCard}>
          <Text style={styles.metricName}>{selectedResult.test_name}</Text>
          <Text style={styles.metricMeta}>
            {patient?.name || 'Patient'} · {formatDate(selectedResult.date)}
          </Text>

          <View style={styles.valueRow}>
            <Text style={[styles.metricValue, { color: severityConfig.color }]}>{selectedResult.result_value}</Text>
            <View style={[styles.sevBadge, { backgroundColor: severityConfig.bg, borderColor: severityConfig.border }]}> 
              <Ionicons name={severityConfig.icon} size={13} color={severityConfig.color} />
              <Text style={[styles.sevBadgeText, { color: severityConfig.color }]}>{severityConfig.label}</Text>
            </View>
          </View>

          <Text style={styles.rangeText}>Reference range: {selectedResult.normal_range}</Text>
        </Animated.View>

        {trend?.values?.length ? (
          <TrendChart trend={trend} severity={severity} />
        ) : (
          <Animated.View entering={FadeInDown.delay(70).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Trend</Text>
            <Text style={styles.cardBody}>No historical trend points are available for this metric yet.</Text>
          </Animated.View>
        )}

        <TTSPlayer
          title="What This May Mean"
          explanations={explanations}
          sourceLabels={sourceLabels}
          statusText={statusText}
        />

        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Next Steps</Text>
          {nextSteps.map((step, idx) => (
            <View key={`${step}_${idx}`} style={styles.stepRow}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(170).springify()} style={styles.disclaimerCard}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.disclaimerText}>This app provides educational information only. Consult a licensed healthcare provider.</Text>
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
  scrollContent: { paddingBottom: 100 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  metricName: { ...Typography.h2, color: Colors.navy },
  metricMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  valueRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricValue: { ...Typography.h1 },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sevBadgeText: { ...Typography.pill },
  rangeText: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 8 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 8 },
  cardBody: { ...Typography.bodySmall, color: Colors.textPrimary, lineHeight: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: Colors.tealDark,
  },
  stepText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  disclaimerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  disclaimerText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: { ...Typography.h3, color: Colors.navy },
  emptyText: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
