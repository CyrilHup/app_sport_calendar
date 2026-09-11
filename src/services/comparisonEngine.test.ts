import { describe, it, expect } from 'vitest';
import { compareWorkoutsWithGarmin, consolidateGarminActivities } from './comparisonEngine';
import { CalendarEvent } from '../types/calendar';
import { GarminActivity } from '../types/garmin';

describe('comparisonEngine - Same-Day Multi-Session Consolidation', () => {
  it('consolidateGarminActivities computes correct cumulative duration, distance, D+ and weighted HR', () => {
    const act1: GarminActivity = {
      activityId: 'run-1',
      activityName: 'Montreal Running',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T11:47:00',
      durationMinutes: 36,
      distanceKm: 6.5,
      elevationGainM: 10,
      elevationLossM: 21,
      avgHeartRate: 162,
      maxHeartRate: 179,
      trainingLoad: 78,
      source: 'GARMIN_CONNECT'
    };

    const act2: GarminActivity = {
      activityId: 'run-2',
      activityName: 'Montreal - [QMT] Running',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T12:23:00',
      durationMinutes: 3,
      distanceKm: 0.5,
      elevationGainM: 4,
      elevationLossM: 0,
      avgHeartRate: 123,
      maxHeartRate: 147,
      trainingLoad: 3,
      source: 'GARMIN_CONNECT'
    };

    const composite = consolidateGarminActivities([act1, act2]);

    expect(composite.durationMinutes).toBe(39);
    expect(composite.distanceKm).toBe(7.0);
    expect(composite.elevationGainM).toBe(14);
    expect(composite.elevationLossM).toBe(21);
    // Weighted HR: (162*36 + 123*3) / 39 = (5832 + 369) / 39 = 6201 / 39 = 159 bpm
    expect(composite.avgHeartRate).toBe(159);
    expect(composite.maxHeartRate).toBe(179);
    expect(composite.trainingLoad).toBe(81);
    expect(composite.activityName).toContain('Montreal Running');
    expect(composite.activityName).toContain('+1 sortie');
  });

  it('merges 2 same-day same-discipline runs into the planned workout and does not leave an unassigned bonus', () => {
    const plannedRun: CalendarEvent = {
      id: 'plan-run-1',
      title: 'Running: Easy Aerobic Base Run Z2',
      startDate: '2026-09-10T11:45:00',
      endDate: '2026-09-10T12:20:00',
      category: 'sport',
      sportType: 'RUN_EASY',
      durationMinutes: 35,
      location: 'Mont-Royal',
      description: 'Z2 Endurance',
      emoji: '🏃',
      colorId: '1',
      colorHex: '#ff5722'
    };

    const act1: GarminActivity = {
      activityId: 'run-1',
      activityName: 'Montreal Running',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T11:47:00',
      durationMinutes: 36,
      distanceKm: 6.5,
      elevationGainM: 10,
      avgHeartRate: 162,
      source: 'GARMIN_CONNECT'
    };

    const act2: GarminActivity = {
      activityId: 'run-2',
      activityName: 'Montreal - [QMT] Running: Easy Aerobic Base',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T12:23:00',
      durationMinutes: 3,
      distanceKm: 0.5,
      elevationGainM: 4,
      avgHeartRate: 123,
      source: 'GARMIN_CONNECT'
    };

    const comparisons = compareWorkoutsWithGarmin(
      [plannedRun],
      [act1, act2],
      {},
      new Date('2026-09-10T23:59:59')
    );

    // There should be exactly 1 comparison item (the planned run fulfilled by both activities)
    // and ZERO unassigned bonus activities!
    expect(comparisons).toHaveLength(1);
    const runComp = comparisons[0];

    expect(runComp.status).toBe('COMPLIANT');
    expect(runComp.isMergedExecution).toBe(true);
    expect(runComp.subActivities).toHaveLength(2);
    expect(runComp.actualActivity?.durationMinutes).toBe(39);
    expect(runComp.actualActivity?.distanceKm).toBe(7.0);
    expect(runComp.actualActivity?.elevationGainM).toBe(14);
  });

  it('keeps an unprescribed different discipline activity (e.g. cycling) as UNPLANNED bonus', () => {
    const plannedRun: CalendarEvent = {
      id: 'plan-run-1',
      title: 'Running: Easy Aerobic Base Run Z2',
      startDate: '2026-09-10T11:45:00',
      endDate: '2026-09-10T12:20:00',
      category: 'sport',
      sportType: 'RUN_EASY',
      durationMinutes: 35,
      location: 'Mont-Royal',
      description: 'Z2 Endurance',
      emoji: '🏃',
      colorId: '1',
      colorHex: '#ff5722'
    };

    const runAct: GarminActivity = {
      activityId: 'run-1',
      activityName: 'Montreal Running',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-10T11:47:00',
      durationMinutes: 36,
      distanceKm: 6.5,
      source: 'GARMIN_CONNECT'
    };

    const bikeAct: GarminActivity = {
      activityId: 'bike-1',
      activityName: 'Sortie Vélo Gravel',
      activityType: 'CYCLING',
      startTimeLocal: '2026-09-10T17:00:00',
      durationMinutes: 45,
      distanceKm: 18.0,
      source: 'GARMIN_CONNECT'
    };

    const comparisons = compareWorkoutsWithGarmin(
      [plannedRun],
      [runAct, bikeAct],
      {},
      new Date('2026-09-10T23:59:59')
    );

    // 1 planned run comparison + 1 bonus cycling comparison
    expect(comparisons).toHaveLength(2);
    const runComp = comparisons.find(c => c.plannedEvent?.id === 'plan-run-1');
    const bonusComp = comparisons.find(c => c.status === 'UNPLANNED');

    expect(runComp).toBeDefined();
    expect(bonusComp).toBeDefined();
    expect(bonusComp?.actualActivity?.activityType).toBe('CYCLING');
  });
});
