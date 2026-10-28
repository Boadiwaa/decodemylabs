 import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDrugHistory, getMedicalHistory } from '../services/PatientStorage';
import { encryptDemo } from '../utils/helpers';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const SETTINGS_SECTIONS = [
  {
    title: 'Privacy & Security',
    items: [
      { id: 'biometric', label: 'Biometric Lock', icon: 'finger-print', toggle: true, defaultValue: true },
      { id: 'encrypt', label: 'Data Encryption', icon: 'lock-closed', toggle: true, defaultValue: true },
      { id: 'autolock', label: 'Auto-Lock (5 min)', icon: 'timer', toggle: true, defaultValue: false },
      { id: 'audit', label: 'Access Audit Log', icon: 'list', toggle: false },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { id: 'push', label: 'Push Notifications', icon: 'notifications', toggle: true, defaultValue: true },
      { id: 'critical', label: 'Critical Alerts Only', icon: 'alert-circle', toggle: true, defaultValue: false },
      { id: 'reminder_notif', label: 'Reminder Alerts', icon: 'calendar', toggle: true, defaultValue: true },
    ],
  },
  {
    title: 'Data Management',
    items: [
      { id: 'export', label: 'Export Patient Data', icon: 'download', toggle: false },
      { id: 'clear', label: 'Clear Local Cache', icon: 'trash', toggle: false, destructive: true },
    ],
  },
];

function savedSummary(items, singular, plural) {
  if (!items.length) return 'None saved';
  const names = items.map((i) => i.name).slice(0, 2).join(', ');
  const more = items.length > 2 ? ` +${items.length - 2} more` : '';
  return `${items.length} ${items.length === 1 ? singular : plural} · ${names}${more}`;
}

