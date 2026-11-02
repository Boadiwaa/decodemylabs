import {
  formatDate, formatShortDate, parseDateFromText, isValidPastISODate, toISODate,
} from '../src/utils/dates';

describe('formatDate', () => {
  it('shows dates day first (DD/MM/YYYY)', () => {
    expect(formatDate('2026-03-04')).toBe('04/03/2026');
    expect(formatShortDate('2026-03-04')).toBe('04/03/26');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatDate('Unknown')).toBe('Unknown');
    expect(formatDate('')).toBe('');
  });
});

describe('parseDateFromText', () => {
  it('reads ambiguous numeric dates day first', () => {
    expect(parseDateFromText('Report Date: 03/04/2025 09:30')).toBe('2025-04-03');
    expect(parseDateFromText('12-03-2025')).toBe('2025-03-12');
    expect(parseDateFromText('12.03.2025')).toBe('2025-03-12');
  });

  it('swaps only when the second number cannot be a month', () => {
    expect(parseDateFromText('04/25/2025')).toBe('2025-04-25');
  });

  it('reads ISO dates, month names and two-digit years', () => {
    expect(parseDateFromText('2025-04-03')).toBe('2025-04-03');
    expect(parseDateFromText('Collected 3 Apr 2025')).toBe('2025-04-03');
    expect(parseDateFromText('03-Apr-25')).toBe('2025-04-03');
    expect(parseDateFromText('April 3, 2025')).toBe('2025-04-03');
    expect(parseDateFromText('03/04/25')).toBe('2025-04-03');
  });

  it('does not read lab ranges or impossible dates as dates', () => {
    expect(parseDateFromText('Magnesium 0.85 0.78-1.03 mmol/L')).toBeNull();
    expect(parseDateFromText('31/02/2025')).toBeNull();
  });

  it('skips future dates and keeps looking', () => {
    expect(parseDateFromText('Due 01/01/2999, tested 05/06/2025')).toBe('2025-06-05');
  });
});

describe('isValidPastISODate', () => {
  it('accepts today and past dates only', () => {
    expect(isValidPastISODate(toISODate())).toBe(true);
    expect(isValidPastISODate('2025-02-28')).toBe(true);
    expect(isValidPastISODate('2999-01-01')).toBe(false);
    expect(isValidPastISODate('unknown')).toBe(false);
  });
});
