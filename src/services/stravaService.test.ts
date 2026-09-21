import { describe, expect, it } from 'vitest';
import { applyStravaElevationEnrichments } from './stravaService';
import { GarminActivity } from '../types/garmin';

const activity: GarminActivity = {
  activityId: 'garmin-1',
  activityName: 'Mont-Royal',
  activityType: 'TRAIL_RUNNING',
  startTimeLocal: '2026-09-20T08:00:00',
  durationMinutes: 72,
  distanceKm: 10.1,
  elevationGainM: 110,
  elevationLossM: 105,
  avgHeartRate: 162,
  avgCadence: 165,
  trainingLoad: 88,
  source: 'GARMIN_CONNECT'
};

describe('Strava elevation enrichment', () => {
  it('replaces only effective terrain metrics and preserves Garmin telemetry', () => {
    const [enriched] = applyStravaElevationEnrichments([activity], [{
      activityId: 'garmin-1',
      stravaActivityId: 'strava-1',
      elevationGainM: 413,
      elevationLossM: 398,
      elevationSource: 'STRAVA_CORRECTED',
      elevationUpdatedAt: '2026-09-20T12:00:00.000Z',
      matchScore: 100
    }]);

    expect(enriched.elevationGainM).toBe(413);
    expect(enriched.elevationLossM).toBe(398);
    expect(enriched.garminElevationGainM).toBe(110);
    expect(enriched.garminElevationLossM).toBe(105);
    expect(enriched.elevationSource).toBe('STRAVA_CORRECTED');
    expect(enriched.avgHeartRate).toBe(162);
    expect(enriched.avgCadence).toBe(165);
    expect(enriched.trainingLoad).toBe(88);
  });
});
