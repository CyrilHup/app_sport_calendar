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
  isAutoAdaptEnabled,
  setAutoAdaptEnabled
} from './adaptivePlanEngine';
import { buildWorkoutPayloadFromEvent } from './garminService';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { TrainingLoadStats } from './statsEngine';
import { ReadinessEvaluation } from './readinessEngine';

describe('Adaptive Plan Engine', () => {
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

  it('keeps nominal plan when Trail ACWR is within safe sweet spot (0.8 - 1.3)', () => {
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
});
