/**
 * FeedbackScreen — a short form (rating, topic, comment) that opens the
 * patient's email app with the message filled in. Reached from Settings and
 * from "Tell us what was unclear" under an explanation.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getExplanationRatings, summarizeExplanationRatings } from '../services/PatientStorage';
import { buildFeedbackMessage, sendFeedback } from '../services/Feedback';
import liteRTService from '../services/LiteRTService';
import { FEEDBACK_EMAIL, FEEDBACK_TOPICS } from '../constants/feedback';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const RATING_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Great'];

export default function FeedbackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState(route?.params?.topic || null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sentVia, setSentVia] = useState(null); // 'email' | 'share'

  const canSend = rating > 0 || comment.trim().length > 0;

  const handleSend = async () => {
    if (!canSend || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      const ratings = user?.id ? summarizeExplanationRatings(await getExplanationRatings(user.id)) : null;
      const result = await sendFeedback(buildFeedbackMessage({
        rating, topic, comment, ratings, aiBackend: liteRTService.isReady ? liteRTService.backend : null,
      }));
      if (result !== 'cancelled') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSentVia(result);
      }
    } catch (e) {
      console.warn('[Feedback] Could not open email or share:', e);
      Alert.alert('Feedback', "We couldn't open your email app. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={Colors.tealDark} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </Animated.View>

      {sentVia ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.thanks}>
          <View style={styles.thanksIcon}>
            <Ionicons name="heart" size={28} color={Colors.teal} />
          </View>
          <Text style={[styles.title, styles.center]}>Thank you</Text>
          <Text style={[styles.subtitle, styles.center]}>
            {sentVia === 'email'
              ? 'Your email app has opened with your feedback. Tap send there to finish.'
              : 'Your feedback is ready to send from the app you chose.'}
            {' '}It helps make TalkingLabs clearer for everyone.
          </Text>
          <TouchableOpacity style={styles.sendBtn} onPress={goBack} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.sendText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.delay(30).springify()}>
              <Text style={styles.title}>Send feedback</Text>
              <Text style={styles.subtitle}>Tell us what's working and what isn't. We read every message.</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(70).springify()} style={styles.section}>
              <Text style={styles.label}>How is TalkingLabs working for you?</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => { Haptics.selectionAsync(); setRating(n === rating ? 0 : n); }}
                    style={styles.star}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} out of 5, ${RATING_WORDS[n]}`}
                    accessibilityState={{ selected: n <= rating }}
                  >
                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={n <= rating ? Colors.teal : Colors.tealMuted} />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && <Text style={styles.ratingWord}>{RATING_WORDS[rating]}</Text>}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.section}>
              <Text style={styles.label}>What's it about?</Text>
              <View style={styles.chips}>
                {FEEDBACK_TOPICS.map((t) => {
                  const selected = topic === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => { Haptics.selectionAsync(); setTopic(selected ? null : t.key); }}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={t.label}
                      accessibilityState={{ selected }}
                    >
                      <Ionicons name={t.icon} size={16} color={selected ? Colors.white : Colors.tealDark} />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
              <Text style={styles.label}>Tell us more</Text>
              <TextInput
                style={styles.input}
                value={comment}
                onChangeText={setComment}
                placeholder={topic === 'explanation'
                  ? 'Which part was unclear? What would have helped?'
                  : 'What happened, or what would make the app better?'}
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={2000}
                accessibilityLabel="Your feedback"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(190).springify()} style={styles.privacy}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.tealDark} />
              <Text style={styles.privacyText}>
                Please don't include your lab results or other health details. We add only the app
                version, your phone model and how many explanations you found helpful.
                {FEEDBACK_EMAIL ? ' You will see the full message before it is sent.' : ''}
              </Text>
            </Animated.View>

            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend || sending}
              accessibilityRole="button"
              accessibilityLabel="Send feedback"
              accessibilityState={{ disabled: !canSend || sending }}
            >
              <Ionicons name="send" size={18} color={Colors.white} />
              <Text style={styles.sendText}>{sending ? 'Opening…' : 'Send feedback'}</Text>
            </TouchableOpacity>
            {!canSend && <Text style={styles.hint}>Choose a rating or write a comment to send.</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8, alignSelf: 'flex-start' },
  backText: { ...Typography.body, fontWeight: '600', color: Colors.tealDark },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  title: { ...Typography.h2, color: Colors.navy, marginBottom: 8 },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: 20 },
  section: { marginBottom: 22 },
  label: { ...Typography.body, fontWeight: '600', color: Colors.navy, marginBottom: 10 },
  stars: { flexDirection: 'row', gap: 4 },
  star: { padding: 6 },
  ratingWord: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 4, marginLeft: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipText: { ...Typography.bodySmall, color: Colors.textPrimary },
  chipTextSelected: { color: Colors.white, fontWeight: '600' },
  input: {
    ...Typography.body, color: Colors.navy,
    minHeight: 130, padding: 14, borderRadius: 16,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  privacy: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: Colors.tealLight, marginBottom: 20,
  },
  privacyText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 18, backgroundColor: Colors.teal, alignSelf: 'stretch',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { ...Typography.button, color: Colors.white },
  hint: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  center: { textAlign: 'center' },
  thanks: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  thanksIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.tealLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
});
