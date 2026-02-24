/**
 * DrugHistoryScreen — warm collection of current medications.
 *
 * Patients can add medications with dosage and duration.
 * Skippable. Data stored strictly on-device via PatientStorage.
 * Last screen in the onboarding flow → marks onboarding complete.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { saveDrugHistory } from '../services/PatientStorage';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const COMMON_DRUGS = [
  'Metformin', 'Amlodipine', 'Lisinopril', 'Atorvastatin',
  'Omeprazole', 'Aspirin', 'Metoprolol', 'Insulin',
  'Hydrochlorothiazide', 'Ibuprofen', 'Paracetamol', 'Amoxicillin',
];

export default function DrugHistoryScreen({ navigation }) {
  const { user, completeOnboarding } = useAuth();
  const insets = useSafeAreaInsets();

  // Array of { name, dosage, frequency, years }
  const [medications, setMedications] = useState([]);
  const [newDrug, setNewDrug] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addMedication = (name) => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (medications.find((m) => m.name.toLowerCase() === name.trim().toLowerCase())) return;
    setMedications((prev) => [
      ...prev,
      { name: name.trim(), dosage: '', frequency: '', years: '' },
    ]);
    setNewDrug('');
    setShowSuggestions(false);
  };

  const removeMedication = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = (index, field, value) => {
    setMedications((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const filteredSuggestions = COMMON_DRUGS.filter(
    (d) =>
      d.toLowerCase().includes(newDrug.toLowerCase()) &&
      !medications.find((m) => m.name.toLowerCase() === d.toLowerCase())
  );

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (medications.length > 0) {
      await saveDrugHistory(user.id, medications);
    }

    // Mark onboarding complete — this triggers navigation to MainTabs
    await completeOnboarding();
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await completeOnboarding();
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <Animated.View entering={FadeIn.delay(50)}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.goBack();
              }}
              style={styles.backBtn}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={Colors.navy} />
            </TouchableOpacity>
          </Animated.View>

          {/* Progress dots */}
          <Animated.View entering={FadeIn.delay(50)} style={styles.progressRow}>
            <View style={[styles.dot, styles.dotDone]} />
            <View style={[styles.dot, styles.dotDone]} />
            <View style={[styles.dot, styles.dotActive]} />
          </Animated.View>

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
            <Text style={styles.emoji}>💊</Text>
            <Text style={styles.title}>Taking any medications?</Text>
            <Text style={styles.subtitle}>
              List any medicines you take regularly — prescriptions, supplements,
              over-the-counter stuff. This helps us flag potential interactions and
              give you better explanations.
            </Text>
          </Animated.View>

          {/* Add medication input */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Text style={styles.inputLabel}>Add a medication</Text>
            <View style={styles.addRow}>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Ionicons name="medical-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Metformin, Aspirin…"
                  placeholderTextColor={Colors.textMuted}
                  value={newDrug}
                  onChangeText={(v) => {
                    setNewDrug(v);
                    setShowSuggestions(v.length > 0);
                  }}
                  onSubmitEditing={() => addMedication(newDrug)}
                  returnKeyType="done"
                  autoCapitalize="words"
                  accessibilityLabel="Medication name"
                />
              </View>
              <TouchableOpacity
                onPress={() => addMedication(newDrug)}
                style={[styles.addBtn, !newDrug.trim() && { opacity: 0.4 }]}
                disabled={!newDrug.trim()}
                activeOpacity={0.7}
                accessibilityLabel="Add medication"
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <Animated.View entering={FadeIn.duration(150)} style={styles.suggestions}>
                {filteredSuggestions.slice(0, 5).map((drug) => (
                  <TouchableOpacity
                    key={drug}
                    onPress={() => addMedication(drug)}
                    style={styles.suggestionItem}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={Colors.indigo} />
                    <Text style={styles.suggestionText}>{drug}</Text>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </Animated.View>

          {/* Quick-add chips */}
          {medications.length === 0 && !newDrug && (
            <Animated.View entering={FadeIn.delay(300)} style={styles.quickAddSection}>
              <Text style={styles.quickAddLabel}>Common medications — tap to add:</Text>
              <View style={styles.chipRow}>
                {COMMON_DRUGS.slice(0, 8).map((drug) => (
                  <TouchableOpacity
                    key={drug}
                    onPress={() => addMedication(drug)}
                    style={styles.chip}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>{drug}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Medication list */}
          {medications.length > 0 && (
            <View style={styles.medList}>
              <Text style={styles.medListTitle}>
                Your medications ({medications.length})
              </Text>
              {medications.map((med, i) => (
                <Animated.View
                  key={`${med.name}-${i}`}
                  entering={FadeInRight.delay(i * 50).springify()}
                  exiting={FadeOut.duration(150)}
                  style={styles.medCard}
                >
                  <View style={styles.medHeader}>
                    <Ionicons name="medical" size={18} color={Colors.indigo} />
                    <Text style={styles.medName}>{med.name}</Text>
                    <TouchableOpacity
                      onPress={() => removeMedication(i)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel={`Remove ${med.name}`}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.medFields}>
                    <View style={styles.medField}>
                      <Text style={styles.medFieldLabel}>Dosage</Text>
                      <TextInput
                        style={styles.medFieldInput}
                        placeholder="e.g. 500mg"
                        placeholderTextColor={Colors.textMuted}
                        value={med.dosage}
                        onChangeText={(v) => updateField(i, 'dosage', v)}
                        accessibilityLabel={`${med.name} dosage`}
                      />
                    </View>
                    <View style={styles.medField}>
                      <Text style={styles.medFieldLabel}>How often?</Text>
                      <TextInput
                        style={styles.medFieldInput}
                        placeholder="e.g. twice daily"
                        placeholderTextColor={Colors.textMuted}
                        value={med.frequency}
                        onChangeText={(v) => updateField(i, 'frequency', v)}
                        accessibilityLabel={`${med.name} frequency`}
                      />
                    </View>
                    <View style={styles.medField}>
                      <Text style={styles.medFieldLabel}>Years</Text>
                      <TextInput
                        style={[styles.medFieldInput, { width: 52, textAlign: 'center' }]}
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        maxLength={3}
                        value={med.years}
                        onChangeText={(v) => updateField(i, 'years', v.replace(/[^0-9.]/g, ''))}
                        accessibilityLabel={`${med.name} duration in years`}
                      />
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Continue / Skip */}
          <View style={styles.actions}>
            <Animated.View entering={FadeInDown.delay(400).springify()}>
              <TouchableOpacity
                onPress={handleFinish}
                activeOpacity={0.85}
                style={styles.continueBtn}
                accessibilityLabel="Finish setup"
              >
                <Text style={styles.continueBtnText}>
                  {medications.length > 0 ? "All set — let's go! 🎉" : "No medications — let's go!"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(500)}>
              <TouchableOpacity
                onPress={handleSkip}
                activeOpacity={0.7}
                style={styles.skipBtn}
                accessibilityLabel="Skip drug history"
              >
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Privacy */}
          <Animated.View entering={FadeIn.delay(600)} style={styles.privacy}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.safe} />
            <Text style={styles.privacyText}>
              Your medication list stays on your phone only. Always.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight,
  },

  progressRow: {
    flexDirection: 'row', alignSelf: 'center', gap: 8, marginBottom: 28,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.indigo, width: 28 },
  dotDone: { backgroundColor: Colors.safe },

  emoji: { fontSize: 36, marginBottom: 8 },
  title: { ...Typography.h2, color: Colors.navy, marginBottom: 10 },
  subtitle: {
    ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24,
  },

  inputLabel: {
    ...Typography.body, color: Colors.navy, fontWeight: '600', marginBottom: 8,
  },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, gap: 10, height: 52,
  },
  input: { flex: 1, ...Typography.body, color: Colors.navy, height: '100%' },
  addBtn: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.indigo, alignItems: 'center', justifyContent: 'center',
  },

  suggestions: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  suggestionText: { ...Typography.body, color: Colors.textPrimary },

  quickAddSection: { marginBottom: 20 },
  quickAddLabel: {
    ...Typography.caption, color: Colors.textMuted, marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { ...Typography.bodySmall, color: Colors.textSecondary },

  medList: { marginTop: 8, marginBottom: 24 },
  medListTitle: {
    ...Typography.label, color: Colors.textSecondary, marginBottom: 12,
  },
  medCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 10,
  },
  medHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  medName: { ...Typography.body, fontWeight: '700', color: Colors.navy, flex: 1 },
  medFields: { flexDirection: 'row', gap: 8 },
  medField: { flex: 1 },
  medFieldLabel: {
    ...Typography.caption, color: Colors.textMuted, fontSize: 10, marginBottom: 4,
  },
  medFieldInput: {
    height: 36, borderRadius: 10,
    backgroundColor: Colors.bgPrimary, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, ...Typography.bodySmall, color: Colors.navy,
  },

  actions: { marginBottom: 16 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 54, borderRadius: 18,
    backgroundColor: Colors.indigo, marginBottom: 12,
  },
  continueBtnText: { ...Typography.button, color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { ...Typography.body, color: Colors.textMuted, fontWeight: '600' },

  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', paddingBottom: 20,
  },
  privacyText: {
    ...Typography.caption, color: Colors.textMuted, fontSize: 11, textAlign: 'center',
  },
});
