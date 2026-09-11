import {
  GarminActivity,
  GarminActivityType,
  GarminSyncState,
  GarminWellnessData,
  GarminWorkoutTargetMode,
  WorkoutPushPayload,
  WorkoutPushResult,
  WorkoutStepDefinition
} from '../types/garmin';
import { CalendarEvent } from '../types/calendar';
import { classifyGarminActivityType } from './activityClassifier';
import { getApiUrl } from './apiConfig';
import { saveWellnessData } from './readinessEngine';
import { setAppConfigOverrides } from './periodizationEngine';
import { formatDateKey, toLocalDateKey } from './dateUtils';


import { Preferences } from '@capacitor/preferences';
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from './storageService';

const GARMIN_STORAGE_KEY = STORAGE_KEYS.GARMIN_ACTIVITIES;
const GARMIN_STATE_KEY = STORAGE_KEYS.GARMIN_STATE;
const GARMIN_CREDS_KEY = STORAGE_KEYS.GARMIN_CREDS;
export const GARMIN_WORKOUT_TARGET_MODE_KEY = 'garmin_workout_target_mode';
export const GARMIN_ATHLETE_BASE_PACE_KEY = 'garmin_athlete_base_pace';

export function getGarminWorkoutTargetMode(): GarminWorkoutTargetMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const mode = localStorage.getItem(GARMIN_WORKOUT_TARGET_MODE_KEY);
      if (mode === 'SMART_PACE_AND_TRAIL_FREE' || mode === 'ALL_FREE' || mode === 'PACE_ONLY' || mode === 'HR_ONLY') {
        return mode as GarminWorkoutTargetMode;
      }
    }
  } catch {}
  return 'SMART_PACE_AND_TRAIL_FREE';
}

export function setGarminWorkoutTargetMode(mode: GarminWorkoutTargetMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GARMIN_WORKOUT_TARGET_MODE_KEY, mode);
    }
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
export function computeDynamicAthleteBasePace(activities?: GarminActivity[]): string {
  const acts = activities || loadStoredGarminActivities();
  const runActs = acts.filter(a => {
    if (a.activityType !== 'RUNNING') return false;
    if (!a.distanceKm || a.distanceKm < 1.5) return false;
    if (!a.avgPaceMinKm) return false;
    // Exclude heavy trail/hill repeats that distort flat aerobic baseline
    const density = (a.elevationGainM || 0) / (a.distanceKm || 1);
    return density < 35;
  });

  if (runActs.length === 0) {
    return '6:05'; // Realistic initial seed
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

  return '6:05';
}

export function isAthleteBasePaceAuto(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const pace = localStorage.getItem(GARMIN_ATHLETE_BASE_PACE_KEY);
      return !pace || pace === 'AUTO';
    }
  } catch {}
  return true;
}

export function getAthleteBasePace(): string {
  return computeDynamicAthleteBasePace();
}

export function setAthleteBasePace(pace: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GARMIN_ATHLETE_BASE_PACE_KEY, pace);
    }
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
 * Saves Garmin credentials in local storage and native preferences.
 */
export function saveGarminCredentials(creds: GarminCredentials): void {
  const jsonStr = JSON.stringify(creds);
  try {
    localStorage.setItem(GARMIN_CREDS_KEY, jsonStr);
  } catch (e) {
    console.error("Failed to save garmin credentials to localStorage", e);
  }
  // Native Preferences (Android SharedPreferences)
  try {
    Preferences.set({ key: GARMIN_CREDS_KEY, value: jsonStr }).catch(() => {});
  } catch {}
}

/**
 * Loads saved Garmin credentials from local storage.
 */
