import { GarminActivity } from '../types/garmin';

function nonEmptyFields(activity: GarminActivity): Partial<GarminActivity> {
  return Object.fromEntries(
    Object.entries(activity).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as Partial<GarminActivity>;
}

type LegacyElevation = GarminActivity & {
  garminElevationGainM?: number;
  garminElevationLossM?: number;
  elevationUpdatedAt?: string;
  stravaActivityId?: string;
};

/** Removes retired elevation metadata and restores original Garmin values when available. */
export function normalizeActivityElevation(activity: GarminActivity): GarminActivity {
  const legacy = activity as LegacyElevation;
  const {
    garminElevationGainM,
    garminElevationLossM,
    elevationUpdatedAt: _elevationUpdatedAt,
    stravaActivityId: _stravaActivityId,
    ...clean
  } = legacy;
  const wasCorrected = (activity as { elevationSource?: string }).elevationSource === 'STRAVA_CORRECTED';
  if (!wasCorrected) return clean;
  return {
    ...clean,
    elevationGainM: garminElevationGainM ?? clean.elevationGainM,
    elevationLossM: garminElevationLossM ?? clean.elevationLossM,
    elevationSource: activity.source === 'GPX_IMPORT' ? 'GPX_IMPORT' : 'GARMIN_CONNECT'
  };
}

function mergeActivity(existing: GarminActivity, incoming: GarminActivity): GarminActivity {
  return {
    ...nonEmptyFields(existing),
    ...nonEmptyFields(incoming)
  } as GarminActivity;
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
      const normalized = normalizeActivityElevation(activity);
      const existing = byId.get(activity.activityId);
      if (!existing) {
        byId.set(activity.activityId, normalized);
        continue;
      }
      byId.set(activity.activityId, mergeActivity(existing, normalized));
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.startTimeLocal).getTime() - new Date(left.startTimeLocal).getTime()
  );
}
