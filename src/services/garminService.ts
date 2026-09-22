import {
  GarminActivity,
  GarminSyncState,
  GarminWellnessData,
  GarminWorkoutTargetMode,
  WorkoutPushPayload,
  WorkoutPushResult,
  WorkoutStepDefinition
} from '../types/garmin';
import { CalendarEvent } from '../types/calendar';
import { classifyGarminActivityType, isStrengthOrCalisthenics, isTrailOrRunning } from './activityClassifier';
import { sanitizeGarminText } from './garminText';
import { AthleteHeartRateZones, calculateHeartRateZones } from './heartRateZones';
export type { AthleteHeartRateZones } from './heartRateZones';
export * from './activityClassifier';
export * from './garminText';
export { parseGPXString } from './gpxParser';
import { getApiUrl } from './apiConfig';
import { saveWellnessData, getBaselineRestingHeartRate } from './readinessEngine';
import { GLOBAL_APP_CONFIG } from './periodizationEngine';
import { formatDateKey, toLocalDateKey } from './dateUtils';
import { mergeGarminActivities } from './activityRepository';
import { GARMIN_TRAINING_POLICY, isValidGarminMaxHeartRate, isValidRecordedHeartRatePeak } from './garminTrainingPolicy';


import { STORAGE_KEYS, storageGet, storageSet, storageRemove, storageGetRaw, storageSetRaw } from './storageService';

const GARMIN_STORAGE_KEY = STORAGE_KEYS.GARMIN_ACTIVITIES;
const GARMIN_STATE_KEY = STORAGE_KEYS.GARMIN_STATE;
const GARMIN_CREDS_KEY = STORAGE_KEYS.GARMIN_CREDS;
let inMemoryGarminCredentials: GarminCredentials | null = null;
export const GARMIN_WORKOUT_TARGET_MODE_KEY = STORAGE_KEYS.GARMIN_WORKOUT_TARGET_MODE;
export const GARMIN_ATHLETE_BASE_PACE_KEY = STORAGE_KEYS.GARMIN_ATHLETE_BASE_PACE;
// Bump when the generated Garmin step structure changes so existing workouts are re-synced.
export const GARMIN_WORKOUT_DEFINITION_VERSION = 'recovery-2min-heart-zones-v2';

export function getGarminWorkoutTargetMode(): GarminWorkoutTargetMode {
  const mode = storageGetRaw(GARMIN_WORKOUT_TARGET_MODE_KEY);
  if (mode === 'SMART_PACE_AND_TRAIL_FREE' || mode === 'ALL_FREE' || mode === 'PACE_ONLY' || mode === 'HR_ONLY') {
    return mode as GarminWorkoutTargetMode;
  }
  return 'SMART_PACE_AND_TRAIL_FREE';
}

export function setGarminWorkoutTargetMode(mode: GarminWorkoutTargetMode): void {
  try {
    storageSetRaw(GARMIN_WORKOUT_TARGET_MODE_KEY, mode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('garmin_target_mode_changed', { detail: { mode } }));
    }
  } catch (err) {
    console.warn('Could not save garmin target mode:', err);
  }
}

/**
 * Dynamically computes the athlete's rolling baseline easy pace
 * from their recent flat running activities (< 35m D+/km).
 * Updates automatically as the athlete progresses over the weeks!
 */
export function computeDynamicAthleteBasePace(activities: GarminActivity[] = []): string {
  const acts = activities;
  const runActs = acts.filter(a => {
    if (a.activityType !== 'RUNNING') return false;
    if (!a.distanceKm || a.distanceKm < 1.5) return false;
    if (!a.avgPaceMinKm) return false;
    // Exclude heavy trail/hill repeats that distort flat aerobic baseline
    const density = (a.elevationGainM || 0) / (a.distanceKm || 1);
    return density < GARMIN_TRAINING_POLICY.flatElevationMetersPerKm;
  });

  if (runActs.length === 0) {
    return GARMIN_TRAINING_POLICY.initialBasePace;
  }

  // Rolling weighted average of recent runs (up to 6 last runs)
  const recentRuns = runActs.slice(0, 6);
  let totalWeightedSec = 0;
  let totalDurMin = 0;

  for (const r of recentRuns) {
    const sec = parsePaceToSeconds(r.avgPaceMinKm || '');
    if (sec >= 180 && sec <= 600) { // between 3:00/km and 10:00/km
      const weight = Math.max(10, r.durationMinutes || 30);
      totalWeightedSec += sec * weight;
      totalDurMin += weight;
    }
  }

  if (totalDurMin > 0) {
    const avgSec = Math.round(totalWeightedSec / totalDurMin);
    return formatSecondsToPace(avgSec);
  }

  return GARMIN_TRAINING_POLICY.initialBasePace;
}

export interface AthletePhysiologicalProfile {
  fcMax: number;
  fcRest: number;
  fcReserve: number;
  trailAvgHr: number;
  runEasyAvgHr: number;
  calisthenicsAvgHr: number;
  basePace: string;
}

/**
 * Extrait le profil physiologique dynamique de l'athlète à partir de ses données Garmin réelles :
 * - FC Max : UserSettings Garmin, pic enregistré réel ou profil utilisateur
 * - FC Repos : moyenne glissante issue de Garmin Wellness (rolling baseline)
 * - FC moyennes réelles par discipline : calculées sur l'historique d'activités Garmin
 * - Allure aérobie de base : calculée dynamiquement sur les footings plats
 */
