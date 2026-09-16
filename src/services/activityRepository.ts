import { GarminActivity } from '../types/garmin';

function completenessScore(activity: GarminActivity): number {
  return Object.values(activity).reduce((score, value) => (
    value !== undefined && value !== null && value !== '' ? score + 1 : score
  ), 0);
}

/**
 * Deterministic merge used at every Garmin/local/cloud boundary.
 * The richer record wins; the later source wins ties (normally the freshest source).
 */
export function mergeGarminActivities(...sources: GarminActivity[][]): GarminActivity[] {
  const byId = new Map<string, GarminActivity>();
  for (const activities of sources) {
    for (const activity of activities || []) {
      if (!activity?.activityId) continue;
      const existing = byId.get(activity.activityId);
      if (!existing || completenessScore(activity) >= completenessScore(existing)) {
        byId.set(activity.activityId, activity);
      }
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.startTimeLocal).getTime() - new Date(left.startTimeLocal).getTime()
  );
}
