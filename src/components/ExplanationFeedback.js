/**
 * ExplanationFeedback — "Was this explanation helpful?" with thumbs up / down.
 *
 * The answer is saved on this phone against the result, so it shows again on
 * a later visit and can be changed. A thumbs down offers a link to the
 * feedback form to say what was unclear.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { getExplanationRatings, saveExplanationRating } from '../services/PatientStorage';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

/**
 * @param {object} props
 * @param {string} props.userId
 * @param {string} props.resultId
 * @param {'gemma'|'standard'} props.source - Which explanation the patient read
 * @param {() => void} props.onTellUsMore - Opens the feedback form
 */
export default function ExplanationFeedback({ userId, resultId, source, onTellUsMore }) {
  const [helpful, setHelpful] = useState(null); // true | false | null

  useEffect(() => {
    let active = true;
    if (!userId || !resultId) return undefined;
    getExplanationRatings(userId).then((all) => {
      if (active) setHelpful(all[resultId] ? all[resultId].helpful : null);
    });
    return () => { active = false; };
  }, [userId, resultId]);

  const choose = (value) => {
    Haptics.selectionAsync();
    // Tapping the chosen answer again clears it.
    const next = helpful === value ? null : value;
    setHelpful(next);
    saveExplanationRating(userId, resultId, next === null ? null : { helpful: next, source });
  };

  const thumb = (value, icon, label) => {
    const selected = helpful === value;
    return (
      <TouchableOpacity
        onPress={() => choose(value)}
        style={[styles.thumb, selected && styles.thumbSelected]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Ionicons name={selected ? icon : `${icon}-outline`} size={20} color={selected ? Colors.white : Colors.teal} />
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.question}>
          {helpful === null ? 'Was this explanation helpful?' : 'Thanks for telling us.'}
        </Text>
        <View style={styles.thumbs}>
          {thumb(true, 'thumbs-up', 'Yes, this explanation was helpful')}
          {thumb(false, 'thumbs-down', 'No, this explanation was not helpful')}
        </View>
      </View>
      {helpful === false && (
        <Animated.View entering={FadeIn}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTellUsMore();
            }}
            style={styles.moreBtn}
            accessibilityRole="button"
            accessibilityLabel="Tell us what was unclear"
          >
            <Text style={styles.moreText}>Tell us what was unclear</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.teal} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  question: { ...Typography.bodySmall, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  thumbs: { flexDirection: 'row', gap: 8 },
  thumb: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.tealMuted, backgroundColor: Colors.bgCard,
  },
  thumbSelected: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 10 },
  moreText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.teal },
});
