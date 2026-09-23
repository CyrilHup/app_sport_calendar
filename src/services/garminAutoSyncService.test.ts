import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeGarminText } from './garminService';
import {
  computeWorkoutSyncSignature,
  getCurrentWeekDateBounds,
  filterCurrentWeekSportWorkouts,
  isGarminAutoSyncEnabled,
  setGarminAutoSyncEnabled,
  GARMIN_AUTO_SYNC_ENABLED_KEY,
  GARMIN_SYNCED_SIGNATURES_KEY,
  GARMIN_SYNCED_WORKOUT_IDS_KEY,
  saveSyncedWeekWorkoutSignatures,
  isWorkoutSyncedToGarmin,
  syncCurrentWeekWorkoutsToGarmin
} from './garminAutoSyncService';
import { CalendarEvent } from '../types/calendar';
import * as garminService from './garminService';

// Mock localStorage for Node environment
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  length: 0
} as any;

function createMockEvent(partial: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'mock_' + Math.random(),
    title: 'Workout',
    startDate: '2026-09-09T16:00:00Z',
    endDate: '2026-09-09T17:00:00Z',
    category: 'sport',
    durationMinutes: 60,
    location: 'Montreal',
    description: 'Mock workout description',
    emoji: '🏃',
    colorId: '1',
    colorHex: '#3b82f6',
    ...partial
  };
}

describe('Garmin Text Sanitizer & Watch Optimizer', () => {
  it('strips all emojis from workout titles and notes', () => {
    const rawTitle = '🏃 Footing récupération active ❤️ 🔥';
    const cleaned = sanitizeGarminText(rawTitle);
    expect(cleaned).toBe('Footing récupération active');
    expect(cleaned.includes('🏃')).toBe(false);
    expect(cleaned.includes('🔥')).toBe(false);
  });

  it('normalizes unsupported special symbols into ASCII equivalents', () => {
    const text = 'Série 1 ➔ Marche • Repos 1’30”';
    const cleaned = sanitizeGarminText(text);
    expect(cleaned).toBe("Série 1 -> Marche - Repos 1'30\"");
  });

  it('enforces maximum character length properly', () => {
    const longTitle = 'Entraînement de côtes très intensif avec répétitions multiples';
    const cleaned = sanitizeGarminText(longTitle, 30);
    expect(cleaned.length).toBeLessThanOrEqual(30);
    expect(cleaned).toBe('Entraînement de côtes très int');
  });

  it('handles empty or falsy strings gracefully', () => {
    expect(sanitizeGarminText('')).toBe('');
    expect(sanitizeGarminText(null as any)).toBe('');
  });
});

