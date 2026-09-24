import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '../types/calendar';
import * as garminService from './garminService';
import {
  computeWorkoutSyncSignature,
  GARMIN_REST_CANCELLED_SIGNATURE,
  GARMIN_SYNCED_WORKOUT_IDS_KEY,
  syncCurrentWeekWorkoutsToGarmin
} from './garminAutoSyncService';
import { fetchGarminRunRegistry, saveGarminRunRegistryEntry } from './supabaseClient';
import { STORAGE_KEYS } from './storageService';

vi.mock('./supabaseClient', () => ({
  fetchGarminRunRegistry: vi.fn(),
  saveGarminRunRegistryEntry: vi.fn()
}));

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  }
});

function run(id: string, durationMinutes = 60): CalendarEvent {
  return {
    id,
    category: 'sport',
    sportType: 'RUN_EASY',
    title: 'Footing facile',
    startDate: '2026-09-23T12:00:00.000Z',
    endDate: '2026-09-23T13:00:00.000Z',
    durationMinutes,
    description: 'Footing',
    location: 'Parc',
    emoji: '🏃',
    colorId: '1',
    colorHex: '#000000'
  };
}

function restAfterRun(id: string): CalendarEvent {
  return {
    ...run(id, 0),
    title: 'Repos complet',
    sportType: 'MOBILITY',
    metadata: { isAdapted: true, originalSportType: 'RUN_EASY', originalTitle: 'Footing facile' }
  };
}

describe('cloud-backed Garmin run IDs', () => {
  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({ email: 'athlete@example.com', password: 'secret' });
  });

  it('uses the cloud exact ID to replace an old definition after local storage is lost', async () => {
    const oldRun = run('SPORT_WORKOUT_2026-09-23');
    const changedRun = run(oldRun.id, 45);
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: oldRun.id,
      workoutDate: '2026-09-23',
      workoutId: '123',
      signature: computeWorkoutSyncSignature(oldRun)
    }]);
    vi.mocked(saveGarminRunRegistryEntry).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({ success: true, workoutId: '456' });

    const result = await syncCurrentWeekWorkoutsToGarmin([changedRun], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(true);
    expect(push).toHaveBeenCalledWith(changedRun, '2026-09-23', 'FORERUNNER_55', undefined, '123');
    expect(saveGarminRunRegistryEntry).toHaveBeenCalledWith('account-a', {
      eventId: changedRun.id,
      workoutDate: '2026-09-23',
      workoutId: '456',
      signature: computeWorkoutSyncSignature(changedRun)
    });
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[oldRun.id]).toBe('456');
  });

  it('cancels a future run replaced by rest only through its exact cloud ID', async () => {
    const rest = restAfterRun('SPORT_WORKOUT_2026-09-23');
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [rest.id]: '123' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: rest.id,
      workoutDate: '2026-09-23',
      workoutId: '123',
      signature: computeWorkoutSyncSignature(run(rest.id))
    }]);
    const cancel = vi.spyOn(garminService, 'cancelWorkoutOnGarmin').mockResolvedValue({ success: true });
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([rest], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(true);
    expect(result.alreadyUpToDate).toBe(false);
    expect(cancel).toHaveBeenCalledWith('2026-09-23', '123');
    expect(push).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[rest.id]).toBe('123');
    expect(JSON.parse(values.get(STORAGE_KEYS.GARMIN_SYNCED_SIGNATURES) || '{}')[rest.id])
      .toBe(GARMIN_REST_CANCELLED_SIGNATURE);
  });

  it('fails closed when cloud and local IDs disagree for a planned rest', async () => {
    const rest = restAfterRun('SPORT_WORKOUT_2026-09-23');
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [rest.id]: '999' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: rest.id, workoutDate: '2026-09-23', workoutId: '123', signature: 'old'
    }]);
    const cancel = vi.spyOn(garminService, 'cancelWorkoutOnGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([rest], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('divergents');
    expect(cancel).not.toHaveBeenCalled();
  });

  it('retries the exact local ID after a lost cancellation response cleared the cloud row', async () => {
    const rest = restAfterRun('SPORT_WORKOUT_2026-09-23');
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [rest.id]: '123' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([]);
    const cancel = vi.spyOn(garminService, 'cancelWorkoutOnGarmin').mockResolvedValue({ success: true });

    const result = await syncCurrentWeekWorkoutsToGarmin([rest], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(true);
    expect(cancel).toHaveBeenCalledWith('2026-09-23', '123');
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[rest.id]).toBe('123');
  });

  it('does not repeat Garmin cancellation when the cloud tombstone already confirms rest', async () => {
    const rest = restAfterRun('SPORT_WORKOUT_2026-09-23');
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: `garmin-date:2026-09-23`,
      workoutDate: '2026-09-23',
      workoutId: '123',
      signature: GARMIN_REST_CANCELLED_SIGNATURE
    }]);
    const cancel = vi.spyOn(garminService, 'cancelWorkoutOnGarmin');
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([rest], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(true);
    expect(result.alreadyUpToDate).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[rest.id]).toBe('123');
  });

  it('recovers an ID committed by the server before the browser saved its event ID', async () => {
    const workout = run('SPORT_WORKOUT_2026-09-23');
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: 'garmin-date:2026-09-23',
      workoutDate: '2026-09-23',
      workoutId: '123',
      signature: 'pending-server-confirmation'
    }]);
    vi.mocked(saveGarminRunRegistryEntry).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({ success: true, workoutId: '456' });

    await syncCurrentWeekWorkoutsToGarmin([workout], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(push).toHaveBeenCalledWith(workout, '2026-09-23', 'FORERUNNER_55', undefined, '123');
  });

  it('stops when local and cloud exact IDs disagree', async () => {
    const workout = run('SPORT_WORKOUT_2026-09-23');
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [workout.id]: '999' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: workout.id,
      workoutDate: '2026-09-23',
      workoutId: '123',
      signature: computeWorkoutSyncSignature(workout)
    }]);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([workout], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Identifiants Garmin divergents');
    expect(push).not.toHaveBeenCalled();
  });

  it('refuses to push two planned runs for the same date', async () => {
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([]);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin(
      [run('first-run'), run('second-run')],
      new Date('2026-09-23T09:00:00Z'),
      { userId: 'account-a' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Plusieurs séances de course prévues');
    expect(push).not.toHaveBeenCalled();
  });

  it('does not write the old account workout into a new account local cache', async () => {
    const workout = run('SPORT_WORKOUT_2026-09-23');
    values.set(STORAGE_KEYS.ACCOUNT_DATA_OWNER, 'account-a');
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([]);
    vi.mocked(saveGarminRunRegistryEntry).mockResolvedValue(true);
    vi.spyOn(garminService, 'pushWorkoutToGarmin').mockImplementation(async () => {
      values.set(STORAGE_KEYS.ACCOUNT_DATA_OWNER, 'account-b');
      return { success: true, workoutId: '456' };
    });

    const result = await syncCurrentWeekWorkoutsToGarmin([workout], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Le compte a changé');
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[workout.id]).toBeUndefined();
    expect(saveGarminRunRegistryEntry).toHaveBeenCalledWith('account-a', expect.objectContaining({
      eventId: workout.id, workoutId: '456'
    }));
  });
});
