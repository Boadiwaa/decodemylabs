/**
 * MedicalHistoryScreen — warm collection of chronic conditions.
 *
 * Patients select from common conditions or add their own, and enter
 * duration in years. Skippable during onboarding — but a gentle nudge
 * explains why it matters. Opened from Settings with { mode: 'edit' } to
 * update the saved list. Data stored strictly on-device via PatientStorage.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getMedicalHistory, saveMedicalHistory } from '../services/PatientStorage';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const CONDITIONS = [
  { id: 'diabetes_type2', name: 'Type 2 Diabetes', icon: 'water' },
  { id: 'diabetes_type1', name: 'Type 1 Diabetes', icon: 'water' },
  { id: 'hypertension', name: 'High Blood Pressure', icon: 'heart' },
  { id: 'heart_disease', name: 'Heart Disease', icon: 'heart-circle' },
  { id: 'asthma', name: 'Asthma', icon: 'cloud' },
  { id: 'copd', name: 'COPD', icon: 'cloud' },
  { id: 'ckd', name: 'Kidney Disease', icon: 'fitness' },
  { id: 'liver_disease', name: 'Liver Disease', icon: 'fitness' },
  { id: 'sickle_cell', name: 'Sickle Cell Disease', icon: 'ellipse' },
  { id: 'hiv', name: 'HIV / AIDS', icon: 'shield' },
  { id: 'cancer', name: 'Cancer (any type)', icon: 'ribbon' },
  { id: 'arthritis', name: 'Arthritis', icon: 'body' },
  { id: 'stroke', name: 'Stroke', icon: 'pulse' },
  { id: 'epilepsy', name: 'Epilepsy', icon: 'flash' },
  { id: 'thyroid', name: 'Thyroid Disease', icon: 'medical' },
  { id: 'high_cholesterol', name: 'High Cholesterol', icon: 'analytics' },
];

function customConditionId(name) {
  return `custom_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

export default function MedicalHistoryScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isEditing = route?.params?.mode === 'edit';

  // { conditionId: { selected: bool, years: string } }
  const [selections, setSelections] = useState({});
  // Conditions the patient typed in: [{ id, name }]
  const [customConditions, setCustomConditions] = useState([]);
  const [otherName, setOtherName] = useState('');

  useEffect(() => {
    if (!isEditing || !user?.id) return;
    getMedicalHistory(user.id).then((saved) => {
      const nextSelections = {};
      const nextCustom = [];
      saved.forEach((c) => {
        nextSelections[c.id] = { selected: true, years: c.years ? String(c.years) : '' };
        if (!CONDITIONS.find((known) => known.id === c.id)) nextCustom.push({ id: c.id, name: c.name });
      });
      setSelections(nextSelections);
      setCustomConditions(nextCustom);
    });
  }, [isEditing, user?.id]);

  const addOtherCondition = () => {
    const name = otherName.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const known = CONDITIONS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const id = known ? known.id : customConditionId(name);
    if (!known && !customConditions.find((c) => c.id === id)) {
      setCustomConditions((prev) => [...prev, { id, name }]);
    }
    setSelections((prev) => (prev[id] ? prev : { ...prev, [id]: { selected: true, years: '' } }));
    setOtherName('');
  };

  const toggleCondition = (id) => {
    Haptics.selectionAsync();
    setSelections((prev) => {
      if (prev[id]?.selected) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { selected: true, years: '' } };
    });
  };

  const setYears = (id, val) => {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], years: val.replace(/[^0-9.]/g, '') },
    }));
  };

  const selectedCount = Object.keys(selections).length;

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const conditions = Object.entries(selections).map(([id, data]) => {
      const cond = CONDITIONS.find((c) => c.id === id) || customConditions.find((c) => c.id === id);
      return {
        id,
        name: cond?.name || id,
        years: parseFloat(data.years) || 0,
      };
    });

    await saveMedicalHistory(user.id, conditions);
    if (isEditing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } else {
      navigation.navigate('DrugHistory');
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('DrugHistory');
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
          {!isEditing && (
            <Animated.View entering={FadeIn.delay(50)} style={styles.progressRow}>
              <View style={[styles.dot, styles.dotDone]} />
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
            </Animated.View>
          )}

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
            <Text style={styles.emoji}>🩺</Text>
            <Text style={styles.title}>
              {isEditing ? 'Your health conditions' : 'Any health conditions we should know about?'}
            </Text>
            <Text style={styles.subtitle}>
              {isEditing
                ? 'Keep this up to date — tick anything new, untick anything that no longer applies, and add conditions that aren\'t listed.'
                : 'If you\'ve been living with any of these, let us know — and for how long. This helps the app give you much more personalized explanations of your lab results.'}
            </Text>
          </Animated.View>

          {/* Conditions grid */}
          <View style={styles.conditionsGrid}>
            {[...CONDITIONS, ...customConditions.map((c) => ({ ...c, icon: 'add-circle' }))].map((cond, i) => {
              const isSelected = !!selections[cond.id]?.selected;
              return (
                <Animated.View
                  key={cond.id}
                  entering={FadeInRight.delay(120 + i * 30).springify().damping(20)}
                >
                  <TouchableOpacity
                    onPress={() => toggleCondition(cond.id)}
                    activeOpacity={0.7}
                    style={[styles.condCard, isSelected && styles.condCardSelected]}
                    accessibilityLabel={cond.name}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.condHeader}>
                      <Ionicons
                        name={cond.icon}
                        size={18}
                        color={isSelected ? Colors.indigo : Colors.textMuted}
                      />
                      <Text style={[styles.condName, isSelected && styles.condNameSelected]}>
                        {cond.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.indigo} />
                      )}
                    </View>

                    {/* Duration input */}
                    {isSelected && (
                      <Animated.View entering={FadeIn.duration(200)} style={styles.durationRow}>
                        <Text style={styles.durationLabel}>For how long?</Text>
                        <View style={styles.durationInputWrap}>
                          <TextInput
                            style={styles.durationInput}
                            placeholder="0"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={selections[cond.id]?.years}
                            onChangeText={(v) => setYears(cond.id, v)}
                            maxLength={3}
                            accessibilityLabel={`Years with ${cond.name}`}
                          />
                          <Text style={styles.durationUnit}>years</Text>
                        </View>
                      </Animated.View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* Other condition */}
          <Animated.View entering={FadeInDown.delay(550).springify()} style={styles.otherCard}>
            <Text style={styles.otherLabel}>Something else?</Text>
            <View style={styles.otherRow}>
              <TextInput
                style={styles.otherInput}
                placeholder="e.g. Gout, Hepatitis B…"
                placeholderTextColor={Colors.textMuted}
                value={otherName}
                onChangeText={setOtherName}
                onSubmitEditing={addOtherCondition}
                returnKeyType="done"
                maxLength={60}
                accessibilityLabel="Other condition name"
              />
              <TouchableOpacity
                onPress={addOtherCondition}
                activeOpacity={0.8}
                style={[styles.otherAddBtn, !otherName.trim() && { opacity: 0.5 }]}
                disabled={!otherName.trim()}
                accessibilityRole="button"
                accessibilityLabel="Add other condition"
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Continue / Skip */}
          <View style={styles.actions}>
            <Animated.View entering={FadeInDown.delay(600).springify()}>
              <TouchableOpacity
                onPress={handleContinue}
                activeOpacity={0.85}
                style={styles.continueBtn}
                accessibilityLabel={isEditing ? 'Save health conditions' : 'Continue to drug history'}
              >
                <Text style={styles.continueBtnText}>
                  {isEditing
                    ? 'Save changes'
                    : selectedCount > 0
                      ? `Continue with ${selectedCount} condition${selectedCount > 1 ? 's' : ''}`
                      : 'Continue — none of these'}
                </Text>
                <Ionicons name={isEditing ? 'checkmark' : 'arrow-forward'} size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            {!isEditing && (
              <Animated.View entering={FadeIn.delay(700)}>
                <TouchableOpacity
                  onPress={handleSkip}
                  activeOpacity={0.7}
                  style={styles.skipBtn}
                  accessibilityLabel="Skip medical history"
                >
                  <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {/* Why this matters */}
          <Animated.View entering={FadeIn.delay(750)} style={styles.whyCard}>
            <Ionicons name="information-circle" size={20} color={Colors.indigo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.whyTitle}>Why does this matter?</Text>
              <Text style={styles.whyText}>
                Lab results mean different things depending on your health background.
                For example, an HbA1c of 6.5% has a very different story if you've been
                managing diabetes for 10 years vs. if this is your first test.
                Sharing this helps us give you explanations that actually make sense for{' '}
                <Text style={{ fontWeight: '700' }}>you</Text>.
              </Text>
            </View>
          </Animated.View>

          {/* Privacy */}
          <Animated.View entering={FadeIn.delay(800)} style={styles.privacy}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.safe} />
            <Text style={styles.privacyText}>
              Stored on your phone only — never uploaded anywhere.
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

  conditionsGrid: { gap: 10, marginBottom: 24 },
  condCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  condCardSelected: {
    backgroundColor: Colors.indigoLight, borderColor: Colors.indigo,
  },
  condHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  condName: {
    ...Typography.body, color: Colors.textPrimary, fontWeight: '600', flex: 1,
  },
  condNameSelected: { color: Colors.indigo },

  durationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  durationLabel: {
    ...Typography.bodySmall, color: Colors.textSecondary,
  },
  durationInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  durationInput: {
    width: 52, height: 36, borderRadius: 10,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    textAlign: 'center', ...Typography.body, fontWeight: '700', color: Colors.navy,
  },
  durationUnit: {
    ...Typography.bodySmall, color: Colors.textMuted,
  },

  otherCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 24,
  },
  otherLabel: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10 },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  otherInput: {
    flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: Colors.bgPrimary, borderWidth: 1, borderColor: Colors.border,
    ...Typography.body, color: Colors.navy,
  },
  otherAddBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.indigo, alignItems: 'center', justifyContent: 'center',
  },

  actions: { marginBottom: 20 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 54, borderRadius: 18,
    backgroundColor: Colors.indigo, marginBottom: 12,
  },
  continueBtnText: { ...Typography.button, color: '#fff' },
  skipBtn: {
    alignItems: 'center', paddingVertical: 12,
  },
  skipText: {
    ...Typography.body, color: Colors.textMuted, fontWeight: '600',
  },

  whyCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: Colors.indigoLight, borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.tealMuted,
  },
  whyTitle: {
    ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 4,
  },
  whyText: {
    ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20,
  },

  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', paddingBottom: 20,
  },
  privacyText: {
    ...Typography.caption, color: Colors.textMuted,
    textAlign: 'center',
  },
});
