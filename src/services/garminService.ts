import {
  GarminActivity,
  GarminActivityType,
  GarminSyncState,
  GarminWellnessData,
  WorkoutPushPayload,
  WorkoutPushResult,
  WorkoutStepDefinition
} from '../types/garmin';
import { CalendarEvent } from '../types/calendar';
import { classifyGarminActivityType } from './activityClassifier';
import { getApiUrl } from './apiConfig';
import { saveWellnessData } from './readinessEngine';
import { setAppConfigOverrides } from './periodizationEngine';
import { formatDateKey } from './dateUtils';


import { Preferences } from '@capacitor/preferences';
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from './storageService';

const GARMIN_STORAGE_KEY = 'garmin_activities_synced';
const GARMIN_STATE_KEY = 'garmin_sync_state';
const GARMIN_CREDS_KEY = 'garmin_credentials';

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
  // Purge any legacy plaintext cookie
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${encodeURIComponent(GARMIN_CREDS_KEY)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
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
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${encodeURIComponent(GARMIN_CREDS_KEY)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
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
export async function syncWithGarminAPI(credentials?: {
  email?: string;
  password?: string;
}): Promise<{ success: boolean; activities: GarminActivity[]; count: number; athleteMaxHr?: number; error?: string }> {
  try {
    const credsToUse = (credentials?.email && credentials?.password)
      ? credentials
      : (loadGarminCredentials() || await loadGarminCredentialsAsync() || credentials);

    const response = await fetch(getApiUrl('/api/garmin-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(credsToUse || {}),
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
    const activities: GarminActivity[] = rawActivities.map(normalizeGarminActivity);
    saveGarminActivities(activities);

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
      activitiesCount: activities.length,
      isSyncing: false
    };
    saveGarminSyncState(newState);

    return {
      success: true,
      activities,
      count: activities.length,
      athleteMaxHr: data.athleteMaxHr
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
  const dateKey = targetDateStr || event.startDate.slice(0, 10);
  const durMin = event.durationMinutes || 45;
  const isFR55 = targetWatch === 'FORERUNNER_55';

  let sportType: WorkoutPushPayload['sportType'] = 'RUNNING';
  let steps: WorkoutStepDefinition[] = [];
  const titlePrefix = '[QMT-80] ';

  const titleLower = event.title.toLowerCase();
  const isAdaptedToEasy = event.metadata?.isAdapted && (
    event.sportType === 'RUN_EASY' ||
    titleLower.includes('footing') ||
    titleLower.includes('récupération') ||
    titleLower.includes('aérobie doux')
  );

  if (isAdaptedToEasy || event.sportType === 'RUN_EASY') {
    sportType = 'RUNNING';
    const warmupDurSec = durMin <= 35 ? 7 * 60 : 10 * 60;
    const cooldownDurSec = 5 * 60;
    const mainDurSec = Math.max(10 * 60, durMin * 60 - warmupDurSec - cooldownDurSec);
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
  } else if (event.sportType === 'TRAIL_INTENSE') {
    // Hill Repeats
    sportType = 'RUNNING';
    const isModerate = event.title.includes('1 série') || durMin <= 50;

    if (isModerate) {
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: 12 * 60,
          targetType: 'HR_RANGE',
          targetHrLow: 135,
          targetHrHigh: 150,
          stepNotes: 'Échauffement progressif Zone 2'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 165,
          targetHrHigh: 175,
          stepNotes: 'Côte modérée contrôlée (FC < 175 bpm)'
        },
        {
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: 'Descente marchée très souple'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 165,
          targetHrHigh: 175,
          stepNotes: 'Côte modérée (FC < 175 bpm)'
        },
        {
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: 'Descente marchée souple'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 165,
          targetHrHigh: 175,
          stepNotes: 'Dernière répétition souple'
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: 8 * 60,
          targetType: 'NONE',
          stepNotes: 'Retour au calme & trot très lent'
        }
      ];
    } else {
      steps = [
        {
          stepType: 'WARMUP',
          durationSeconds: 15 * 60,
          targetType: 'HR_RANGE',
          targetHrLow: 135,
          targetHrHigh: 150,
          stepNotes: 'Échauffement progressif Zone 2'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 172,
          targetHrHigh: 190,
          stepNotes: 'Répétition côte raide (Zone 4/5)'
        },
        {
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: 'Descente trot très souple ou marche'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 172,
          targetHrHigh: 190,
          stepNotes: 'Répétition côte raide (Zone 4/5)'
        },
        {
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: 'Descente trot très souple'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 172,
          targetHrHigh: 190,
          stepNotes: 'Répétition côte raide (Zone 4/5)'
        },
        {
          stepType: 'RECOVERY',
          durationSeconds: 90,
          targetType: 'NONE',
          stepNotes: 'Descente trot souple'
        },
        {
          stepType: 'INTERVAL',
          durationSeconds: 60,
          targetType: 'HR_RANGE',
          targetHrLow: 172,
          targetHrHigh: 190,
          stepNotes: 'Dernière montée tonique !'
        },
        {
          stepType: 'COOLDOWN',
          durationSeconds: 10 * 60,
          targetType: 'NONE',
          stepNotes: 'Retour au calme & décrassage'
        }
      ];
    }
  } else if (event.sportType === 'TRAIL_LONG') {
    sportType = 'RUNNING';
    const mainDurSec = Math.max(20 * 60, (durMin - 20) * 60);
    const isAdapted = Boolean(event.metadata?.isAdapted);
    const targetHrHigh = event.metadata?.targetHeartRateRange?.[1] || 155;
    steps = [
      {
        stepType: 'WARMUP',
        durationSeconds: 15 * 60,
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
        durationSeconds: 5 * 60,
        targetType: 'NONE',
        stepNotes: 'Marche active et retour au calme'
      }
    ];
  } else if (event.sportType === 'CALISTHENICS' || event.sportType === 'GYM_FORCE' || event.sportType === 'MOBILITY') {
    // Forerunner 55 optimized: uses CARDIO so FR55 watch can run it natively with intervals & vibration
    sportType = isFR55 ? 'CARDIO' : 'STRENGTH';
    steps = [
      {
        stepType: 'INTERVAL',
        durationSeconds: durMin * 60,
        stepNotes: 'Entraînement Calisthénie libre au poids du corps'
      }
    ];
  } else {
    sportType = 'CARDIO';
    steps = [
      {
        stepType: 'WARMUP',
        durationSeconds: 10 * 60,
        stepNotes: 'Échauffement libre'
      },
      {
        stepType: 'INTERVAL',
        durationSeconds: Math.max(10, durMin - 15) * 60,
        stepNotes: event.title
      },
      {
        stepType: 'COOLDOWN',
        durationSeconds: 5 * 60,
        stepNotes: 'Retour au calme'
      }
    ];
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
    const dateStr = ev.startDate.slice(0, 10);
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


