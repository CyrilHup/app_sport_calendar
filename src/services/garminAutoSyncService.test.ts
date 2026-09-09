import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeGarminText } from './garminService';
import {
  computeWorkoutSyncSignature,
  getCurrentWeekDateBounds,
  filterCurrentWeekSportWorkouts,
  isGarminAutoSyncEnabled,
  setGarminAutoSyncEnabled,
  GARMIN_AUTO_SYNC_ENABLED_KEY,
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
    startDate: '2026-09-09T08:00:00Z',
    endDate: '2026-09-09T09:00:00Z',
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

  it('syncs only changed workouts and skips already synced ones', async () => {
    // Mock credentials
    vi.spyOn(garminService, 'loadGarminCredentials').mockReturnValue({
      email: 'test@example.com',
      password: 'password123'
    });

    const pushSpy = vi.spyOn(garminService, 'pushWorkoutToGarmin').mockResolvedValue({
      success: true,
      workoutId: 'garmin_123',
      workoutName: '[QMT] Footing',
      scheduledDate: '2026-09-09'
    });

    const refDate = new Date('2026-09-09T12:00:00Z');
    const sampleEvents: CalendarEvent[] = [
      createMockEvent({
        id: 'sport_1',
        title: 'Footing',
        startDate: '2026-09-09T08:00:00Z',
        endDate: '2026-09-09T09:00:00Z',
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
  });
});
