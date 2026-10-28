import * as Crypto from 'expo-crypto';
import { parseISODate } from './dates';
import Colors from '../constants/colors';

/** Local calendar date for YYYY-MM-DD strings, otherwise whatever Date makes of it. */
function toLocalDate(value) {
  const d = parseISODate(value) || new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Age in whole years on `today`, or null when the date of birth is missing or invalid. */
export function getAge(dob, today = new Date()) {
  const d = dob ? toLocalDate(dob) : null;
  if (!d) return null;
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  return age;
}

// Dates are shown day first (DD/MM/YYYY); see utils/dates.js.
export { formatDate } from './dates';

/** Whole calendar days from `today` to the date (negative when past), or null when invalid. */
export function daysUntil(dateStr, today = new Date()) {
  const target = dateStr ? toLocalDate(dateStr) : null;
  if (!target) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
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
      return { label: 'Critical', color: Colors.danger, bg: Colors.dangerBg, border: Colors.dangerBorder, icon: 'alert-circle' };
    case 'warn':
      return { label: 'Elevated', color: Colors.warn, bg: Colors.warnBg, border: Colors.warnBorder, icon: 'warning' };
    default:
      return { label: 'Normal', color: Colors.safe, bg: Colors.safeBg, border: Colors.safeBorder, icon: 'checkmark-circle' };
  }
}

export async function encryptDemo(plainText) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    plainText
  );
  return digest;
}

// Salted, iterated SHA-256 for on-device credentials. expo-crypto has no
// bcrypt/PBKDF2, so this raises the bar without claiming production strength.
// Each round is a native call; 1000 rounds took ~6 s per login on an emulator.
const PASSWORD_HASH_ITERATIONS = 100;

async function derivePasswordHash(password, salt, iterations) {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < iterations; i++) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${digest}`);
  }
  return digest;
}

/** Returns `{ passwordHash, passwordSalt, passwordIterations }` to store instead of the password. */
export async function hashPassword(password) {
  const passwordSalt = Crypto.randomUUID();
  const passwordIterations = PASSWORD_HASH_ITERATIONS;
  const passwordHash = await derivePasswordHash(password, passwordSalt, passwordIterations);
  return { passwordHash, passwordSalt, passwordIterations };
}

/** Checks a password against a stored user, including legacy plain-text records. */
export async function verifyPassword(password, storedUser) {
  if (storedUser?.passwordHash && storedUser?.passwordSalt) {
    const iterations = storedUser.passwordIterations || PASSWORD_HASH_ITERATIONS;
    return (await derivePasswordHash(password, storedUser.passwordSalt, iterations)) === storedUser.passwordHash;
  }
  return typeof storedUser?.password === 'string' && storedUser.password === password;
}

export function getLanguageLabel(lang) {
  switch (lang) {
    case 'en': return 'English';
    case 'fr': return 'Français';
    case 'ak': return 'Akan';
    default: return lang;
  }
}