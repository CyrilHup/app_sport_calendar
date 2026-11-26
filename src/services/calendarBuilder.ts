import { CalendarEvent, DailySchedule } from '../types/calendar';
import { GarminActivity } from '../types/garmin';
import { addRecommendedStrengthSessions } from './recommendedStrengthSessions';
import { isStrengthOrCalisthenics } from './activityClassifier';
import { AppConfig, COLOR_MAP, GLOBAL_APP_CONFIG, getDailyWorkoutPlan, getPeriodizationContext } from './periodizationEngine';
import { addDays, formatDateKey } from './dateUtils';
import { capLongRunToRecentHistory, recentRunBaseline } from './trainingBaseline';

/** Builds the generated training schedule from dates, plan settings, and Garmin history. */
export function buildTrainingCalendar(
  startDate: Date,
  daysCount = 60,
  config: Readonly<AppConfig> = GLOBAL_APP_CONFIG,
  recentActivities: GarminActivity[] = [],
  asOfDate: Date = new Date()
): { schedules: DailySchedule[]; allEvents: CalendarEvent[] } {
  const baseline = recentRunBaseline(recentActivities, asOfDate);
  const schedules: DailySchedule[] = [];
  const allEvents: CalendarEvent[] = [];

  for (let i = 0; i < daysCount; i++) {
    const currentDate = addDays(startDate, i);
    const dateKey = formatDateKey(currentDate);
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const periodContext = getPeriodizationContext(currentDate, config);
    let workoutTemplate = getDailyWorkoutPlan(
      dayOfWeek, periodContext, currentDate, config
    );

    const inPrescriptionHorizon = currentDate.getTime() >= asOfDate.getTime() &&
      currentDate.getTime() - asOfDate.getTime() <= 14 * 86400_000;
    if (workoutTemplate.sportType === 'TRAIL_INTENSE' && baseline.runCount28d < 4 && inPrescriptionHorizon) {
      workoutTemplate = {
        ...workoutTemplate,
        title: 'Endurance facile provisoire (historique incomplet)',
        duration: Math.min(workoutTemplate.duration, 35),
        sportType: 'RUN_EASY',
        targetElevationM: 0,
        targetHeartRate: 'Aisance respiratoire',
        targetHeartRateRange: undefined,
        description: 'Historique de course récent insuffisant pour prescrire des côtes intenses. Footing ou marche-course en aisance respiratoire, à réévaluer après synchronisation des séances.'
      };
    }
    if (workoutTemplate.sportType === 'TRAIL_LONG' && inPrescriptionHorizon) {
      const cappedMinutes = capLongRunToRecentHistory(workoutTemplate.duration, baseline);
      if (cappedMinutes < workoutTemplate.duration) {
        const originalMinutes = workoutTemplate.duration;
        workoutTemplate = {
          ...workoutTemplate,
          title: `Sortie longue ajustée (${cappedMinutes} min)`,
          duration: cappedMinutes,
          targetElevationM: workoutTemplate.targetElevationM === undefined ? undefined
            : Math.round(workoutTemplate.targetElevationM * cappedMinutes / originalMinutes),
          description: `${workoutTemplate.description}\n• Durée provisoirement plafonnée à ${cappedMinutes} min ${baseline.longestRunMinutes30d ? `d'après la plus longue sortie enregistrée sur 30 jours (${baseline.longestRunMinutes30d} min)` : 'faute d’historique récent complet'}. Ce repère de progression est à ajuster avec vos sensations, vos douleurs et votre historique complet.`
        };
      }
    }

    const events: CalendarEvent[] = [];
    let sportSession: CalendarEvent | undefined;

    if (workoutTemplate.duration > 0 && workoutTemplate.address) {
      const targetHomeReturn = new Date(currentDate);
      targetHomeReturn.setHours(config.TARGET_HOME_RETURN_HOUR, config.TARGET_HOME_RETURN_MIN, 0, 0);
      const isHomeActivity = workoutTemplate.address === config.HOME_ADDRESS ||
        workoutTemplate.locName.includes('Maisonneuve') || workoutTemplate.locName.includes('Home') ||
        workoutTemplate.locName.includes('Maison');
      const transitAllerMinutes = isHomeActivity ? 0
        : workoutTemplate.address === config.MOUNT_ROYAL_ADDRESS ? config.TRANSIT_TIMES.HOME_TO_MONT_ROYAL
          : workoutTemplate.address === config.ETS_ADDRESS ? config.TRANSIT_TIMES.HOME_TO_ETS : 0;
      const transitRetourMinutes = isHomeActivity ? 0
        : workoutTemplate.address === config.MOUNT_ROYAL_ADDRESS ? config.TRANSIT_TIMES.MONT_ROYAL_TO_HOME
          : workoutTemplate.address === config.ETS_ADDRESS ? config.TRANSIT_TIMES.ETS_TO_HOME : 0;

      const workoutEnd = new Date(targetHomeReturn.getTime() - transitRetourMinutes * 60000);
      const workoutStart = new Date(workoutEnd.getTime() - workoutTemplate.duration * 60000);

      if (transitAllerMinutes > 0) {
        const travelStart = new Date(workoutStart.getTime() - transitAllerMinutes * 60000);
        events.push({
          id: `SPORT_TRAVEL_ALLER_${dateKey}`,
          category: 'trajet',
          sportType: 'TRAVEL',
          title: `🚶‍♂️ Commute to ${workoutTemplate.locName}`,
          startDate: travelStart.toISOString(),
          endDate: workoutStart.toISOString(),
          location: `${config.HOME_ADDRESS} ➔ ${workoutTemplate.address}`,
          description: `Estimated commute: ~${transitAllerMinutes} min`,
          emoji: '🚶‍♂️',
          colorId: COLOR_MAP.TRAVEL.colorId,
          colorHex: COLOR_MAP.TRAVEL.colorHex,
          durationMinutes: transitAllerMinutes
        });
      }

      sportSession = {
        id: `SPORT_WORKOUT_${dateKey}`,
        category: 'sport',
        sportType: workoutTemplate.sportType,
        title: `${workoutTemplate.emoji} ${workoutTemplate.title}`,
        startDate: workoutStart.toISOString(),
        endDate: workoutEnd.toISOString(),
        location: workoutTemplate.locName,
        description: workoutTemplate.description,
        emoji: workoutTemplate.emoji,
        colorId: workoutTemplate.colorId,
        colorHex: workoutTemplate.colorHex,
        durationMinutes: workoutTemplate.duration,
        metadata: {
          isOptional: workoutTemplate.optional,
          targetHeartRate: workoutTemplate.targetHeartRate,
          targetHeartRateRange: workoutTemplate.targetHeartRateRange,
          targetCadence: workoutTemplate.targetCadence,
          targetElevationM: workoutTemplate.targetElevationM,
          nutritionAdvice: workoutTemplate.nutritionAdvice,
          commuteAller: transitAllerMinutes > 0 ? {
            departureTime: new Date(workoutStart.getTime() - transitAllerMinutes * 60000).toISOString(),
            arrivalTime: workoutStart.toISOString(),
            durationMinutes: transitAllerMinutes
          } : undefined,
          commuteRetour: transitRetourMinutes > 0 ? {
            departureTime: workoutEnd.toISOString(),
            arrivalTime: new Date(workoutEnd.getTime() + transitRetourMinutes * 60000).toISOString(),
            durationMinutes: transitRetourMinutes
          } : undefined
        }
      };
      events.push(sportSession);

      if (transitRetourMinutes > 0) {
        const travelEnd = new Date(workoutEnd.getTime() + transitRetourMinutes * 60000);
        events.push({
          id: `SPORT_TRAVEL_RETOUR_${dateKey}`,
          category: 'trajet',
          sportType: 'TRAVEL',
          title: `🚶‍♂️ Commute Back (${workoutTemplate.locName})`,
          startDate: workoutEnd.toISOString(),
          endDate: travelEnd.toISOString(),
          location: `${workoutTemplate.address} ➔ ${config.HOME_ADDRESS}`,
          description: `Commute back home: ~${transitRetourMinutes} min`,
          emoji: '🚶‍♂️',
          colorId: COLOR_MAP.TRAVEL.colorId,
          colorHex: COLOR_MAP.TRAVEL.colorHex,
          durationMinutes: transitRetourMinutes
        });
      }
    }

    const stretchStart = new Date(currentDate);
    stretchStart.setHours(22, 0, 0, 0);
    const stretchEnd = new Date(stretchStart.getTime() + 20 * 60000);
    events.push({
      id: `SPORT_STRETCH_${dateKey}`,
      category: 'mobility',
      sportType: 'MOBILITY',
      title: '🧘 Evening Mobility & Stretching',
      startDate: stretchStart.toISOString(),
      endDate: stretchEnd.toISOString(),
      location: 'Home (Mat)',
      description: 'Pike/straddle stretch, seated leg lifts, Jefferson curls, couch stretch to release hip flexors.',
      emoji: '🧘',
      colorId: COLOR_MAP.MOBILITY.colorId,
      colorHex: COLOR_MAP.MOBILITY.colorHex,
      durationMinutes: 20
    });

    events.sort((a, b) => a.startDate.localeCompare(b.startDate));
    allEvents.push(...events);
    schedules.push({
      date: dateKey,
      dayOfWeek,
      periodContext,
      events,
      sportSession,
      hasCourse: false,
      hasIntensiveCourse: false
    });
  }

  const strengthSessionsLast28d = recentActivities.filter(activity => {
    const startedAt = new Date(activity.startTimeLocal).getTime();
    const ageMs = asOfDate.getTime() - startedAt;
    return ageMs >= 0 && ageMs < 28 * 24 * 60 * 60 * 1000 && isStrengthOrCalisthenics(activity);
  }).length;

  return addRecommendedStrengthSessions(schedules, allEvents, strengthSessionsLast28d);
}