export function loadGarminCredentials(): GarminCredentials | null {
  try {
    const raw = localStorage.getItem(GARMIN_CREDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Asynchronously loads Garmin credentials, checking native Preferences as fallback.
 */
export async function loadGarminCredentialsAsync(): Promise<GarminCredentials | null> {
  const existing = loadGarminCredentials();
  if (existing) return existing;
  try {
    const { value } = await Preferences.get({ key: GARMIN_CREDS_KEY });
    if (value) {
      const parsed = JSON.parse(value);
      if (parsed?.email) {
        saveGarminCredentials(parsed);
        return parsed;
      }
    }
  } catch {}
  return null;
}

/**
 * Clears saved Garmin credentials across storage layers.
 */
export function clearGarminCredentials(): void {
  try {
    localStorage.removeItem(GARMIN_CREDS_KEY);
  } catch {}
  try {
    Preferences.remove({ key: GARMIN_CREDS_KEY }).catch(() => {});
  } catch {}
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
    activityType: type
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
  try {
    const credsToUse = (credentials?.email && credentials?.password)
      ? credentials
      : (loadGarminCredentials() || await loadGarminCredentialsAsync() || credentials);

    const syncMode = options?.mode || 'incremental';

    const response = await fetch(getApiUrl('/api/garmin-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(credsToUse || {}),
        syncMode,
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
        activities: [],
        count: 0,
        error: `Erreur serveur Garmin (Code HTTP ${response.status}) : ${responseText.slice(0, 160).trim() || 'Réponse non-JSON reçue du serveur'}`
      };
    }

    if (!response.ok || !data?.success) {
      return {
        success: false,
        activities: [],
        count: 0,
        error: data?.error || 'Échec de l\'authentification ou de la récupération des activités Garmin Connect.'
      };
    }

    const rawActivities: GarminActivity[] = data.activities || [];
    const freshActivities: GarminActivity[] = rawActivities.map(normalizeGarminActivity);

    // Merge incoming activities with existing stored activities so past history is preserved
    const existingActivities = loadStoredGarminActivities();
    const activityMap = new Map<string, GarminActivity>();
    for (const act of existingActivities) {
      activityMap.set(act.activityId, act);
    }
    for (const act of freshActivities) {
      activityMap.set(act.activityId, act);
    }
    const combinedActivities = Array.from(activityMap.values()).sort(
      (a, b) => new Date(b.startTimeLocal).getTime() - new Date(a.startTimeLocal).getTime()
    );

    saveGarminActivities(combinedActivities);

    // If wellness data is returned, persist it immediately
    if (data.wellness) {
      saveWellnessData(data.wellness);
    }

    // If athleteMaxHr is detected from Garmin userSettings or recorded peak HR
    if (typeof data.athleteMaxHr === 'number' && data.athleteMaxHr > 140) {
      setAppConfigOverrides({ fcMax: data.athleteMaxHr });
      try {
        localStorage.setItem('athlete_fc_max', String(data.athleteMaxHr));
      } catch {}
    }

    // Persist credentials locally so future reloads and "Synchro Directe" work automatically
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
      athleteMaxHr: data.athleteMaxHr,
      syncMode: data.syncMode || syncMode
    };
  } catch (err: any) {
    return {
      success: false,
      activities: [],
      count: 0,
      error: err.message || 'Network error while connecting to Garmin API proxy.'
    };
  }
}

/**
 * GPX text parser for manual watch exports
 */
export function parseGPXString(gpxText: string, fileName: string): GarminActivity {
  // Extract name
  const nameMatch = gpxText.match(/<name>([^<]+)<\/name>/i);
  const name = nameMatch ? nameMatch[1].trim() : fileName.replace(/\.[^/.]+$/, "");

  // Extract time
  const timeMatch = gpxText.match(/<time>([^<]+)<\/time>/i);
  const startTime = timeMatch ? new Date(timeMatch[1]).toISOString() : new Date().toISOString();

  // Extract trackpoints and compute distance & elevation gain
  const trkptRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>(?:[\s\S]*?<time>([^<]+)<\/time>)?[\s\S]*?<\/trkpt>/gi;
  let match;
  let totalDistM = 0;
  let totalEleGainM = 0;
  let prevLat: number | null = null;
  let prevLon: number | null = null;
  let prevEle: number | null = null;
  let firstTime: Date | null = null;
  let lastTime: Date | null = null;

  while ((match = trkptRegex.exec(gpxText)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const ele = parseFloat(match[3]);
    const timeStr = match[4];

    if (timeStr) {
      const t = new Date(timeStr);
      if (!firstTime) firstTime = t;
      lastTime = t;
    }

    if (prevLat !== null && prevLon !== null) {
      totalDistM += haversineDistance(prevLat, prevLon, lat, lon);
    }
    if (prevEle !== null && ele > prevEle) {
      totalEleGainM += ele - prevEle;
    }

    prevLat = lat;
    prevLon = lon;
    prevEle = ele;
  }

  let durationMin = 45;
  if (firstTime && lastTime) {
    durationMin = Math.max(1, Math.round((lastTime.getTime() - firstTime.getTime()) / 60000));
  }

  const distKm = parseFloat((totalDistM / 1000).toFixed(2));
  const eleGain = Math.round(totalEleGainM);

  // Infer sport type from activity name or elevation
  let inferredType: GarminActivityType = 'TRAIL_RUNNING';
  if (name.toLowerCase().includes('stairs') || name.toLowerCase().includes('escalier')) {
    inferredType = 'OTHER';
  } else if (name.toLowerCase().includes('gym') || name.toLowerCase().includes('calisth')) {
    inferredType = 'STRENGTH_TRAINING';
  } else if (eleGain < 50 && distKm > 3) {
    inferredType = 'RUNNING';
  }

  return {
    activityId: `gpx-${Date.now()}`,
    activityName: name,
    activityType: inferredType,
    startTimeLocal: startTime,
    durationMinutes: durationMin,
    distanceKm: distKm > 0 ? distKm : undefined,
    elevationGainM: eleGain > 0 ? eleGain : undefined,
    calories: Math.round(durationMin * 8.5),
    source: 'GPX_IMPORT'
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Strips emojis, pictographs, and incompatible special symbols for Garmin watch displays (e.g. Forerunner 55).
 * Normalizes punctuation and limits string length if specified.
 */
export function sanitizeGarminText(text?: string | null, maxLength?: number): string {
  if (!text) return '';
  let cleaned = text
    // 1. Normalize special symbols and arrows FIRST before dingbats emoji range
    .replace(/[➔➜➝➞]/g, '->')
    .replace(/[•●▪]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    // 2. Strip emojis, pictographs, and remaining dingbats
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    // 3. Collapse consecutive whitespaces and trim
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim();
  }
  return cleaned;
}

/**
 * Constructs a structured Garmin workout payload from a planned CalendarEvent.
 * Calibrated specifically for Garmin Forerunner 55 compatibility (clean text, no emojis, concise notes).
 */
export function buildWorkoutPayloadFromEvent(
  event: CalendarEvent,
  targetDateStr?: string,
  targetWatch: 'FORERUNNER_55' | 'STANDARD' = 'FORERUNNER_55'
): WorkoutPushPayload {
  const dateKey = targetDateStr || toLocalDateKey(event.startDate);
  const durMin = event.durationMinutes || 45;
  const isFR55 = targetWatch === 'FORERUNNER_55';
  const targetMode = getGarminWorkoutTargetMode();
  const basePaceStr = getAthleteBasePace();
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
          targetPaceMarginSeconds: 20,
          stepNotes: `Échauffement trot souple (${paceWarmLow} - ${paceWarmHigh}/km)`
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'PACE',
          targetPaceLowMinKm: paceMainLow,
          targetPaceHighMinKm: paceMainHigh,
          targetPaceMinKm: basePaceStr,
          targetPaceMarginSeconds: 18,
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
      // Mode Fréquence Cardiaque classique
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: 125,
          targetHrHigh: 140,
          stepNotes: 'Échauffement progressif très doux (Zone 1/2)'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: 130,
          targetHrHigh: 142,
          stepNotes: 'Footing souple et régulier sur terrain plat (Zone 1/2 stricte < 142 bpm)'
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

    // Standard rep = 60s montée tonique + 90s descente trot très souple = 150s (2.5 min)
    if (hillBlockSec >= 1200) {
      // 2 séries de côtes avec pause inter-séries
      // Série 1: 4 répétitions (4 * 150s = 600s = 10 min)
      for (let i = 1; i <= 4; i++) {
        hillSteps.push({
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
          targetHrLow: isTargetFree ? undefined : 172,
          targetHrHigh: isTargetFree ? undefined : 190,
          stepNotes: `Série 1 - Côte ${i}/4 (effort tonique RPE 8/10)`
        });
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: 90,
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

      // Série 2: 4 répétitions (4 * 150s = 600s = 10 min)
      for (let i = 1; i <= 4; i++) {
        hillSteps.push({
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
          targetHrLow: isTargetFree ? undefined : 172,
          targetHrHigh: isTargetFree ? undefined : 190,
          stepNotes: `Série 2 - Côte ${i}/4 (effort tonique RPE 8/10)`
        });
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: i < 4 ? 'Descente trot très souple ou marche' : 'Descente finale souple'
        });
      }

      // Remainder of hill block (e.g. 1500 - 600 - 180 - 600 = 120s / 2 min) added as transition trot
      const allocatedHillSec = 600 + 180 + 600;
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
          durationSeconds: 60,
          targetType: isTargetFree ? 'NONE' : 'HR_RANGE',
          targetHrLow: isTargetFree ? undefined : 172,
          targetHrHigh: isTargetFree ? undefined : 190,
          stepNotes: `Côte ${i}/${numReps} (effort tonique RPE 8/10)`
        });
        hillSteps.push({
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: 'Descente marchée très souple'
        });
      }
      const allocatedHillSec = numReps * 150;
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
      const targetHrHigh = event.metadata?.targetHeartRateRange?.[1] || 155;
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: warmupDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: 135,
          targetHrHigh: targetHrHigh,
          stepNotes: 'Échauffement progressif sur sentier (Zone 1/2)'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: mainDurSec,
          targetType: 'HR_RANGE',
          targetHrLow: 135,
          targetHrHigh: targetHrHigh,
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
  targetWatch: 'FORERUNNER_55' | 'STANDARD' = 'FORERUNNER_55'
): Promise<WorkoutPushResult> {
  try {
    const creds = loadGarminCredentials() || (await loadGarminCredentialsAsync());
    const payload = buildWorkoutPayloadFromEvent(event, targetDateStr, targetWatch);

    const response = await fetch(getApiUrl('/api/garmin-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: creds?.email,
        password: creds?.password,
        action: 'push-workout',
        workout: payload
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
      headers: { 'Content-Type': 'application/json' },
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

/**
 * Nettoie les entraînements en double sur Garmin Connect (anciennes versions avec émojis ou doublons de synchronisation).
 */
export async function cleanDuplicateGarminWorkouts(): Promise<{
  success: boolean;
  deletedCount: number;
  deletedNames?: string[];
  message: string;
  error?: string;
}> {
  try {
    const creds = loadGarminCredentials() || (await loadGarminCredentialsAsync());
    const response = await fetch(getApiUrl('/api/garmin-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: creds?.email,
        password: creds?.password,
        action: 'clean-duplicates'
      })
    });

    let data: any;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        deletedCount: 0,
        message: 'Réponse non-JSON reçue du serveur.',
        error: `Code HTTP ${response.status}`
      };
    }

    if (!response.ok || !data?.success) {
      return {
        success: false,
        deletedCount: 0,
        message: data?.error || 'Erreur lors du nettoyage des doublons Garmin.',
        error: data?.error
      };
    }

    return {
      success: true,
      deletedCount: data.deletedCount || 0,
      deletedNames: data.deletedNames || [],
      message: data.message || `${data.deletedCount || 0} doublons supprimés.`
    };
  } catch (err: any) {
    return {
      success: false,
      deletedCount: 0,
      message: err?.message || 'Erreur réseau lors du nettoyage des doublons Garmin.',
      error: err?.message
    };
  }
}


