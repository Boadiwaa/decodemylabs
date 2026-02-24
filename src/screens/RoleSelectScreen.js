import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function RoleSelectScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Register', { role: 'patient' });
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.tealLight, Colors.bgPrimary, Colors.white]}
        style={[styles.container, { paddingTop: insets.top + 20 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.delay(100)}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.navy} />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(150).springify().damping(18)}>
          <Text style={styles.title}>Welcome to <Text style={{ color: Colors.teal }}>TalkingLabs</Text></Text>
          <Text style={styles.subtitle}>
            Your personal lab results companion. View your results, hear explanations, and track your health over time.
          </Text>
        </Animated.View>

        {/* Patient card */}
        <View style={styles.cardsContainer}>
          <Animated.View entering={FadeInDown.delay(250).springify().damping(18)}>
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.8}
              style={[styles.roleCard, { backgroundColor: Colors.tealLight, borderColor: Colors.tealMuted }]}
            >
              <View style={[styles.roleIcon, { backgroundColor: Colors.teal + '20' }]}>
                <Ionicons name="person" size={28} color={Colors.teal} />
              </View>
              <Text style={styles.roleTitle}>Get Started</Text>
              <Text style={styles.roleDesc}>
                Sign up to view your lab results, hear explanations in multiple languages, and track your health over time.
              </Text>
              <View style={[styles.selectBtn, { backgroundColor: Colors.teal }]}>
                <Text style={styles.selectBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Login link */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.loginLinkWrap}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Login');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    ...Typography.h2,
    color: Colors.navy,
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  cardsContainer: {
    gap: 16,
  },
  roleCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  roleTitle: {
    ...Typography.h4,
    color: Colors.navy,
    marginBottom: 6,
  },
  roleDesc: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  selectBtnText: {
    ...Typography.buttonSmall,
    color: '#fff',
    fontWeight: '600',
  },
  loginLinkWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  loginText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  loginLink: {
    ...Typography.bodySmall,
    color: Colors.teal,
    fontWeight: '700',
  },
});
