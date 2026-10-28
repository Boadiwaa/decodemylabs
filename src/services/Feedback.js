/**
 * Feedback — builds the feedback message and hands it to the patient's email
 * app (or the share sheet). Nothing is sent in the background: the patient sees
 * the full message and chooses to send it.
 *
 * The message carries only what the patient typed plus app details and the
 * counts of "Was this helpful?" answers. No results, names or health details
 * are added.
 */

import { Linking, Platform, Share } from 'react-native';
import * as Device from 'expo-device';
import appConfig from '../../app.json';
import { FEEDBACK_EMAIL, FEEDBACK_TOPICS } from '../constants/feedback';

export const APP_VERSION = appConfig.expo.version;

/**
 * @param {object} feedback
 * @param {number} [feedback.rating] - 1 to 5
 * @param {string} [feedback.topic] - FEEDBACK_TOPICS key
 * @param {string} [feedback.comment]
 * @param {object} [feedback.ratings] - summarizeExplanationRatings() output
 * @param {object} [device] - { os, osVersion, model } (defaults to this phone)
 * @returns {{ subject: string, body: string }}
 */
export function buildFeedbackMessage({ rating, topic, comment, ratings }, device = currentDevice()) {
  const topicLabel = FEEDBACK_TOPICS.find((t) => t.key === topic)?.label || 'General';
  const lines = [
    `Rating: ${rating ? `${rating} out of 5` : 'not given'}`,
    `About: ${topicLabel}`,
    '',
    (comment || '').trim() || '(no comment)',
    '',
    '---',
    `TalkingLabs ${APP_VERSION} · ${device.os} ${device.osVersion} · ${device.model}`,
  ];
  if (ratings) {
    const { gemma, standard } = ratings;
    lines.push(
      `Explanations rated helpful: Gemma ${gemma.helpful} of ${gemma.helpful + gemma.notHelpful}, `
        + `standard ${standard.helpful} of ${standard.helpful + standard.notHelpful}`,
    );
  }
  return { subject: `TalkingLabs feedback: ${topicLabel}`, body: lines.join('\n') };
}

function currentDevice() {
  return {
    os: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: String(Platform.Version),
    model: Device.modelName || 'unknown phone',
  };
}

/**
 * Open the email app with the message filled in, or the share sheet when no
 * feedback address is set or no email app opens.
 * @returns {Promise<'email' | 'share' | 'cancelled'>}
 */
export async function sendFeedback(message) {
  if (FEEDBACK_EMAIL) {
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(message.subject)}`
      + `&body=${encodeURIComponent(message.body)}`;
    try {
      await Linking.openURL(url);
      return 'email';
    } catch (e) {
      console.warn('[Feedback] No email app opened, using the share sheet:', e.message);
    }
  }
  const result = await Share.share({ title: message.subject, message: `${message.subject}\n\n${message.body}` });
  return result.action === Share.dismissedAction ? 'cancelled' : 'share';
}
