 import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  getAppSettings, getDrugHistory, getMedicalHistory, saveAppSettings,
} from '../services/PatientStorage';
import { authenticate, getLockAvailability } from '../services/AppLock';
import { exportBackup, pickBackup, restoreBackup } from '../services/DataBackup';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

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
      getAppSettings(user.id).then((settings) => setAppLock(settings.appLock));
    }, [user?.id])
  );

  // Turning the lock on or off asks for the fingerprint/face/PIN first, so a
  // patient can't lock themselves out and someone else can't switch it off.
  const handleAppLockToggle = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const turningOn = !appLock;
    const availability = await getLockAvailability();
    if (turningOn && !availability.available) {
      Alert.alert('App lock', availability.message);
      return;
    }
    // With no phone screen lock there is nothing to check, so turning the lock
    // off is allowed; otherwise the patient could never switch it off.
    if (availability.available) {
      const result = await authenticate(turningOn ? 'Turn on app lock' : 'Turn off app lock');
      if (!result.success) return;
    }
    await saveAppSettings(user.id, { appLock: turningOn });
    setAppLock(turningOn);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [appLock, user?.id]);

  const runExport = useCallback(async () => {
    setBusy('export');
    try {
      await exportBackup(user.id);
    } catch (e) {
      console.warn('[Settings] Export failed:', e);
      Alert.alert('Backup', "We couldn't create your backup. Please try again.");
    } finally {
      setBusy(null);
    }
  }, [user?.id]);

  const handleExport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Save a backup',
      'The backup file holds your health information, conditions, medicines and report photos. '
        + "It is not password-protected, so save it somewhere private (for example your own Google Drive) "
        + 'and avoid sending it in chats.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: runExport },
      ],
    );
  }, [runExport]);

  const handleImport = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy('import');
    let picked;
    try {
      picked = await pickBackup();
    } finally {
      setBusy(null);
    }
    if (!picked) return;
    if (!picked.ok) {
      Alert.alert('Restore', picked.reason);
      return;
    }

    const s = picked.summary;
    Alert.alert(
      'Restore this backup?',
      `Backup from ${s.exportedOn}: ${s.reports} report${s.reports !== 1 ? 's' : ''}, `
        + `${s.results} result${s.results !== 1 ? 's' : ''}, ${s.conditions} condition${s.conditions !== 1 ? 's' : ''} `
        + `and ${s.medicines} medicine${s.medicines !== 1 ? 's' : ''}.\n\n`
        + 'This replaces the health information currently in the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace my data',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            try {
              await restoreBackup(user.id, picked.backup);
              setConditions(await getMedicalHistory(user.id));
              setMedicines(await getDrugHistory(user.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Restore', 'Your backup has been restored.');
            } catch (e) {
              console.warn('[Settings] Restore failed:', e);
              Alert.alert('Restore', "We couldn't restore this backup. Your existing data was not changed.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, [user?.id]);

  const dataItems = [
    { id: 'export', label: 'Save a backup', detail: 'Reports, results, conditions and medicines', icon: 'download', onPress: handleExport },
    { id: 'import', label: 'Restore from a backup', detail: 'Replaces the data in the app', icon: 'cloud-upload', onPress: handleImport },
  ];

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
  const [appLock, setAppLock] = useState(false);
  const [busy, setBusy] = useState(null); // 'export' | 'import' | null
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

        {/* Privacy */}
        <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.sectionCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.tealLight }]}>
                <Ionicons name="finger-print" size={18} color={Colors.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>App lock</Text>
                <Text style={styles.settingDetail}>Fingerprint, face or phone PIN to open the app</Text>
              </View>
              <Switch
                value={appLock}
                onValueChange={handleAppLockToggle}
                trackColor={{ false: Colors.border, true: Colors.tealMuted }}
                thumbColor={appLock ? Colors.teal : Colors.white}
                accessibilityLabel="App lock"
              />
            </View>
          </View>
        </Animated.View>

        {/* Your data */}
        <Animated.View entering={FadeInDown.delay(210).springify().damping(18)} style={styles.section}>
          <Text style={styles.sectionTitle}>Your data</Text>
          <View style={styles.sectionCard}>
            {dataItems.map((item, ii) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.6}
                onPress={item.onPress}
                disabled={!!busy}
                style={[styles.settingRow, ii < dataItems.length - 1 && styles.settingRowBorder]}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.detail}`}
              >
                <View style={[styles.settingIcon, { backgroundColor: Colors.tealLight }]}>
                  <Ionicons name={item.icon} size={18} color={Colors.tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingDetail}>{item.detail}</Text>
                </View>
                {busy === item.id
                  ? <ActivityIndicator size="small" color={Colors.teal} />
                  : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionHint}>
            Everything is kept on this phone. A backup lets you move to a new phone or recover after
            reinstalling. Backup files are not password-protected.
          </Text>
        </Animated.View>

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
