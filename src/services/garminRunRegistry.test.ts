import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '../types/calendar';
import * as garminService from './garminService';
import {
  computeWorkoutSyncSignature,
  GARMIN_REST_CANCELLED_SIGNATURE,
  GARMIN_SYNCED_SIGNATURES_KEY,
  GARMIN_SYNCED_WORKOUT_IDS_KEY,
  syncCurrentWeekWorkoutsToGarmin
} from './garminAutoSyncService';
import { fetchGarminRunRegistry, exchangeGarminRunRegistryEntries } from './supabaseClient';
import { STORAGE_KEYS } from './storageService';

vi.mock('./supabaseClient', () => ({
  fetchGarminRunRegistry: vi.fn(),
  exchangeGarminRunRegistryEntries: vi.fn()
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
  it('cancels a published future-week run changed to rest after a move', async () => {
    const rest = {
      ...restAfterRun('SPORT_WORKOUT_2026-09-23'),
      startDate: '2026-09-28T12:00:00.000Z', endDate: '2026-09-28T12:00:00.000Z'
    };
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: rest.id, workoutDate: '2026-09-28', workoutId: '123', signature: 'signed-moved-run'
    }]);
    const cancel = vi.spyOn(garminService, 'cancelWorkoutOnGarmin').mockResolvedValue({ success: true });
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');
    const result = await syncCurrentWeekWorkoutsToGarmin([rest], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a', changedEventIds: [rest.id]
    });
    expect(result.success).toBe(true);
    expect(cancel).toHaveBeenCalledWith('2026-09-28', '123');
    expect(push).not.toHaveBeenCalled();
  });

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
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({ success: true, workoutId: '456' });

    const result = await syncCurrentWeekWorkoutsToGarmin([changedRun], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(true);
    expect(push).toHaveBeenCalledWith(changedRun, '2026-09-23', 'FORERUNNER_55', undefined, '123', '2026-09-23', computeWorkoutSyncSignature(changedRun));
    // The server owns confirmation; the browser must not overwrite a newer
    // registry row written by another device after the response.
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

  it('reports manual review when an app-tracked run becomes rest but has no exact Garmin ID', async () => {
    const rest = restAfterRun('SPORT_WORKOUT_2026-09-23');
    values.set(GARMIN_SYNCED_SIGNATURES_KEY, JSON.stringify({
      [rest.id]: computeWorkoutSyncSignature(run(rest.id))
    }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([]);
    const cancel = vi.spyOn(garminService, 'cancelWorkoutOnGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([rest], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('sans identifiant exact enregistré');
    expect(cancel).not.toHaveBeenCalled();
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
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({ success: true, workoutId: '456' });

    await syncCurrentWeekWorkoutsToGarmin([workout], new Date('2026-09-23T09:00:00Z'), {
      userId: 'account-a'
    });

    expect(push).toHaveBeenCalledWith(workout, '2026-09-23', 'FORERUNNER_55', undefined, '123', '2026-09-23', computeWorkoutSyncSignature(workout));
  });

  it('recovers a stale local ID from the server-confirmed exact version', async () => {
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

    expect(result.success).toBe(true);
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[workout.id]).toBe('123');
    expect(push).not.toHaveBeenCalled();
  });

  it('exchanges two runs when the same-day scheduled time passed but no activity was recorded', async () => {
    const first = { ...run('SPORT_WORKOUT_2026-09-23'), startDate: '2026-09-24T12:00:00.000Z',
      endDate: '2026-09-24T13:00:00.000Z', metadata: { originalDate: '2026-09-23', isPostponed: true } };
    const second = { ...run('SPORT_WORKOUT_2026-09-24'), startDate: '2026-09-23T12:00:00.000Z',
      endDate: '2026-09-23T13:00:00.000Z', metadata: { originalDate: '2026-09-24', isPostponed: true } };
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [first.id]: '111', [second.id]: '222' }));
    values.set(GARMIN_SYNCED_SIGNATURES_KEY, JSON.stringify({ [first.id]: 'old-first', [second.id]: 'old-second' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-23', workoutId: '111', signature: 'old-first' },
      { eventId: second.id, workoutDate: '2026-09-24', workoutId: '222', signature: 'old-second' }
    ]);
    vi.mocked(exchangeGarminRunRegistryEntries).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockResolvedValueOnce({ success: true, workoutId: '333' })
      .mockResolvedValueOnce({ success: true, workoutId: '444' });

    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T13:00:00Z'), { userId: 'account-a' });

    expect(result.success).toBe(true);
    expect(push).toHaveBeenNthCalledWith(1, first, '2026-09-24', 'FORERUNNER_55', undefined, '222', '2026-09-24', computeWorkoutSyncSignature(first));
    expect(push).toHaveBeenNthCalledWith(2, second, '2026-09-23', 'FORERUNNER_55', undefined, '111', '2026-09-23', computeWorkoutSyncSignature(second));
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')).toMatchObject({ [first.id]: '333', [second.id]: '444' });
    // A swap can never be persisted with sequential single-row upserts: the
    // first swapped row collides with the row still holding the old date/ID.
    expect(exchangeGarminRunRegistryEntries).toHaveBeenCalledWith('account-a', {
      eventId: first.id,
      workoutDate: '2026-09-24',
      workoutId: '333',
      signature: computeWorkoutSyncSignature(first)
    }, {
      eventId: second.id,
      workoutDate: '2026-09-23',
      workoutId: '444',
      signature: computeWorkoutSyncSignature(second)
    });
  });

  it('heals the cloud registry without pushing when Garmin already holds the swap', async () => {
    // Garmin + local storage already swapped (new IDs, fresh signatures) but
    // the cloud registry still shows the old mapping because sequential
    // upserts cannot express a swap.
    const first = { ...run('SPORT_WORKOUT_2026-09-23'), startDate: '2026-09-24T12:00:00.000Z',
      endDate: '2026-09-24T13:00:00.000Z', metadata: { originalDate: '2026-09-23', isPostponed: true } };
    const second = { ...run('SPORT_WORKOUT_2026-09-24'), startDate: '2026-09-23T12:00:00.000Z',
      endDate: '2026-09-23T13:00:00.000Z', metadata: { originalDate: '2026-09-24', isPostponed: true } };
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [first.id]: '333', [second.id]: '444' }));
    values.set(GARMIN_SYNCED_SIGNATURES_KEY, JSON.stringify({
      [first.id]: computeWorkoutSyncSignature(first),
      [second.id]: computeWorkoutSyncSignature(second)
    }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-23', workoutId: '444', signature: computeWorkoutSyncSignature(second) },
      { eventId: second.id, workoutDate: '2026-09-24', workoutId: '333', signature: computeWorkoutSyncSignature(first) }
    ]);
    vi.mocked(exchangeGarminRunRegistryEntries).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T13:00:00Z'), { userId: 'account-a' });

    expect(result.success).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(exchangeGarminRunRegistryEntries).toHaveBeenCalledWith('account-a', {
      eventId: first.id,
      workoutDate: '2026-09-24',
      workoutId: '333',
      signature: computeWorkoutSyncSignature(first)
    }, {
      eventId: second.id,
      workoutDate: '2026-09-23',
      workoutId: '444',
      signature: computeWorkoutSyncSignature(second)
    });
  });

  it('refuses to infer workout contents from foreign same-day IDs', async () => {
    // Local + cloud still reference the pre-swap IDs, but Garmin already
    // swapped: each push reports its replace target gone with exactly one
    // QMT session scheduled. Adopt instead of duplicating.
    const first = { ...run('SPORT_WORKOUT_2026-09-23'), startDate: '2026-09-24T12:00:00.000Z',
      endDate: '2026-09-24T13:00:00.000Z', metadata: { originalDate: '2026-09-23', isPostponed: true } };
    const second = { ...run('SPORT_WORKOUT_2026-09-24'), startDate: '2026-09-23T12:00:00.000Z',
      endDate: '2026-09-23T13:00:00.000Z', metadata: { originalDate: '2026-09-24', isPostponed: true } };
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [first.id]: '111', [second.id]: '222' }));
    values.set(GARMIN_SYNCED_SIGNATURES_KEY, JSON.stringify({ [first.id]: 'old-first', [second.id]: 'old-second' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-23', workoutId: '111', signature: 'old-first' },
      { eventId: second.id, workoutDate: '2026-09-24', workoutId: '222', signature: 'old-second' }
    ]);
    vi.mocked(exchangeGarminRunRegistryEntries).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockResolvedValueOnce({
        success: false,
        errorCode: 'GARMIN_REPLACE_MISSING',
        error: "La séance exacte 222 n'est plus programmée le 2026-09-24. Vérifiez manuellement le calendrier Garmin avant de réessayer.",
        scheduledDate: '2026-09-24',
        scheduledWorkoutIds: ['333']
      })
      .mockResolvedValueOnce({
        success: false,
        errorCode: 'GARMIN_REPLACE_MISSING',
        error: "La séance exacte 111 n'est plus programmée le 2026-09-23. Vérifiez manuellement le calendrier Garmin avant de réessayer.",
        scheduledDate: '2026-09-23',
        scheduledWorkoutIds: ['444']
      });

    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T13:00:00Z'), { userId: 'account-a' });

    expect(result.success).toBe(false);
    expect(push).toHaveBeenCalledTimes(2);
    expect(exchangeGarminRunRegistryEntries).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[first.id]).not.toBe('333');
  });

  it('does not synchronize an exchange when an actual activity is associated with a workout', async () => {
    const first = { ...run('SPORT_WORKOUT_2026-09-23'), startDate: '2026-09-24T12:00:00.000Z',
      metadata: { originalDate: '2026-09-23', isPostponed: true } };
    const second = { ...run('SPORT_WORKOUT_2026-09-24'), startDate: '2026-09-23T12:00:00.000Z',
      metadata: { originalDate: '2026-09-24', isPostponed: true } };
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [first.id]: '111', [second.id]: '222' }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-23', workoutId: '111', signature: 'old-first' },
      { eventId: second.id, workoutDate: '2026-09-24', workoutId: '222', signature: 'old-second' }
    ]);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T13:00:00Z'), {
      userId: 'account-a', completedEventIds: [second.id]
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('une activité réalisée est déjà associée');
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
    // The server commits before returning; the browser must not write with the new account's token.
  });
  it('moves a cloud-tracked session using its confirmed source date after storage reset', async () => {
    const original = run('SPORT_WORKOUT_2026-09-23');
    const moved = { ...original, startDate: '2026-09-25T12:00:00Z', metadata: { originalDate: '2026-09-23', isPostponed: true } };
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([{
      eventId: original.id, workoutDate: '2026-09-23', workoutId: '123', signature: computeWorkoutSyncSignature(original)
    }]);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({ success: true, workoutId: '456' });
    const result = await syncCurrentWeekWorkoutsToGarmin([moved], new Date('2026-09-23T09:00:00Z'), { userId: 'account-a' });
    expect(result.success).toBe(true);
    expect(push).toHaveBeenCalledWith(moved, '2026-09-25', 'FORERUNNER_55', undefined, '123', '2026-09-23', computeWorkoutSyncSignature(moved));
  });

  it('publishes an explicit Sunday-to-Monday move and retains it for later retries', async () => {
    const original = { ...run('sunday'), startDate: '2026-09-27T12:00:00Z' };
    const moved = { ...original, startDate: '2026-09-28T12:00:00Z', metadata: { originalDate: '2026-09-27', isPostponed: true } };
    const entry = { eventId: original.id, workoutDate: '2026-09-27', workoutId: '123', signature: computeWorkoutSyncSignature(original) };
    vi.mocked(fetchGarminRunRegistry).mockImplementation(async () => [{ ...entry }]);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockResolvedValueOnce({ success: false, error: 'temporary network failure' })
      .mockResolvedValueOnce({ success: true, workoutId: '456' });
    const result = await syncCurrentWeekWorkoutsToGarmin([moved], new Date('2026-09-27T09:00:00Z'), {
      userId: 'account-a', changedEventIds: [moved.id]
    });
    expect(result.success).toBe(false);
    expect(push).toHaveBeenCalledWith(moved, '2026-09-28', 'FORERUNNER_55', undefined, '123', '2026-09-27', computeWorkoutSyncSignature(moved));
    const retried = await syncCurrentWeekWorkoutsToGarmin([moved], new Date('2026-09-27T09:00:00Z'), { userId: 'account-a' });
    expect(retried.success).toBe(true);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('recovers a swap after a server-confirmed push response was lost', async () => {
    const first = { ...run('first'), startDate: '2026-09-24T12:00:00Z', metadata: { originalDate: '2026-09-23', isPostponed: true } };
    const second = { ...run('second'), startDate: '2026-09-23T12:00:00Z', metadata: { originalDate: '2026-09-24', isPostponed: true } };
    values.set(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ first: '222', second: '444' }));
    values.set(GARMIN_SYNCED_SIGNATURES_KEY, JSON.stringify({ first: 'old', second: computeWorkoutSyncSignature(second) }));
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-23', workoutId: '444', signature: computeWorkoutSyncSignature(second) },
      { eventId: second.id, workoutDate: '2026-09-24', workoutId: '333', signature: computeWorkoutSyncSignature(first) }
    ]);
    vi.mocked(exchangeGarminRunRegistryEntries).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin');
    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T09:00:00Z'), { userId: 'account-a' });
    expect(result.success).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(exchangeGarminRunRegistryEntries).toHaveBeenCalledWith('account-a', {
      eventId: first.id, workoutDate: '2026-09-24', workoutId: '333', signature: computeWorkoutSyncSignature(first)
    }, {
      eventId: second.id, workoutDate: '2026-09-23', workoutId: '444', signature: computeWorkoutSyncSignature(second)
    });
  });

  it('restores both Garmin days after undo without requiring originalDate metadata', async () => {
    const first = { ...run('first'), startDate: '2026-09-23T12:00:00Z' };
    const second = { ...run('second'), startDate: '2026-09-24T12:00:00Z' };
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-24', workoutId: '333', signature: 'old-first' },
      { eventId: second.id, workoutDate: '2026-09-23', workoutId: '444', signature: 'old-second' }
    ]);
    vi.mocked(exchangeGarminRunRegistryEntries).mockResolvedValue(true);
    const push = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockResolvedValueOnce({ success: true, workoutId: '555' })
      .mockResolvedValueOnce({ success: true, workoutId: '666' });
    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T09:00:00Z'), { userId: 'account-a', changedEventIds: [first.id, second.id] });
    expect(result.success).toBe(true);
    expect(push.mock.calls[0].slice(4,6)).toEqual(['444','2026-09-23']);
    expect(push.mock.calls[1].slice(4,6)).toEqual(['333','2026-09-24']);
    expect(exchangeGarminRunRegistryEntries).toHaveBeenCalledOnce();
  });

  it('reports a failed transaction without losing confirmed local swap IDs', async () => {
    const first = { ...run('first'), startDate: '2026-09-24T12:00:00Z' };
    const second = { ...run('second'), startDate: '2026-09-23T12:00:00Z' };
    vi.mocked(fetchGarminRunRegistry).mockResolvedValue([
      { eventId: first.id, workoutDate: '2026-09-23', workoutId: '444', signature: computeWorkoutSyncSignature(second) },
      { eventId: second.id, workoutDate: '2026-09-24', workoutId: '333', signature: computeWorkoutSyncSignature(first) }
    ]);
    vi.mocked(exchangeGarminRunRegistryEntries).mockResolvedValue(false);
    const result = await syncCurrentWeekWorkoutsToGarmin([first, second], new Date('2026-09-23T09:00:00Z'), { userId: 'account-a' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('registre non réconcilié');
    expect(JSON.parse(values.get(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')).toMatchObject({ first: '333', second: '444' });
  });

});
