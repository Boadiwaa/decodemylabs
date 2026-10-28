jest.mock('expo-crypto', () => ({}));

import { getAge, daysUntil } from '../src/utils/helpers';

describe('getAge', () => {
  const today = new Date(2026, 9, 28); // 28/10/2026

  it('counts whole years up to today', () => {
    expect(getAge('1965-02-24', today)).toBe(61);
    expect(getAge('1990-10-28', today)).toBe(36);
    expect(getAge('1990-10-29', today)).toBe(35);
  });

  it('uses the real current date by default', () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const iso = `${tenYearsAgo.getFullYear()}-${String(tenYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(tenYearsAgo.getDate()).padStart(2, '0')}`;
    expect(getAge(iso)).toBe(10);
  });

  it('returns null when the date of birth is missing or invalid', () => {
    expect(getAge(null, today)).toBeNull();
    expect(getAge('', today)).toBeNull();
    expect(getAge('not a date', today)).toBeNull();
  });
});

describe('daysUntil', () => {
  const today = new Date(2026, 9, 28, 18, 30);

  it('counts calendar days, ignoring the time of day', () => {
    expect(daysUntil('2026-10-28', today)).toBe(0);
    expect(daysUntil('2026-10-29', today)).toBe(1);
    expect(daysUntil('2026-10-21', today)).toBe(-7);
  });

  it('returns null for a missing date', () => {
    expect(daysUntil(undefined, today)).toBeNull();
  });
});
