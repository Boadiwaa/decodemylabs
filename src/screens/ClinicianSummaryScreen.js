/**
 * ClinicianSummaryScreen — lets the patient share a recap of their latest
 * results with a clinician they trust: as a PDF through the share sheet
 * (email, WhatsApp, Notes…) or as a QR code shown on screen.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUserLabData } from '../hooks/useUserLabData';
import { getDrugHistory, getLabReports, getMedicalHistory } from '../services/PatientStorage';
import { buildClinicianSummary, buildQrText, shareSummaryPdf } from '../services/ClinicianSummary';
import QrCode from '../components/QrCode';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function ClinicianSummaryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { isLoading, allResults, getPatients, getLabResultsFn, getTrends } = useUserLabData();
  const [extra, setExtra] = useState(null); // { reports, conditions, medications }
  const [includeBackground, setIncludeBackground] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([getLabReports(user.id), getMedicalHistory(user.id), getDrugHistory(user.id)])
      .then(([reports, conditions, medications]) => setExtra({ reports, conditions, medications }));
  }, [user?.id]);

  const labResults = getLabResultsFn('self');
  const summary = useMemo(() => {
    if (!extra || labResults.length === 0) return null;
    return buildClinicianSummary({
      patient: getPatients()[0],
      labResults,
      allResults,
      trends: getTrends('self'),
      reports: extra.reports,
      conditions: extra.conditions,
      medications: extra.medications,
      includeHealthBackground: includeBackground,
    });
  }, [extra, labResults, allResults, getPatients, getTrends, includeBackground]);

  const qrText = useMemo(() => (summary ? buildQrText(summary) : ''), [summary]);

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSharePdf = async () => {
    if (!summary || sharing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      await shareSummaryPdf(summary);
    } catch (e) {
      console.warn('[ClinicianSummary] PDF share failed:', e);
      Alert.alert('Share summary', "We couldn't make the PDF. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const qrSize = Math.min(width - 72, 340);

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={Colors.tealDark} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(30).springify()}>
          <Text style={styles.title}>Share with your clinician</Text>
          <Text style={styles.subtitle}>
            A recap of your latest results: what to watch and why, your trends, and where each value came from.
            Useful for a second opinion or your next visit.
          </Text>
        </Animated.View>

        {isLoading || !extra ? (
          <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
        ) : !summary ? (
          <View style={styles.card}>
            <Text style={styles.cardBody}>Upload a lab report first, then you can share a summary of your results.</Text>
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(70).springify()} style={styles.card}>
              <Text style={styles.cardTitle}>What's in it</Text>
              {summary.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.cardBody}>{b}</Text>
                </View>
              ))}
              <View style={styles.statsRow}>
                <Stat label="Monitor closely" value={summary.monitoring.closely.length} color={Colors.danger} />
                <Stat label="Keep tracking" value={summary.monitoring.tracking.length} color={Colors.warn} />
                <Stat label="Reports" value={summary.reportCount} color={Colors.navy} />
              </View>
              <Text style={styles.note}>
                The PDF also lists every result by body system, and an evidence trail: which report each value came
                from, its test date, and how it was read.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(110).springify()} style={[styles.card, styles.switchRow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Include my conditions and medicines</Text>
                <Text style={styles.note}>Helps your clinician read the results in context.</Text>
              </View>
              <Switch
                value={includeBackground}
                onValueChange={(v) => { Haptics.selectionAsync(); setIncludeBackground(v); }}
                trackColor={{ false: Colors.border, true: Colors.tealMuted }}
                thumbColor={includeBackground ? Colors.teal : Colors.white}
                accessibilityLabel="Include my conditions and medicines"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.privacy}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.tealDark} />
              <Text style={styles.privacyText}>
                This contains your name, results and health details. Share it only with people you trust, such as
                your doctor. TalkingLabs doesn't upload it anywhere.
              </Text>
            </Animated.View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSharePdf}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel="Share as PDF by email, WhatsApp, Notes or another app"
              accessibilityState={{ busy: sharing }}
            >
              {sharing
                ? <ActivityIndicator color={Colors.white} />
                : <Ionicons name="document-text-outline" size={20} color={Colors.white} />}
              <View>
                <Text style={styles.primaryText}>{sharing ? 'Making your PDF…' : 'Share as PDF'}</Text>
                <Text style={styles.primarySub}>Email, WhatsApp, Notes, Drive…</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowQr((v) => !v); }}
              accessibilityRole="button"
              accessibilityLabel={showQr ? 'Hide QR code' : 'Show a QR code your clinician can scan'}
              accessibilityState={{ expanded: showQr }}
            >
              <Ionicons name="qr-code-outline" size={20} color={Colors.teal} />
              <Text style={styles.secondaryText}>{showQr ? 'Hide QR code' : 'Show QR code'}</Text>
            </TouchableOpacity>

            {showQr && (
              <Animated.View entering={FadeInDown.springify()} style={[styles.card, styles.qrCard]}>
                <QrCode
                  value={qrText}
                  size={qrSize}
                  accessibilityLabel="QR code with a short summary of your results"
                />
                <Text style={[styles.cardBody, styles.center]}>
                  Your clinician can scan this with their phone camera. It shows a short text summary; the PDF has
                  everything.
                </Text>
              </Animated.View>
            )}

            <Text style={styles.disclaimer}>
              This summary is not a diagnosis. Consult a licensed healthcare provider.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8, alignSelf: 'flex-start' },
  backText: { ...Typography.body, fontWeight: '600', color: Colors.tealDark },
  content: { paddingHorizontal: 16, paddingBottom: 60 },
  title: { ...Typography.h2, color: Colors.navy, marginBottom: 6 },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: 16 },
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 8 },
  cardBody: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.teal, marginTop: 7 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.bgPrimary },
  statValue: { ...Typography.h3 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  note: { ...Typography.caption, color: Colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { ...Typography.bodySmall, fontWeight: '600', color: Colors.navy },
  privacy: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: Colors.tealLight, marginBottom: 16,
  },
  privacyText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    minHeight: 60, borderRadius: 18, backgroundColor: Colors.teal, paddingHorizontal: 16,
  },
  primaryText: { ...Typography.button, color: Colors.white },
  primarySub: { ...Typography.caption, color: Colors.white },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 18, marginTop: 10, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.tealMuted, backgroundColor: Colors.white,
  },
  secondaryText: { ...Typography.button, color: Colors.teal },
  qrCard: { alignItems: 'center', gap: 12 },
  center: { textAlign: 'center' },
  disclaimer: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
