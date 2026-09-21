import { getApiUrl } from './apiConfig';
import { GarminActivity } from '../types/garmin';

export interface StravaStatus {
  success: boolean;
  connected: boolean;
  athleteName?: string;
  lastSyncAt?: string;
  scope?: string;
  error?: string;
}

export interface StravaElevationEnrichment {
  activityId: string;
  stravaActivityId: string;
  elevationGainM?: number;
  elevationLossM?: number;
  elevationSource: 'STRAVA_CORRECTED';
  elevationUpdatedAt: string;
  matchScore: number;
}

export interface StravaElevationSyncResult {
  success: boolean;
  connected: boolean;
  athleteName?: string;
  matchedCount: number;
  enrichedCount: number;
  unmatchedCount?: number;
  lastSyncAt?: string;
  enrichments: StravaElevationEnrichment[];
  error?: string;
}

async function authenticatedHeaders(): Promise<Record<string, string>> {
  // Keep Supabase initialization out of pure elevation-enrichment imports and
  // load it only when a network request is actually made.
  const { getSupabaseAccessToken } = await import('./supabaseClient');
  const token = await getSupabaseAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function readResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text.slice(0, 200) };
  }
}

export async function getStravaStatus(): Promise<StravaStatus> {
  try {
    const response = await fetch(getApiUrl('/api/strava-sync?action=status'), {
      headers: await authenticatedHeaders()
    });
    const data = await readResponse(response);
    if (!response.ok || !data?.success) {
      return {
        success: false,
        connected: false,
        error: data?.error || `Erreur Strava HTTP ${response.status}`
      };
    }
    return data as StravaStatus;
  } catch (error) {
    return {
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Impossible de lire le statut Strava.'
    };
  }
}

export async function getStravaAuthorizationUrl(): Promise<{ success: boolean; authorizationUrl?: string; error?: string }> {
  try {
    const response = await fetch(getApiUrl('/api/strava-sync?action=authorize'), {
      headers: await authenticatedHeaders()
    });
    const data = await readResponse(response);
    if (!response.ok || !data?.success || !data.authorizationUrl) {
      return { success: false, error: data?.error || `Erreur OAuth Strava HTTP ${response.status}` };
    }
    return { success: true, authorizationUrl: data.authorizationUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Connexion Strava impossible.' };
  }
}

export async function disconnectStrava(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(getApiUrl('/api/strava-sync?action=disconnect'), {
      method: 'POST',
      headers: await authenticatedHeaders(),
      body: JSON.stringify({})
    });
    const data = await readResponse(response);
    return response.ok && Boolean(data?.success)
      ? { success: true }
      : { success: false, error: data?.error || `Erreur de dissociation Strava HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Dissociation Strava impossible.' };
  }
}

export async function syncStravaElevation(activities: GarminActivity[]): Promise<StravaElevationSyncResult> {
  const candidates = activities
    .filter(activity => activity.source === 'GARMIN_CONNECT' && (
      activity.activityType === 'RUNNING' || activity.activityType === 'TRAIL_RUNNING'
    ))
    .map(activity => ({
      activityId: activity.activityId,
      startTimeLocal: activity.startTimeLocal,
      durationMinutes: activity.durationMinutes,
      distanceKm: activity.distanceKm,
      activityType: activity.activityType
    }));

  try {
    const response = await fetch(getApiUrl('/api/strava-sync?action=sync'), {
      method: 'POST',
      headers: await authenticatedHeaders(),
      body: JSON.stringify({ activities: candidates })
    });
    const data = await readResponse(response);
    if (!response.ok || !data?.success) {
      return {
        success: false,
        connected: Boolean(data?.connected),
        matchedCount: 0,
        enrichedCount: 0,
        enrichments: [],
        error: data?.error || `Erreur de synchronisation Strava HTTP ${response.status}`
      };
    }
    return data as StravaElevationSyncResult;
  } catch (error) {
    return {
      success: false,
      connected: false,
      matchedCount: 0,
      enrichedCount: 0,
      enrichments: [],
      error: error instanceof Error ? error.message : 'Synchronisation Strava impossible.'
    };
  }
}

/** Applies only terrain fields; Garmin identity and physiological telemetry remain untouched. */
export function applyStravaElevationEnrichments(
  activities: GarminActivity[],
  enrichments: StravaElevationEnrichment[]
): GarminActivity[] {
  const byActivityId = new Map(enrichments.map(enrichment => [enrichment.activityId, enrichment]));
  return activities.map(activity => {
    const enrichment = byActivityId.get(activity.activityId);
    if (!enrichment) return activity;

    const originalGarminElevation = activity.elevationSource === 'STRAVA_CORRECTED'
      ? activity.garminElevationGainM
      : (activity.garminElevationGainM ?? activity.elevationGainM);
    const originalGarminLoss = activity.elevationSource === 'STRAVA_CORRECTED'
      ? activity.garminElevationLossM
      : (activity.garminElevationLossM ?? activity.elevationLossM);

    return {
      ...activity,
      elevationGainM: enrichment.elevationGainM ?? activity.elevationGainM,
      elevationLossM: enrichment.elevationLossM ?? activity.elevationLossM,
      garminElevationGainM: originalGarminElevation,
      garminElevationLossM: originalGarminLoss,
      elevationSource: 'STRAVA_CORRECTED',
      elevationUpdatedAt: enrichment.elevationUpdatedAt,
      stravaActivityId: enrichment.stravaActivityId
    };
  });
}
