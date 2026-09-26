import { describe, expect, it } from 'vitest';
import { GarminActivity } from '../types/garmin';
import { capLongRunToRecentHistory, recentRunBaseline } from './trainingBaseline';
import { buildCompleteCalendar } from './icsParser';
import { GLOBAL_APP_CONFIG } from './periodizationEngine';

const run = (id: string, day: number, durationMinutes: number, distanceKm: number): GarminActivity => ({
  activityId: id, activityName: 'Course', activityType: 'RUNNING',
  startTimeLocal: `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`,
  durationMinutes, distanceKm, source: 'GARMIN_CONNECT'
});

describe('history based long-run guard', () => {
  it('holds a large planned jump until longer runs are actually completed', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    const baseline = recentRunBaseline([
      run('1', 7, 42, 7), run('2', 12, 52, 8), run('3', 18, 60, 9), run('4', 24, 77, 11)
    ], now);
    expect(baseline).toMatchObject({ runCount28d: 4, longestRunMinutes30d: 77, runKm28d: 35 });
    expect(capLongRunToRecentHistory(115, baseline)).toBe(89);
    expect(capLongRunToRecentHistory(75, baseline)).toBe(75);
  });

  it('uses a conservative provisional plan when the recent history is sparse', () => {
    expect(capLongRunToRecentHistory(115, recentRunBaseline([run('1', 24, 45, 6)],
      new Date('2026-09-26T12:00:00Z')))).toBe(52);
    expect(capLongRunToRecentHistory(115, recentRunBaseline([], new Date('2026-09-26T12:00:00Z')))).toBe(60);
  });

  it('applies the guard to the near-term calendar and labels the foundation Sunday optional', () => {
    const runs = [run('1', 7, 42, 7), run('2', 12, 52, 8), run('3', 18, 60, 9), run('4', 24, 77, 11)];
    const calendar = buildCompleteCalendar([], new Date('2026-09-28T12:00:00'), 7,
      GLOBAL_APP_CONFIG, runs, new Date('2026-09-26T12:00:00'));
    const saturday = calendar.allEvents.find(event => event.id === 'SPORT_WORKOUT_2026-10-03');
    const sunday = calendar.allEvents.find(event => event.id === 'SPORT_WORKOUT_2026-10-04');
    expect(saturday?.durationMinutes).toBe(89);
    expect(saturday?.description).toContain('77 min');
    expect(sunday?.metadata?.isOptional).toBe(true);
  });
});