export function getDynamicAthleteProfile(
  activities: GarminActivity[] = [],
  profileOverride?: { fcMax?: number; fcRest?: number }
): AthletePhysiologicalProfile {
  const acts = activities;

  // 1. FC Max dynamique
  let fcMax = 0;
  if (isValidGarminMaxHeartRate(profileOverride?.fcMax)) {
    fcMax = profileOverride.fcMax;
  } else {
    fcMax = GLOBAL_APP_CONFIG.ATHLETE_FC_MAX;

    // Validation avec les pics réels enregistrés sur la montre (rehausse si un pic réel supérieur est mesuré)
    if (acts.length > 0) {
      const recordedPeaks = acts
        .map(a => a.maxHeartRate)
        .filter(isValidRecordedHeartRatePeak);
      if (recordedPeaks.length > 0) {
        const peakRecorded = Math.max(...recordedPeaks);
        if (peakRecorded > fcMax) {
          fcMax = peakRecorded;
        }
      }
    }
  }

  // 2. FC Repos dynamique (issue de Garmin Wellness)
  const fcRest = typeof profileOverride?.fcRest === 'number' && profileOverride.fcRest > 30
    ? profileOverride.fcRest
    : GLOBAL_APP_CONFIG.ATHLETE_FC_REST;
  const fcReserve = fcMax - fcRest;

  // 3. Calcul dynamique de la FC moyenne en Trail (activités avec D+ >= 80m ou type TRAIL)
  const trailActs = acts.filter(a => {
    const actTypeUpper = String(a.activityType || '').toUpperCase();
    const isTrail = actTypeUpper === 'TRAIL_RUNNING' || (isTrailOrRunning(a) && ((a.elevationGainM || 0) >= GARMIN_TRAINING_POLICY.trailElevationMeters || String(a.activityName || '').toLowerCase().includes('trail')));
    return isTrail && typeof a.avgHeartRate === 'number' && a.avgHeartRate > 110 && a.avgHeartRate < 210;
  });

  let trailAvgHr = 0;
  if (trailActs.length > 0) {
    const recentTrail = trailActs.slice(0, 10);
    let weightedSum = 0;
    let durSum = 0;
    for (const a of recentTrail) {
      const dur = Math.max(10, a.durationMinutes || 30);
      weightedSum += a.avgHeartRate! * dur;
      durSum += dur;
    }
    if (durSum > 0) trailAvgHr = Math.round(weightedSum / durSum);
  }
  if (!trailAvgHr) {
    trailAvgHr = Math.round(fcRest + GARMIN_TRAINING_POLICY.reserveFractions.trail * fcReserve);
  }

  // 4. Calcul dynamique de la FC moyenne en Footing Plat / Récupération
  const easyActs = acts.filter(a => {
    const actTypeUpper = String(a.activityType || '').toUpperCase();
    const nameLower = String(a.activityName || '').toLowerCase();
    const isTrail = actTypeUpper === 'TRAIL_RUNNING' || nameLower.includes('trail') || (a.elevationGainM || 0) >= GARMIN_TRAINING_POLICY.trailElevationMeters;
    const isFlatRun = !isTrail && (actTypeUpper === 'RUNNING' || isTrailOrRunning(a)) && ((a.elevationGainM || 0) / Math.max(0.5, a.distanceKm || 1) < GARMIN_TRAINING_POLICY.flatElevationMetersPerKm);
    return isFlatRun && typeof a.avgHeartRate === 'number' && a.avgHeartRate > 100 && a.avgHeartRate < 200;
  });

  let runEasyAvgHr = 0;
  if (easyActs.length > 0) {
    const recentEasy = easyActs.slice(0, 10);
    let weightedSum = 0;
    let durSum = 0;
    for (const a of recentEasy) {
      const dur = Math.max(10, a.durationMinutes || 30);
      weightedSum += a.avgHeartRate! * dur;
      durSum += dur;
    }
    if (durSum > 0) runEasyAvgHr = Math.round(weightedSum / durSum);
  }
  if (!runEasyAvgHr) {
    runEasyAvgHr = Math.round(fcRest + GARMIN_TRAINING_POLICY.reserveFractions.easyRun * fcReserve);
  }

  // 5. Calcul dynamique de la FC moyenne en Renforcement / Calisthénie
  const calisActs = acts.filter(a => {
    const isCalis = isStrengthOrCalisthenics(a.activityType, a.activityName);
    return isCalis && typeof a.avgHeartRate === 'number' && a.avgHeartRate > 80 && a.avgHeartRate < 180;
  });

  let calisthenicsAvgHr = 0;
  if (calisActs.length > 0) {
    const recentCalis = calisActs.slice(0, 10);
    let weightedSum = 0;
    let durSum = 0;
    for (const a of recentCalis) {
      const dur = Math.max(10, a.durationMinutes || 30);
      weightedSum += a.avgHeartRate! * dur;
      durSum += dur;
    }
    if (durSum > 0) calisthenicsAvgHr = Math.round(weightedSum / durSum);
  }
  if (!calisthenicsAvgHr) {
    calisthenicsAvgHr = Math.round(fcRest + GARMIN_TRAINING_POLICY.reserveFractions.strength * fcReserve);
  }

  const basePace = computeDynamicAthleteBasePace(acts);

  return {
    fcMax,
    fcRest,
    fcReserve,
    trailAvgHr,
    runEasyAvgHr,
    calisthenicsAvgHr,
    basePace
  };
}

/**
 * Calcule dynamiquement les 5 zones d'intensité cardio de l'athlète selon le modèle
 * de réserve cardiaque de Karvonen (HRr = FCmax - FCrepos).
 */
export function getAthleteHeartRateZones(profile?: AthletePhysiologicalProfile): AthleteHeartRateZones {
  const p = profile || getDynamicAthleteProfile();
  return calculateHeartRateZones(p.fcMax, p.fcRest);
}

/**
 * Détermine la fréquence cardiaque moyenne attendue pour une séance planifiée,
 * en s'ancrant en priorité absolue sur les statistiques physiologiques réelles de l'athlète
 * (historique Garmin/Supabase) et sa réserve cardiaque (HRr).
 */
