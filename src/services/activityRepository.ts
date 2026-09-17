import { GarminActivity } from '../types/garmin';

function nonEmptyFields(activity: GarminActivity): Partial<GarminActivity> {
  return Object.fromEntries(
    Object.entries(activity).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as Partial<GarminActivity>;
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
      byId.set(activity.activityId, {
        ...nonEmptyFields(existing),
        ...nonEmptyFields(activity)
      } as GarminActivity);
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.startTimeLocal).getTime() - new Date(left.startTimeLocal).getTime()
  );
}
