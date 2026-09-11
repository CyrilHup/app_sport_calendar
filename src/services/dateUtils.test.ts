import { describe, it, expect } from 'vitest';
import {
  formatDateKey,
  getMondayOfWeek,
  getMondayWeekKey,
  getGarminLocalDateKey,
  formatFriendlyDay,
  formatTime,
  parseLocalDate,
  addDays,
  toLocalDateKey
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

  it('parses local dates at midnight without UTC shifting', () => {
    const d = parseLocalDate('2026-09-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // Sept
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
    expect(formatDateKey(d)).toBe('2026-09-09');
  });

  it('safely adds days without DST drifting', () => {
    const d = parseLocalDate('2026-09-09');
    const plus3 = addDays(d, 3);
    expect(formatDateKey(plus3)).toBe('2026-09-12');
    const minus5 = addDays(d, -5);
    expect(formatDateKey(minus5)).toBe('2026-09-04');
  });

  it('extracts local date key from ISO string and Garmin local strings', () => {
    expect(toLocalDateKey('2026-09-09')).toBe('2026-09-09');
    expect(toLocalDateKey('2026-09-09 18:30:00')).toBe('2026-09-09');
    const d = new Date(2026, 8, 9, 21, 0, 0);
    expect(toLocalDateKey(d)).toBe('2026-09-09');
    expect(toLocalDateKey(d.toISOString())).toBe('2026-09-09');
  });
});