export function getExpectedHeartRateForEvent(
  event: {
    sportType?: string;
    title?: string;
    metadata?: {
      targetHeartRateRange?: [number, number];
      targetHeartRate?: string;
      targetElevationM?: number;
    };
  },
  profile?: AthletePhysiologicalProfile
): number {
  const p = profile || getDynamicAthleteProfile();
  const titleLower = String(event.title || '').toLowerCase();
  const sportType = String(event.sportType || '').toUpperCase();
  const targetElevation = event.metadata?.targetElevationM || 0;

  const isTrailIntense = sportType === 'TRAIL_INTENSE' || titleLower.includes('côte') || titleLower.includes('hill') || titleLower.includes('répétition');
  const isTrailDiscipline = sportType === 'TRAIL_LONG' || titleLower.includes('trail') || titleLower.includes('rando-course') || targetElevation >= GARMIN_TRAINING_POLICY.trailElevationMeters;
  const isTempoDiscipline = sportType === 'RUN_TEMPO' || titleLower.includes('tempo') || titleLower.includes('seuil');
  const isEasyRunDiscipline = sportType === 'RUN_EASY' || titleLower.includes('footing') || titleLower.includes('doux') || titleLower.includes('récupération') || titleLower.includes('aerobic base') || titleLower.includes('rolling run');
  const isCalisthenics = isStrengthOrCalisthenics(sportType, event.title);

  // 1. Détermination du niveau physiologique de base pour la discipline (ancrage sur télémétrie réelle)
  let baseDisciplineHr: number;
  if (isTrailIntense) {
    baseDisciplineHr = Math.round(p.fcRest + GARMIN_TRAINING_POLICY.reserveFractions.intenseTrail * p.fcReserve);
  } else if (isTrailDiscipline) {
    baseDisciplineHr = p.trailAvgHr;
  } else if (isTempoDiscipline) {
    baseDisciplineHr = Math.round(p.fcRest + GARMIN_TRAINING_POLICY.reserveFractions.tempo * p.fcReserve);
  } else if (isEasyRunDiscipline) {
    baseDisciplineHr = p.runEasyAvgHr;
  } else if (isCalisthenics) {
    baseDisciplineHr = p.calisthenicsAvgHr;
  } else {
    baseDisciplineHr = Math.round(p.fcRest + GARMIN_TRAINING_POLICY.reserveFractions.other * p.fcReserve);
  }

  // 2. Si une plage cible numérique explicite a été fournie
  if (event.metadata?.targetHeartRateRange && event.metadata.targetHeartRateRange.length === 2) {
    const [low, high] = event.metadata.targetHeartRateRange;
    if (low > 60 && high > low) {
      if (isTrailIntense || targetElevation >= 100) {
        return Math.min(p.fcMax - 5, Math.max(baseDisciplineHr, high - 2));
      }
      const rangeMid = Math.round((low + high) / 2);
      // Si la plage cible prescrit un effort spécifique supérieur à l'endurance de base
      if (rangeMid > baseDisciplineHr) {
        return Math.min(p.fcMax - 5, rangeMid);
      }
      // Pour les séances d'endurance ou de trail, la télémétrie réelle prévaut sur toute plage statique basse
      return baseDisciplineHr;
    }
  }

  // 3. Si une cible textuelle explicite existe
  if (event.metadata?.targetHeartRate) {
    const text = event.metadata.targetHeartRate;
    const matchRange = text.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})/);
    if (matchRange) {
      const low = parseInt(matchRange[1], 10);
      const high = parseInt(matchRange[2], 10);
      if (low > 60 && high > low) {
        const mid = Math.round((low + high) / 2);
        if (mid > baseDisciplineHr) return Math.min(p.fcMax - 5, mid);
      }
    }
  }

  return baseDisciplineHr;
}

export function isAthleteBasePaceAuto(): boolean {
  const pace = storageGetRaw(GARMIN_ATHLETE_BASE_PACE_KEY);
  return !pace || pace === 'AUTO';
}

export function getAthleteBasePace(activities: GarminActivity[] = []): string {
  const stored = storageGetRaw(GARMIN_ATHLETE_BASE_PACE_KEY);
  if (stored && stored !== 'AUTO') return stored;
  return computeDynamicAthleteBasePace(activities);
}

/** Storage-facing adapter; the calculation above remains deterministic for explicit inputs. */
export function getStoredAthleteProfile(): AthletePhysiologicalProfile {
  const cachedFc = Number(storageGetRaw(STORAGE_KEYS.ATHLETE_FC_MAX));
  return getDynamicAthleteProfile(loadStoredGarminActivities(), {
    fcMax: isValidGarminMaxHeartRate(cachedFc) ? cachedFc : undefined,
    fcRest: getBaselineRestingHeartRate()
  });
}

export function setAthleteBasePace(pace: string): void {
  try {
    storageSetRaw(GARMIN_ATHLETE_BASE_PACE_KEY, pace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('garmin_base_pace_changed', { detail: { pace } }));
    }
  } catch (err) {
    console.warn('Could not save athlete base pace:', err);
  }
}

export function parsePaceToSeconds(paceStr: string): number {
  if (!paceStr) return 365;
  const parts = paceStr.split(':').map(p => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  const parsed = parseFloat(paceStr);
  return isNaN(parsed) ? 365 : Math.round(parsed * 60);
}

export function formatSecondsToPace(seconds: number): string {
  const clamped = Math.max(120, Math.min(900, Math.round(seconds)));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export interface GarminCredentials {
  email?: string;
  password?: string;
}

/**
 * Keeps Garmin credentials for the current app session only.
 * Passwords must never be written to localStorage, Capacitor Preferences or cloud metadata.
 */
export function saveGarminCredentials(creds: GarminCredentials): void {
  inMemoryGarminCredentials = { ...creds };
  const jsonStr = JSON.stringify(creds);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(GARMIN_CREDS_KEY, jsonStr);
    }
  } catch {}

  // Remove copies created by older releases. The async native cleanup is best-effort.
  try { localStorage.removeItem(GARMIN_CREDS_KEY); } catch {}
  void import('@capacitor/preferences')
    .then(({ Preferences }) => Preferences.remove({ key: GARMIN_CREDS_KEY }))
    .catch(() => {});
}