export default function SecurityScreen({ navigation }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [conditions, setConditions] = useState([]);
  const [medicines, setMedicines] = useState([]);

  // Reload whenever Settings is shown, so edits made in the health screens appear.
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      getMedicalHistory(user.id).then(setConditions);
      getDrugHistory(user.id).then(setMedicines);
    }, [user?.id])
  );

  const healthItems = [
    {
      id: 'conditions',
      label: 'Health conditions',
      detail: savedSummary(conditions, 'condition', 'conditions'),
      icon: 'medkit',
      route: 'EditMedicalHistory',
    },
    {
      id: 'medicines',
      label: 'Medicines',
      detail: savedSummary(medicines, 'medicine', 'medicines'),
      icon: 'medical',
      route: 'EditDrugHistory',
    },
  ];
  const [toggles, setToggles] = useState(() => {
    const initial = {};
    SETTINGS_SECTIONS.forEach(section =>
      section.items.forEach(item => {
        if (item.toggle) initial[item.id] = item.defaultValue ?? false;
      })
    );
    return initial;
  });

  const handleToggle = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToggles(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleAction = useCallback(async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.id === 'audit') {
      Alert.alert('Audit Log', 'Last accessed: Sep 24, 2023 — 14:32\nAccess count today: 3\nNo anomalies detected.');
    } else if (item.id === 'export') {
      const hash = await encryptDemo('patient-data-export');
      Alert.alert('Export Ready', `Encrypted hash:\n${hash.slice(0, 24)}…\n\nData would be exported securely.`);
    } else if (item.id === 'clear') {
      Alert.alert('Clear Cache', 'This will remove locally cached data. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
      ]);
    }
  }, []);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>
            YOUR SETTINGS
          </Text>
        </View>
        <View style={[styles.roleBadgeHeader, { backgroundColor: Colors.tealLight }]}>
          <Ionicons
            name="person"
            size={14}
            color={Colors.tealDark}
          />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Mode info card — now shows user profile */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.modeCard}>
          <View style={styles.modeIconWrap}>
            <Ionicons
              name="person"
              size={22}
              color={Colors.tealDark}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>{user?.fullName || 'User'}</Text>
            <Text style={styles.modeDesc}>{user?.email}</Text>
            <Text style={[styles.modeBadge, {
              color: Colors.tealDark,
              backgroundColor: Colors.tealLight,
            }]}>
              Patient
            </Text>
          </View>
        </Animated.View>

        {/* My health */}
        <Animated.View entering={FadeInDown.delay(90).springify().damping(18)} style={styles.section}>
          <Text style={styles.sectionTitle}>My health</Text>
          <View style={styles.sectionCard}>
            {healthItems.map((item, ii) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.6}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate(item.route);
                }}
                style={[styles.settingRow, ii < healthItems.length - 1 && styles.settingRowBorder]}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.label.toLowerCase()}. ${item.detail}`}
              >
                <View style={[styles.settingIcon, { backgroundColor: Colors.tealLight }]}>
                  <Ionicons name={item.icon} size={18} color={Colors.tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingDetail} numberOfLines={1}>{item.detail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionHint}>
            Keeping these up to date helps explain your results in the context of your health.
          </Text>
        </Animated.View>

        {/* Settings sections */}
        {SETTINGS_SECTIONS.map((section, si) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(120 + si * 80).springify().damping(18)}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={item.toggle ? 1 : 0.6}
                  onPress={() => !item.toggle && handleAction(item)}
                  style={[
                    styles.settingRow,
                    ii < section.items.length - 1 && styles.settingRowBorder,
                  ]}
                >
                  <View style={[styles.settingIcon, {
                    backgroundColor: item.destructive ? Colors.dangerBg : Colors.tealLight,
                  }]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.destructive ? Colors.danger : Colors.tealDark}
                    />
                  </View>
                  <Text style={[
                    styles.settingLabel,
                    item.destructive && { color: Colors.danger },
                  ]}>
                    {item.label}
                  </Text>
                  {item.toggle ? (
                    <Switch
                      value={toggles[item.id]}
                      onValueChange={() => handleToggle(item.id)}
                      trackColor={{ false: Colors.border, true: Colors.tealMuted }}
                      thumbColor={toggles[item.id] ? Colors.tealDark : Colors.textMuted}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* About card */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.aboutCard}>
          <Image source={require('../../assets/icon.png')} style={styles.aboutLogo} />
          <Text style={styles.aboutName}>TalkingLabs</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutDisclaimer}>
            This app provides educational health information only.{'\n'}
            Always consult a licensed healthcare provider for medical decisions.
          </Text>
        </Animated.View>

        {/* Logout button */}
        <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.logoutWrap}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Log Out', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log Out',
                  style: 'destructive',
                  onPress: () => logout(),
                },
              ]);
            }}
            activeOpacity={0.7}
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
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

  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 16, padding: 16,
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  modeIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.tealLight,
    alignItems: 'center', justifyContent: 'center',
  },
  modeTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy },
  modeDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  modeBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  roleBadgeHeader: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  section: { marginTop: 24, marginHorizontal: 16 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 8, marginLeft: 4 },
  sectionCard: {
    backgroundColor: Colors.white, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingRowBorder: {
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { ...Typography.body, color: Colors.navy, flex: 1 },
  settingDetail: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  sectionHint: { ...Typography.caption, color: Colors.textMuted, marginTop: 8, marginLeft: 4 },

  aboutCard: {
    alignItems: 'center', marginHorizontal: 16, marginTop: 32,
    paddingVertical: 28, backgroundColor: Colors.white,
    borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight,
  },
  aboutLogo: {
    width: 50, height: 50, borderRadius: 14,
  },
  aboutName: { ...Typography.h4, color: Colors.navy, marginTop: 10 },
  aboutVersion: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  aboutDisclaimer: {
    ...Typography.caption, color: Colors.textMuted,
    textAlign: 'center', marginTop: 12, paddingHorizontal: 24,
  },
  logoutWrap: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.dangerBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  logoutText: {
    ...Typography.button,
    color: Colors.danger,
    fontSize: 15,
  },
});
