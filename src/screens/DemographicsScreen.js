/**
 * DemographicsScreen — warm, friendly collection of patient demographics.
 *
 * Shown after basic registration for patient accounts.
 * Collects: DoB, sex, race, nationality, place of residence.
 * Data is stored strictly on-device via PatientStorage.
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { saveProfile } from '../services/PatientStorage';
import Colors from '../constants/colors';
import Typography from '../constants/typography';
import COUNTRIES from '../constants/countries';

const SEX_OPTIONS = ['Male', 'Female', 'Other'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Validate and build a Date from day/month/year strings. Returns null if invalid. */
function parseDateParts(dd, mm, yyyy) {
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (!d || !m || !y) return null;
  if (y < 1920 || y > new Date().getFullYear()) return null;
  if (m < 1 || m > 12) return null;
  // Check day validity for the specific month/year
  const maxDay = new Date(y, m, 0).getDate();
  if (d < 1 || d > maxDay) return null;
  const date = new Date(y, m - 1, d);
  if (date > new Date()) return null; // can't be in the future
  return date;
}

export default function DemographicsScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [dob, setDob] = useState(null); // Date object
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [dobError, setDobError] = useState('');
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const [sex, setSex] = useState('');
  const [race, setRace] = useState('');
  const [nationality, setNationality] = useState('');
  const [residence, setResidence] = useState('');

  // Country picker state
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [countrySearch]);

  const isValid = dob instanceof Date && sex;

  const formatDate = (date) => {
    if (!date) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd} / ${mm} / ${yyyy}`;
  };

  // Validate & build Date whenever any part changes
  const updateDob = useCallback((day, month, year) => {
    setDobError('');
    // Only validate once all three fields have input
    if (!day && !month && !year) { setDob(null); return; }
    if (!day || !month || !year || year.length < 4) { setDob(null); return; }
    const date = parseDateParts(day, month, year);
    if (date) {
      setDob(date);
      Haptics.selectionAsync();
    } else {
      setDob(null);
      setDobError('Please enter a valid date');
    }
  }, []);

  const handleDayChange = (v) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    setDobDay(clean);
    updateDob(clean, dobMonth, dobYear);
    if (clean.length === 2) monthRef.current?.focus();
  };
  const handleMonthChange = (v) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    setDobMonth(clean);
    updateDob(dobDay, clean, dobYear);
    if (clean.length === 2) yearRef.current?.focus();
  };
  const handleYearChange = (v) => {
    const clean = v.replace(/\D/g, '').slice(0, 4);
    setDobYear(clean);
    updateDob(dobDay, dobMonth, clean);
  };

  const handleContinue = async () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const profile = {
      dob: formatDate(dob),
      sex,
      race: race.trim() || null,
      nationality: nationality || null,
      residence: residence.trim() || null,
      fullName: user?.fullName,
    };

    await saveProfile(user.id, profile);
    navigation.navigate('MedicalHistory');
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
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </Animated.View>

          {/* Greeting */}
          <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
            <Text style={styles.emoji}>👋🏿</Text>
            <Text style={styles.title}>
              Hey {user?.fullName?.split(' ')[0] || 'there'}! Let's get to know you a little.
            </Text>
            <Text style={styles.subtitle}>
              This helps us tailor everything — from lab explanations to health tips — just for you.
              Your info stays on this device only. 🔒
            </Text>
          </Animated.View>

          {/* Form */}
          <View style={styles.form}>
            {/* Date of Birth — pure-JS inline inputs (fast, no native bridge) */}
            <Animated.View entering={FadeInDown.delay(180).springify()}>
              <Text style={styles.inputLabel}>When were you born? 🎂</Text>
              <View style={styles.dobRow}>
                <View style={[styles.dobCell, styles.dobCellSmall]}>
                  <Text style={styles.dobCellLabel}>Day</Text>
                  <TextInput
                    style={styles.dobInput}
                    placeholder="DD"
                    placeholderTextColor={Colors.textMuted}
                    value={dobDay}
                    onChangeText={handleDayChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                    accessibilityLabel="Day of birth"
                  />
                </View>
                <Text style={styles.dobSlash}>/</Text>
                <View style={[styles.dobCell, styles.dobCellSmall]}>
                  <Text style={styles.dobCellLabel}>Month</Text>
                  <TextInput
                    ref={monthRef}
                    style={styles.dobInput}
                    placeholder="MM"
                    placeholderTextColor={Colors.textMuted}
                    value={dobMonth}
                    onChangeText={handleMonthChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    returnKeyType="next"
                    accessibilityLabel="Month of birth"
                  />
                </View>
                <Text style={styles.dobSlash}>/</Text>
                <View style={[styles.dobCell, styles.dobCellLarge]}>
                  <Text style={styles.dobCellLabel}>Year</Text>
                  <TextInput
                    ref={yearRef}
                    style={styles.dobInput}
                    placeholder="YYYY"
                    placeholderTextColor={Colors.textMuted}
                    value={dobYear}
                    onChangeText={handleYearChange}
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="done"
                    accessibilityLabel="Year of birth"
                  />
                </View>
              </View>
              {dob && (
                <Text style={styles.dobPreview}>
                  {dob.getDate()} {MONTHS[dob.getMonth()]} {dob.getFullYear()}
                </Text>
              )}
              {dobError ? <Text style={styles.dobErrorText}>{dobError}</Text> : null}
            </Animated.View>

            {/* Sex */}
            <Animated.View entering={FadeInDown.delay(240).springify()}>
              <Text style={styles.inputLabel}>How do you identify?</Text>
              <View style={styles.chipRow}>
                {SEX_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSex(opt);
                    }}
                    style={[styles.chip, sex === opt && styles.chipSelected]}
                    activeOpacity={0.7}
                    accessibilityLabel={`Sex: ${opt}`}
                    accessibilityState={{ selected: sex === opt }}
                  >
                    <Text style={[styles.chipText, sex === opt && styles.chipTextSelected]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* Race */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <Text style={styles.inputLabel}>What's your ethnic background?</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="people-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Black / African, Caucasian, Asian…"
                  placeholderTextColor={Colors.textMuted}
                  value={race}
                  onChangeText={setRace}
                  autoCapitalize="words"
                  accessibilityLabel="Ethnic background"
                />
              </View>
              <Text style={styles.hint}>
                Some lab reference ranges differ by ethnicity — this helps us be more accurate.
              </Text>
            </Animated.View>

            {/* Nationality — Dropdown */}
            <Animated.View entering={FadeInDown.delay(360).springify()}>
              <Text style={styles.inputLabel}>Nationality</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setCountrySearch('');
                  setShowCountryPicker(true);
                }}
                style={styles.inputWrap}
                activeOpacity={0.7}
                accessibilityLabel="Select nationality"
              >
                <Ionicons name="flag-outline" size={18} color={Colors.textMuted} />
                <Text style={[styles.input, { paddingTop: Platform.OS === 'ios' ? 14 : 12 }, !nationality && { color: Colors.textMuted }]}>
                  {nationality || 'Tap to select your country'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>

            {/* Country Picker Modal */}
            <Modal
              visible={showCountryPicker}
              transparent
              animationType="slide"
            >
              <View style={styles.modalOverlay}>
                <View style={styles.countryPickerModal}>
                  <View style={styles.countryPickerHeader}>
                    <Text style={styles.countryPickerTitle}>Select country</Text>
                    <TouchableOpacity
                      onPress={() => setShowCountryPicker(false)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={26} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.countrySearchWrap}>
                    <Ionicons name="search" size={18} color={Colors.textMuted} />
                    <TextInput
                      style={styles.countrySearchInput}
                      placeholder="Search countries…"
                      placeholderTextColor={Colors.textMuted}
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                    {countrySearch.length > 0 && (
                      <TouchableOpacity onPress={() => setCountrySearch('')}>
                        <Ionicons name="close" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    data={filteredCountries}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.selectionAsync();
                          setNationality(item);
                          setShowCountryPicker(false);
                        }}
                        style={[
                          styles.countryItem,
                          nationality === item && styles.countryItemSelected,
                        ]}
                        activeOpacity={0.6}
                      >
                        <Text style={[
                          styles.countryItemText,
                          nationality === item && styles.countryItemTextSelected,
                        ]}>
                          {item}
                        </Text>
                        {nationality === item && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.indigo} />
                        )}
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={styles.countrySeparator} />}
                    style={styles.countryList}
                  />
                </View>
              </View>
            </Modal>

            {/* Place of Residence */}
            <Animated.View entering={FadeInDown.delay(420).springify()}>
              <Text style={styles.inputLabel}>Where do you live? 🏠</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Accra, Lagos, London…"
                  placeholderTextColor={Colors.textMuted}
                  value={residence}
                  onChangeText={setResidence}
                  autoCapitalize="words"
                  accessibilityLabel="Place of residence"
                />
              </View>
            </Animated.View>
          </View>

          {/* Continue */}
          <Animated.View entering={FadeInDown.delay(480).springify()}>
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.85}
              disabled={!isValid}
              style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
              accessibilityLabel="Continue to medical history"
            >
              <Text style={styles.continueBtnText}>Next — Your health history</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>

          {/* Privacy note */}
          <Animated.View entering={FadeIn.delay(550)} style={styles.privacy}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.safe} />
            <Text style={styles.privacyText}>
              Everything you share stays on your phone. We never send your data to any server.
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
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.border,
  },
  dotActive: { backgroundColor: Colors.indigo, width: 28 },

  emoji: { fontSize: 36, marginBottom: 8 },
  title: {
    ...Typography.h2, color: Colors.navy, marginBottom: 10,
  },
  subtitle: {
    ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 28,
  },

  form: { gap: 22, marginBottom: 28 },

  inputLabel: {
    ...Typography.body, color: Colors.navy, fontWeight: '600', marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, gap: 10, height: 52,
  },
  input: {
    flex: 1, ...Typography.body, color: Colors.navy, height: '100%',
  },
  hint: {
    ...Typography.caption, color: Colors.textMuted, marginTop: 6, marginLeft: 4,
  },

  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.indigoLight, borderColor: Colors.indigo,
  },
  chipText: {
    ...Typography.body, color: Colors.textSecondary, fontWeight: '600',
  },
  chipTextSelected: { color: Colors.indigo },

  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 54, borderRadius: 18,
    backgroundColor: Colors.indigo, marginBottom: 16,
  },
  continueBtnDisabled: { opacity: 0.45 },
  continueBtnText: { ...Typography.button, color: '#fff' },

  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', paddingBottom: 20,
  },
  privacyText: {
    ...Typography.caption, color: Colors.textMuted,
    textAlign: 'center', flex: 1,
  },

  /* ----------  Modal common  ---------- */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  /* ----------  Date of birth inputs  ---------- */
  dobRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
  },
  dobCell: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4,
  },
  dobCellSmall: { flex: 1 },
  dobCellLarge: { flex: 1.5 },
  dobCellLabel: {
    ...Typography.caption, color: Colors.textMuted,
    fontWeight: '600',
  },
  dobInput: {
    ...Typography.body, color: Colors.navy, fontWeight: '700',
    fontSize: 18, height: 36, padding: 0, textAlign: 'center',
  },
  dobSlash: {
    ...Typography.body, color: Colors.textMuted, fontSize: 22,
    fontWeight: '300', paddingBottom: 8,
  },
  dobPreview: {
    ...Typography.caption, color: Colors.safe, fontWeight: '600',
    marginTop: 6, marginLeft: 4,
  },
  dobErrorText: {
    ...Typography.caption, color: Colors.danger, fontWeight: '600',
    marginTop: 6, marginLeft: 4,
  },

  /* ----------  Country picker  ---------- */
  countryPickerModal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34, maxHeight: '75%',
  },
  countryPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  countryPickerTitle: {
    ...Typography.h3, color: Colors.navy,
  },
  countrySearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.bgPrimary, borderRadius: 14,
    paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: Colors.border,
  },
  countrySearchInput: {
    flex: 1, ...Typography.body, color: Colors.navy, height: '100%',
  },
  countryList: {
    flexGrow: 0,
  },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  countryItemSelected: {
    backgroundColor: Colors.indigoLight,
  },
  countryItemText: {
    ...Typography.body, color: Colors.textPrimary,
  },
  countryItemTextSelected: {
    color: Colors.indigo, fontWeight: '700',
  },
  countrySeparator: {
    height: 1, backgroundColor: Colors.borderLight, marginHorizontal: 20,
  },
});
