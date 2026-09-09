import { describe, it, expect } from 'vitest';
import {
  formatDateKey,
  getMondayOfWeek,
  getMondayWeekKey,
  getGarminLocalDateKey,
  formatFriendlyDay,
  formatTime
} from './dateUtils';

describe('dateUtils', () => {
  it('formats dates consistently as YYYY-MM-DD', () => {
    const d = new Date(2026, 8, 5); // Sept 5, 2026 (month is 0-indexed)
    expect(formatDateKey(d)).toBe('2026-09-05');
  });

  it('calculates the Monday of a given week', () => {
    // 2026-09-05 is Saturday
    const sat = new Date('2026-09-05T15:30:00');
    const monday = getMondayOfWeek(sat);
    expect(formatDateKey(monday)).toBe('2026-08-31');
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);

    // 2026-08-31 is already Monday
    const mon = new Date('2026-08-31T20:00:00');
    expect(formatDateKey(getMondayOfWeek(mon))).toBe('2026-08-31');

    // 2026-09-06 is Sunday
    const sun = new Date('2026-09-06T12:00:00');
    expect(formatDateKey(getMondayOfWeek(sun))).toBe('2026-08-31');
  });

  it('calculates the Monday week key string from a date string', () => {
    expect(getMondayWeekKey('2026-09-05')).toBe('2026-08-31');
    expect(getMondayWeekKey('2026-09-06')).toBe('2026-08-31');
    expect(getMondayWeekKey('2026-08-31')).toBe('2026-08-31');
    expect(getMondayWeekKey('2026-09-07')).toBe('2026-09-07');
    expect(getMondayWeekKey('')).toBe('');
  });

  it('extracts the local Garmin date key safely without timezone shift', () => {
    expect(getGarminLocalDateKey({ startTimeLocal: '2026-09-04 18:30:00' })).toBe('2026-09-04');
    expect(getGarminLocalDateKey({ date: '2026-09-03' })).toBe('2026-09-03');
    expect(getGarminLocalDateKey(null)).toBe(formatDateKey(new Date()));
  });

  it('formats friendly days in French', () => {
    const formatted = formatFriendlyDay('2026-09-05');
    expect(formatted.toLowerCase()).toContain('sept');
  });

  it('formats time in 24h format', () => {
    const d = new Date('2026-09-05T14:05:00');
    expect(formatTime(d)).toBe('14:05');
    expect(formatTime('2026-09-05T09:30:00')).toBe('09:30');
    expect(formatTime('invalid')).toBe('');
  });
});
