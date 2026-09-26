import { GarminActivity } from '../types/garmin';

export function recentRunBaseline(activities: GarminActivity[], asOf: Date): {
  runCount28d: number;
  longestRunMinutes30d?: number;
  runKm28d: number;
} {
  const endOfDay = new Date(asOf);
  endOfDay.setHours(23, 59, 59, 999);
  const now = endOfDay.getTime();
  const runs = activities.filter(activity =>
    (activity.activityType === 'RUNNING' || activity.activityType === 'TRAIL_RUNNING') &&
    Number.isFinite(Date.parse(activity.startTimeLocal)) &&
    now - Date.parse(activity.startTimeLocal) >= 0 &&
    now - Date.parse(activity.startTimeLocal) <= 30 * 86400_000);
  const last28 = runs.filter(activity => now - Date.parse(activity.startTimeLocal) <= 28 * 86400_000);
  return {
    runCount28d: last28.length,
    longestRunMinutes30d: runs.length ? Math.max(...runs.map(activity => activity.durationMinutes)) : undefined,
    runKm28d: Math.round(last28.reduce((sum, activity) => sum + (activity.distanceKm || 0), 0) * 10) / 10
  };
}

/** Provisional time guard, recalculated only when actual long-run history advances. */
export function capLongRunToRecentHistory(plannedMinutes: number, baseline: ReturnType<typeof recentRunBaseline>): number {
  if (baseline.runCount28d < 4) {
    return Math.min(plannedMinutes, 60,
      baseline.longestRunMinutes30d ? Math.max(20, Math.round(baseline.longestRunMinutes30d * 1.15)) : 60);
  }
  if (!baseline.longestRunMinutes30d) return Math.min(plannedMinutes, 60);
  return Math.min(plannedMinutes, Math.max(20, Math.round(baseline.longestRunMinutes30d * 1.15)));
}
