import { beforeEach, describe, expect, it } from 'vitest';
import { mergeGarminActivities } from './activityRepository';
import { getCalendarBuildWindow } from './calendarWindow';
import { selectDayActivityContext } from './daySelectors';
import { generateICSContent } from './icsSerializer';
import { getLocalSyncTimestamp, setLocalSyncTimestamp, shouldAdoptCloudValue } from './syncMetadata';
import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import { createAppConfig, getPeriodizationContext, GLOBAL_APP_CONFIG } from './periodizationEngine';
import { buildCompleteCalendar } from './icsParser';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(key => delete store[key]); }
};

function activity(overrides: Partial<GarminActivity> = {}): GarminActivity {
  return {
    activityId: 'a1',
    activityName: 'Run',
    activityType: 'RUNNING',
    startTimeLocal: '2026-09-15T08:00:00',
    durationMinutes: 30,
    source: 'GARMIN_CONNECT',
    ...overrides
  };
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'sport-1',
    category: 'sport',
    title: 'Run, easy; steady',
    startDate: '2026-09-15T12:00:00.000Z',
    endDate: '2026-09-15T12:30:00.000Z',
    location: 'Park',
    description: 'Line 1\nLine 2',
    emoji: '🏃',
    colorId: '5',
    colorHex: '#000000',
    durationMinutes: 30,
    ...overrides
  };
}

describe('canonical data pipeline helpers', () => {
  beforeEach(() => localStorage.clear());

  it('merges activities deterministically and keeps later source values', () => {
    const older = activity({ startTimeLocal: '2026-09-14T08:00:00', distanceKm: 5 });
    const richer = activity({ distanceKm: 5, avgHeartRate: 150 });
    const newest = activity({ activityId: 'a2', startTimeLocal: '2026-09-16T08:00:00' });

    expect(mergeGarminActivities([older], [richer, newest])).toEqual([newest, richer]);
  });

  it('retains complementary metrics and lets the later source win conflicts', () => {
    const local = activity({ activityName: 'Old local name', avgHeartRate: 140 });
    const cloud = activity({ activityName: 'Updated cloud name', avgCadence: 174 });
    const [merged] = mergeGarminActivities([local], [cloud]);

    expect(merged.activityName).toBe('Updated cloud name');
    expect(merged.avgHeartRate).toBe(140);
    expect(merged.avgCadence).toBe(174);
  });

  it('selects one deduplicated day view from activities and comparisons', () => {
    const actual = activity();
    const comparison: ActivityComparison = {
      id: 'c1',
      date: '2026-09-15',
      status: 'COMPLIANT',
      plannedEvent: event(),
      actualActivity: actual,
      durationDeltaMinutes: 0,
      heartRateCompliance: 'OPTIMAL',
      complianceScore: 100,
      feedbackNotes: []
    };

    const result = selectDayActivityContext('2026-09-15', [actual], [comparison]);
    expect(result.activities).toEqual([actual]);
    expect(result.comparisons).toEqual([comparison]);
    expect(result.isPlannedSessionCompleted).toBe(true);
  });

  it('uses the earliest Monday between today and the configured sport start', () => {
    const historical = getCalendarBuildWindow(new Date('2026-09-16T12:00:00'), '2026-09-01');
    const future = getCalendarBuildWindow(new Date('2026-09-16T12:00:00'), '2026-10-01', 30);

    expect(historical.startMonday.getFullYear()).toBe(2026);
    expect(historical.startMonday.getMonth()).toBe(7);
    expect(historical.startMonday.getDate()).toBe(31);
    expect(historical.daysCount).toBe(98);
    expect(future.startMonday.getDate()).toBe(14);
    expect(future.daysCount).toBe(30);
  });

  it('resolves cloud conflicts from explicit per-domain timestamps', () => {
    setLocalSyncTimestamp('manualPairs', '2026-09-15T10:00:00.000Z');
    expect(getLocalSyncTimestamp('manualPairs')).toBe('2026-09-15T10:00:00.000Z');
    expect(shouldAdoptCloudValue('2026-09-15T10:00:01.000Z', getLocalSyncTimestamp('manualPairs'))).toBe(true);
    expect(shouldAdoptCloudValue('2026-09-15T09:59:59.000Z', getLocalSyncTimestamp('manualPairs'))).toBe(false);
  });

  it('serializes deterministic RFC 5545 output with escaped text', () => {
    const content = generateICSContent([event()], new Date('2026-09-15T09:00:00.000Z'));
    expect(content).toContain('DTSTAMP:20260915T090000Z');
    expect(content).toContain('SUMMARY:Run\\, easy\\; steady');
    expect(content).toContain('DESCRIPTION:Line 1\\nLine 2');
    expect(content.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('keeps profile-specific plan settings isolated from the immutable defaults', () => {
    const custom = createAppConfig({
      campusAddress: 'Campus de test',
      raceName: 'Course de test',
      raceDate: '2027-06-01'
    });
    const date = new Date('2027-05-01T12:00:00');
    const customContext = getPeriodizationContext(date, custom);
    const defaultContext = getPeriodizationContext(date);
    const built = buildCompleteCalendar([], date, 1, custom);

    expect(custom.RACE_NAME).toBe('Course de test');
    expect(GLOBAL_APP_CONFIG.RACE_NAME).not.toBe('Course de test');
    expect(customContext.daysToRace).not.toBe(defaultContext.daysToRace);
    expect(built.schedules[0].periodContext.daysToRace).toBe(customContext.daysToRace);
    expect(Object.isFrozen(GLOBAL_APP_CONFIG)).toBe(true);
  });
});
