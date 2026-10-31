/**
 * Trend charts for the clinician summary PDF, drawn as inline SVG.
 *
 * They follow the app's TrendChart (line in the result's severity colour,
 * dashed grid, white-ringed dots) with what a printed page needs instead of
 * tapping: each value and date written out, and the normal range shaded so the
 * distance from normal is visible. Lines are straight between results: a
 * smooth curve would dip or peak between points at values never measured.
 */

import { normalizeUnit } from '../domain/reference_ranges';
import { formatDate, formatShortDate } from '../utils/dates';

const W = 320;
const H = 168;
const PAD = { left: 40, right: 12, top: 18, bottom: 28 };

const LINE = { danger: '#B4474F', warn: '#B07A1E', safe: '#1A9E9B' };
const BAND = '#E3F4EC';
const GRID = '#DCEDED';
const MUTED = '#5E7877';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Numeric bounds of a normal-range text: "0 - 3.4 µmol/L", "<200 mg/dL",
 * "90 or higher mL/min", ">1.0 mmol/L". Missing sides are null.
 * @returns {{ min: number|null, max: number|null } | null}
 */
export function parseRangeBounds(text) {
  const t = String(text || '').replace(/,/g, '');
  let m = t.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = t.match(/(?:<|≤|less than|below)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (m) return { min: null, max: Number(m[1]) };
  m = t.match(/(?:>|≥|more than|above)\s*=?\s*(\d+(?:\.\d+)?)/i) || t.match(/(\d+(?:\.\d+)?)\s*or (?:higher|more|above)/i);
  if (m) return { min: Number(m[1]), max: null };
  return null;
}

/** About four round-numbered gridlines covering [lo, hi]. */
function niceTicks(lo, hi) {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < hi) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(6)));
  return ticks;
}

const fmt = (v) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Number(v.toFixed(2))));

/**
 * SVG trend chart for one test.
 * @param {object} trend - { unit, values: [{ value, isoDate, date? }] }
 * @param {object} lab - Latest result ({ unit, normal_range })
 * @param {'safe'|'warn'|'danger'} severity
 */
export function trendChartSvg(trend, lab, severity) {
  const values = trend?.values || [];
  if (!values.length) return '';
  const color = LINE[severity] || LINE.safe;
  const sameUnit = normalizeUnit(lab?.unit) === normalizeUnit(trend.unit);
  const band = sameUnit ? parseRangeBounds(lab?.normal_range) : null;

  const nums = values.map((v) => v.value);
  const finiteBand = band ? [band.min, band.max].filter((v) => v != null) : [];
  let lo = Math.min(...nums, ...finiteBand);
  let hi = Math.max(...nums, ...finiteBand);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  lo = Math.max(lo - pad, Math.min(...nums) >= 0 ? 0 : -Infinity);
  hi += pad;
  const ticks = niceTicks(lo, hi);
  lo = ticks[0];
  hi = ticks[ticks.length - 1];

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (values.length === 1 ? plotW / 2 : (i * plotW) / (values.length - 1));
  const y = (v) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const pts = values.map((v, i) => [x(i), y(v.value)]);

  const parts = [];
  if (band) {
    const top = y(band.max == null ? hi : Math.min(band.max, hi));
    const base = y(band.min == null ? lo : Math.max(band.min, lo));
    if (base > top) {
      parts.push(`<rect x="${PAD.left}" y="${top.toFixed(1)}" width="${plotW}" height="${(base - top).toFixed(1)}" fill="${BAND}"/>`);
      parts.push(`<text x="${W - PAD.right - 4}" y="${(top + 10).toFixed(1)}" text-anchor="end" font-size="8" fill="#2E7A55">Normal range</text>`);
    }
  }

  for (const t of ticks) {
    parts.push(`<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="${GRID}" stroke-dasharray="3,5"/>`);
    parts.push(`<text x="${PAD.left - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="${MUTED}">${esc(fmt(t))}</text>`);
  }

  if (pts.length > 1) {
    parts.push(`<polyline points="${pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')}" `
      + `fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
  }

  values.forEach((v, i) => {
    const [px, py] = pts[i];
    const anchor = values.length > 1 && i === 0 ? 'start' : values.length > 1 && i === values.length - 1 ? 'end' : 'middle';
    const labelY = py - 9 < PAD.top - 4 ? py + 16 : py - 9;
    parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>`);
    parts.push(`<text x="${px.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" font-size="8.5" font-weight="700" fill="#0C4E4C">${esc(fmt(v.value))}</text>`);
    parts.push(`<text x="${px.toFixed(1)}" y="${H - 10}" text-anchor="${anchor}" font-size="8" fill="${MUTED}">${esc(v.date || formatShortDate(v.isoDate))}</text>`);
  });

  const summary = values.map((v) => `${fmt(v.value)} on ${formatDate(v.isoDate)}`).join(', ');
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(`Trend in ${trend.unit}: ${summary}`)}">`
    + `${parts.join('')}</svg>`;
}
