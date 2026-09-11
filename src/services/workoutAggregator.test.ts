import { describe, it, expect } from 'vitest';
import {
  groupDaySportWorkouts,
  normalizeDiscipline,
  getDisciplineMetadata
} from './workoutAggregator';
import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';

describe('workoutAggregator', () => {
  it('normalizes disciplines correctly', () => {
    expect(normalizeDiscipline(null, { activityType: 'RUNNING', activityName: 'Jogging' } as GarminActivity)).toBe('RUNNING');
    expect(normalizeDiscipline(null, { activityType: 'STRENGTH_TRAINING', activityName: 'Renforcement' } as GarminActivity)).toBe('STRENGTH_TRAINING');
    expect(normalizeDiscipline({ title: 'Running: Easy Aerobic', category: 'sport' } as CalendarEvent, null)).toBe('RUNNING');
    expect(normalizeDiscipline({ title: 'Entraînement Calisthénie', category: 'sport' } as CalendarEvent, null)).toBe('STRENGTH_TRAINING');
  });

  it('aggregates two running activities on the same day into a unified group', () => {
    const dayDate = '2026-09-10';

    const plannedRun: CalendarEvent = {
      id: 'plan-run-1',
      title: 'Running: Easy Aerobic 35 min',
      description: 'Course facile',
      startDate: '2026-09-10T11:47:00',
      endDate: '2026-09-10T12:23:00',
      category: 'sport',
      colorId: 'sport',
      colorHex: '#ff5722',
      durationMinutes: 35,
      emoji: '🏃',
      location: 'Parc Lafontaine'
    };

    const mainGarminRun: GarminActivity = {
      activityId: 'garmin-run-main',
      activityName: 'Montreal - Easy Run',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T11:47:00',
      durationMinutes: 36,
      distanceKm: 6.5,
      elevationGainM: 10,
      elevationLossM: 10,
      avgHeartRate: 162,
      maxHeartRate: 175,
      source: 'GARMIN_CONNECT'
    };

    const mainComparison: ActivityComparison = {
      id: 'comp-run-main',
      date: dayDate,
      status: 'COMPLIANT',
      plannedEvent: plannedRun,
      actualActivity: mainGarminRun,
      durationDeltaMinutes: 1,
      complianceScore: 98,
      heartRateCompliance: 'OPTIMAL',
      feedbackNotes: ['Très bonne séance']
    };

    const bonusGarminRun: GarminActivity = {
      activityId: 'garmin-run-bonus',
      activityName: 'Montreal - [QMT] Running: Segment',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T12:25:00',
      durationMinutes: 3,
      distanceKm: 0.5,
      elevationGainM: 4,
      elevationLossM: 2,
      avgHeartRate: 123,
      maxHeartRate: 130,
      source: 'GARMIN_CONNECT'
    };

    const bonusComparison: ActivityComparison = {
      id: 'comp-unplanned-bonus',
      date: dayDate,
      status: 'UNPLANNED',
      actualActivity: bonusGarminRun,
      durationDeltaMinutes: 3,
      complianceScore: 100,
      heartRateCompliance: 'OPTIMAL',
      feedbackNotes: ['Bonus Garmin']
    };

    const groups = groupDaySportWorkouts([plannedRun], [mainComparison, bonusComparison], dayDate);

    expect(groups).toHaveLength(1);
    const runGroup = groups[0];

    expect(runGroup.discipline).toBe('RUNNING');
    expect(runGroup.isMerged).toBe(true);
    expect(runGroup.items).toHaveLength(2);
    expect(runGroup.totalDurationMinutes).toBe(39); // 36 + 3
    expect(runGroup.totalDistanceKm).toBe(7.0); // 6.5 + 0.5
    expect(runGroup.totalElevationGainM).toBe(14); // 10 + 4
    // Weighted avg HR: (36 * 162 + 3 * 123) / 39 = (5832 + 369) / 39 = 6201 / 39 = 159 bpm
    expect(runGroup.weightedAvgHeartRate).toBe(159);
    expect(runGroup.hasPlanned).toBe(true);
    expect(runGroup.hasValidated).toBe(true);
    expect(runGroup.hasUnplannedBonus).toBe(true);
  });

  it('aggregates catchup calisthenics with an unplanned calisthenics bonus', () => {
    const dayDate = '2026-09-10';

    const postponedPlan: CalendarEvent = {
      id: 'plan-calisth-mon',
      title: 'Entraînement Calisthénie',
      description: 'Poids du corps',
      startDate: '2026-09-07T16:00:00',
      endDate: '2026-09-07T16:25:00',
      category: 'sport',
      colorId: 'sport',
      colorHex: '#10b981',
      durationMinutes: 25,
      emoji: '🤸',
      location: 'ÉTS Gym'
    };

    const catchupComp: ActivityComparison = {
      id: 'catchup-thu',
      date: dayDate,
      status: 'COMPLIANT',
      isPostponedCatchup: true,
      scheduledDate: '2026-09-07',
      executedDate: dayDate,
      plannedEvent: postponedPlan,
      actualActivity: {
        activityId: 'garmin-calisth-catchup',
        activityName: 'Entraînement aux barres ÉTS',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-10T20:34:00',
        durationMinutes: 23,
        avgHeartRate: 106,
        source: 'GARMIN_CONNECT'
      },
      durationDeltaMinutes: -2,
      complianceScore: 95,
      heartRateCompliance: 'OPTIMAL',
      feedbackNotes: ['Reportée et exécutée']
    };

    const bonusCalisthComp: ActivityComparison = {
      id: 'comp-unplanned-calisth',
      date: dayDate,
      status: 'UNPLANNED',
      actualActivity: {
        activityId: 'garmin-calisth-bonus',
        activityName: 'Calisthénie / Renforcement',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-10T21:05:00',
        durationMinutes: 10,
        avgHeartRate: 109,
        source: 'GARMIN_CONNECT'
      },
      durationDeltaMinutes: 10,
      complianceScore: 100,
      heartRateCompliance: 'OPTIMAL',
      feedbackNotes: ['Bonus Garmin']
    };

    const groups = groupDaySportWorkouts([], [catchupComp, bonusCalisthComp], dayDate);

    expect(groups).toHaveLength(1);
    const calisthGroup = groups[0];

    expect(calisthGroup.discipline).toBe('STRENGTH_TRAINING');
    expect(calisthGroup.isMerged).toBe(true);
    expect(calisthGroup.items).toHaveLength(2);
    expect(calisthGroup.totalDurationMinutes).toBe(33); // 23 + 10
    // Weighted avg HR: (23 * 106 + 10 * 109) / 33 = (2438 + 1090) / 33 = 3528 / 33 = 106.9 -> 107
    expect(calisthGroup.weightedAvgHeartRate).toBe(107);
    expect(calisthGroup.hasPostponedCatchup).toBe(true);
    expect(calisthGroup.hasUnplannedBonus).toBe(true);
  });

  it('keeps single activities unmerged', () => {
    const dayDate = '2026-09-09';
    const singlePlan: CalendarEvent = {
      id: 'single-run',
      title: 'Footing récupération',
      description: 'Footing très doux',
      startDate: '2026-09-09T08:00:00',
      endDate: '2026-09-09T08:40:00',
      category: 'sport',
      colorId: 'sport',
      colorHex: '#ff5722',
      durationMinutes: 40,
      emoji: '🏃',
      location: 'Mont-Royal'
    };

    const groups = groupDaySportWorkouts([singlePlan], [], dayDate);
    expect(groups).toHaveLength(1);
    expect(groups[0].isMerged).toBe(false);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].totalDurationMinutes).toBe(40);
  });
});
