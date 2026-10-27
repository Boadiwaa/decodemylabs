import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert, InteractionManager } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useModel } from '../context/ModelContext';
import { useUserLabData } from '../hooks/useUserLabData';
import PatientCard from '../components/PatientCard';
import ModelStatusBar from '../components/ModelStatusBar';
import { getSeverityConfig } from '../utils/helpers';
import { deleteLabReport } from '../services/PatientStorage';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { initializeModel } = useModel();
  const insets = useSafeAreaInsets();
  const {
    getPatients, getLabResultsFn, getAlerts, getTrends,
    hasRealData, reportSessions, getReportSessionData, refresh,
  } = useUserLabData();

  const [activeTab, setActiveTab] = useState('current');

  const handleDeleteReport = (session) => {
    Alert.alert(
      'Delete Report',
      `Remove "${session.fileName}" and its ${session.testCount} lab results? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLabReport(user.id, session.reportId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              refresh();
            } catch (e) {
              console.warn('Delete report failed:', e);
              Alert.alert('Error', 'Could not delete the report. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Attempt to load MedGemma model on dashboard mount
  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      initializeModel();
    });

    return () => {
      interactionTask.cancel();
    };
  }, [initializeModel]);

  // Refresh data every time the screen comes into focus (e.g. after uploading)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const visiblePatients = getPatients();
  const greetingName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <View>
            <Text style={styles.headerTitle}>Talking<Text style={{ color: Colors.teal }}>Labs</Text></Text>
            <Text style={styles.headerSub}>Your Labs, Explained Simply</Text>
          </View>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: Colors.tealLight }]}>
          <Ionicons name="person" size={14} color={Colors.tealDark} />
          <Text style={[styles.roleBadgeText, { color: Colors.tealDark }]}>PT</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* AI Model status indicator */}
        <ModelStatusBar />

        {/* Welcome card */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.welcomeCard}>
          <Text style={{ ...Typography.h3, color: Colors.navy }}>Hey {greetingName}! 👋🏿</Text>
          <Text style={{ ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
            Great to see you! Your latest results are ready below.{'\n'}
            Tap your profile card to get a friendly breakdown — you can even listen to it read aloud. 🎧
          </Text>
        </Animated.View>

        {/* Upload Lab Report shortcut */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <TouchableOpacity
            style={styles.uploadBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Upload a lab report"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('LabUpload');
            }}
          >
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={22} color={Colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>Upload a Lab Report</Text>
              <Text style={styles.uploadSub}>PDF, photo, or snap with your camera</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        {/* Dashboard tabs: Current / Past */}
        {hasRealData && reportSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'current' && styles.tabActive]}
              activeOpacity={0.7}
              onPress={() => { Haptics.selectionAsync(); setActiveTab('current'); }}
              accessibilityLabel="Current results"
            >
              <Ionicons name="pulse" size={14} color={activeTab === 'current' ? Colors.teal : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>Current</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'past' && styles.tabActive]}
              activeOpacity={0.7}
              onPress={() => { Haptics.selectionAsync(); setActiveTab('past'); }}
              accessibilityLabel="Past reports"
            >
              <Ionicons name="time-outline" size={14} color={activeTab === 'past' ? Colors.teal : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>Past Reports</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'current' ? 'YOUR RESULTS' : 'PAST REPORTS'}
          </Text>
          <Text style={styles.sectionCount}>
            {activeTab === 'current'
              ? `${visiblePatients.length} patient${visiblePatients.length !== 1 ? 's' : ''}`
              : `${reportSessions.length} report${reportSessions.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* CURRENT TAB — Patient cards (latest results) */}
        {activeTab === 'current' && (
          <>
            {visiblePatients.length > 0 ? (
              visiblePatients.map((p, i) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  labResults={getLabResultsFn(p.id)}
                  patientAlerts={getAlerts(p.id)}
                  patientTrends={getTrends(p.id)}
                  index={i}
                  onPress={(patient) => navigation.navigate('Report', { patientId: patient.id })}
                />
              ))
            ) : (
              <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyCard}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>📋</Text>
                <Text style={styles.emptyTitle}>No lab results yet</Text>
                <Text style={styles.emptySub}>
                  Upload your first lab report to see your results here.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('LabUpload');
                  }}
                  accessibilityLabel="Upload your first lab report"
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>Upload Lab Report</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        )}

        {/* PAST TAB — List of previous report sessions */}
        {activeTab === 'past' && (
          <>
            {reportSessions.length > 0 ? (
              reportSessions.map((session, i) => {
                const sev = getSeverityConfig(session.severity);
                const dateStr = session.date || 'Unknown date';
                return (
                  <Animated.View key={session.reportId} entering={FadeInDown.delay(i * 70).springify()}>
                    <TouchableOpacity
                      style={styles.pastCard}
                      activeOpacity={0.7}
                      accessibilityLabel={`View report from ${dateStr}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('Report', {
                          patientId: 'self',
                          reportId: session.reportId,
                        });
                      }}
                    >
                      <View style={styles.pastIcon}>
                        <Ionicons name="document-text" size={22} color={Colors.teal} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pastTitle} numberOfLines={1}>{session.fileName}</Text>
                        <Text style={styles.pastSub}>{dateStr} · {session.testCount} tests</Text>
                      </View>
                      <View style={[styles.pastBadge, { backgroundColor: sev.bg || Colors.tealLight }]}>
                        <View style={[styles.pastDot, { backgroundColor: sev.color }]} />
                        <Text style={[styles.pastBadgeText, { color: sev.color }]}>{sev.label}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteReport(session)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ marginLeft: 6, padding: 4 }}
                        accessibilityLabel={`Delete report ${session.fileName}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            ) : (
              <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyCard}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🕐</Text>
                <Text style={styles.emptyTitle}>No past reports</Text>
                <Text style={styles.emptySub}>
                  Your previous lab reports will appear here after you upload more.
                </Text>
              </Animated.View>
            )}
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
  logo: {
    width: 36, height: 36, borderRadius: 12,
  },
  headerTitle: { ...Typography.h4, color: Colors.navy },
  headerSub: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: 1 },
  alertRibbon: {
    marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 20,
    backgroundColor: Colors.dangerBg,
    borderWidth: 1, borderColor: Colors.dangerBorder,
    shadowColor: Colors.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12,
  },
  alertIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  alertTitle: { ...Typography.body, fontWeight: '700', color: Colors.danger },
  alertSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  welcomeCard: {
    marginHorizontal: 16, marginTop: 16, padding: 20, borderRadius: 20,
    backgroundColor: Colors.tealLight, borderWidth: 1, borderColor: Colors.tealMuted,
  },
  pillRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14 },
  pill: {
    flex: 1, padding: 12, borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  pillValue: { fontFamily: Typography.serif, fontSize: 22, fontWeight: '700' },
  pillLabel: { ...Typography.pill, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 22, marginBottom: 10,
  },
  sectionTitle: { ...Typography.label, color: Colors.navy },
  sectionCount: { ...Typography.caption, color: Colors.textMuted },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.tealMuted,
    borderStyle: 'dashed',
    gap: 12,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { ...Typography.body, fontWeight: '600', color: Colors.navy },
  uploadSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  emptyCard: {
    marginHorizontal: 16, padding: 32, borderRadius: 20,
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
  tabRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: 18,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
  },
  tabActive: {
    backgroundColor: Colors.tealLight, borderColor: Colors.teal,
  },
  tabText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.teal },
  pastCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 18,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    gap: 12,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  pastIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.tealLight, alignItems: 'center', justifyContent: 'center',
  },
  pastTitle: { ...Typography.body, fontWeight: '600', color: Colors.navy },
  pastSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  pastBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  pastDot: { width: 6, height: 6, borderRadius: 3 },
  pastBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});