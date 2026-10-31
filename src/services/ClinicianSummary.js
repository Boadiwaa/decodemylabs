/**
 * ClinicianSummary — a one-document recap of the patient's results for a
 * clinician: bulleted summary, what to monitor and why, all latest results by
 * body system with their trend, the patient's conditions and medicines, and an
 * evidence trail showing where every value came from.
 *
 * Built on the phone and shared by the patient (PDF through the share sheet, or
 * a short text in an on-screen QR code). Nothing is uploaded by the app.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildMonitoringList, buildSummaryBullets } from '../domain/monitoring';
import { groupByLabGroup } from '../domain/lab_groups';
import { findRepeatedTests } from '../domain/report_checks';
import { formatDate, toISODate } from '../utils/dates';
import { APP_VERSION } from './Feedback';
import { prepareShareFile } from '../utils/shareFiles';
import { trendChartSvg } from './ClinicianSummaryCharts';

export const DISCLAIMER = 'This summary was prepared by the patient with TalkingLabs. Values were read from photos '
  + 'of their own lab reports on their phone and may contain reading errors: check them against the original reports. '
  + 'It is not a diagnosis. Consult a licensed healthcare provider.';

const READ_BY = {
  gemma_photo: 'Gemma (AI) read the report photo',
  gemma_text: 'Text recognition, then Gemma (AI)',
  text_pattern: 'Text recognition and pattern matching',
  typed: 'Typed in by the patient',
};

const RANGE_FROM = {
  report: 'Printed on the report',
  app: 'App default (not read from the report)',
  typed: 'Typed in by the patient',
};

/** Date of birth as DD/MM/YYYY, whether saved as an ISO date or as typed ("15 / 06 / 1985"). */
function displayDob(dob) {
  if (!dob) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(dob) ? formatDate(dob) : String(dob).replace(/\s*\/\s*/g, '/').trim();
}

/** How the test date was set, for the evidence trail. */
function dateSource(lab) {
  if (lab.date_confirmed) return 'Confirmed by the patient';
  if (lab.date_found === true) return 'Read from the report';
  if (lab.date_found === false) return 'Not found on the report; upload date used';
  return 'Not recorded';
}

/**
 * Collect everything the summary shows.
 * @param {object} input
 * @param {{ name: string, dob?: string, gender?: string }} input.patient
 * @param {Array} input.labResults - Latest result per test (useUserLabData)
 * @param {Array} [input.allResults] - Every stored result, to spot a report that gave two values for one test
 * @param {Array} input.trends
 * @param {Array} input.reports - Stored lab reports ({ id, fileName, uploadedAt })
 * @param {Array} [input.conditions]
 * @param {Array} [input.medications]
 * @param {boolean} [input.includeHealthBackground] - Include conditions and medicines
 * @param {Date} [input.now]
 */
