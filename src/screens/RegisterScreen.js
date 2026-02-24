import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function RegisterScreen({ route, navigation }) {
  const { role } = route.params;
  const { register } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePhone = (p) => /^[\d\s\-+()]{7,15}$/.test(p);

  const canSubmit = () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) return false;
    if (!validateEmail(email)) return false;
    if (password.length < 6) return false;
    if (!phone.trim() || !validatePhone(phone)) return false;
    return true;
  };

  const handleRegister = async () => {
    if (!canSubmit()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');

    const result = await register({
      role: 'patient',
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      phone: phone.trim() || null,
    });

    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigation is handled by App.js auth state change
    } else {
      setError(result.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <View style={[styles.roleBadge, { backgroundColor: Colors.tealLight }]}>
              <Ionicons
                name="person"
                size={14}
                color={Colors.tealDark}
              />
              <Text style={[styles.roleBadgeText, { color: Colors.tealDark }]}>
                Patient Registration
              </Text>
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Sign up to view your lab results, hear explanations, and receive reminders.
            </Text>
          </Animated.View>

          {/* Form */}
          <View style={styles.form}>
            {/* Full Name */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </Animated.View>

            {/* Email */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {email.length > 0 && !validateEmail(email) && (
                <Text style={styles.fieldError}>Please enter a valid email address</Text>
              )}
            </Animated.View>

            {/* Phone */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={styles.fieldHint}>Used for appointment and lab reminders via text</Text>
            </Animated.View>

            {/* Password */}
            <Animated.View entering={FadeInDown.delay(400).springify()}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && password.length < 6 && (
                <Text style={styles.fieldError}>Password must be at least 6 characters</Text>
              )}
            </Animated.View>
          </View>

          {/* Error message */}
          {error ? (
            <Animated.View entering={FadeIn} style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          {/* Submit */}
          <Animated.View entering={FadeInDown.delay(450).springify()}>
            <TouchableOpacity
              onPress={handleRegister}
              activeOpacity={0.85}
              disabled={!canSubmit() || loading}
              style={[
                styles.submitBtn,
                { backgroundColor: Colors.teal },
                (!canSubmit() || loading) && styles.submitBtnDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Login link */}
          <Animated.View entering={FadeIn.delay(500)} style={styles.loginLinkWrap}>
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

          {/* Disclaimer */}
          <Animated.View entering={FadeIn.delay(550)} style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.disclaimerText}>
              This app provides educational information only. Always consult a licensed healthcare provider.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  roleBadgeText: {
    ...Typography.labelSmall,
    fontSize: 10,
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
    marginBottom: 24,
  },
  form: {
    gap: 18,
    marginBottom: 20,
  },
  inputLabel: {
    ...Typography.caption,
    color: Colors.navy,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    gap: 10,
    height: 50,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.navy,
    height: '100%',
  },
  fieldError: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 4,
    fontSize: 11,
  },
  fieldHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
    marginLeft: 4,
    fontSize: 11,
  },
  verifyBtn: {
    backgroundColor: Colors.tealLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyBtnText: {
    ...Typography.buttonSmall,
    color: Colors.tealDark,
    fontSize: 11,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  verifiedMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginLeft: 4,
  },
  verifiedMsgText: {
    ...Typography.caption,
    color: Colors.safe,
    fontWeight: '600',
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerBg,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.danger,
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
    marginBottom: 16,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    ...Typography.button,
    color: '#fff',
  },
  loginLinkWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  disclaimerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
