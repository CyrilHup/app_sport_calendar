import { GarminActivity } from '../types/garmin';

function nonEmptyFields(activity: GarminActivity): Partial<GarminActivity> {
  return Object.fromEntries(
    Object.entries(activity).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as Partial<GarminActivity>;
}

function isStravaElevation(activity?: Partial<GarminActivity>): boolean {
  return activity?.elevationSource === 'STRAVA_CORRECTED' || Boolean(activity?.stravaActivityId);
}

function correctionTime(activity: Partial<GarminActivity>): number {
  const time = Date.parse(activity.elevationUpdatedAt || '');
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function mergeActivity(existing: GarminActivity, incoming: GarminActivity): GarminActivity {
  const merged = {
    ...nonEmptyFields(existing),
    ...nonEmptyFields(incoming)
  } as GarminActivity;

  // Garmin remains the canonical activity source, but a corrected Strava
  // elevation is authoritative for the terrain fields. A later Garmin sync
  // must not silently restore the less useful value.
  const existingHasStravaElevation = isStravaElevation(existing);
  const incomingHasStravaElevation = isStravaElevation(incoming);
  if (existingHasStravaElevation || incomingHasStravaElevation) {
    const keepExisting = existingHasStravaElevation && (
      !incomingHasStravaElevation || correctionTime(existing) > correctionTime(incoming)
    );
    const authoritative = keepExisting ? existing : incoming;
    const other = keepExisting ? incoming : existing;
    merged.elevationGainM = authoritative.elevationGainM ?? other.elevationGainM;
    merged.elevationLossM = authoritative.elevationLossM ?? other.elevationLossM;
    merged.elevationSource = 'STRAVA_CORRECTED';
    merged.elevationUpdatedAt = authoritative.elevationUpdatedAt ?? other.elevationUpdatedAt;
    merged.stravaActivityId = authoritative.stravaActivityId ?? other.stravaActivityId;
  }

  // Preserve the original Garmin values even when a partial response arrives
  // from Garmin Connect after the Strava enrichment.
  merged.garminElevationGainM = merged.source === 'GARMIN_CONNECT'
    ? incoming.garminElevationGainM ?? existing.garminElevationGainM
    : undefined;
  merged.garminElevationLossM = merged.source === 'GARMIN_CONNECT'
    ? incoming.garminElevationLossM ?? existing.garminElevationLossM
    : undefined;
  return merged;
}

/**
 * Deterministic merge used at every Garmin/local/cloud boundary.
 * Sources are ordered oldest to newest. Later non-empty values win conflicts;
 * earlier-only fields are retained instead of being lost to partial responses.
 */
export function mergeGarminActivities(...sources: GarminActivity[][]): GarminActivity[] {
  const byId = new Map<string, GarminActivity>();
  for (const activities of sources) {
    for (const activity of activities || []) {
      if (!activity?.activityId) continue;
      const existing = byId.get(activity.activityId);
      if (!existing) {
        byId.set(activity.activityId, activity);
        continue;
      }
      byId.set(activity.activityId, mergeActivity(existing, activity));
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.startTimeLocal).getTime() - new Date(left.startTimeLocal).getTime()
  );
}