export function buildClinicianSummary({
  patient, labResults = [], allResults = [], trends = [], reports = [], conditions = [], medications = [],
  includeHealthBackground = true, now = new Date(),
}) {
  const monitoring = buildMonitoringList({ labResults, trends, conditions, medications });
  const dates = labResults.map((l) => l.date).filter(Boolean).sort();
  const trendDates = trends.flatMap((t) => (t.values || []).map((v) => v.isoDate)).filter(Boolean).sort();
  const allDates = [...dates, ...trendDates].sort();
  const reportById = new Map(reports.map((r) => [r.id, r]));
  const usedReportIds = new Set(labResults.map((l) => l.source_report_id).filter(Boolean));
  const repeated = findRepeatedTests(allResults);

  return {
    generatedAt: now.toISOString(),
    patient: {
      name: patient?.name || 'Patient',
      dob: displayDob(patient?.dob),
      gender: patient?.gender && patient.gender !== 'Not specified' ? patient.gender : null,
    },
    period: allDates.length ? { from: allDates[0], to: allDates[allDates.length - 1] } : null,
    reportCount: reports.length,
    bullets: buildSummaryBullets({ labResults, monitoring }),
    monitoring,
    groups: groupByLabGroup(labResults, (l) => l.test_name).map((g) => ({
      title: g.title,
      rows: g.items.map((lab) => ({ lab, trend: trends.find((t) => t.test_name === lab.test_name) || null })),
    })),
    background: includeHealthBackground
      ? { conditions: conditions.map((c) => c.name).filter(Boolean), medications }
      : null,
    evidence: labResults.map((lab) => {
      const report = reportById.get(lab.source_report_id);
      const p = lab.provenance;
      const twice = repeated.find((t) => t.testName === lab.test_name && t.reportId === lab.source_report_id);
      const conflict = twice
        ? `This report gave ${twice.values.length} values for this test (${twice.values.join(', ')}). Both were kept; `
          + 'the patient was asked to check with the lab. Please check the original report.'
        : '';
      const corrected = p?.replaced
        ? `Corrected by the patient; first read as ${p.replaced.value}${p.replaced.read_by ? ` (${READ_BY[p.replaced.read_by] || p.replaced.read_by})` : ''}`
        : '';
      return {
        test: lab.test_name,
        value: lab.result_value,
        date: lab.date,
        dateSource: dateSource(lab),
        report: report
          ? `${report.fileName || 'Report'} (uploaded ${formatDate(report.uploadedAt)})`
          : lab.source_report_id === 'manual' ? 'Entered without a report' : 'Report no longer on the phone',
        readBy: p ? READ_BY[p.read_by] || p.read_by : 'Not recorded (saved before this was tracked)',
        rangeFrom: p ? RANGE_FROM[p.range_source] || p.range_source : 'Not recorded',
        note: [corrected, conflict].filter(Boolean).join(' '),
      };
    }),
    reportsUsed: [...usedReportIds].map((id) => reportById.get(id)).filter(Boolean),
    repeated,
  };
}

// -- QR code text --

const QR_MAX_CHARS = 700; // keeps the code easy to scan from a phone screen

/** Short plain-text version for the on-screen QR code. */
export function buildQrText(summary) {
  const lines = [
    `TalkingLabs summary ${formatDate(summary.generatedAt)}`,
    `${summary.patient.name}${summary.patient.dob ? `, born ${summary.patient.dob}` : ''}`,
  ];
  if (summary.period) lines.push(`Results ${formatDate(summary.period.from)} to ${formatDate(summary.period.to)}`);

  const closely = summary.monitoring.closely;
  lines.push(closely.length ? 'Monitor closely:' : 'All latest results within normal range.');
  const footer = [
    summary.background?.medications?.length
      ? `Medicines: ${summary.background.medications.map((m) => m.name).join(', ')}` : null,
    'Not a diagnosis. Full PDF available from the patient.',
  ].filter(Boolean);

  let shown = 0;
  for (const item of closely) {
    const line = `- ${item.lab.test_name} ${item.lab.result_value}${item.direction === 'high' ? ' H' : item.direction === 'low' ? ' L' : ''} (ref ${item.lab.normal_range})`;
    const remaining = closely.length - shown - 1;
    const tail = remaining > 0 ? [`+${remaining} more in the PDF`] : [];
    if ([...lines, line, ...tail, ...footer].join('\n').length > QR_MAX_CHARS) {
      lines.push(`+${closely.length - shown} more in the PDF`);
      break;
    }
    lines.push(line);
    shown += 1;
  }
  return [...lines, ...footer].join('\n').slice(0, QR_MAX_CHARS);
}

// -- PDF --

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STATUS = {
  danger: { label: 'Well outside range', color: '#B4474F' },
  warn: { label: 'Slightly outside range', color: '#8A5A12' },
  safe: { label: 'Normal', color: '#2E7A55' },
};

/** Small inline trend line for the PDF. */
function sparkline(trend) {
  const values = (trend?.values || []).map((v) => v.value);
  if (values.length < 2) return '<span class="muted">One result</span>';
  const w = 110;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    4 + (i * (w - 8)) / (values.length - 1),
    h - 4 - ((v - min) / span) * (h - 8),
  ]);
  const [lx, ly] = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend">`
    + `<polyline points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="#1A9E9B" stroke-width="2"/>`
    + `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="#0C4E4C"/></svg>`;
}

function trendText(trend) {
  const v = trend?.values || [];
  if (v.length < 2) return '';
  return `${esc(v[0].value)} → ${esc(v[v.length - 1].value)} ${esc(trend.unit)} (${v.length} results)`;
}