describe('Garmin Auto-Sync Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('enables auto-sync by default and saves user preferences', () => {
    expect(isGarminAutoSyncEnabled()).toBe(true);
    setGarminAutoSyncEnabled(false);
    expect(isGarminAutoSyncEnabled()).toBe(false);
    expect(localStorage.getItem(GARMIN_AUTO_SYNC_ENABLED_KEY)).toBe('false');
    setGarminAutoSyncEnabled(true);
    expect(isGarminAutoSyncEnabled()).toBe(true);
  });

  it('correctly identifies current week bounds (Monday to Sunday)', () => {
    // Wednesday 2026-09-09
    const refDate = new Date('2026-09-09T12:00:00Z');
    const { weekStartStr, weekEndStr } = getCurrentWeekDateBounds(refDate);

    // Monday should be 2026-09-07, Sunday 2026-09-13
    expect(weekStartStr).toBe('2026-09-07');
    expect(weekEndStr).toBe('2026-09-13');
  });

  it('filters only sport workouts within current week', () => {
    const refDate = new Date('2026-09-09T12:00:00Z');

    const sampleEvents: CalendarEvent[] = [
      createMockEvent({
        id: 'sport_current_week',
        title: 'Footing Zone 2',
        startDate: '2026-09-10T08:00:00Z',
        endDate: '2026-09-10T09:00:00Z',
        category: 'sport',
        durationMinutes: 60,
        location: 'Mont-Royal'
      }),
      createMockEvent({
        id: 'study_current_week',
        title: 'Cours Math ÉTS',
        startDate: '2026-09-10T10:00:00Z',
        endDate: '2026-09-10T12:00:00Z',
        category: 'course',
        durationMinutes: 120,
        location: 'Pavillon A'
      }),
      createMockEvent({
        id: 'sport_next_week',
        title: 'Sortie Longue',
        startDate: '2026-09-15T08:00:00Z',
        endDate: '2026-09-15T10:00:00Z',
        category: 'sport',
        durationMinutes: 120,
        location: 'Parc'
      }),
      createMockEvent({
        id: 'postponed_placeholder',
        title: 'Séance déplacée',
        startDate: '2026-09-08T08:00:00Z',
        endDate: '2026-09-08T09:00:00Z',
        category: 'sport',
        durationMinutes: 60,
        location: 'Mont-Royal',
        metadata: { isPostponedPlaceholder: true }
      })
    ];

    const filtered = filterCurrentWeekSportWorkouts(sampleEvents, refDate);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('sport_current_week');
  });

  it('computes distinct signatures when workout date or parameters change', () => {
    const ev1: CalendarEvent = createMockEvent({
      id: 'ev_1',
      title: 'Footing',
      startDate: '2026-09-08T08:00:00Z',
      endDate: '2026-09-08T09:00:00Z',
      category: 'sport',
      durationMinutes: 60,
      location: 'Parc'
    });

    const sigInitial = computeWorkoutSyncSignature(ev1);

    // Postpone / move to next day
    const evPostponed: CalendarEvent = {
      ...ev1,
      startDate: '2026-09-09T08:00:00Z',
      metadata: { originalDate: '2026-09-08' }
    };
    const sigPostponed = computeWorkoutSyncSignature(evPostponed);

    expect(sigInitial).not.toBe(sigPostponed);

    // Adapt / change duration
    const evAdapted: CalendarEvent = {
      ...ev1,
      durationMinutes: 40,
      metadata: { isAdapted: true }
    };
    const sigAdapted = computeWorkoutSyncSignature(evAdapted);

    expect(sigInitial).not.toBe(sigAdapted);
  });

  it('includes the Garmin workout definition version in sync signatures', () => {
    const event = createMockEvent({ id: 'versioned-workout' });
    expect(computeWorkoutSyncSignature(event)).toContain('recovery-2min-heart-zones-v2::versioned-workout');
  });

  it('invalidates a synced workout when its prescribed zones or target mode change', () => {
    const event = createMockEvent({
      id: 'zone-workout',
      metadata: { targetHeartRateRange: [141, 164] }
    });
    const originalSignature = computeWorkoutSyncSignature(event);
    expect(computeWorkoutSyncSignature({
      ...event,
      metadata: { targetHeartRateRange: [132, 150] }
    })).not.toBe(originalSignature);

    garminService.setGarminWorkoutTargetMode('HR_ONLY');
    expect(computeWorkoutSyncSignature(event)).not.toBe(originalSignature);
  });

  it('does not create a duplicate for a legacy workout without a known Garmin ID', async () => {
    const event = createMockEvent({
      id: 'legacy-workout', startDate: '2026-09-09T16:00:00Z'
    });
    saveSyncedWeekWorkoutSignatures({
      [event.id]: 'recovery-2min-v1::legacy-workout::old-definition'
    });
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com', password: 'password123'
    });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const result = await syncCurrentWeekWorkoutsToGarmin(
      [event], new Date('2026-09-09T12:00:00Z'), { force: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('éviter les doublons');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('also protects current-version signatures when their Garmin ID is unknown', async () => {
    const event = createMockEvent({ id: 'missing-id' });
    saveSyncedWeekWorkoutSignatures({ [event.id]: computeWorkoutSyncSignature(event) });
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com', password: 'password123'
    });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const changed = { ...event, durationMinutes: 45 };
    const result = await syncCurrentWeekWorkoutsToGarmin(
      [changed], new Date('2026-09-09T12:00:00Z'), { force: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('identifiant exact');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('passes the selected athlete profile through to the Garmin push', async () => {
    const event = createMockEvent({ id: 'profile-workout' });
    const athleteProfile = garminService.getDynamicAthleteProfile([], { fcMax: 180, fcRest: 60 });
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com', password: 'password123'
    });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({
      success: true, workoutId: '101'
    });

    const result = await syncCurrentWeekWorkoutsToGarmin(
      [event], new Date('2026-09-09T12:00:00Z'), { athleteProfile }
    );

    expect(result.success).toBe(true);
    expect(pushSpy).toHaveBeenCalledWith(event, '2026-09-09', 'FORERUNNER_55', athleteProfile, undefined);
    expect(isWorkoutSyncedToGarmin(event, athleteProfile)).toBe(true);
  });

  it('lets the server reuse its Garmin session when no password is stored locally', async () => {
    const event = createMockEvent({ id: 'server-session-workout' });
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue(null);
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({
      success: true, workoutId: '321'
    });

    const result = await syncCurrentWeekWorkoutsToGarmin([event], new Date('2026-09-09T12:00:00Z'));

    expect(result.success).toBe(true);
    expect(pushSpy).toHaveBeenCalledOnce();
  });

  it('stops the batch after the first structured Garmin reauthentication error', async () => {
    const events = [
      createMockEvent({ id: 'wednesday' }),
      createMockEvent({ id: 'thursday', startDate: '2026-09-10T08:00:00Z' })
    ];
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({
      success: false,
      error: 'Veuillez renseigner votre email et mot de passe Garmin Connect.',
      errorCode: 'GARMIN_AUTH_REQUIRED'
    });

    const result = await syncCurrentWeekWorkoutsToGarmin(events, new Date('2026-09-09T12:00:00Z'));

    expect(result.reason).toBe('NO_CREDENTIALS');
    expect(pushSpy).toHaveBeenCalledOnce();
    expect(result.totalWeekWorkouts).toBe(2);
  });

  it('never creates or replaces a workout after it has started', async () => {
    const started = createMockEvent({
      id: 'already-started',
      startDate: '2026-09-09T08:00:00Z',
      endDate: '2026-09-09T09:00:00Z'
    });
    saveSyncedWeekWorkoutSignatures({ [started.id]: computeWorkoutSyncSignature(started) });
    localStorage.setItem(GARMIN_SYNCED_WORKOUT_IDS_KEY, JSON.stringify({ [started.id]: '123' }));
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin');

    const changed = { ...started, durationMinutes: 45 };
    const result = await syncCurrentWeekWorkoutsToGarmin([changed], new Date('2026-09-09T12:00:00Z'));

    expect(result.success).toBe(true);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}')[started.id]).toBe('123');

    const completedEarly = createMockEvent({ id: 'completed-early', metadata: { isCompleted: true } });
    await syncCurrentWeekWorkoutsToGarmin([completedEarly], new Date('2026-09-09T12:00:00Z'));
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('does not recreate a workout completed before its scheduled start', async () => {
    const completed = createMockEvent({ id: 'completed-before-start' });
    const upcoming = createMockEvent({ id: 'still-upcoming', startDate: '2026-09-10T16:00:00Z' });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({
      success: true,
      workoutId: '123',
      workoutName: '[QMT] Workout',
      scheduledDate: '2026-09-10'
    });

    await syncCurrentWeekWorkoutsToGarmin(
      [completed, upcoming],
      new Date('2026-09-09T12:00:00Z'),
      { completedEventIds: [completed.id] }
    );

    expect(pushSpy).toHaveBeenCalledOnce();
    expect(pushSpy).toHaveBeenCalledWith(upcoming, '2026-09-10', 'FORERUNNER_55', undefined, undefined);
  });

  it('syncs only changed workouts and skips already synced ones', async () => {
    // Mock credentials
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com',
      password: 'password123'
    });

    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({
      success: true,
      workoutId: '123',
      workoutName: '[QMT] Footing',
      scheduledDate: '2026-09-09'
    });

    const refDate = new Date('2026-09-09T12:00:00Z');
    const sampleEvents: CalendarEvent[] = [
      createMockEvent({
        id: 'sport_1',
        title: 'Footing',
        startDate: '2026-09-09T16:00:00Z',
        endDate: '2026-09-09T17:00:00Z',
        category: 'sport',
        durationMinutes: 60,
        location: 'Parc'
      })
    ];

    // First call -> pushed
    const res1 = await syncCurrentWeekWorkoutsToGarmin(sampleEvents, refDate);
    expect(res1.success).toBe(true);
    expect(res1.pushedCount).toBe(1);
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Second call without modifications -> skips and reports alreadyUpToDate
    const res2 = await syncCurrentWeekWorkoutsToGarmin(sampleEvents, refDate);
    expect(res2.success).toBe(true);
    expect(res2.pushedCount).toBe(0);
    expect(res2.alreadyUpToDate).toBe(true);
    expect(pushSpy).toHaveBeenCalledTimes(1); // No new call!

    // Third call after modifying event -> pushes updated workout!
    const modifiedEvents: CalendarEvent[] = [
      {
        ...sampleEvents[0],
        durationMinutes: 45,
        metadata: { isAdapted: true }
      }
    ];
    const res3 = await syncCurrentWeekWorkoutsToGarmin(modifiedEvents, refDate);
    expect(res3.pushedCount).toBe(1);
    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(pushSpy.mock.calls[1][4]).toBe('123');
    expect(JSON.parse(localStorage.getItem(GARMIN_SYNCED_WORKOUT_IDS_KEY) || '{}').sport_1).toBe('123');
  });

  it('marks a workout as synced only after Garmin confirms scheduling', async () => {
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com',
      password: 'password123'
    });

    const workout = createMockEvent({
      id: 'garmin_confirmation_test',
      startDate: '2026-09-09T16:00:00Z',
      endDate: '2026-09-09T17:00:00Z'
    });
    const refDate = new Date('2026-09-09T12:00:00Z');

    vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValueOnce({
      success: false,
      error: 'Garmin refused calendar scheduling'
    });

    const failedResult = await syncCurrentWeekWorkoutsToGarmin([workout], refDate);
    expect(failedResult.success).toBe(false);
    expect(failedResult.reason).toBe('ERROR');
    expect(isWorkoutSyncedToGarmin(workout)).toBe(false);
    expect(JSON.parse(localStorage.getItem(GARMIN_SYNCED_SIGNATURES_KEY) || '{}')).toEqual({});

    vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValueOnce({
      success: true,
      workoutId: '456',
      scheduledDate: '2026-09-09'
    });

    const successResult = await syncCurrentWeekWorkoutsToGarmin([workout], refDate);
    expect(successResult.success).toBe(true);
    expect(isWorkoutSyncedToGarmin(workout)).toBe(true);
  });

  it('stops automatic retries when a replacement needs manual review', async () => {
    const workout = createMockEvent({ id: 'replacement-failed' });
    const refDate = new Date('2026-09-09T12:00:00Z');
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com', password: 'password123'
    });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockResolvedValueOnce({ success: true, workoutId: '123' })
      .mockResolvedValueOnce({ success: false, error: 'Remplacement Garmin incomplet : ancienne séance 123 et nouvelle séance 456 à vérifier manuellement.' });

    await syncCurrentWeekWorkoutsToGarmin([workout], refDate);
    const changed = { ...workout, durationMinutes: 45 };
    expect((await syncCurrentWeekWorkoutsToGarmin([changed], refDate)).success).toBe(false);
    const again = await syncCurrentWeekWorkoutsToGarmin([changed], refDate, { force: true });
    expect(again.success).toBe(false);
    expect(again.error).toContain('123 et nouvelle séance 456');
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight Garmin operation between concurrent callers', async () => {
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com',
      password: 'password123'
    });

    let finishPush!: (value: any) => void;
    const pendingPush = new Promise<any>(resolve => { finishPush = resolve; });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockReturnValue(pendingPush);
    const workout = createMockEvent({ id: 'concurrent_sync' });
    const refDate = new Date('2026-09-09T12:00:00Z');

    const first = syncCurrentWeekWorkoutsToGarmin([workout], refDate);
    const second = syncCurrentWeekWorkoutsToGarmin([workout], refDate);

    expect(second).toBe(first);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    finishPush({ success: true, workoutId: '789', scheduledDate: '2026-09-09' });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult);
    expect(firstResult.success).toBe(true);
  });

  it('pushes the latest changed workout after an earlier push finishes', async () => {
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com',
      password: 'password123'
    });

    let finishFirst!: (value: any) => void;
    const firstPush = new Promise<any>(resolve => { finishFirst = resolve; });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockReturnValueOnce(firstPush)
      .mockResolvedValue({ success: true, workoutId: '902', scheduledDate: '2026-09-09' });
    const original = createMockEvent({ id: 'changed_mid_sync', durationMinutes: 60 });
    const changed = { ...original, durationMinutes: 45 };
    const refDate = new Date('2026-09-09T12:00:00Z');

    const pending = syncCurrentWeekWorkoutsToGarmin([original], refDate);
    expect(syncCurrentWeekWorkoutsToGarmin([changed], refDate)).toBe(pending);
    finishFirst({ success: true, workoutId: '901', scheduledDate: '2026-09-09' });
    await pending;

    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(pushSpy.mock.calls[1][4]).toBe('901');
    expect(pushSpy.mock.calls[1][0].durationMinutes).toBe(45);
    expect(isWorkoutSyncedToGarmin(changed)).toBe(true);
  });

  it('does not discard a queued changed workout when the active request repeats', async () => {
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com', password: 'password123'
    });
    let finishFirst!: (value: any) => void;
    const firstPush = new Promise<any>(resolve => { finishFirst = resolve; });
    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin')
      .mockReturnValueOnce(firstPush)
      .mockResolvedValue({ success: true, workoutId: '904', scheduledDate: '2026-09-09' });
    const original = createMockEvent({ id: 'repeat_during_sync', durationMinutes: 60 });
    const changed = { ...original, durationMinutes: 45 };
    const refDate = new Date('2026-09-09T12:00:00Z');

    const pending = syncCurrentWeekWorkoutsToGarmin([original], refDate);
    syncCurrentWeekWorkoutsToGarmin([changed], refDate);
    syncCurrentWeekWorkoutsToGarmin([original], refDate);
    finishFirst({ success: true, workoutId: '903', scheduledDate: '2026-09-09' });
    await pending;

    expect(pushSpy).toHaveBeenCalledTimes(2);
    expect(pushSpy.mock.calls[1][0].durationMinutes).toBe(45);
    expect(isWorkoutSyncedToGarmin(changed)).toBe(true);
  });
});
