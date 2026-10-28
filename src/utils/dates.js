/**
 * Date helpers. Stored dates are ISO (YYYY-MM-DD); patients see Ghana-style
 * day-first dates (DD/MM/YYYY).
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (avoids the UTC shift of toISOString). */
export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse YYYY-MM-DD as a local date. Returns null for anything else. */
export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

function buildDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Reject rollovers such as 31/02.
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const iso = parseISODate(value);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) return iso;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DD/MM/YYYY. Unparseable input is returned unchanged. */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return value ? String(value) : '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** DD/MM/YY, for chart labels. */
export function formatShortDate(value) {
  const d = toDate(value);
  if (!d) return value ? String(value) : '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

function monthFromName(name) {
  const index = MONTHS.indexOf(String(name).slice(0, 3).toLowerCase());
  return index >= 0 ? index + 1 : 0;
}

function expandYear(year) {
  return year.length === 2 ? 2000 + Number(year) : Number(year);
}

/** First match of `pattern` that `toParts` turns into a real, non-future date. */
function firstValidMatch(text, pattern, toParts) {
  const today = toISODate();
  for (const match of text.matchAll(pattern)) {
    const parts = toParts(match);
    const d = parts && buildDate(...parts);
    if (d && toISODate(d) <= today) return toISODate(d);
  }
  return null;
}

/** Day-first unless the second number can only be a day. */
function numericParts(m) {
  const a = Number(m[1]);
  const b = Number(m[2]);
  const year = expandYear(m[3]);
  return b > 12 && a <= 12 ? [year, a, b] : [year, b, a];
}

/**
 * Find a date in free text and return it as YYYY-MM-DD, or null.
 * Numeric dates are read day first (DD/MM/YYYY, as in Ghana) unless the
 * second number can only be a day. Also reads YYYY-MM-DD and month names
 * ("12 Mar 2026", "12-Mar-26", "March 12, 2026"). Future dates are skipped.
 */
export function parseDateFromText(text) {
  const s = String(text || '');
  return (
    firstValidMatch(s, /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, (m) => [Number(m[1]), Number(m[2]), Number(m[3])])
    || firstValidMatch(s, /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g, numericParts)
    // Two-digit years only with slashes, so ranges like "0.78-1.03" are not read as dates.
    || firstValidMatch(s, /\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/g, numericParts)
    || firstValidMatch(
      s,
      /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})[\s\-/.,]+(\d{4}|\d{2})\b/g,
      (m) => [expandYear(m[3]), monthFromName(m[2]), Number(m[1])],
    )
    || firstValidMatch(
      s,
      /\b([A-Za-z]{3,9})[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-/.]+(\d{4})\b/g,
      (m) => [Number(m[3]), monthFromName(m[1]), Number(m[2])],
    )
  );
}

/** True for a valid YYYY-MM-DD that is not in the future. */
export function isValidPastISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = parseISODate(iso);
  return Boolean(d) && toISODate(d) <= toISODate();
}
