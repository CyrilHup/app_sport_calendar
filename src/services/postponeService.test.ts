import { describe, it, expect } from 'vitest';
import { CalendarEvent, DailySchedule, PeriodizationContext } from '../types/calendar';
import { GarminActivity } from '../types/garmin';
import { applyPostponements, cancelPostponeWorkout, postponeWorkout } from './postponeService';
import { compareWorkoutsWithGarmin } from './comparisonEngine';

describe('Workout Postpone Service', () => {
  const dummyContext: PeriodizationContext = {
    phase: 'FONDATION_RAMP_1',
    weekNumber: 1,
    isDeload: false,
    volumeFactor: 0.55,
    label: 'Ramp-up W1',
    daysToRace: 300,
    description: 'Adaptation'
  };

  const saturdayWorkout: CalendarEvent = {
    id: 'SPORT_WORKOUT_2026-09-05',
    category: 'sport',
    sportType: 'TRAIL_LONG',
    title: '🏔️ Trail: Sortie Longue D+ (1h15)',
    startDate: '2026-09-05T09:00:00.000Z',
    endDate: '2026-09-05T10:15:00.000Z',
    location: 'Mont Royal',
    description: 'Séance pilier trail',
    emoji: '🏔️',
    colorId: '6',
    colorHex: '#ff6b35',
    durationMinutes: 75,
    metadata: {
      targetElevationM: 400,
      targetHeartRate: '< 155 bpm'
    }
  };

  const saturdaySchedule: DailySchedule = {
    date: '2026-09-05',
    dayOfWeek: 5, // Samedi
    periodContext: dummyContext,
    events: [saturdayWorkout],
    sportSession: saturdayWorkout,
    hasCourse: false,
    hasIntensiveCourse: false
  };

  const sundaySchedule: DailySchedule = {
    date: '2026-09-06',
    dayOfWeek: 6, // Dimanche
    periodContext: dummyContext,
    events: [],
    sportSession: undefined,
    hasCourse: false,
    hasIntensiveCourse: false
  };

  it('postpones a workout from Saturday to Sunday properly', () => {
    const baseSchedules = [saturdaySchedule, sundaySchedule];
    const baseEvents = [saturdayWorkout];

    const overrides = postponeWorkout(
      {},
      saturdayWorkout.id,
      '2026-09-05',
      '2026-09-06',
      'Fatigue le samedi, course effectuée dimanche'
    );

    const { schedules, allEvents } = applyPostponements(baseSchedules, baseEvents, overrides);

    // Vérification jour source (Samedi)
    const sat = schedules.find(s => s.date === '2026-09-05')!;
    expect(sat.events.length).toBe(1);
    expect(sat.events[0].metadata?.isPostponedPlaceholder).toBe(true);
    expect(sat.events[0].metadata?.postponedToDate).toBe('2026-09-06');
    expect(sat.sportSession).toBeUndefined();

    // Vérification jour cible (Dimanche)
    const sun = schedules.find(s => s.date === '2026-09-06')!;
    expect(sun.events.length).toBe(1);
    const movedWorkout = sun.events[0];
    expect(movedWorkout.id).toBe(saturdayWorkout.id);
    expect(movedWorkout.startDate.startsWith('2026-09-06')).toBe(true);
    expect(movedWorkout.metadata?.isPostponed).toBe(true);
    expect(movedWorkout.metadata?.originalDate).toBe('2026-09-05');
    expect(sun.sportSession?.id).toBe(saturdayWorkout.id);

    // Vérification allEvents
    expect(allEvents.length).toBe(1);
    expect(allEvents[0].startDate.startsWith('2026-09-06')).toBe(true);
  });

  it('restores the original workout when postponement is cancelled', () => {
    const baseSchedules = [saturdaySchedule, sundaySchedule];
    const baseEvents = [saturdayWorkout];

    let overrides = postponeWorkout(
      {},
      saturdayWorkout.id,
      '2026-09-05',
      '2026-09-06'
    );

    // Annulation du report
    overrides = cancelPostponeWorkout(overrides, saturdayWorkout.id);
    expect(Object.keys(overrides).length).toBe(0);

    const { schedules, allEvents } = applyPostponements(baseSchedules, baseEvents, overrides);

    const sat = schedules.find(s => s.date === '2026-09-05')!;
    expect(sat.events.length).toBe(1);
    expect(sat.events[0].id).toBe(saturdayWorkout.id);
    expect(sat.events[0].metadata?.isPostponedPlaceholder).toBeUndefined();
    expect(sat.sportSession?.id).toBe(saturdayWorkout.id);

    const sun = schedules.find(s => s.date === '2026-09-06')!;
    expect(sun.events.length).toBe(0);
    expect(allEvents.length).toBe(1);
    expect(allEvents[0].startDate.startsWith('2026-09-05')).toBe(true);
  });

  it('integrates seamlessly with Garmin comparison engine and automatic weekly reconciliation', () => {
    const baseSchedules = [saturdaySchedule, sundaySchedule];
    const baseEvents = [saturdayWorkout];

    // L'athlète a couru dimanche 6 septembre sur Garmin au Mont-Royal
    const sundayGarminActivity: GarminActivity = {
      activityId: 'garmin-sun-1',
      activityName: 'Course Mont-Royal Dimanche',
      activityType: 'TRAIL_RUNNING',
      startTimeLocal: '2026-09-06T09:15:00',
      durationMinutes: 76,
      distanceKm: 11.2,
      elevationGainM: 395,
      avgHeartRate: 152,
      maxHeartRate: 171,
      source: 'GARMIN_CONNECT'
    };

    // 1. Détection automatique globale :
    // Même sans report manuel, la séance du samedi est automatiquement rattrapée
    // par l'activité du dimanche dans le même microcycle hebdomadaire !
    const asOfSunday = new Date('2026-09-06T20:00:00');
    const compAuto = compareWorkoutsWithGarmin(baseEvents, [sundayGarminActivity], {}, asOfSunday);
    
    // Le samedi n'est PAS en échec MISSED
    const satMissed = compAuto.find(c => c.date === '2026-09-05' && c.status === 'MISSED');
    expect(satMissed).toBeUndefined();

    // La séance apparaît sur le jour d'exécution avec le badge de rattrapage
    const sunCompAuto = compAuto.find(c => c.date === '2026-09-06');
    expect(sunCompAuto).toBeDefined();
    expect(sunCompAuto?.status).toBe('COMPLIANT');
    expect(sunCompAuto?.isPostponedCatchup).toBe(true);
    expect(sunCompAuto?.scheduledDate).toBe('2026-09-05');
    expect(sunCompAuto?.executedDate).toBe('2026-09-06');

    // 2. Report manuel dans le calendrier
    const overrides = postponeWorkout(
      {},
      saturdayWorkout.id,
      '2026-09-05',
      '2026-09-06'
    );
    const { allEvents: transformedEvents } = applyPostponements(baseSchedules, baseEvents, overrides);

    const compManual = compareWorkoutsWithGarmin(transformedEvents, [sundayGarminActivity], {}, asOfSunday);
    const sunCompManual = compManual.find(c => c.date === '2026-09-06');
    expect(sunCompManual).toBeDefined();
    expect(sunCompManual?.status).toBe('COMPLIANT');
    expect(sunCompManual?.actualActivity?.activityId).toBe('garmin-sun-1');
  });

  it('automatically detects and links multiple cross-day workouts across the weekly microcycle', () => {
    // Cas réel de l'utilisateur :
    // - Vendredi 4 sept. : Calisthenics 3 (60 min)
    // - Samedi 5 sept. : Running: Active Recovery (35 min)
    // - Samedi 5 sept. : Activité Garmin "Rave" (12 min, OTHER)
    // - Dimanche 6 sept. : Activité Garmin "Montreal Running" (31 min, RUNNING)
    // - Dimanche 6 sept. : Activité Garmin "Montreal Autre" (21 min, OTHER -> Renforcement musculaire)

    const fridayCalisthenics: CalendarEvent = {
      id: 'WORKOUT_2026-09-04_CALISTHENICS',
      category: 'sport',
      sportType: 'CALISTHENICS',
      title: '🤸 Calisthenics 3 (Handstand & Skills - Home)',
      startDate: '2026-09-04T18:00:00.000Z',
      endDate: '2026-09-04T19:00:00.000Z',
      location: 'Home',
      description: 'Handstand & Skills',
      emoji: '🤸',
      colorId: '11',
      colorHex: '#ef4444',
      durationMinutes: 60
    };

    const saturdayRun: CalendarEvent = {
      id: 'WORKOUT_2026-09-05_RUN',
      category: 'sport',
      sportType: 'RUN_EASY',
      title: '🏃 Running: Active Recovery (Neighborhood / Maisonneuve)',
      startDate: '2026-09-05T10:00:00.000Z',
      endDate: '2026-09-05T10:35:00.000Z',
      location: 'Maisonneuve',
      description: 'Active Recovery',
      emoji: '🏃',
      colorId: '6',
      colorHex: '#ff6b35',
      durationMinutes: 35
    };

    const saturdayRave: GarminActivity = {
      activityId: 'garmin-sat-rave',
      activityName: 'Rave',
      activityType: 'OTHER',
      startTimeLocal: '2026-09-05T23:00:00',
      durationMinutes: 12,
      avgHeartRate: 97,
      maxHeartRate: 124,
      source: 'GARMIN_CONNECT'
    };

    const sundayRunning: GarminActivity = {
      activityId: 'garmin-sun-run',
      activityName: 'Montreal Running',
      activityType: 'RUNNING',
      startTimeLocal: '2026-09-06T11:00:00',
      durationMinutes: 31,
      distanceKm: 5.1,
      avgPaceMinKm: '6:04',
      avgHeartRate: 161,
      maxHeartRate: 175,
      source: 'GARMIN_CONNECT'
    };

    const sundayMuscu: GarminActivity = {
      activityId: 'garmin-sun-muscu',
      activityName: 'Montreal Autre',
      activityType: 'OTHER',
      startTimeLocal: '2026-09-06T14:00:00',
      durationMinutes: 21,
      distanceKm: 0,
      avgHeartRate: 96,
      maxHeartRate: 122,
      source: 'GARMIN_CONNECT'
    };

    const plannedWorkouts = [fridayCalisthenics, saturdayRun];
    const garminActivities = [saturdayRave, sundayRunning, sundayMuscu];

    const asOfSunday = new Date('2026-09-06T22:00:00');
    const comparisons = compareWorkoutsWithGarmin(plannedWorkouts, garminActivities, {}, asOfSunday);

    // 1. Aucune séance n'est en statut MISSED !
    const missed = comparisons.filter(c => c.status === 'MISSED');
    expect(missed.length).toBe(0);

    // 2. La course de dimanche a rattrapé la course de samedi
    const runCatchup = comparisons.find(c => c.plannedEvent?.id === saturdayRun.id);
    expect(runCatchup).toBeDefined();
    expect(runCatchup?.isPostponedCatchup).toBe(true);
    expect(runCatchup?.scheduledDate).toBe('2026-09-05');
    expect(runCatchup?.executedDate).toBe('2026-09-06');
    expect(runCatchup?.actualActivity?.activityId).toBe('garmin-sun-run');
    expect(runCatchup?.status).toBe('COMPLIANT');

    // 3. La musculation de dimanche a rattrapé la calisthénie de vendredi
    const muscuCatchup = comparisons.find(c => c.plannedEvent?.id === fridayCalisthenics.id);
    expect(muscuCatchup).toBeDefined();
    expect(muscuCatchup?.isPostponedCatchup).toBe(true);
    expect(muscuCatchup?.scheduledDate).toBe('2026-09-04');
    expect(muscuCatchup?.executedDate).toBe('2026-09-06');
    expect(muscuCatchup?.actualActivity?.activityId).toBe('garmin-sun-muscu');

    // 4. L'activité Rave du samedi reste en UNPLANNED / Bonus
    const raveBonus = comparisons.find(c => c.actualActivity?.activityId === 'garmin-sat-rave');
    expect(raveBonus).toBeDefined();
    expect(raveBonus?.status).toBe('UNPLANNED');

    // 5. Ni la course du dimanche ni la muscu du dimanche ne sont des bonus non planifiés
    const unplannedSun = comparisons.filter(c => c.status === 'UNPLANNED' && c.date === '2026-09-06');
    expect(unplannedSun.length).toBe(0);
  });
});
