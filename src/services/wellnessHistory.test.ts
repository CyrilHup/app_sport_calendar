import { beforeEach, describe, expect, it } from 'vitest';
import { GarminWellnessData } from '../types/garmin';
import { getWellnessForDate, mergeWellnessData, saveWellnessData } from './readinessEngine';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(key => delete store[key]); }
};

const local: GarminWellnessData = {
  date: '2026-09-16',
  syncedAt: '2026-09-16T12:00:00.000Z',
  restingHeartRate: 51,
  sleep: { totalMinutes: 420, score: 82 },
  hrv: { status: 'BALANCED', lastNightAvg: 56 }
};

describe('wellness history merge', () => {
  beforeEach(() => localStorage.clear());

  it('does not let stale cloud data overwrite newer local measurements', () => {
    const cloud: GarminWellnessData = {
      date: local.date,
      syncedAt: '2026-09-16T08:00:00.000Z',
      restingHeartRate: 58,
      sleep: { totalMinutes: 360, deepMinutes: 80 },
      bodyBattery: 70
    };
    saveWellnessData(local);
    saveWellnessData(cloud);

    expect(getWellnessForDate(local.date)).toMatchObject({
      syncedAt: local.syncedAt,
      restingHeartRate: 51,
      bodyBattery: 70,
      sleep: { totalMinutes: 420, score: 82, deepMinutes: 80 }
    });
  });

  it('uses newer cloud fields while retaining measurements omitted from that response', () => {
    const cloud: GarminWellnessData = {
      date: local.date,
      syncedAt: '2026-09-16T15:00:00.000Z',
      restingHeartRate: 49,
      hrv: { status: 'LOW' }
    };
    expect(mergeWellnessData(local, cloud)).toMatchObject({
      syncedAt: cloud.syncedAt,
      restingHeartRate: 49,
      sleep: local.sleep,
      hrv: { status: 'LOW', lastNightAvg: 56 }
    });
  });

  it('rejects combining measurements from different days', () => {
    expect(() => mergeWellnessData(local, { ...local, date: '2026-09-17' })).toThrow('different dates');
  });
});
