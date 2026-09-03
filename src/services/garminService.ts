import { GarminActivity, GarminActivityType, GarminSyncState } from '../types/garmin';

const GARMIN_STORAGE_KEY = 'garmin_activities_synced';
const GARMIN_STATE_KEY = 'garmin_sync_state';

/**
 * Loads real synchronized Garmin activities from persistent local storage.
 * Returns an EMPTY array if no activities have been synchronized yet (NO hardcoded mock data).
 */
export function loadStoredGarminActivities(): GarminActivity[] {
  try {
    // Purge any legacy mock storage keys
    localStorage.removeItem('garmin_activities_v1');
    localStorage.removeItem('garmin_sync_state_v1');
    localStorage.removeItem('garmin_activities_v2');
    localStorage.removeItem('garmin_sync_state_v2');
    localStorage.removeItem('garmin_activities_v3');
    localStorage.removeItem('garmin_sync_state_v3');

    const raw = localStorage.getItem(GARMIN_STORAGE_KEY);
    if (raw) {
      const parsed: GarminActivity[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load stored garmin activities", e);
  }
  return [];
}

/**
 * Persists synchronized Garmin activities.
 */
export function saveGarminActivities(activities: GarminActivity[]): void {
  try {
    localStorage.setItem(GARMIN_STORAGE_KEY, JSON.stringify(activities));
  } catch (e) {
    console.error("Failed to save garmin activities", e);
  }
}

/**
 * Loads Garmin connection state.
 */
export function loadGarminSyncState(): GarminSyncState {
  try {
    const raw = localStorage.getItem(GARMIN_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load garmin state", e);
  }
  return {
    connected: false,
    lastSyncTime: undefined,
    accountEmail: undefined,
    activitiesCount: 0,
    isSyncing: false,
    mode: "LIVE"
  };
}

/**
 * Saves Garmin connection state.
 */
export function saveGarminSyncState(state: GarminSyncState): void {
  try {
    localStorage.setItem(GARMIN_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save garmin state", e);
  }
}

/**
 * Calls the backend /api/garmin-sync endpoint to authenticate with Garmin Connect
 * and retrieve actual logged activities via the Garmin API.
 */
export async function syncWithGarminAPI(credentials?: {
  email?: string;
  password?: string;
}): Promise<{ success: boolean; activities: GarminActivity[]; count: number; error?: string }> {
  try {
    const response = await fetch('/api/garmin-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials || {})
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        activities: [],
        count: 0,
        error: data.error || 'Failed to authenticate and fetch activities from Garmin Connect.'
      };
    }

    const activities: GarminActivity[] = data.activities || [];
    saveGarminActivities(activities);

    const newState: GarminSyncState = {
      connected: true,
      lastSyncTime: new Date().toISOString(),
      accountEmail: credentials?.email || "Synced Account",
      activitiesCount: activities.length,
      isSyncing: false,
      mode: "LIVE"
    };
    saveGarminSyncState(newState);

    return {
      success: true,
      activities,
      count: activities.length
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
