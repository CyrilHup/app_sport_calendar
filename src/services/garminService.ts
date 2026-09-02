import { GarminActivity, GarminSyncState } from '../types/garmin';

const GARMIN_STORAGE_KEY = 'garmin_activities_v1';
const GARMIN_STATE_KEY = 'garmin_sync_state_v1';

export function getSampleGarminActivities(): GarminActivity[] {
  return [
    {
      activityId: "garmin-101",
      activityName: "Autre - Mont-Royal Côte & Escaliers D+",
      activityType: "OTHER",
      startTimeLocal: "2026-09-01T11:15:00",
      durationMinutes: 58,
      distanceKm: 9.4,
      elevationGainM: 395,
      avgHeartRate: 176,
      maxHeartRate: 189,
      avgCadence: 172,
      avgPaceMinKm: "6:10",
      calories: 680,
      aerobicTrainingEffect: 4.2,
      anaerobicTrainingEffect: 2.5,
      source: "SAMPLE_DATA"
    },
    {
      activityId: "garmin-102",
      activityName: "Autre - Calisthénie Haut du Corps - ÉTS Gym",
      activityType: "OTHER",
      startTimeLocal: "2026-09-02T11:45:00",
      durationMinutes: 62,
      avgHeartRate: 118,
      maxHeartRate: 145,
      calories: 390,
      source: "SAMPLE_DATA"
    },
    {
      activityId: "garmin-103",
      activityName: "Autre - Footing V1 Aisance - Parc Maisonneuve",
      activityType: "OTHER",
      startTimeLocal: "2026-09-03T07:30:00",
      durationMinutes: 44,
      distanceKm: 7.8,
      elevationGainM: 45,
      avgHeartRate: 142,
      maxHeartRate: 149,
      avgCadence: 174,
      avgPaceMinKm: "5:38",
      calories: 490,
      aerobicTrainingEffect: 3.1,
      anaerobicTrainingEffect: 0.2,
      source: "SAMPLE_DATA"
    },
    {
      activityId: "garmin-104",
      activityName: "Autre - Handstand & Anneaux - ÉTS Gym",
      activityType: "OTHER",
      startTimeLocal: "2026-09-04T17:15:00",
      durationMinutes: 42,
      avgHeartRate: 112,
      maxHeartRate: 135,
      calories: 270,
      source: "SAMPLE_DATA"
    },
    {
      activityId: "garmin-105",
      activityName: "Autre - Sortie Longue D+ Mont-Royal",
      activityType: "OTHER",
      startTimeLocal: "2026-09-05T08:30:00",
      durationMinutes: 92,
      distanceKm: 15.2,
      elevationGainM: 520,
      avgHeartRate: 151,
      maxHeartRate: 164,
      avgCadence: 168,
      avgPaceMinKm: "6:03",
      calories: 1140,
      aerobicTrainingEffect: 4.5,
      anaerobicTrainingEffect: 1.1,
      source: "SAMPLE_DATA"
    },
    {
      activityId: "garmin-106",
      activityName: "Autre - Footing Régénérant Dimanche",
      activityType: "OTHER",
      startTimeLocal: "2026-09-06T10:00:00",
      durationMinutes: 41,
      distanceKm: 6.9,
      elevationGainM: 30,
      avgHeartRate: 137,
      maxHeartRate: 145,
      avgCadence: 172,
      avgPaceMinKm: "5:56",
      calories: 410,
      source: "SAMPLE_DATA"
    }
  ];
}

export function loadStoredGarminActivities(): GarminActivity[] {
  try {
    const raw = localStorage.getItem(GARMIN_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load garmin activities", e);
  }
  const samples = getSampleGarminActivities();
  saveGarminActivities(samples);
  return samples;
}

export function saveGarminActivities(activities: GarminActivity[]): void {
  try {
    localStorage.setItem(GARMIN_STORAGE_KEY, JSON.stringify(activities));
  } catch (e) {
    console.error("Failed to save garmin activities", e);
  }
}

export function loadGarminSyncState(): GarminSyncState {
  try {
    const raw = localStorage.getItem(GARMIN_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load garmin state", e);
  }
  return {
    connected: true,
    lastSyncTime: new Date().toISOString(),
    accountEmail: "athlete@example.com",
    activitiesCount: 6,
    isSyncing: false,
    mode: "DEMO"
  };
}

export function saveGarminSyncState(state: GarminSyncState): void {
  try {
    localStorage.setItem(GARMIN_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save garmin state", e);
  }
}

/**
 * Simple GPX text parser for dropzone imports
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
  let prevLat: number | null = null;
  let prevLon: number | null = null;
  let prevEle: number | null = null;
  let totalDistanceM = 0;
  let elevationGainM = 0;
  let pointCount = 0;

  while ((match = trkptRegex.exec(gpxText)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const ele = parseFloat(match[3]);

    if (prevLat !== null && prevLon !== null) {
      const dist = haversineDistance(prevLat, prevLon, lat, lon);
      totalDistanceM += dist;
    }

    if (prevEle !== null && ele > prevEle) {
      const diff = ele - prevEle;
      if (diff > 0.5) elevationGainM += diff;
    }

    prevLat = lat;
    prevLon = lon;
    prevEle = ele;
    pointCount++;
  }

  const distanceKm = Math.round((totalDistanceM / 1000) * 10) / 10;
  const durMin = Math.max(30, Math.round(distanceKm * 6)); // estimate 6 min/km if duration not embedded

  return {
    activityId: `gpx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    activityName: name,
    activityType: elevationGainM > 100 ? "TRAIL_RUNNING" : "RUNNING",
    startTimeLocal: startTime,
    durationMinutes: durMin,
    distanceKm: distanceKm || 8.5,
    elevationGainM: Math.round(elevationGainM) || 120,
    avgHeartRate: 154,
    maxHeartRate: 172,
    avgCadence: 170,
    calories: Math.round(durMin * 11),
    source: "GPX_IMPORT"
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
