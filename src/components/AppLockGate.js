/**
 * AppLockGate — covers the app until the patient unlocks it with their
 * fingerprint, face, or phone PIN, when App lock is on in Settings.
 *
 * Locks when the app starts and when it comes back after being in the
 * background for LOCK_AFTER_MS. The screens stay mounted underneath, so
 * unlocking returns the patient to where they were.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { getAppSettings } from '../services/PatientStorage';
import { authenticate, getLockAvailability } from '../services/AppLock';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const LOCK_AFTER_MS = 60 * 1000;

/**
 * Lock only when App lock is on and the phone has a screen lock to check.
 * If the screen lock was removed there is nothing to verify, and locking
 * would shut the patient out.
 */
async function shouldLock(userId) {
  const settings = await getAppSettings(userId);
  return settings.appLock && (await getLockAvailability()).available;
}

export default function AppLockGate({ userId, children }) {
  const { logout } = useAuth();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const backgroundedAt = useRef(null);
  const prompting = useRef(false);

  useEffect(() => {
    let active = true;
    shouldLock(userId).then((lock) => {
      if (!active) return;
      setLocked(lock);
      setChecking(false);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active' || backgroundedAt.current == null) return;
      const away = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (away >= LOCK_AFTER_MS && (await shouldLock(userId))) {
        setMessage('');
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [userId]);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const result = await authenticate('Unlock Decode My Labs');
    prompting.current = false;
    // The system prompt can move the app to the background; don't count that as leaving.
    backgroundedAt.current = null;
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocked(false);
      setMessage('');
    } else {
      setMessage(result.message);
    }
  }, []);

  // Ask straight away when the lock appears.
  useEffect(() => {
    if (locked && !checking) unlock();
  }, [locked, checking, unlock]);

  const covered = checking || locked;

  return (
    <View style={{ flex: 1 }}>
      {/* While locked, hide the screens underneath from screen readers too. */}
      <View
        style={{ flex: 1 }}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={covered}
      >
        {children}
      </View>
      {covered && (
        <View style={styles.cover} accessibilityViewIsModal>
          {!checking && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.content}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} />
              <Text style={styles.title}>Decode My Labs is locked</Text>
              <Text style={styles.subtitle}>
                Use your fingerprint, face, or phone PIN to see your health information.
              </Text>

              {!!message && (
                <Animated.View entering={FadeInDown.springify()} style={styles.messageCard}>
                  <Ionicons name="information-circle" size={18} color={Colors.warn} />
                  <Text style={styles.messageText}>{message}</Text>
                </Animated.View>
              )}

              <TouchableOpacity
                style={styles.unlockBtn}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  unlock();
                }}
                accessibilityRole="button"
                accessibilityLabel="Unlock Decode My Labs"
              >
                <Ionicons name="finger-print" size={20} color="#fff" />
                <Text style={styles.unlockText}>Unlock</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutBtn}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  logout();
                }}
                accessibilityRole="button"
                accessibilityLabel="Log out and sign in with your password instead"
              >
                <Text style={styles.logoutText}>Log out and use my password instead</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { alignItems: 'center', width: '100%' },
  logo: { width: 72, height: 72, borderRadius: 20, marginBottom: 20 },
  title: { ...Typography.h2, color: Colors.navy, textAlign: 'center', marginBottom: 8 },
  subtitle: {
    ...Typography.body, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  messageCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warnBg, borderColor: Colors.warnBorder, borderWidth: 1,
    borderRadius: 14, padding: 12, marginBottom: 20, alignSelf: 'stretch',
  },
  messageText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, borderRadius: 18, backgroundColor: Colors.teal, alignSelf: 'stretch',
  },
  unlockText: { ...Typography.button, color: '#fff' },
  logoutBtn: { paddingVertical: 16 },
  logoutText: { ...Typography.bodySmall, color: Colors.teal, fontWeight: '600' },
});