function monitoringTable(items) {
  return `<table><thead><tr><th>Test</th><th>Latest</th><th>Normal</th><th>Why</th><th>Trend</th></tr></thead><tbody>${
    items.map((i) => `<tr>
      <td><b>${esc(i.lab.test_name)}</b><br><span class="muted">${esc(formatDate(i.lab.date))}</span></td>
      <td style="color:${STATUS[i.severity].color}"><b>${esc(i.lab.result_value)}</b></td>
      <td>${esc(i.lab.normal_range)}</td>
      <td><ul>${i.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></td>
      <td>${sparkline(i.trendRef)}<br><span class="muted">${trendText(i.trendRef)}</span></td>
    </tr>`).join('')
  }</tbody></table>`;
}

/** One chart card per result to monitor closely: the trend as the app draws it. */
function trendCharts(items, repeated = []) {
  return `<div class="charts">${items.map((i) => {
    const trend = i.trendRef;
    const values = trend?.values || [];
    const change = i.change
      ? `${i.change.pct > 0 ? '↑' : i.change.pct < 0 ? '↓' : '→'} ${Math.abs(i.change.pct)}% since ${formatDate(i.change.from.isoDate)}`
      : values.length > 1 ? `${values.length} results` : 'One result so far';
    const notes = [
      repeated.some((t) => t.testName === i.lab.test_name)
        ? 'One report gave two values for this test; both are plotted.' : null,
      trend?.convertedCount ? `Earlier results converted to ${trend.unit} to compare.` : null,
    ].filter(Boolean);
    return `<div class="chart">
      <div class="chart-head">
        <b>${esc(i.lab.test_name)}</b>
        <span style="color:${STATUS[i.severity].color}"><b>${esc(i.lab.result_value)}</b> · ${STATUS[i.severity].label}</span>
      </div>
      <div class="muted">Normal: ${esc(i.lab.normal_range)} · <span style="color:${i.change?.worsening ? STATUS.danger.color : '#5E7877'}">${esc(change)}</span></div>
      ${trendChartSvg(trend || { unit: i.lab.unit, values: [{ value: Number(i.lab.numeric_value), isoDate: i.lab.date }] }, i.lab, i.severity)}
      ${notes.map((t) => `<div class="muted">${esc(t)}</div>`).join('')}
    </div>`;
  }).join('')}</div>`;
}

/** The PDF as HTML (A4, printed by expo-print). */
export function renderSummaryHtml(summary) {
  const { patient } = summary;
  const trendFor = (testName) => summary.groups.flatMap((g) => g.rows).find((r) => r.lab.test_name === testName)?.trend;
  const withTrend = (items) => items.map((i) => ({ ...i, trendRef: trendFor(i.lab.test_name) }));
  const meta = [
    patient.dob ? `Born ${esc(patient.dob)}` : null,
    patient.gender ? esc(patient.gender) : null,
    summary.period ? `Results from ${esc(formatDate(summary.period.from))} to ${esc(formatDate(summary.period.to))}` : null,
    `${summary.reportCount} report${summary.reportCount === 1 ? '' : 's'} on file`,
  ].filter(Boolean).join(' · ');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Lab results summary</title><style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0C4E4C; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: 0.2px; }
  .meta { color: #4F6B6A; margin: 0 0 4px; }
  .rule { border: 0; border-top: 2px solid #CDEEEE; margin: 10px 0 12px; }
  h2 { background: #CDEEEE; color: #0C4E4C; font-size: 11.5pt; padding: 5px 10px; margin: 16px 0 8px; border-radius: 3px; page-break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 10px 0 4px; color: #106B68; }
  ul { margin: 0; padding-left: 16px; }
  li { margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { background: #0C4E4C; color: #fff; text-align: left; font-size: 9pt; font-weight: 600; padding: 5px 6px; }
  td { border-bottom: 1px solid #E6F2F2; padding: 5px 6px; vertical-align: top; font-size: 9.5pt; }
  tbody tr:nth-child(even) td { background: #F3FBFB; }
  .muted { color: #5E7877; font-size: 8.5pt; }
  .closely h2 { background: #FBEDEE; color: #7A2E35; }
  .summary li { font-size: 10.5pt; }
  .evidence td { font-size: 8.5pt; }
  .charts { display: flex; flex-wrap: wrap; gap: 10px; }
  .chart { width: calc(50% - 5px); border: 1px solid #DCEDED; border-radius: 8px; padding: 8px 10px 6px; page-break-inside: avoid; break-inside: avoid; }
  .chart-head { display: flex; justify-content: space-between; gap: 8px; font-size: 10pt; }
  .chart svg.trend { display: block; margin-top: 4px; }
  .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #CDEEEE; color: #4F6B6A; font-size: 8.5pt; }
  </style></head><body>
  <h1>Lab results summary</h1>
  <p class="meta"><b>${esc(patient.name)}</b></p>
  <p class="meta">${meta}</p>
  <p class="meta">Prepared ${esc(formatDate(summary.generatedAt))} with TalkingLabs ${esc(APP_VERSION)}</p>
  <hr class="rule">

  <h2>Summary</h2>
  <ul class="summary">${summary.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>

  ${summary.monitoring.closely.length ? `<div class="closely"><h2>Monitor closely</h2>${monitoringTable(withTrend(summary.monitoring.closely))}</div>` : ''}
  ${summary.monitoring.closely.length ? `<h2>Trends to watch</h2>
  <p class="muted">Results to monitor closely, as charted in the app. The shaded band is the normal range.</p>
  ${trendCharts(withTrend(summary.monitoring.closely), summary.repeated)}` : ''}
  ${summary.monitoring.tracking.length ? `<h2>Keep tracking</h2>${monitoringTable(withTrend(summary.monitoring.tracking))}` : ''}

  <h2>All latest results</h2>
  ${summary.groups.map((g) => `<h3>${esc(g.title)}</h3><table><thead><tr><th>Test</th><th>Result</th><th>Normal</th><th>Status</th><th>Test date</th><th>Trend</th></tr></thead><tbody>${
    g.rows.map(({ lab, trend }) => `<tr>
      <td>${esc(lab.test_name)}</td>
      <td style="color:${STATUS[lab.severity || 'safe'].color}"><b>${esc(lab.result_value)}</b></td>
      <td>${esc(lab.normal_range)}</td>
      <td>${STATUS[lab.severity || 'safe'].label}</td>
      <td>${esc(formatDate(lab.date))}</td>
      <td>${sparkline(trend)}<br><span class="muted">${trendText(trend)}</span></td>
    </tr>`).join('')
  }</tbody></table>`).join('')}

  ${summary.background ? `<h2>Health background (from the patient)</h2>
  <p><b>Conditions:</b> ${summary.background.conditions.length ? esc(summary.background.conditions.join(', ')) : 'None recorded'}</p>
  <p><b>Medicines:</b> ${summary.background.medications.length
    ? esc(summary.background.medications.map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')).join('; '))
    : 'None recorded'}</p>` : ''}

  <h2>Evidence trail</h2>
  <p class="muted">Where each value above came from, so it can be checked against the original report.</p>
  <table class="evidence"><thead><tr><th>Test</th><th>Value</th><th>Test date</th><th>Source report</th><th>How it was read</th><th>Normal range</th></tr></thead><tbody>${
    summary.evidence.map((e) => `<tr>
      <td>${esc(e.test)}</td>
      <td>${esc(e.value)}${e.note ? `<br><span class="muted">${esc(e.note)}</span>` : ''}</td>
      <td>${esc(formatDate(e.date))}<br><span class="muted">${esc(e.dateSource)}</span></td>
      <td>${esc(e.report)}</td>
      <td>${esc(e.readBy)}</td>
      <td>${esc(e.rangeFrom)}</td>
    </tr>`).join('')
  }</tbody></table>

  <p class="footer">${esc(DISCLAIMER)}</p>
  </body></html>`;
}

const PDF_PREFIX = 'TalkingLabs-summary-';

/**
 * Make the PDF and open the share sheet (email, WhatsApp, Notes, Drive…).
 * The file stays in the app's private storage until the next summary replaces it.
 */
export async function shareSummaryPdf(summary) {
  const { uri } = await Print.printToFileAsync({ html: renderSummaryHtml(summary) });
  const target = await prepareShareFile(PDF_PREFIX, `${PDF_PREFIX}${toISODate()}.pdf`);
  await FileSystem.moveAsync({ from: uri, to: target });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(target, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share your lab results summary',
  });
  return target;
}
