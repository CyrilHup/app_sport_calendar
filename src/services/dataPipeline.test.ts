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
import { buildEffectiveCalendar, selectCalendarEventsById } from './calendarPipeline';

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

  it('keeps corrected Strava elevation when Garmin is synchronized again', () => {
    const garmin = activity({
      elevationGainM: 110,
      elevationLossM: 105,
      garminElevationGainM: 110,
      garminElevationLossM: 105,
      elevationSource: 'GARMIN_CONNECT'
    });
    const corrected = activity({
      elevationGainM: 413,
      elevationLossM: 398,
      garminElevationGainM: 110,
      garminElevationLossM: 105,
      elevationSource: 'STRAVA_CORRECTED',
      stravaActivityId: 'strava-1',
      elevationUpdatedAt: '2026-09-20T12:00:00.000Z'
    });

    const [afterEnrichment] = mergeGarminActivities([garmin], [corrected]);
    const [afterGarminRefresh] = mergeGarminActivities([afterEnrichment], [garmin]);

    expect(afterGarminRefresh.elevationGainM).toBe(413);
    expect(afterGarminRefresh.elevationLossM).toBe(398);
    expect(afterGarminRefresh.elevationSource).toBe('STRAVA_CORRECTED');
    expect(afterGarminRefresh.garminElevationGainM).toBe(110);
    expect(afterGarminRefresh.stravaActivityId).toBe('strava-1');
  });

  it('keeps the newest Strava correction regardless of local/cloud merge order', () => {
    const older = activity({
      elevationGainM: 300,
      elevationLossM: 280,
      elevationSource: 'STRAVA_CORRECTED',
      stravaActivityId: 'strava-1',
      elevationUpdatedAt: '2026-09-19T12:00:00.000Z'
    });
    const newer = activity({
      elevationGainM: 420,
      elevationLossM: 410,
      elevationSource: 'STRAVA_CORRECTED',
      stravaActivityId: 'strava-1',
      elevationUpdatedAt: '2026-09-20T12:00:00.000Z'
    });

    for (const sources of [[[older], [newer]], [[newer], [older]]]) {
      const [merged] = mergeGarminActivities(...sources);
      expect(merged.elevationGainM).toBe(420);
      expect(merged.elevationLossM).toBe(410);
      expect(merged.elevationUpdatedAt).toBe('2026-09-20T12:00:00.000Z');
    }
  });

  it('does not preserve a GPX value under a Garmin provenance field', () => {
    const imported = activity({ source: 'GPX_IMPORT', elevationGainM: 120, garminElevationGainM: 120 });
    const [merged] = mergeGarminActivities([imported], [activity({ source: 'GPX_IMPORT', elevationGainM: 130 })]);
    expect(merged.elevationGainM).toBe(130);
    expect(merged.garminElevationGainM).toBeUndefined();
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

  it('uses the same effective calendar for display and exact-ID sync requests', () => {
    const planned = event({ id: 'planned-1' });
    const base = { schedules: [], allEvents: [planned] };
    const effective = buildEffectiveCalendar(base, {}, {});

    expect(selectCalendarEventsById(effective.allEvents, ['planned-1']).events).toEqual([planned]);
    expect(selectCalendarEventsById(effective.allEvents, ['removed-id']).missingIds).toEqual(['removed-id']);
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
