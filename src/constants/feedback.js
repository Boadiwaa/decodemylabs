/**
 * Where feedback goes.
 *
 * Set EXPO_PUBLIC_FEEDBACK_EMAIL (in .env.local and the eas.json build env) to
 * have "Send" open the patient's email app addressed to you. Without it, Send
 * opens the share sheet so the patient can choose how to send it.
 */

export const FEEDBACK_EMAIL = String(process.env.EXPO_PUBLIC_FEEDBACK_EMAIL || '').trim();

export const FEEDBACK_TOPICS = [
  { key: 'explanation', label: 'An explanation was unclear', icon: 'chatbubble-ellipses-outline' },
  { key: 'bug', label: "Something isn't working", icon: 'bug-outline' },
  { key: 'idea', label: 'An idea', icon: 'bulb-outline' },
  { key: 'other', label: 'Something else', icon: 'ellipsis-horizontal-circle-outline' },
];