/**
 * Loads credentials from the current app session.
 */
export function loadGarminCredentials(): GarminCredentials | null {
  if (inMemoryGarminCredentials) return { ...inMemoryGarminCredentials };
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(GARMIN_CREDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GarminCredentials;
        inMemoryGarminCredentials = parsed;
        return { ...parsed };
      }
    }
  } catch {}
  return null;
}

/**
 * Async compatibility wrapper. Legacy persistent copies are deliberately deleted,
 * not restored, so the password cannot silently become persistent again.
 */
export async function loadGarminCredentialsAsync(): Promise<GarminCredentials | null> {
  const existing = loadGarminCredentials();
  try { localStorage.removeItem(GARMIN_CREDS_KEY); } catch {}
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: GARMIN_CREDS_KEY });
  } catch {}
  return existing;
}

/**
 * Clears saved Garmin credentials across storage layers.
 */
export function clearGarminCredentials(): void {
  inMemoryGarminCredentials = null;
  try { sessionStorage.removeItem(GARMIN_CREDS_KEY); } catch {}
  try { localStorage.removeItem(GARMIN_CREDS_KEY); } catch {}
  void import('@capacitor/preferences')
    .then(({ Preferences }) => Preferences.remove({ key: GARMIN_CREDS_KEY }))
    .catch(() => {});
}

async function getGarminApiHeaders(): Promise<Record<string, string>> {
  const { getSupabaseAccessToken } = await import('./supabaseClient');
  const token = await getSupabaseAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * Normalizes an activity's type based on its metadata and name.
 * E.g., climbing/bouldering/grimp activities logged as 'OTHER' or generic are mapped to 'CLIMBING'.
 */
export function normalizeGarminActivity(a: GarminActivity): GarminActivity {
  let type = a.activityType;
  if (type === 'OTHER' || !type) {
    type = classifyGarminActivityType(a.garminTypeKey, a.activityName);
  }

  let actName = a.activityName;
  const lower = (actName || '').trim().toLowerCase();
  if (
    lower === 'cardio' ||
    lower === 'cardio training' ||
    lower === 'indoor cardio' ||
    lower === 'indoor_cardio' ||
    lower === 'entraînement cardio'
  ) {
    actName = 'Calisthénie / Renforcement';
  }

  return {
    ...a,
    activityName: actName,
    activityType: type,
    // Backfill provenance for activities saved before the Strava enrichment
    // fields existed. Corrected activities already carry their original
    // Garmin value and must keep it untouched.
    garminElevationGainM: a.garminElevationGainM ?? (
      a.elevationSource === 'STRAVA_CORRECTED' ? undefined : a.elevationGainM
    ),
    garminElevationLossM: a.garminElevationLossM ?? (
      a.elevationSource === 'STRAVA_CORRECTED' ? undefined : a.elevationLossM
    ),
    elevationSource: a.elevationSource || (a.source === 'GPX_IMPORT' ? 'GPX_IMPORT' : 'GARMIN_CONNECT')
  };
}

/**
 * Loads real synchronized Garmin activities from persistent local storage.
 * Returns an EMPTY array if no activities have been synchronized yet (NO hardcoded mock data).
 */
export function loadStoredGarminActivities(): GarminActivity[] {
  const parsed = storageGet<GarminActivity[]>(STORAGE_KEYS.GARMIN_ACTIVITIES, []);
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeGarminActivity);
  }
  return [];
}

/**
 * Persists synchronized Garmin activities.
 */
export function saveGarminActivities(activities: GarminActivity[]): void {
  const normalized = activities.map(normalizeGarminActivity);
  storageSet(STORAGE_KEYS.GARMIN_ACTIVITIES, normalized);
}

/**
 * Loads Garmin connection state.
 */
export function loadGarminSyncState(): GarminSyncState {
  return storageGet<GarminSyncState>(STORAGE_KEYS.GARMIN_STATE, {
    connected: false,
    lastSyncTime: undefined,
    accountEmail: undefined,
    activitiesCount: 0,
    isSyncing: false
  });
}

/**
 * Saves Garmin connection state.
 */
export function saveGarminSyncState(state: GarminSyncState): void {
  storageSet(STORAGE_KEYS.GARMIN_STATE, state);
}

/**
 * Calls the backend /api/garmin-sync endpoint to authenticate with Garmin Connect
 * and retrieve actual logged activities via the Garmin API.
 */
