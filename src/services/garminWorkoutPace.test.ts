import { describe, it, expect, beforeEach } from 'vitest';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLocalStorage;
}

import {
  buildWorkoutPayloadFromEvent,
  getGarminWorkoutTargetMode,
  setGarminWorkoutTargetMode,
  getAthleteBasePace,
  setAthleteBasePace,
  parsePaceToSeconds,
  formatSecondsToPace,
  getDynamicAthleteProfile,
  getExpectedHeartRateForEvent
} from './garminService';
import { CalendarEvent } from '../types/calendar';
import { GarminActivity } from '../types/garmin';

function createMockEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'test-event-1',
    category: 'sport',
    title: 'Test Workout',
    startDate: '2026-09-15T09:00:00',
    endDate: '2026-09-15T09:45:00',
    location: 'Parc La Fontaine',
    description: 'Séance de course',
    emoji: '🏃',
    colorId: '5',
    colorHex: '#4cc9f0',
    durationMinutes: 45,
    ...overrides
  };
}

describe('Garmin Workout Smart Pace & Trail Free Target Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('converts pace strings to seconds and back accurately', () => {
    expect(parsePaceToSeconds('6:05')).toBe(365);
    expect(parsePaceToSeconds('5:50')).toBe(350);
    expect(parsePaceToSeconds('6:25')).toBe(385);

    expect(formatSecondsToPace(365)).toBe('6:05');
    expect(formatSecondsToPace(350)).toBe('5:50');
    expect(formatSecondsToPace(385)).toBe('6:25');
  });

  it('defaults to SMART_PACE_AND_TRAIL_FREE target mode and 6:05 base pace', () => {
    expect(getGarminWorkoutTargetMode()).toBe('SMART_PACE_AND_TRAIL_FREE');
    expect(getAthleteBasePace()).toBe('6:05');
  });

  it('generates realistic PACE targets for flat easy run (RUN_EASY)', () => {
    setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');
    setAthleteBasePace('6:05');

    const flatEasyEvent = createMockEvent({
      id: 'event-run-easy-1',
      title: 'Footing Récupération & Aérobie',
      sportType: 'RUN_EASY',
      durationMinutes: 45
    });

    const payload = buildWorkoutPayloadFromEvent(flatEasyEvent);

    expect(payload.sportType).toBe('RUNNING');
    expect(payload.steps.length).toBe(3);

    // Warmup step: gentle pace
    const warmup = payload.steps[0];
    expect(warmup.stepType).toBe('WARMUP');
    expect(warmup.targetType).toBe('PACE');
    expect(warmup.targetPaceLowMinKm).toBe('6:20');
    expect(warmup.targetPaceHighMinKm).toBe('7:00');

    // Interval / main block: base pace window (5:50 - 6:25 /km)
    const main = payload.steps[1];
    expect(main.stepType).toBe('INTERVAL');
    expect(main.targetType).toBe('PACE');
    expect(main.targetPaceLowMinKm).toBe('5:50');
    expect(main.targetPaceHighMinKm).toBe('6:25');
    expect(main.targetPaceMinKm).toBe('6:05');
    expect(main.stepNotes).toContain('5:50 - 6:25/km');

    // Cooldown: libre
    const cooldown = payload.steps[2];
    expect(cooldown.stepType).toBe('COOLDOWN');
    expect(cooldown.targetType).toBe('NONE');
  });

  it('generates targetType NONE for Trail runs (TRAIL_LONG) on Mont-Royal to avoid false alerts in climbs/descents', () => {
    setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');

    const trailLongEvent = createMockEvent({
      id: 'event-trail-long-1',
      title: 'Sortie Longue Mont-Royal',
      startDate: '2026-09-20T08:00:00',
      endDate: '2026-09-20T09:30:00',
      sportType: 'TRAIL_LONG',
      durationMinutes: 90,
      location: 'Parc du Mont-Royal',
      metadata: { targetElevationM: 250 }
    });

    const payload = buildWorkoutPayloadFromEvent(trailLongEvent);

    expect(payload.steps.length).toBe(3);
    for (const step of payload.steps) {
      expect(step.targetType).toBe('NONE');
    }
    expect(payload.steps[1].stepNotes).toContain('Rando-Course Z2');
  });

  it('generates targetType NONE for Hill Repeats (TRAIL_INTENSE) on Mont-Royal', () => {
    setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');

    const hillRepeatsEvent = createMockEvent({
      id: 'event-trail-intense-1',
      title: 'Séance de Côtes Mont-Royal',
      startDate: '2026-09-17T17:00:00',
      endDate: '2026-09-17T17:50:00',
      sportType: 'TRAIL_INTENSE',
      durationMinutes: 50,
      location: 'Mont-Royal'
    });

    const payload = buildWorkoutPayloadFromEvent(hillRepeatsEvent);

    // All steps in hill repeats must have targetType NONE so the watch does not vibrate during the climb or descent
    for (const step of payload.steps) {
      expect(step.targetType).toBe('NONE');
    }
  });

  it('generates targetType NONE for ALL runs when targetMode is ALL_FREE', () => {
    setGarminWorkoutTargetMode('ALL_FREE');

    const flatEasyEvent = createMockEvent({
      id: 'event-run-easy-2',
      title: 'Footing Récupération Plat',
      sportType: 'RUN_EASY',
      durationMinutes: 40
    });

    const payload = buildWorkoutPayloadFromEvent(flatEasyEvent);

    for (const step of payload.steps) {
      expect(step.targetType).toBe('NONE');
    }
  });

  it('guarantees that Hill Repeats + Leg Strength (70 min) steps sum to exactly 70 minutes (4200s)', () => {
    setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');

    const tuesdaySession = createMockEvent({
      id: 'event-tuesday-70min',
      title: 'Trail: Hill Repeats D+ (Mont-Royal) + Leg Strength',
      startDate: '2026-09-15T17:00:00',
      endDate: '2026-09-15T18:10:00',
      sportType: 'TRAIL_INTENSE',
      durationMinutes: 70,
      location: 'Mont Royal',
      metadata: { targetElevationM: 380 }
    });

    const payload = buildWorkoutPayloadFromEvent(tuesdaySession);

    // 1. Total seconds must exactly match 70 min = 4200 seconds
    const totalSeconds = payload.steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    expect(totalSeconds).toBe(70 * 60);

    // 2. Must contain running hill repeats steps as well as leg strength steps
    const hasRenfoStep = payload.steps.some(s => s.stepNotes?.includes('Renfo'));
    expect(hasRenfoStep).toBe(true);

    const hasFentesSquats = payload.steps.some(s => s.stepNotes?.includes('Fentes bulgares'));
    expect(hasFentesSquats).toBe(true);

    const hasMollets = payload.steps.some(s => s.stepNotes?.includes('Mollets'));
    expect(hasMollets).toBe(true);

    // 3. TargetType should be NONE in smart mode to avoid watch alerts on hill climbs and strength
    for (const step of payload.steps) {
      expect(step.targetType).toBe('NONE');
    }
  });

  it('guarantees that all sport sessions mathematically match their planned duration', () => {
    setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');

    const runEasy = createMockEvent({
      id: 'run-easy-45',
      title: 'Running: Easy Aerobic Base Run Z2',
      sportType: 'RUN_EASY',
      durationMinutes: 45
    });
    const p1 = buildWorkoutPayloadFromEvent(runEasy);
    expect(p1.steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)).toBe(45 * 60);

    const trailLong = createMockEvent({
      id: 'trail-long-105',
      title: 'Trail: Rando-Course D+ (1h45)',
      sportType: 'TRAIL_LONG',
      durationMinutes: 105
    });
    const p2 = buildWorkoutPayloadFromEvent(trailLong);
    expect(p2.steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)).toBe(105 * 60);

    const calisthenics = createMockEvent({
      id: 'calis-60',
      title: 'Entraînement Calisthénie',
      sportType: 'CALISTHENICS',
      durationMinutes: 60
    });
    const p3 = buildWorkoutPayloadFromEvent(calisthenics);
    expect(p3.steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)).toBe(60 * 60);
  });

  it('extracts dynamic athlete physiological profile from Garmin activities history', () => {
    const sampleActivities: GarminActivity[] = [
      {
        activityId: 'trail-1',
        activityName: 'Trail Mont-Royal',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-12T17:35:00',
        durationMinutes: 77,
        elapsedDurationMinutes: 88,
        distanceKm: 11.42,
        elevationGainM: 293,
        avgHeartRate: 160,
        maxHeartRate: 187,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'trail-2',
        activityName: 'Côtes & D+',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-08T18:00:00',
        durationMinutes: 60,
        distanceKm: 8.5,
        elevationGainM: 310,
        avgHeartRate: 164,
        maxHeartRate: 190,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'run-flat-1',
        activityName: 'Footing aérobie',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-05T09:00:00',
        durationMinutes: 40,
        distanceKm: 6.5,
        elevationGainM: 20,
        avgPaceMinKm: '6:09 /km',
        avgHeartRate: 142,
        maxHeartRate: 155,
        source: 'GARMIN_CONNECT'
      }
    ];

    const profile = getDynamicAthleteProfile(sampleActivities);
    expect(profile.fcMax).toBeGreaterThanOrEqual(190);
    expect(profile.fcRest).toBeGreaterThanOrEqual(40);
    expect(profile.trailAvgHr).toBeGreaterThanOrEqual(158);
    expect(profile.trailAvgHr).toBeLessThanOrEqual(165);
    expect(profile.runEasyAvgHr).toBe(142);
  });

  it('determines realistic expected heart rate for planned trail and running workouts', () => {
    const profile = getDynamicAthleteProfile([]);

    const trailWithRange = getExpectedHeartRateForEvent(
      {
        sportType: 'TRAIL_LONG',
        title: 'Trail: Rando-Course D+ (1h25)',
        metadata: {
          targetElevationM: 357,
          targetHeartRateRange: [135, 155]
        }
      },
      profile
    );
    expect(trailWithRange).toBeGreaterThanOrEqual(150);
    expect(trailWithRange).toBeLessThanOrEqual(profile.fcMax);

    const hillWorkout = getExpectedHeartRateForEvent(
      {
        sportType: 'TRAIL_INTENSE',
        title: 'Côtes & D+ Mont-Royal'
      },
      profile
    );
    expect(hillWorkout).toBeGreaterThanOrEqual(165);

    const easyRun = getExpectedHeartRateForEvent(
      {
        sportType: 'RUN_EASY',
        title: 'Footing récupération'
      },
      profile
    );
    expect(easyRun).toBeLessThanOrEqual(148);
  });
});

