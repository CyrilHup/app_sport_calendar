import { describe, expect, it } from 'vitest';
import { calculateElevationLossM, matchStravaActivities } from './stravaMatching';

const garminRun = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'garmin-1',
  activityName: 'Mont-Royal',
  activityType: 'TRAIL_RUNNING',
  startTimeLocal: '2026-09-20T08:00:00',
  durationMinutes: 72,
  distanceKm: 10.1,
  source: 'GARMIN_CONNECT' as const,
  ...overrides
});

describe('Strava activity matching', () => {
  it('matches a same-day run with close time, duration and distance', () => {
    const [match] = matchStravaActivities(
      [garminRun()],
      [{
        id: 987,
        sport_type: 'TrailRun',
        start_date_local: '2026-09-20T08:03:00-04:00',
        moving_time: 4_300,
        elapsed_time: 4_350,
        distance: 10_050,
        total_elevation_gain: 413
      }]
    );

    expect(match?.stravaActivity.id).toBe(987);
    expect(match?.score).toBeGreaterThanOrEqual(90);
  });

  it('does not match different activities merely because they share a date', () => {
    const matches = matchStravaActivities(
      [garminRun()],
      [{
        id: 988,
        sport_type: 'Run',
        start_date_local: '2026-09-20T18:00:00-04:00',
        moving_time: 2_400,
        distance: 5_000
      }]
    );

    expect(matches).toHaveLength(0);
  });

  it('uses each Strava activity only once', () => {
    const matches = matchStravaActivities(
      [garminRun({ activityId: 'garmin-1' }), garminRun({ activityId: 'garmin-2', startTimeLocal: '2026-09-20T08:04:00' })],
      [{
        id: 989,
        sport_type: 'Run',
        start_date_local: '2026-09-20T08:03:00-04:00',
        moving_time: 4_300,
        distance: 10_050
      }]
    );

    expect(matches).toHaveLength(1);
  });
});

describe('Strava elevation stream helpers', () => {
  it('filters small downhill noise while accumulating meaningful descent', () => {
    expect(calculateElevationLossM([100, 99, 96, 95.5, 90, 91])).toBe(9);
  });

  it('returns undefined when no usable profile exists', () => {
    expect(calculateElevationLossM([null, 'bad'])).toBeUndefined();
  });
});