export async function syncWithGarminAPI(
  credentials?: {
    email?: string;
    password?: string;
  },
  options?: {
    mode?: 'full' | 'incremental';
  }
): Promise<{ success: boolean; activities: GarminActivity[]; count: number; athleteMaxHr?: number; error?: string; syncMode?: string }> {
  let combinedActivities = loadStoredGarminActivities();
  try {
    const credsToUse = (credentials?.email && credentials?.password)
      ? credentials
      : (loadGarminCredentials() || await loadGarminCredentialsAsync() || credentials);

    const syncMode = options?.mode || 'incremental';

    let detectedMaxHr: number | undefined;
    let nextOffset: number | null = 0;
    let pageRequests = 0;

    do {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 55_000);
      let response: Response;
      let responseText: string;
      try {
        response = await fetch(getApiUrl('/api/garmin-sync'), {
          method: 'POST',
          headers: await getGarminApiHeaders(),
          body: JSON.stringify({
            ...(credsToUse || {}),
            syncMode,
            offset: syncMode === 'full' ? nextOffset : 0,
            clientDate: formatDateKey(new Date())
          }),
          signal: abortController.signal
        });
        responseText = await response.text();
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          return {
            success: false,
            activities: combinedActivities,
            count: combinedActivities.length,
            error: 'La synchronisation Garmin a expiré après 55s. Les pages déjà récupérées ont été conservées.'
          };
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          activities: combinedActivities,
          count: combinedActivities.length,
          error: `Erreur serveur Garmin (HTTP ${response.status}) : ${responseText.slice(0, 160).trim() || 'Réponse non-JSON'}`
        };
      }
      if (!response.ok || !data?.success) {
        return {
          success: false,
          activities: combinedActivities,
          count: combinedActivities.length,
          error: data?.error || 'Échec de la récupération des activités Garmin Connect.'
        };
      }

      const freshActivities: GarminActivity[] = Array.isArray(data.activities)
        ? data.activities.map(normalizeGarminActivity)
        : [];
      combinedActivities = mergeGarminActivities(combinedActivities, freshActivities);
      saveGarminActivities(combinedActivities);
      if (data.wellness) saveWellnessData(data.wellness);
      if (isValidGarminMaxHeartRate(data.athleteMaxHr)) {
        detectedMaxHr = detectedMaxHr === undefined
          ? data.athleteMaxHr
          : Math.max(detectedMaxHr, data.athleteMaxHr);
        storageSetRaw(STORAGE_KEYS.ATHLETE_FC_MAX, String(detectedMaxHr));
      }

      if (Number.isInteger(data.skippedActivityCount) && data.skippedActivityCount > 0) {
        return {
          success: false,
          activities: combinedActivities,
          count: combinedActivities.length,
          error: `${data.skippedActivityCount} activité(s) Garmin ignorée(s) car sans identifiant ou date fiable. Les autres activités ont été conservées.`
        };
      }

      if (data.historyTruncated) {
        return {
          success: false,
          activities: combinedActivities,
          count: combinedActivities.length,
          error: 'Limite de 5 000 activités Garmin atteinte. Les pages reçues sont conservées, mais l’historique complet n’est pas confirmé.'
        };
      }

      pageRequests++;
      const candidate = data.nextOffset;
      nextOffset = syncMode === 'full' && Number.isInteger(candidate) && candidate > (nextOffset || 0)
        ? candidate
        : null;
    } while (nextOffset !== null && pageRequests < 25);

    if (nextOffset !== null) {
      return {
        success: false,
        activities: combinedActivities,
        count: combinedActivities.length,
        error: 'La synchronisation complète Garmin nécessite plus de 25 requêtes. Les pages déjà récupérées ont été conservées.'
      };
    }

    // Keep credentials only in memory for this app session.
    if (credsToUse?.email && credsToUse?.password) {
      saveGarminCredentials({ email: credsToUse.email, password: credsToUse.password });
    }

    const newState: GarminSyncState = {
      connected: true,
      lastSyncTime: new Date().toISOString(),
      accountEmail: credsToUse?.email || "Compte Garmin",
      activitiesCount: combinedActivities.length,
      isSyncing: false
    };
    saveGarminSyncState(newState);

    return {
      success: true,
      activities: combinedActivities,
      count: combinedActivities.length,
      athleteMaxHr: detectedMaxHr,
      syncMode
    };
  } catch (err: any) {
    return {
      success: false,
      activities: combinedActivities,
      count: combinedActivities.length,
      error: err.message || 'Network error while connecting to Garmin API proxy.'
    };
  }
}


/**
 * Constructs a structured Garmin workout payload from a planned CalendarEvent.
 * Calibrated specifically for Garmin Forerunner 55 compatibility (clean text, no emojis, concise notes).
 */
