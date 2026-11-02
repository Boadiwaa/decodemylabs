/**
 * ModelDownloadCard — offers the one-time Gemma download when the model isn't
 * on the phone yet, and shows its progress. Until it's downloaded the app
 * uses the standard (rule-based) explanations.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useModel } from '../context/ModelContext';
import { formatGB, MODEL_DOWNLOAD } from '../services/ModelSetup';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const SIZE = formatGB(MODEL_DOWNLOAD.bytes);

/**
 * @param {object} props
 * @param {object} [props.style] - Overrides the card's outer spacing
 * @param {boolean} [props.dismissible] - Show "Not now" (hides the card until next time)
 */
export default function ModelDownloadCard({ style, dismissible = true }) {
  const { download, startModelDownload, pauseModelDownload, cancelModelDownload } = useModel();
  const [hidden, setHidden] = useState(false);
  const { status, bytesWritten, totalBytes, error } = download;
  const percent = Math.floor((bytesWritten / totalBytes) * 100);
  const progressText = `${formatGB(bytesWritten)} of ${SIZE} (${percent}%)`;

  const confirmStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Download ${SIZE}?`,
      'This is a large download. Wi-Fi is best, as it can use a lot of mobile data. '
        + 'You can keep using the app while it downloads, and pause at any time.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Download', onPress: startModelDownload },
      ],
    );
  };

  const press = (fn, style = Haptics.ImpactFeedbackStyle.Light) => () => {
    Haptics.impactAsync(style);
    fn();
  };

  if (status === 'done') return null;
  if (hidden && status === 'idle') return null;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.card, style]}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={18} color={Colors.tealDark} />
        </View>
        <Text style={styles.title}>
          {status === 'downloading' ? 'Downloading Gemma AI…'
            : status === 'paused' ? 'Gemma AI download paused'
              : status === 'error' ? 'Gemma AI download stopped'
                : 'Get more detailed explanations'}
        </Text>
      </View>

      {status === 'idle' && (
        <Text style={styles.body}>
          Gemma is an AI that explains your results in more detail. It's a one-time {SIZE} download.
          After that it works without internet, and your results never leave your phone.
        </Text>
      )}

      {(status === 'downloading' || status === 'paused' || (status === 'error' && bytesWritten > 0)) && (
        <>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Gemma AI download"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
          >
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.progressText}>{progressText}</Text>
        </>
      )}

      {status === 'downloading' && (
        <Text style={styles.body}>You can keep using the app while this finishes.</Text>
      )}
      {status === 'error' && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        {status === 'idle' && (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={confirmStart}
              accessibilityRole="button"
              accessibilityLabel={`Download Gemma AI, ${SIZE}`}
            >
              <Ionicons name="download-outline" size={18} color={Colors.white} />
              <Text style={styles.primaryText}>Download ({SIZE})</Text>
            </TouchableOpacity>
            {dismissible && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={press(() => setHidden(true))}
                accessibilityRole="button"
                accessibilityLabel="Not now. Hide this until next time"
              >
                <Text style={styles.secondaryText}>Not now</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {status === 'downloading' && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={press(pauseModelDownload)}
            accessibilityRole="button"
            accessibilityLabel="Pause download"
          >
            <Ionicons name="pause" size={16} color={Colors.teal} />
            <Text style={styles.secondaryText}>Pause</Text>
          </TouchableOpacity>
        )}

        {(status === 'paused' || status === 'error') && (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={press(startModelDownload, Haptics.ImpactFeedbackStyle.Medium)}
              accessibilityRole="button"
              accessibilityLabel={bytesWritten > 0 ? 'Resume download' : 'Try the download again'}
            >
              <Ionicons name={bytesWritten > 0 ? 'play' : 'refresh'} size={16} color={Colors.white} />
              <Text style={styles.primaryText}>{bytesWritten > 0 ? 'Resume' : 'Try again'}</Text>
            </TouchableOpacity>
            {bytesWritten > 0 && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={press(cancelModelDownload)}
                accessibilityRole="button"
                accessibilityLabel="Cancel download and delete the downloaded part"
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.tealMuted,
    gap: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.tealLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...Typography.h4, color: Colors.navy, flex: 1 },
  body: { ...Typography.bodySmall, color: Colors.textSecondary },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.bgSecondary, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.teal },
  progressText: { ...Typography.bodySmall, ...Typography.numbers, color: Colors.textPrimary },
  errorText: { ...Typography.bodySmall, color: Colors.warn },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.teal, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  primaryText: { ...Typography.buttonSmall, color: Colors.white },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  secondaryText: { ...Typography.buttonSmall, color: Colors.teal },
});
