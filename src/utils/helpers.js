import * as Crypto from 'expo-crypto';

export function getAge(dob) {
  const d = new Date(dob);
  const now = new Date('2023-09-25');
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

export function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(dateStr) {
  const now = new Date('2023-09-25');
  const target = new Date(dateStr);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function getTrendChange(trendValues) {
  if (!trendValues || trendValues.length < 2) return { pct: 0, direction: 'stable' };
  const first = trendValues[0].value;
  const last = trendValues[trendValues.length - 1].value;
  const pct = ((last - first) / first * 100).toFixed(1);
  return {
    pct: Math.abs(pct),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable',
  };
}

export function getSeverityConfig(severity) {
  switch (severity) {
    case 'danger':
      return { label: 'Critical', color: '#D98E93', bg: '#FDF2F3', border: '#F5D5D8', icon: 'alert-circle' };
    case 'warn':
      return { label: 'Elevated', color: '#D4AA6A', bg: '#FDF8F0', border: '#F0DFC4', icon: 'alert-triangle' };
    default:
      return { label: 'Normal', color: '#7BBFA0', bg: '#F0FAF5', border: '#C5E8D8', icon: 'checkmark-circle' };
  }
}

export async function encryptDemo(plainText) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    plainText
  );
  return digest;
}

export function getLanguageLabel(lang) {
  switch (lang) {
    case 'en': return 'English';
    case 'fr': return 'Français';
    case 'ak': return 'Akan';
    default: return lang;
  }
}