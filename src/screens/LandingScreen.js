import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const { width } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'flask',
    title: 'Smart lab interpretation',
    desc: 'AI-powered analysis of blood work, metabolic panels, and more — with clinical context.',
  },
  {
    icon: 'people',
    title: 'Patient-First Design',
    desc: 'Clear, friendly explanations of your lab results — no medical jargon needed.',
  },
  {
    icon: 'volume-high',
    title: 'Multilingual TTS',
    desc: 'Hear results explained in English, French, or Akan — accessible health for all.',
  },
  {
    icon: 'trending-up',
    title: 'Trend analysis',
    desc: 'Track lab values over time. See patterns, catch changes early.',
  },
];

const STATS = [
  { value: '3', label: 'Languages' },
  { value: 'AI', label: 'Powered' },
  { value: '24/7', label: 'Access' },
];

export default function LandingScreen({ navigation }) {
  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('RoleSelect');
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[Colors.tealLight, Colors.bgPrimary, Colors.white]}
          style={styles.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Top bar */}
          <Animated.View entering={FadeIn.delay(100)} style={styles.topBar}>
            <Image source={require('../../assets/icon.png')} style={styles.logoIcon} />
            <Text style={styles.logoText}>
              Decode My <Text style={styles.logoAccent}>Labs</Text>
            </Text>
          </Animated.View>

          {/* Hero content */}
          <Animated.View entering={FadeInDown.delay(200).springify().damping(18)} style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Your Labs, Explained{'\n'}
              <Text style={styles.heroTitleAccent}>simply.</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Decode My Labs employs the best parts of AI to provide on-the-go
              lab interpretation that's accurate and actionable.{'\n'}
              Understand and track your labs easily without compromising on the privacy of your health data.
            </Text>
          </Animated.View>

          {/* CTA Button */}
          <Animated.View entering={FadeInUp.delay(400).springify()}>
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.85}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Get started</Text>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={18} color={Colors.tealDark} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Stats row */}
          <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.statsRow}>
            {STATS.map((stat, i) => (
              <View key={i} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </Animated.View>
        </LinearGradient>

        {/* Divider line */}
        <View style={styles.divider} />

        {/* Features section */}
        <View style={styles.featuresSection}>
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Text style={styles.sectionLabel}>Our solutions</Text>
            <Text style={styles.sectionTitle}>
              Your all in one pocket lab companion.
            </Text>
          </Animated.View>

          {FEATURES.map((feature, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(400 + index * 100).springify().damping(18)}
              style={styles.featureCard}
            >
              <View style={styles.featureIconWrap}>
                <Ionicons name={feature.icon} size={22} color={Colors.teal} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={Colors.tealMuted} />
            </Animated.View>
          ))}
        </View>

        {/* Bottom CTA */}
        <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.bottomCta}>
          <LinearGradient
            colors={[Colors.tealDark, Colors.tealVivid]}
            style={styles.bottomCtaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.bottomCtaTitle}>
              Ready to see your{'\n'}results clearly?
            </Text>
            <Text style={styles.bottomCtaDesc}>
              Simple, direct, and easy to understand — the way health information should be.
            </Text>
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.85}
              style={styles.bottomCtaBtn}
            >
              <Text style={styles.bottomCtaBtnText}>Open dashboard</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.tealDark} />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(900)} style={styles.footer}>
          <View style={styles.footerBrand}>
            <Image source={require('../../assets/icon.png')} style={styles.footerIcon} />
            <Text style={styles.footerLogo}>
              Decode My <Text style={styles.footerLogoAccent}>Labs</Text>
            </Text>
          </View>
          <Text style={styles.footerText}>
            Rebuilding the lab experience for good.
          </Text>
          <Text style={styles.footerDisclaimer}>
            This app provides educational information only.{'\n'}
            Always consult a licensed healthcare provider.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Hero
  heroGradient: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 48,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  logoText: {
    ...Typography.h4,
    color: Colors.navy,
  },
  logoAccent: {
    color: Colors.teal,
  },
  heroContent: {
    marginBottom: 32,
  },
  heroTitle: {
    ...Typography.hero,
    color: Colors.navy,
    marginBottom: 20,
  },
  heroTitleAccent: {
    color: Colors.teal,
    fontStyle: 'italic',
  },
  heroSubtitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    maxWidth: width * 0.85,
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.teal,
    paddingVertical: 16,
    paddingLeft: 28,
    paddingRight: 6,
    borderRadius: 50,
    gap: 14,
    shadowColor: Colors.tealDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  ctaText: {
    ...Typography.button,
    color: Colors.white,
  },
  ctaArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  statValue: {
    ...Typography.stat,
    color: Colors.tealDark,
  },
  statLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 4,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 24,
  },

  // Features
  featuresSection: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.teal,
    marginBottom: 12,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.navy,
    marginBottom: 28,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 3,
  },
  featureDesc: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // Bottom CTA
  bottomCta: {
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bottomCtaGradient: {
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  bottomCtaTitle: {
    ...Typography.h2,
    color: Colors.white,
    marginBottom: 12,
  },
  bottomCtaDesc: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 24,
  },
  bottomCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    gap: 10,
  },
  bottomCtaBtnText: {
    ...Typography.buttonSmall,
    color: Colors.tealDark,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  footerIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  footerLogo: {
    ...Typography.h4,
    color: Colors.navy,
  },
  footerLogoAccent: {
    color: Colors.teal,
  },
  footerText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  footerDisclaimer: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