export function buildWorkoutPayloadFromEvent(
  event: CalendarEvent,
  targetDateStr?: string,
  targetWatch: 'FORERUNNER_55' | 'STANDARD' = 'FORERUNNER_55',
  athleteProfile?: AthletePhysiologicalProfile
): WorkoutPushPayload {
  const dateKey = targetDateStr || toLocalDateKey(event.startDate);
  const durMin = event.durationMinutes || 45;
  const isFR55 = targetWatch === 'FORERUNNER_55';
  const targetMode = getGarminWorkoutTargetMode();
  const profile = athleteProfile || getDynamicAthleteProfile();
  const athleteZones = getAthleteHeartRateZones(profile);
  const basePaceStr = profile.basePace || getAthleteBasePace();
  const baseSec = parsePaceToSeconds(basePaceStr);

  let sportType: WorkoutPushPayload['sportType'] = 'RUNNING';
  let steps: WorkoutStepDefinition[] = [];

  const titleLower = event.title.toLowerCase();
  const locationLower = (event.location || '').toLowerCase();
  const targetElev = event.metadata?.targetElevationM || 0;

  const isTrailSession =
    event.sportType === 'TRAIL_LONG' ||
    event.sportType === 'TRAIL_INTENSE' ||
    targetElev >= 30 ||
    titleLower.includes('trail') ||
    titleLower.includes('mont-royal') ||
    titleLower.includes('mont royal') ||
    titleLower.includes('côte') ||
    titleLower.includes('cote') ||
    titleLower.includes('d+') ||
    locationLower.includes('mont-royal') ||
    locationLower.includes('mont royal');

  const isAdaptedToEasy = event.metadata?.isAdapted && (
    event.sportType === 'RUN_EASY' ||
    titleLower.includes('footing') ||
    titleLower.includes('récupération') ||
    titleLower.includes('aérobie doux')
  );

  const useFreeForTrail = isTrailSession && targetMode !== 'HR_ONLY';
  const useFreeForAll = targetMode === 'ALL_FREE';
  const usePaceForFlat = (targetMode === 'SMART_PACE_AND_TRAIL_FREE' || targetMode === 'PACE_ONLY') && !isTrailSession;

  if (isAdaptedToEasy || event.sportType === 'RUN_EASY') {
    sportType = 'RUNNING';
    const warmupDurSec = durMin <= 35 ? 7 * 60 : 10 * 60;
    const cooldownDurSec = 5 * 60;
    const mainDurSec = Math.max(10 * 60, durMin * 60 - warmupDurSec - cooldownDurSec);

    if (useFreeForTrail || useFreeForAll) {
      // Mode 100% Libre (Zéro vibration intempestive)
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'NONE',
          stepNotes: isTrailSession ? 'Échauffement progressif sur sentier' : 'Échauffement progressif très doux'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'NONE',
          stepNotes: isTrailSession ? 'Sortie trail libre au feeling Z2' : 'Footing souple et régulier Z2'
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: cooldownDurSec,
          targetType: 'NONE',
          stepNotes: 'Retour au calme & marche lente'
        }
      ];
    } else if (usePaceForFlat) {
      // Guide par Plages d'Allure réalistes sur le plat
      const paceWarmLow = formatSecondsToPace(baseSec + 15);
      const paceWarmHigh = formatSecondsToPace(baseSec + 55);
      const paceMainLow = formatSecondsToPace(baseSec - 15);
      const paceMainHigh = formatSecondsToPace(baseSec + 20);

      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'PACE',
          targetPaceLowMinKm: paceWarmLow,
          targetPaceHighMinKm: paceWarmHigh,
          targetPaceMinKm: formatSecondsToPace(baseSec + 35),
          targetPaceMarginSeconds: GARMIN_TRAINING_POLICY.warmupPaceMarginSeconds,
          stepNotes: `Échauffement trot souple (${paceWarmLow} - ${paceWarmHigh}/km)`
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'PACE',
          targetPaceLowMinKm: paceMainLow,
          targetPaceHighMinKm: paceMainHigh,
          targetPaceMinKm: basePaceStr,
          targetPaceMarginSeconds: GARMIN_TRAINING_POLICY.defaultPaceMarginSeconds,
          stepNotes: `Footing régulier (${paceMainLow} - ${paceMainHigh}/km)`
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: cooldownDurSec,
          targetType: 'NONE',
          stepNotes: 'Retour au calme & marche lente'
        }
      ];
    } else {
      // Mode Fréquence Cardiaque dynamique (Karvonen Zone 1/2)
      const targetHrLow = event.metadata?.targetHeartRateRange?.[0] || athleteZones.zone1[0];
      const targetHrHigh = event.metadata?.targetHeartRateRange?.[1] || athleteZones.zone2[1];
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: athleteZones.zone1[0],
          targetHrHigh: athleteZones.zone1[1],
          stepNotes: `Échauffement progressif très doux (Zone 1 : ${athleteZones.zone1[0]}-${athleteZones.zone1[1]} bpm)`
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: targetHrLow,
          targetHrHigh: targetHrHigh,
          stepNotes: `Footing régulier en Zone 2 (${targetHrLow}-${targetHrHigh} bpm)`
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: cooldownDurSec,
          targetType: 'NONE',
          stepNotes: 'Retour au calme & marche lente'
        }
      ];
    }
  } else if (event.sportType === 'TRAIL_INTENSE') {
    // Hill Repeats (Séances de Côtes) & Renforcement Spécifique Post-Côtes
    sportType = 'RUNNING';
    const hasLegStrength = titleLower.includes('leg strength') || titleLower.includes('renfo') || titleLower.includes('strength');

    // If session includes post-hill leg strength (e.g. Tuesday 70 min = 45 min trail + 25 min renfo)
    let strengthMin = 0;
    if (hasLegStrength) {
      strengthMin = durMin >= 65 ? 25 : (durMin >= 50 ? 20 : 15);
    }
    const trailMin = Math.max(20, durMin - strengthMin);
    const trailSec = trailMin * 60;

    const warmupDurSec = (trailMin <= 35 ? 10 : 15) * 60;
    const cooldownDurSec = (hasLegStrength ? 5 : 8) * 60;
    const hillBlockSec = Math.max(10 * 60, trailSec - warmupDurSec - cooldownDurSec);

    const isTargetFree = useFreeForTrail || useFreeForAll;

    // Build the Hill Repeats running steps
    const hillSteps: WorkoutStepDefinition[] = [
      {
        stepType: 'WARMUP',
        durationSeconds: warmupDurSec,
        targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
        targetHrLow: isTargetFree ? undefined : 135,
        targetHrHigh: isTargetFree ? undefined : 150,
        stepNotes: 'Échauffement progressif vers les côtes (Mont-Royal)'
      }
    ];

    const hillRepEffortSec = 60;
    const hillRepRecoverySec = 2 * 60;
    const hillRepCycleSec = hillRepEffortSec + hillRepRecoverySec;

    // Standard rep = 60s montée tonique + 120s descente très souple = 180s (3 min)
    if (hillBlockSec >= 1200) {
      // 2 séries de côtes avec pause inter-séries
      // Série 1: 4 répétitions (4 * 180s = 720s = 12 min)
      for (let i = 1; i <= 4; i++) {
        hillSteps.push({
          stepType: 'INTERVAL',
          durationSeconds: hillRepEffortSec,
          targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
          targetHrLow: isTargetFree ? undefined : 172,
          targetHrHigh: isTargetFree ? undefined : 190,
          stepNotes: `Série 1 - Côte ${i}/4 (effort tonique RPE 8/10)`
        });
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: hillRepRecoverySec,
          targetType: 'NONE',
          stepNotes: 'Descente trot très souple ou marche'
        });
      }

      // Inter-série recovery (180s = 3 min)
      hillSteps.push({
        stepType: 'RECOVERY',
        durationSeconds: 180,
        targetType: 'NONE',
        stepNotes: 'Récupération inter-séries (marche & hydratation)'
      });

      // Série 2: 4 répétitions (4 * 180s = 720s = 12 min)
      for (let i = 1; i <= 4; i++) {
        hillSteps.push({
          stepType: 'INTERVAL',
          durationSeconds: hillRepEffortSec,
          targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
          targetHrLow: isTargetFree ? undefined : 172,
          targetHrHigh: isTargetFree ? undefined : 190,
          stepNotes: `Série 2 - Côte ${i}/4 (effort tonique RPE 8/10)`
        });
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: hillRepRecoverySec,
          targetType: 'NONE',
          stepNotes: i < 4 ? 'Descente trot très souple ou marche' : 'Descente finale souple'
        });
      }

      // Remaining hill-block time is added as a transition trot when available.
      const allocatedHillSec = 4 * hillRepCycleSec + 180 + 4 * hillRepCycleSec;
      const remainHillSec = hillBlockSec - allocatedHillSec;
      if (remainHillSec > 30) {
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: remainHillSec,
          targetType: 'NONE',
          stepNotes: 'Trot de transition souple'
        });
      }
    } else {
      // 1 série de côtes adaptées à la durée disponible
      const numReps = Math.max(3, Math.floor(hillBlockSec / 150));
      for (let i = 1; i <= numReps; i++) {
        hillSteps.push({
          stepType: 'INTERVAL',
          durationSeconds: hillRepEffortSec,
          targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
          targetHrLow: isTargetFree ? undefined : 172,
          targetHrHigh: isTargetFree ? undefined : 190,
          stepNotes: `Côte ${i}/${numReps} (effort tonique RPE 8/10)`
        });
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: hillRepRecoverySec,
          targetType: 'NONE',
          stepNotes: 'Descente marchée très souple'
        });
      }
      const allocatedHillSec = numReps * hillRepCycleSec;
      const remainHillSec = hillBlockSec - allocatedHillSec;
      if (remainHillSec > 30) {
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: remainHillSec,
          targetType: 'NONE',
          stepNotes: 'Trot de liaison souple'
        });
      }
    }

    // Cooldown du bloc trail
    hillSteps.push({
      stepType: 'COOLDOWN',
      durationSeconds: cooldownDurSec,
      targetType: 'NONE',
      stepNotes: hasLegStrength
        ? 'Trot souple & transition vers renforcement'
        : 'Retour au calme & décrassage plat'
    });

    // Post-hill leg strength steps if requested
    if (hasLegStrength && strengthMin > 0) {
      const strengthSec = strengthMin * 60;
      const s1Sec = Math.round(strengthMin * 0.4) * 60; // e.g. 10 min
      const s2Sec = Math.round(strengthMin * 0.32) * 60; // e.g. 8 min
      const s3Sec = Math.max(60, strengthSec - s1Sec - s2Sec); // e.g. 7 min

      hillSteps.push({
        stepType: 'INTERVAL',
        durationSeconds: s1Sec,
        targetType: 'NONE',
        stepNotes: 'Renfo : Fentes bulgares & squats tempo (freinage excentrique)'
      });

      hillSteps.push({
        stepType: 'INTERVAL',
        durationSeconds: s2Sec,
        targetType: 'NONE',
        stepNotes: 'Renfo : Mollets unilatéraux & stabilité chevilles'
      });

      hillSteps.push({
        stepType: 'COOLDOWN',
        durationSeconds: s3Sec,
        targetType: 'NONE',
        stepNotes: 'Mobilité hanches & étirements doux'
      });
    }

    steps = hillSteps;
  } else if (event.sportType === 'TRAIL_LONG') {
    sportType = 'RUNNING';
    const isAdapted = Boolean(event.metadata?.isAdapted);
    const warmupDurSec = durMin <= 40 ? 10 * 60 : 15 * 60;
    const cooldownDurSec = 5 * 60;
    const mainDurSec = Math.max(10 * 60, durMin * 60 - warmupDurSec - cooldownDurSec);

    if (useFreeForTrail || useFreeForAll) {
      // Sortie Trail / Rando-course sans vibration d'alerte (targetType: 'NONE')
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'NONE',
          stepNotes: 'Échauffement progressif sur sentier'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'NONE',
          stepNotes: isAdapted
            ? 'Rando-Course allégée : Power-hike dès 7%'
            : 'Rando-Course Z2 : Power-hike dès 7%'
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: cooldownDurSec,
          targetType: 'NONE',
          stepNotes: 'Marche active et retour au calme'
        }
      ];
    } else {
      const targetHrLow = event.metadata?.targetHeartRateRange?.[0] || athleteZones.zone2[0];
      const targetHrHigh = event.metadata?.targetHeartRateRange?.[1] || athleteZones.zone2[1];
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: targetHrLow,
          targetHrHigh: targetHrHigh,
          stepNotes: `Échauffement progressif sur sentier (${targetHrLow}-${targetHrHigh} bpm)`
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: targetHrLow,
          targetHrHigh: targetHrHigh,
          stepNotes: isAdapted
            ? 'Rando-Course allégée : Power-hike dès 7%'
            : `Rando-Course Z2 (${targetHrLow}-${targetHrHigh} bpm) : Power-hike dès 7%`
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: cooldownDurSec,
          targetType: 'NONE',
          stepNotes: 'Marche active et retour au calme'
        }
      ];
    }
  } else if (event.sportType === 'CALISTHENICS' || event.sportType === 'GYM_FORCE' || event.sportType === 'MOBILITY') {
    // Forerunner 55 optimized: uses CARDIO so FR55 watch can run it natively with intervals & vibration
    sportType = isFR55 ? 'CARDIO' : 'STRENGTH';
    steps = [
      {
        stepType: 'INTERVAL',
        durationSeconds: durMin * 60,
        targetType: 'NONE',
        stepNotes: 'Entraînement Calisthénie libre au poids du corps'
      }
    ];
  } else {
    sportType = 'CARDIO';
    steps = [
      {
        stepType: 'WARMUP',
        durationSeconds: 10 * 60,
        targetType: 'NONE',
        stepNotes: 'Échauffement libre'
      },
      {
        stepType: 'INTERVAL',
        durationSeconds: Math.max(10, durMin - 15) * 60,
        targetType: 'NONE',
        stepNotes: event.title
      },
      {
        stepType: 'COOLDOWN',
        durationSeconds: 5 * 60,
        targetType: 'NONE',
        stepNotes: 'Retour au calme'
      }
    ];
  }

  // Universal mathematical guarantee: Ensure total duration of steps exactly matches durMin * 60
  const totalCalculatedSec = steps.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const targetTotalSec = durMin * 60;
  if (totalCalculatedSec !== targetTotalSec && steps.length > 0) {
    const diffSec = targetTotalSec - totalCalculatedSec;
    const lastIdx = steps.length - 1;
    steps[lastIdx].durationSeconds = Math.max(60, (steps[lastIdx].durationSeconds || 0) + diffSec);
  }

  // Sanitize all step notes for clean Forerunner 55 watch screen rendering
  const cleanedSteps = steps.map(st => ({
    ...st,
    stepNotes: sanitizeGarminText(st.stepNotes, 48)
  }));

  // Clean title, strip emojis, and cap at 36 characters for Forerunner 55 screen
  const cleanRawTitle = sanitizeGarminText(event.title);
  const prefixedTitle = cleanRawTitle.startsWith('[QMT') ? cleanRawTitle : `[QMT] ${cleanRawTitle}`;
  const finalTitle = sanitizeGarminText(prefixedTitle, 36);

  return {
    title: finalTitle,
    sportType,
    scheduledDate: dateKey,
    description: sanitizeGarminText(`${cleanRawTitle} - ${durMin} min\n${event.description || ''}`, 250),
    steps: cleanedSteps,
    targetWatch
  };
}

