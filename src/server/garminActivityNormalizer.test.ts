import { describe, expect, it } from 'vitest';
import { normalizeGarminActivities, normalizeGarminActivity } from './garminActivityNormalizer';

describe('Garmin activity normalization', () => {
  it('rejects records without stable identity or a real start time', () => {
    const valid = { activityId: 123, startTimeLocal: '2026-09-17T08:00:00', activityType: 'running', duration: 1800 };
    expect(normalizeGarminActivity(valid)?.activityId).toBe('123');
    expect(normalizeGarminActivity({ ...valid, activityId: undefined })).toBeNull();
    expect(normalizeGarminActivity({ ...valid, startTimeLocal: undefined })).toBeNull();
    expect(normalizeGarminActivity({ ...valid, startTimeLocal: 'not-a-date' })).toBeNull();
    expect(normalizeGarminActivities([valid, { ...valid, activityId: undefined }]).skippedActivityCount).toBe(1);
  });

  it('normalizes a valid Garmin activity without synthetic fallbacks', () => {
    const result = normalizeGarminActivity({
      activityId: 456,
      activityName: 'Cardio',
      activityType: { typeKey: 'cardio' },
      startTimeGMT: '2026-09-17T09:00:00Z',
      duration: 1800,
      distance: 5000,
      averageHR: 150
    });
    expect(result).toMatchObject({
      activityId: '456',
      activityName: 'Calisthénie / Renforcement',
      startTimeLocal: '2026-09-17T09:00:00Z',
      durationMinutes: 30,
      distanceKm: 5,
      avgHeartRate: 150
    });
  });
});
