import { describe, it, expect } from 'vitest';

const testStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => testStorage[key] ?? null,
  setItem: (key: string, value: string) => { testStorage[key] = String(value); },
  removeItem: (key: string) => { delete testStorage[key]; },
  clear: () => { Object.keys(testStorage).forEach(k => delete testStorage[k]); }
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

import {
  evaluateAdaptivePlanStatus,
  applyAdaptiveModifications,
  buildOverridesFromActions,
  getPriorWeekPostponedEventIds,
  isAutoAdaptEnabled,
  setAutoAdaptEnabled
} from './adaptivePlanEngine';
import { buildWorkoutPayloadFromEvent, setGarminWorkoutTargetMode } from './garminService';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { TrainingLoadStats } from './statsEngine';
import { ReadinessEvaluation } from './readinessEngine';

describe('Adaptive Plan Engine', () => {
  it('preserves a started workout when locking a revised current-week plan', () => {
    const started = {
      eventId: 'started', date: '2026-09-07', originalTitle: 'Footing', adaptedTitle: 'Footing réduit',
      originalDurationMinutes: 60, adaptedDurationMinutes: 40, adaptationReason: 'charge',
      coachingCue: 'Rester facile', createdAt: '2026-09-07T07:00:00Z'
    };
    const future = { ...started, eventId: 'future', date: '2026-09-08' };
    const result = buildOverridesFromActions([], { started, future }, '2026-09-07',
      ['2026-09-07', '2026-09-08'], new Set(['started']));
    expect(result).toEqual({ started });
  });

  it('drops a prior-week adaptation when a postponed workout enters a new frozen week without a new action', () => {
    const source = mockWeeklySportEvents[1];
    const moved = {
      ...source,
      startDate: '2026-09-14T17:00:00.000Z',
      endDate: '2026-09-14T18:05:00.000Z',
      metadata: { ...source.metadata, isPostponed: true, originalDate: '2026-09-08' }
    };
    const previous = {
      eventId: source.id,
      date: '2026-09-08',
      originalTitle: source.title,
      adaptedTitle: 'Séance réduite semaine précédente',
      originalDurationMinutes: source.durationMinutes,
      adaptedDurationMinutes: 30,
      originalSportType: source.sportType,
      adaptationReason: 'Charge élevée',
      coachingCue: 'Rester facile',
      createdAt: '2026-09-08T10:00:00.000Z'
    };
    const activeWeek = Array.from({ length: 7 }, (_, index) => `2026-09-${String(14 + index).padStart(2, '0')}`);
    const crossWeekPostpones = getPriorWeekPostponedEventIds([moved], activeWeek);

    expect(crossWeekPostpones).toEqual(new Set([source.id]));
    const overrides = buildOverridesFromActions([], { [source.id]: previous }, '2026-09-14', activeWeek, new Set(), crossWeekPostpones);
    expect(overrides).toEqual({});
    expect(applyAdaptiveModifications([], [moved], overrides).allEvents[0].durationMinutes).toBe(source.durationMinutes);
  });

  it('does not classify same-week moves as cross-week and preserves a protected prior-week override', () => {
    const source = mockWeeklySportEvents[1];
    const sourceWeek = Array.from({ length: 7 }, (_, index) => `2026-09-${String(7 + index).padStart(2, '0')}`);
    const sameWeekMove = {
      ...source,
      startDate: '2026-09-09T17:00:00.000Z',
      metadata: { ...source.metadata, isPostponed: true, originalDate: '2026-09-08' }
    };
    const previous = {
      eventId: source.id,
      date: '2026-09-08',
      originalTitle: source.title,
      adaptedTitle: 'Séance réduite',
      originalDurationMinutes: source.durationMinutes,
      adaptedDurationMinutes: 30,
      originalSportType: source.sportType,
      adaptationReason: 'Charge élevée',
      coachingCue: 'Rester facile',
      createdAt: '2026-09-08T10:00:00.000Z'
    };

    expect(getPriorWeekPostponedEventIds([sameWeekMove], sourceWeek)).toEqual(new Set());

    const destinationWeek = Array.from({ length: 7 }, (_, index) => `2026-09-${String(14 + index).padStart(2, '0')}`);
    const crossWeekMove = {
      ...sameWeekMove,
      startDate: '2026-09-14T17:00:00.000Z'
    };
    const crossWeekIds = getPriorWeekPostponedEventIds([crossWeekMove], destinationWeek);
    const preservedStarted = buildOverridesFromActions([], { [source.id]: previous }, '2026-09-14', destinationWeek, new Set([source.id]), crossWeekIds);
    expect(preservedStarted[source.id]).toEqual(previous);
  });

  it('does not attach a date-based override to a changed or already completed workout', () => {
    const event = mockWeeklySportEvents[1];
    const override = {
      eventId: event.id, date: '2026-09-08', originalTitle: event.title,
      adaptedTitle: 'Séance allégée', originalDurationMinutes: event.durationMinutes,
      adaptedDurationMinutes: 35, originalSportType: event.sportType,
      adaptationReason: 'Charge', coachingCue: 'Facile', createdAt: '2026-09-08T19:00:00Z'
    };
    const changed = { ...event, title: 'Nouvelle séance du même jour' };
    const completed = { ...event, metadata: { isCompleted: true } };
    expect(applyAdaptiveModifications([], [changed], { [event.id]: override }).allEvents[0]).toEqual(changed);
    expect(applyAdaptiveModifications([], [completed], { [event.id]: override }).allEvents[0]).toEqual(completed);
  });

  const mockBaseReadiness: ReadinessEvaluation = {
    score: 85,
    status: 'OPTIMAL',
    statusLabel: 'Prêt',
    badgeEmoji: '🟢',
    badgeColorHex: '#10b981',
    headline: 'Forme optimale',
    summary: 'Bonne récupération',
    factors: {
      sleepScore: 85,
      sleepDurationHours: 8,
      hrvScore: 85,
      hrvStatus: 'BALANCED',
      rhrDeltaBpm: 0
    }
  };

  const mockWeeklySportEvents: CalendarEvent[] = [
    {
      id: 'SPORT_MON',
      category: 'sport',
      sportType: 'CALISTHENICS',
      title: '🤸 Calisthenics 1 (Push & Core)',
      startDate: '2026-09-07T17:00:00.000Z',
      endDate: '2026-09-07T18:05:00.000Z',
      location: 'ÉTS Gym',
      description: 'Dips and core',
      emoji: '🤸',
      colorId: '7',
      colorHex: '#7209b7',
      durationMinutes: 65
    },
    {
      id: 'SPORT_TUE',
      category: 'sport',
      sportType: 'TRAIL_INTENSE',
      title: '⚡ Trail: Hill Repeats D+ (Mont-Royal)',
      startDate: '2026-09-08T17:00:00.000Z',
      endDate: '2026-09-08T18:20:00.000Z',
      location: 'Mont Royal',
      description: '2 sets of 5x 1 min hill',
      emoji: '⚡',
      colorId: '11',
      colorHex: '#f72585',
      durationMinutes: 80
    },
    {
      id: 'SPORT_SAT',
      category: 'sport',
      sportType: 'TRAIL_LONG',
      title: '🏔️ Trail: Long Run D+ (1h55)',
      startDate: '2026-09-12T08:00:00.000Z',
      endDate: '2026-09-12T09:55:00.000Z',
      location: 'Mont Royal',
      description: 'Long trail run on Mont Royal',
      emoji: '🏔️',
      colorId: '6',
      colorHex: '#ff6b35',
      durationMinutes: 115
    }
  ];

  it('avoids ACWR-only adaptation during calibration while preserving safe and independent fatigue signals', () => {
    const safeTrainingLoad: TrainingLoadStats = {
      currentCtl: 45,
      currentAtl: 48,
      currentTsb: -3,
      formStatus: 'OPTIMAL_BUILD',
      formLabel: 'Développement optimal',
      acwrRatio: 1.08,
      acwrStatus: 'OPTIMAL',
      acwrLabel: 'Sweet spot',
      acuteLoad7d: 180,
      chronicLoad28dWeeklyAvg: 165,
      fitnessTrend: [],
      trailAcwrRatio: 1.08,
      trailAcuteLoad7d: 180,
      trailChronicLoad28dWeeklyAvg: 165,
      trailAcwrStatus: 'OPTIMAL',
      calisthenicsAcuteLoad7d: 150,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 330,
      totalTrailChronicLoad28d: 660,
      recentSessions7d: []
    };

    const status = evaluateAdaptivePlanStatus(safeTrainingLoad, mockBaseReadiness, mockWeeklySportEvents);

    expect(status.injuryRiskLevel).toBe('SAFE');
    expect(status.recommendedActions.length).toBe(0);
    expect(status.headline).toContain('Sweet Spot');

    const calibratingLoad = {
      ...safeTrainingLoad,
      trailAcwrRatio: 1.55,
      trailAcwrStatus: 'CALIBRATING' as const
    };
    const calibratingStatus = evaluateAdaptivePlanStatus(calibratingLoad, mockBaseReadiness, mockWeeklySportEvents);
    expect(calibratingStatus.injuryRiskLevel).toBe('SAFE');
    expect(calibratingStatus.recommendedActions).toHaveLength(0);
    expect(calibratingStatus.headline).toContain('Calibration');
    expect(calibratingStatus.explanation).toContain('ne déclenche pas seul d\'adaptation');

    const fatigueDespiteCalibration = evaluateAdaptivePlanStatus({
      ...calibratingLoad,
      currentTsb: -30
    }, mockBaseReadiness, mockWeeklySportEvents);
    expect(fatigueDespiteCalibration.injuryRiskLevel).toBe('HIGH');
    expect(fatigueDespiteCalibration.explanation).toContain('TSB -30');
    expect(fatigueDespiteCalibration.explanation).not.toContain('ACWR 1.55 >');

    const lowReadiness = evaluateAdaptivePlanStatus(calibratingLoad, {
      ...mockBaseReadiness,
      score: 40,
      status: 'LOW'
    }, mockWeeklySportEvents);
    expect(lowReadiness.injuryRiskLevel).toBe('MODERATE');
    expect(lowReadiness.explanation).toContain('score de récupération bas');
    expect(lowReadiness.explanation).not.toContain("l'ACWR (1.55");
  });

  it('proposes smart non-destructive adaptations when Trail ACWR > 1.5 (High Injury Risk)', () => {
    const dangerTrainingLoad: TrainingLoadStats = {
      currentCtl: 40,
      currentAtl: 75,
      currentTsb: -35,
      formStatus: 'HIGH_OVERLOAD',
      formLabel: 'Surmenage',
      acwrRatio: 1.68,
      acwrStatus: 'DANGER_HIGH_RISK',
      acwrLabel: 'Danger blessure',
      acuteLoad7d: 320,
      chronicLoad28dWeeklyAvg: 190,
      fitnessTrend: [],
      trailAcwrRatio: 1.68,
      trailAcuteLoad7d: 320,
      trailChronicLoad28dWeeklyAvg: 190,
      trailAcwrStatus: 'DANGER_HIGH_RISK',
      calisthenicsAcuteLoad7d: 150,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 470,
      totalTrailChronicLoad28d: 760,
      recentSessions7d: []
    };

    const status = evaluateAdaptivePlanStatus(dangerTrainingLoad, mockBaseReadiness, mockWeeklySportEvents);

    expect(status.injuryRiskLevel).toBe('HIGH');
    expect(status.recommendedActions.length).toBe(2);

    // 1. Tuesday Hill repeats converted to easy flat recovery footing (35 min)
    const tueAction = status.recommendedActions.find(a => a.eventId === 'SPORT_TUE');
    expect(tueAction).toBeDefined();
    expect(tueAction?.adaptedDurationMinutes).toBe(35);
    expect(tueAction?.adaptedTitle).toContain('Footing Aérobie Doux');
    expect(tueAction?.adaptedElevationM).toBe(0);
    expect(tueAction?.adaptedLocation).toContain('plat');

    // 2. Saturday Long Run reduced by ~28% duration to protect tendons
    const satAction = status.recommendedActions.find(a => a.eventId === 'SPORT_SAT');
    expect(satAction).toBeDefined();
    expect(satAction?.adaptedDurationMinutes).toBeLessThan(115);
    expect(satAction?.adaptedDurationMinutes).toBe(83); // 115 * 0.72
    expect(satAction?.adaptedElevationM).toBeGreaterThan(0);
    expect(satAction?.adaptedLocation).toContain('Mont-Royal');

    // 3. Calisthenics MUST NOT be touched (it has zero running impact)
    const calisAction = status.recommendedActions.find(a => a.eventId === 'SPORT_MON');
    expect(calisAction).toBeUndefined();

    const fatigueOnly = evaluateAdaptivePlanStatus({
      ...dangerTrainingLoad,
      trailAcwrRatio: 1.1,
      trailAcwrStatus: 'OPTIMAL'
    }, mockBaseReadiness, mockWeeklySportEvents);
    expect(fatigueOnly.injuryRiskLevel).toBe('HIGH');
    expect(fatigueOnly.explanation).toContain('TSB -35');
    expect(fatigueOnly.explanation).not.toContain('ACWR 1.1 >');
    expect(fatigueOnly.recommendedActions[0].adaptedDescription).toContain('TSB -35');
  });

  it('applies and reverts adaptive modifications to schedules and events accurately', () => {
    const baseSchedules: DailySchedule[] = [
      {
        date: '2026-09-08',
        dayOfWeek: 1,
        hasCourse: false,
        hasIntensiveCourse: false,
        periodContext: {
          phase: 'FONDATION',
          weekNumber: 1,
          isDeload: false,
          volumeFactor: 1,
          label: 'Fondation',
          daysToRace: 290,
          description: ''
        },
        events: [mockWeeklySportEvents[1]],
        sportSession: mockWeeklySportEvents[1]
      }
    ];

    const actions = [
      {
        eventId: 'SPORT_TUE',
        date: '2026-09-08',
        originalTitle: mockWeeklySportEvents[1].title,
        adaptedTitle: '🛡️ Footing Aérobie Doux & Récupération Z1/Z2 (35 min)',
        originalDurationMinutes: 80,
        adaptedDurationMinutes: 35,
        actionType: 'LIGHTEN' as const,
        reason: 'Protection des tendons d\'Achille',
        coachingCue: '35 min footing souple à plat',
        targetHeartRate: '< 142 bpm',
        adaptedLocation: 'Terrain plat / Parc (évite le D+)',
        adaptedElevationM: 0
      }
    ];

    const overrides = buildOverridesFromActions(actions);
    const { schedules: adaptedSchedules, allEvents: adaptedEvents } = applyAdaptiveModifications(
      baseSchedules,
      mockWeeklySportEvents,
      overrides
    );

    // Verified adaptation applied
    const adaptedEv = adaptedSchedules[0].events[0];
    expect(adaptedEv.title).toBe('🛡️ Footing Aérobie Doux & Récupération Z1/Z2 (35 min)');
    expect(adaptedEv.durationMinutes).toBe(35);
    expect(adaptedEv.location).toBe('Terrain plat / Parc (évite le D+)');
    expect(adaptedEv.metadata?.targetElevationM).toBe(0);
    expect(adaptedEv.metadata?.isAdapted).toBe(true);
    expect(adaptedEv.metadata?.originalDurationMinutes).toBe(80);
    expect(adaptedSchedules[0].sportSession?.durationMinutes).toBe(35);

    // Verified revert
    const { schedules: revertedSchedules } = applyAdaptiveModifications(
      baseSchedules,
      mockWeeklySportEvents,
      {}
    );
    expect(revertedSchedules[0].events[0].title).toBe('⚡ Trail: Hill Repeats D+ (Mont-Royal)');
    expect(revertedSchedules[0].events[0].durationMinutes).toBe(80);
  });

  it('handles Under-training (trail ACWR < 0.8) with Gabbett safe progressive consolidation', () => {
    const underloadTrainingLoad: TrainingLoadStats = {
      currentCtl: 35,
      currentAtl: 20,
      currentTsb: 15,
      formStatus: 'TRANSITION_FRESH',
      formLabel: 'Très frais',
      acwrRatio: 0.55,
      acwrStatus: 'UNDERLOAD',
      acwrLabel: 'Sous-charge',
      acuteLoad7d: 70,
      chronicLoad28dWeeklyAvg: 130,
      fitnessTrend: [],
      trailAcwrRatio: 0.55,
      trailAcuteLoad7d: 70,
      trailChronicLoad28dWeeklyAvg: 130,
      trailAcwrStatus: 'UNDERLOAD',
      calisthenicsAcuteLoad7d: 120,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 190,
      totalTrailChronicLoad28d: 520,
      recentSessions7d: []
    };

    const status = evaluateAdaptivePlanStatus(underloadTrainingLoad, mockBaseReadiness, mockWeeklySportEvents);

    expect(status.headline).toContain('Sous-charge');
    expect(status.explanation).toContain('0.8');
    // For ACWR < 0.6, heavy hill repeats are proactively smoothed to 1 set to prevent a sudden spike
    const tueAction = status.recommendedActions.find(a => a.eventId === 'SPORT_TUE');
    expect(tueAction).toBeDefined();
    expect(tueAction?.adaptedDurationMinutes).toBe(40);
    expect(tueAction?.adaptedTitle).toContain('Anti-pic');
  });

  it('manages Auto-Adapt toggle state in storage', () => {
    setAutoAdaptEnabled(true);
    expect(isAutoAdaptEnabled()).toBe(true);

    setAutoAdaptEnabled(false);
    expect(isAutoAdaptEnabled()).toBe(false);

    setAutoAdaptEnabled(true);
  });

  it('generates TRAIL_LONG Garmin workout payload with aligned 155 bpm upper ceiling and Rando-Course instructions', () => {
    const trailLongEvent: CalendarEvent = {
      id: 'SPORT_SAT_LONG',
      category: 'sport',
      sportType: 'TRAIL_LONG',
      title: '🏔️ Trail: Rando-Course D+ (1h35)',
      startDate: '2026-09-12T10:40:00.000Z',
      endDate: '2026-09-12T12:15:00.000Z',
      location: 'Mont Royal',
      description: 'Rando-Course D+',
      durationMinutes: 95,
      emoji: '🏔️',
      colorId: '6',
      colorHex: '#ff6b35',
      metadata: {
        targetElevationM: 400,
        targetHeartRateRange: [135, 155]
      }
    };

    setGarminWorkoutTargetMode('HR_ONLY');
    const payload = buildWorkoutPayloadFromEvent(trailLongEvent, '2026-09-12', 'FORERUNNER_55');

    expect(payload.sportType).toBe('RUNNING');
    expect(payload.steps.length).toBe(3);

    // Warmup step: capped at 155 bpm
    expect(payload.steps[0].targetHrHigh).toBe(155);

    // Interval step: capped at 155 bpm with explicit Rando-Course cue
    expect(payload.steps[1].targetHrHigh).toBe(155);
    expect(payload.steps[1].stepNotes || '').toContain('Rando-Course');
    expect((payload.steps[1].stepNotes || '').toLowerCase()).toContain('power-hike');
  });

  it('strictly freezes past sessions and already completed sessions from re-adaptation', () => {
    const dangerTrainingLoad: TrainingLoadStats = {
      currentCtl: 40,
      currentAtl: 75,
      currentTsb: -35,
      formStatus: 'HIGH_OVERLOAD',
      formLabel: 'Surmenage',
      acwrRatio: 1.68,
      acwrStatus: 'DANGER_HIGH_RISK',
      acwrLabel: 'Danger blessure',
      acuteLoad7d: 320,
      chronicLoad28dWeeklyAvg: 190,
      fitnessTrend: [],
      trailAcwrRatio: 1.68,
      trailAcuteLoad7d: 320,
      trailChronicLoad28dWeeklyAvg: 190,
      trailAcwrStatus: 'DANGER_HIGH_RISK',
      calisthenicsAcuteLoad7d: 150,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 470,
      totalTrailChronicLoad28d: 760,
      recentSessions7d: []
    };

    // As of Thursday Sept 10:
    // Tuesday Sept 8 is in the past (date < asOfDate) -> MUST be frozen, NEVER adapted
    // Saturday Sept 12 is in the future -> CAN be adapted
    const asOfThu = new Date('2026-09-10T12:00:00.000Z');
    const status = evaluateAdaptivePlanStatus(
      dangerTrainingLoad,
      mockBaseReadiness,
      mockWeeklySportEvents,
      {},
      asOfThu
    );

    // Tuesday is past, so only Saturday should be adapted!
    expect(status.recommendedActions.some(a => a.eventId === 'SPORT_TUE')).toBe(false);
    expect(status.recommendedActions.some(a => a.eventId === 'SPORT_SAT')).toBe(true);

    // If Saturday was already completed (e.g. ran early), it must also NOT be adapted
    const completedSet = new Set(['SPORT_SAT']);
    const statusWithCompleted = evaluateAdaptivePlanStatus(
      dangerTrainingLoad,
      mockBaseReadiness,
      mockWeeklySportEvents,
      {},
      asOfThu,
      completedSet
    );
    expect(statusWithCompleted.recommendedActions.length).toBe(0);

    const startedToday = evaluateAdaptivePlanStatus(
      dangerTrainingLoad,
      mockBaseReadiness,
      [mockWeeklySportEvents[2]],
      {},
      new Date('2026-09-12T10:00:00.000Z')
    );
    expect(startedToday.recommendedActions).toEqual([]);

    const stillFutureToday = evaluateAdaptivePlanStatus(
      dangerTrainingLoad,
      mockBaseReadiness,
      [mockWeeklySportEvents[2]],
      {},
      new Date('2026-09-12T07:00:00.000Z')
    );
    expect(stillFutureToday.recommendedActions.some(action => action.eventId === 'SPORT_SAT')).toBe(true);
  });

  it('preserves past overrides intact when generating overrides with todayKey', () => {
    const existingPastOverride = {
      eventId: 'SPORT_TUE',
      date: '2026-09-08',
      originalTitle: '⚡ Trail: Hill Repeats D+ (Mont-Royal)',
      adaptedTitle: '🛡️ Footing Aérobie Doux & Récupération Z1/Z2 (35 min)',
      originalDurationMinutes: 80,
      adaptedDurationMinutes: 35,
      adaptationReason: 'Adaptation initiale respectée',
      coachingCue: 'Footing souple',
      createdAt: '2026-09-08T08:00:00.000Z'
    };

    const newFutureAction = {
      eventId: 'SPORT_SAT',
      date: '2026-09-12',
      originalTitle: '🏔️ Trail: Long Run D+ (1h55)',
      adaptedTitle: '🛡️ Trail Réduit (1h23)',
      originalDurationMinutes: 115,
      adaptedDurationMinutes: 83,
      actionType: 'LIGHTEN' as const,
      reason: 'Prévention',
      coachingCue: 'Footing souple'
    };

    const todayKey = '2026-09-10'; // Thursday
    const overrides = buildOverridesFromActions(
      [newFutureAction],
      { [existingPastOverride.eventId]: existingPastOverride },
      todayKey
    );

    // Tuesday's past override is strictly preserved
    expect(overrides['SPORT_TUE']).toEqual(existingPastOverride);
    // Saturday's future override is added
    expect(overrides['SPORT_SAT']).toBeDefined();
    expect(overrides['SPORT_SAT'].adaptedDurationMinutes).toBe(83);
  });

  it('converts short secondary recovery/fatigued runs (< 50 min) to REST when ACWR > 1.5', () => {
    const dangerTrainingLoad: TrainingLoadStats = {
      currentCtl: 40,
      currentAtl: 75,
      currentTsb: -35,
      formStatus: 'HIGH_OVERLOAD',
      formLabel: 'Surmenage',
      acwrRatio: 1.68,
      acwrStatus: 'DANGER_HIGH_RISK',
      acwrLabel: 'Danger blessure',
      acuteLoad7d: 320,
      chronicLoad28dWeeklyAvg: 190,
      fitnessTrend: [],
      trailAcwrRatio: 1.68,
      trailAcuteLoad7d: 320,
      trailChronicLoad28dWeeklyAvg: 190,
      trailAcwrStatus: 'DANGER_HIGH_RISK',
      calisthenicsAcuteLoad7d: 150,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 470,
      totalTrailChronicLoad28d: 760,
      recentSessions7d: []
    };

    const sundayRecoveryEvent: CalendarEvent = {
      id: 'SPORT_SUN',
      category: 'sport',
      sportType: 'RUN_EASY',
      title: '🏃 Trail: Fatigued / Rolling Run (35 min)',
      startDate: '2026-09-13T10:00:00.000Z',
      endDate: '2026-09-13T10:35:00.000Z',
      location: 'Mont Royal / Neighborhood',
      description: 'Back-to-back fatigued run',
      emoji: '🏃',
      colorId: '5',
      colorHex: '#4cc9f0',
      durationMinutes: 35,
      metadata: { targetElevationM: 90 }
    };

    const status = evaluateAdaptivePlanStatus(dangerTrainingLoad, mockBaseReadiness, [sundayRecoveryEvent]);
    expect(status.recommendedActions.length).toBe(1);

    const sunAction = status.recommendedActions[0];
    expect(sunAction.actionType).toBe('REST');
    expect(sunAction.adaptedDurationMinutes).toBe(0);
    expect(sunAction.adaptedElevationM).toBe(0);
    expect(sunAction.adaptedTitle).toContain('Repos');
    expect(sunAction.reason).not.toContain('Réduction de 0 min');
    expect(sunAction.reason).not.toContain('Réduction de -');
  });

  it('guarantees that an adaptation NEVER increases duration or elevation', () => {
    const dangerTrainingLoad: TrainingLoadStats = {
      currentCtl: 40,
      currentAtl: 75,
      currentTsb: -35,
      formStatus: 'HIGH_OVERLOAD',
      formLabel: 'Surmenage',
      acwrRatio: 1.68,
      acwrStatus: 'DANGER_HIGH_RISK',
      acwrLabel: 'Danger blessure',
      acuteLoad7d: 320,
      chronicLoad28dWeeklyAvg: 190,
      fitnessTrend: [],
      trailAcwrRatio: 1.68,
      trailAcuteLoad7d: 320,
      trailChronicLoad28dWeeklyAvg: 190,
      trailAcwrStatus: 'DANGER_HIGH_RISK',
      calisthenicsAcuteLoad7d: 150,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 470,
      totalTrailChronicLoad28d: 760,
      recentSessions7d: []
    };

    const testEvents: CalendarEvent[] = [
      {
        id: 'TEST_SHORT',
        category: 'sport',
        sportType: 'TRAIL_LONG',
        title: 'Short Trail (30 min)',
        startDate: '2026-09-13T10:00:00.000Z',
        endDate: '2026-09-13T10:30:00.000Z',
        location: 'Mont Royal',
        description: 'Short',
        emoji: '🏔️',
        colorId: '6',
        colorHex: '#ff6b35',
        durationMinutes: 30,
        metadata: { targetElevationM: 100 }
      },
      {
        id: 'TEST_60M',
        category: 'sport',
        sportType: 'TRAIL_LONG',
        title: 'Medium Trail (60 min)',
        startDate: '2026-09-13T11:00:00.000Z',
        endDate: '2026-09-13T12:00:00.000Z',
        location: 'Mont Royal',
        description: '60m',
        emoji: '🏔️',
        colorId: '6',
        colorHex: '#ff6b35',
        durationMinutes: 60,
        metadata: { targetElevationM: 250 }
      }
    ];

    const status = evaluateAdaptivePlanStatus(dangerTrainingLoad, mockBaseReadiness, testEvents);
    for (const act of status.recommendedActions) {
      expect(act.adaptedDurationMinutes).toBeLessThanOrEqual(act.originalDurationMinutes);
      if (act.adaptedElevationM !== undefined && act.originalElevationM !== undefined) {
        expect(act.adaptedElevationM).toBeLessThanOrEqual(act.originalElevationM);
      }
      expect(act.reason).not.toMatch(/Réduction de -\d+/);
      expect(act.reason).not.toContain('Réduction de 0 min');
    }
  });

  it('remains stable across 30 successive adaptation cycles without cascading to 0 minutes', () => {
    const dangerLoad: TrainingLoadStats = {
      currentCtl: 40,
      currentAtl: 75,
      currentTsb: -35,
      formStatus: 'HIGH_OVERLOAD',
      formLabel: 'Surmenage',
      acwrRatio: 1.68,
      acwrStatus: 'DANGER_HIGH_RISK',
      acwrLabel: 'Danger blessure',
      acuteLoad7d: 320,
      chronicLoad28dWeeklyAvg: 190,
      fitnessTrend: [],
      trailAcwrRatio: 1.68,
      trailAcuteLoad7d: 320,
      trailChronicLoad28dWeeklyAvg: 190,
      trailAcwrStatus: 'DANGER_HIGH_RISK',
      calisthenicsAcuteLoad7d: 150,
      calisthenicsSessionsCount7d: 3,
      totalSystemicAcuteLoad7d: 470,
      totalTrailChronicLoad28d: 760,
      recentSessions7d: []
    };

    let currentEvents = [...mockWeeklySportEvents];
    let overrides: Record<string, any> = {};

    for (let pass = 0; pass < 30; pass++) {
      const status = evaluateAdaptivePlanStatus(
        dangerLoad,
        mockBaseReadiness,
        currentEvents,
        overrides,
        new Date('2026-09-07T09:00:00.000Z')
      );

      overrides = buildOverridesFromActions(
        status.recommendedActions,
        overrides,
        '2026-09-07',
        ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']
      );

      const modified = applyAdaptiveModifications(
        [],
        mockWeeklySportEvents,
        overrides
      );

      currentEvents = modified.allEvents;

      // Key workouts must NEVER become 0 min
      const hillEvent = currentEvents.find(e => e.id === 'SPORT_TUE');
      const longTrailEvent = currentEvents.find(e => e.id === 'SPORT_SAT');

      expect(hillEvent).toBeDefined();
      expect(hillEvent!.durationMinutes).toBeGreaterThanOrEqual(30);
      expect(hillEvent!.durationMinutes).toBeLessThanOrEqual(35);

      expect(longTrailEvent).toBeDefined();
      expect(longTrailEvent!.durationMinutes).toBeGreaterThanOrEqual(70);
      expect(longTrailEvent!.durationMinutes).toBeLessThanOrEqual(85);
    }
  });
});