/**
 * Pushes an individual workout to Garmin Connect and schedules it on the user's watch calendar.
 */
export async function pushWorkoutToGarmin(
  event: CalendarEvent,
  targetDateStr?: string,
  targetWatch: 'FORERUNNER_55' | 'STANDARD' = 'FORERUNNER_55',
  athleteProfile?: AthletePhysiologicalProfile,
  replaceWorkoutId?: string
): Promise<WorkoutPushResult> {
  try {
    const creds = loadGarminCredentials() || (await loadGarminCredentialsAsync());
    const payload = buildWorkoutPayloadFromEvent(event, targetDateStr, targetWatch, athleteProfile || getStoredAthleteProfile());

    const response = await fetch(getApiUrl('/api/garmin-sync'), {
      method: 'POST',
      headers: await getGarminApiHeaders(),
      body: JSON.stringify({
        email: creds?.email,
        password: creds?.password,
        action: 'push-workout',
        workout: { ...payload, replaceWorkoutId }
      })
    });

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Erreur serveur Garmin (Code HTTP ${response.status}) : ${responseText.slice(0, 160).trim() || 'Réponse non-JSON reçue du serveur'}`
      };
    }

    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || 'Erreur lors de l\'envoi de la séance vers Garmin Connect.'
      };
    }

    return {
      success: true,
      workoutId: data.workoutId,
      workoutName: data.workoutName,
      scheduledDate: data.scheduledDate,
      sportType: data.sportType,
      message: data.message || `Séance programmée avec succès sur Garmin Connect pour le ${payload.scheduledDate} !`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur réseau lors de la communication avec le proxy Garmin.'
    };
  }
}

/**
 * Pushes an entire week of workouts to Garmin Connect in one click.
 */
export async function pushWeekWorkoutsToGarmin(
  events: CalendarEvent[],
  targetWatch: 'FORERUNNER_55' | 'STANDARD' = 'FORERUNNER_55'
): Promise<{ success: boolean; pushedCount: number; results: WorkoutPushResult[]; error?: string }> {
  const sportEvents = events.filter(e => e.category === 'sport' && !e.metadata?.isPostponedPlaceholder);
  if (sportEvents.length === 0) {
    return { success: false, pushedCount: 0, results: [], error: 'Aucune séance sportive trouvée pour cette semaine.' };
  }

  const results: WorkoutPushResult[] = [];
  let pushedCount = 0;

  for (const ev of sportEvents) {
    const dateStr = toLocalDateKey(ev.startDate);
    const res = await pushWorkoutToGarmin(ev, dateStr, targetWatch);
    results.push(res);
    if (res.success) pushedCount++;
  }

  return {
    success: pushedCount > 0,
    pushedCount,
    results
  };
}

/**
 * Fetches the latest wellness data (sleep, HRV, RHR, readiness) from Garmin Connect.
 */
export async function fetchGarminWellness(): Promise<{ success: boolean; wellness?: GarminWellnessData; error?: string }> {
  try {
    const creds = loadGarminCredentials() || (await loadGarminCredentialsAsync());
    const response = await fetch(getApiUrl('/api/garmin-sync'), {
      method: 'POST',
      headers: await getGarminApiHeaders(),
      body: JSON.stringify({
        email: creds?.email,
        password: creds?.password,
        action: 'get-wellness',
        clientDate: formatDateKey(new Date())
      })
    });

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Erreur serveur Garmin (Code HTTP ${response.status}) : ${responseText.slice(0, 160).trim() || 'Réponse non-JSON reçue du serveur'}`
      };
    }

    if (!response.ok || !data?.success || !data?.wellness) {
      return {
        success: false,
        error: data?.error || 'Données bien-être Garmin indisponibles.'
      };
    }

    saveWellnessData(data.wellness);
    return {
      success: true,
      wellness: data.wellness
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur réseau lors de la récupération des données santé Garmin.'
    };
  }
}
