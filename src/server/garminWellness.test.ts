import { describe, expect, it, vi } from 'vitest';
import { fetchGarminWellness, getGarminLocalDate } from './garminWellness';

function client() {
  return {
    getSleepData: vi.fn().mockResolvedValue({ dailySleepDTO: {
      sleepTimeSeconds: 28_800,
      sleepScores: { overall: { value: 87, qualifierKey: 'GOOD' } }
    } }),
    getHeartRate: vi.fn().mockResolvedValue({ restingHeartRate: 49 }),
    client: { get: vi.fn()
      .mockResolvedValueOnce({ hrvSummary: { lastNightAvg: 58, status: 'BALANCED' } })
      .mockResolvedValueOnce([{ score: 81 }]) }
  };
}

describe('Garmin wellness adapter', () => {
  it('normalizes independent Garmin wellness signals', async () => {
    const result = await fetchGarminWellness(client(), '2026-09-20', 100, '2026-09-20T12:00:00Z');
    expect(result).toMatchObject({
      date: '2026-09-20',
      sleep: { totalMinutes: 480, score: 87, qualityMessage: 'GOOD' },
      restingHeartRate: 49,
      hrv: { lastNightAvg: 58, status: 'BALANCED' },
      trainingReadinessScore: 81,
      syncedAt: '2026-09-20T12:00:00Z'
    });
  });

  it('returns a dated partial record when optional Garmin calls fail', async () => {
    const failing = {
      getSleepData: vi.fn().mockRejectedValue(new Error('unavailable')),
      getHeartRate: vi.fn().mockRejectedValue(new Error('unavailable')),
      client: { get: vi.fn().mockRejectedValue(new Error('unavailable')) }
    };
    expect(await fetchGarminWellness(failing, '2026-09-20', 100, 'now')).toEqual({
      date: '2026-09-20', sleep: undefined, restingHeartRate: undefined,
      hrv: undefined, trainingReadinessScore: undefined, syncedAt: 'now'
    });
  });

  it('derives a stable Montreal calendar date', () => {
    expect(getGarminLocalDate(new Date('2026-09-20T02:00:00Z'))).toBe('2026-09-19');
  });
});
