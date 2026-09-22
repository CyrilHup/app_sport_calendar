import { GarminActivity } from '../types/garmin.js';
import { classifyGarminActivityType } from '../services/activityClassifier.js';

const GENERIC_CARDIO_NAMES = new Set([
  'cardio', 'cardio training', 'indoor cardio', 'indoor_cardio', 'entraînement cardio'
]);

export function normalizeGarminActivity(raw: unknown): GarminActivity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const a = raw as Record<string, any>;
  const activityId = a.activityId === undefined || a.activityId === null ? '' : String(a.activityId).trim();
  const startTimeLocal = a.startTimeLocal || a.startTimeGMT;
  if (!activityId || activityId === 'NaN' || typeof startTimeLocal !== 'string' || !Number.isFinite(Date.parse(startTimeLocal))) {
    return null;
  }

  const typeKey = String((typeof a.activityType === 'object' ? a.activityType?.typeKey : a.activityType) || '');
  let activityName = String(a.activityName || '');
  const activityType = classifyGarminActivityType(typeKey, activityName);
  if (GENERIC_CARDIO_NAMES.has(activityName.trim().toLowerCase())) {
    activityName = 'Calisthénie / Renforcement';
  }

  const movingDurSec = a.movingDuration || a.duration || a.elapsedDuration || 0;
  const elapsedDurSec = a.elapsedDuration || a.duration || 0;
  const isStrengthOrClimb = activityType === 'STRENGTH_TRAINING' ||
    activityType === 'CLIMBING' || activityType === 'FITNESS_EQUIPMENT';
  const effectiveDurSec = isStrengthOrClimb ? elapsedDurSec : (movingDurSec || elapsedDurSec);
  const durationMinutes = Math.max(1, Math.round(effectiveDurSec / 60));
  const distanceKm = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : undefined;

  let avgPaceMinKm: string | undefined;
  if ((activityType === 'RUNNING' || activityType === 'TRAIL_RUNNING' || activityType === 'WALKING') &&
    distanceKm && distanceKm > 0.1 && effectiveDurSec > 0) {
    const paceSecondsPerKm = Math.round(effectiveDurSec / distanceKm);
    const paceMinutes = Math.floor(paceSecondsPerKm / 60);
    const paceSeconds = paceSecondsPerKm % 60;
    if (paceMinutes < 30) {
      avgPaceMinKm = `${paceMinutes}:${String(paceSeconds).padStart(2, '0')} /km`;
    }
  }

  return {
    activityId,
    activityName: activityName || 'Garmin Activity',
    activityType,
    garminTypeKey: typeKey || undefined,
    startTimeLocal,
    durationMinutes,
    elapsedDurationMinutes: elapsedDurSec ? Math.round(elapsedDurSec / 60) : undefined,
    movingDurationMinutes: movingDurSec ? Math.round(movingDurSec / 60) : undefined,
    distanceKm,
    elevationGainM: a.elevationGain !== undefined && a.elevationGain !== null ? Math.round(a.elevationGain) : undefined,
    elevationLossM: a.elevationLoss !== undefined && a.elevationLoss !== null ? Math.round(a.elevationLoss) : undefined,
    elevationSource: 'GARMIN_CONNECT',
    avgHeartRate: a.averageHR ? Math.round(a.averageHR) : undefined,
    maxHeartRate: a.maxHR ? Math.round(a.maxHR) : undefined,
    avgCadence: a.averageRunningCadenceInStepsPerMinute
      ? Math.round(a.averageRunningCadenceInStepsPerMinute)
      : (a.averageBikingCadenceInRevPerMinute ? Math.round(a.averageBikingCadenceInRevPerMinute) : undefined),
    avgPaceMinKm,
    calories: a.calories ? Math.round(a.calories) : undefined,
    aerobicTrainingEffect: typeof a.aerobicTrainingEffect === 'number'
      ? parseFloat(a.aerobicTrainingEffect.toFixed(1)) : undefined,
    anaerobicTrainingEffect: typeof a.anaerobicTrainingEffect === 'number'
      ? parseFloat(a.anaerobicTrainingEffect.toFixed(1)) : undefined,
    trainingLoad: a.activityTrainingLoad ? Math.round(a.activityTrainingLoad) : undefined,
    trainingEffectLabel: a.trainingEffectLabel ? String(a.trainingEffectLabel) : undefined,
    vo2MaxValue: typeof a.vO2MaxValue === 'number' ? Math.round(a.vO2MaxValue) : undefined,
    source: 'GARMIN_CONNECT'
  };
}

export function normalizeGarminActivities(rawActivities: unknown[]): {
  activities: GarminActivity[];
  skippedActivityCount: number;
} {
  const activities = rawActivities.map(normalizeGarminActivity).filter((item): item is GarminActivity => item !== null);
  return { activities, skippedActivityCount: rawActivities.length - activities.length };
}
