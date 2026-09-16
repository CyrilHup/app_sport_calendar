import { ActivityComparison, GarminActivity } from '../types/garmin';
import { getGarminLocalDateKey } from './dateUtils';

export interface DayActivityContext {
  comparisons: ActivityComparison[];
  activities: GarminActivity[];
  isPlannedSessionCompleted: boolean;
}

/** Pure, shared projection of the canonical activity/comparison state for one day. */
export function selectDayActivityContext(
  dateKey: string,
  activities: GarminActivity[],
  comparisons: ActivityComparison[]
): DayActivityContext {
  const dayComparisons = comparisons.filter(comparison => comparison.date === dateKey);
  const activityById = new Map<string, GarminActivity>();

  for (const activity of activities) {
    if (getGarminLocalDateKey(activity) === dateKey) {
      activityById.set(activity.activityId, activity);
    }
  }
  for (const comparison of dayComparisons) {
    const activity = comparison.actualActivity;
    if (activity) activityById.set(activity.activityId, activity);
  }

  return {
    comparisons: dayComparisons,
    activities: Array.from(activityById.values()),
    isPlannedSessionCompleted: dayComparisons.some(
      comparison =>
        (comparison.status === 'COMPLIANT' || comparison.status === 'PARTIAL') &&
        comparison.plannedEvent?.category === 'sport'
    )
  };
}
