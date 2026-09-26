import React, { useMemo } from 'react';
import { PeriodizationContext } from '../types/calendar';
import { GarminActivity } from '../types/garmin';
import { QMTPlanOverview } from './QMTPlanOverview';
import { getGarminLocalDateKey, getMondayWeekKey, formatDateKey, addDays, parseLocalDate } from '../services/dateUtils';
import { recentRunBaseline } from '../services/trainingBaseline';

interface PeriodizationTabProps {
  currentContext: PeriodizationContext;
  activities: GarminActivity[];
  referenceDate: Date;
}

export const PeriodizationTab: React.FC<PeriodizationTabProps> = ({
  currentContext,
  activities,
  referenceDate
}) => {
  const strengthSessionsThisWeek = useMemo(() => {
    const monday = getMondayWeekKey(formatDateKey(referenceDate));
    const sunday = formatDateKey(addDays(parseLocalDate(monday), 6));
    const seen = new Set<string>();
    return activities.filter(activity => {
      const date = getGarminLocalDateKey(activity);
      if (date < monday || date > sunday || seen.has(activity.activityId)) return false;
      const strength = activity.activityType === 'STRENGTH_TRAINING' ||
        /calisth|muscu|renfo|traction|gainage|strength/i.test(activity.activityName);
      if (strength) seen.add(activity.activityId);
      return strength;
    }).length;
  }, [activities, referenceDate]);

  const runBaseline = useMemo(() => recentRunBaseline(activities, referenceDate), [activities, referenceDate]);
  const strengthSessionsLast28d = useMemo(() => activities.filter(activity => {
    const endOfDay = new Date(referenceDate);
    endOfDay.setHours(23, 59, 59, 999);
    const age = endOfDay.getTime() - new Date(activity.startTimeLocal).getTime();
    return Number.isFinite(age) && age >= 0 && age <= 28 * 86400_000 &&
      (activity.activityType === 'STRENGTH_TRAINING' ||
        /calisth|muscu|renfo|traction|gainage|strength/i.test(activity.activityName));
  }).length, [activities, referenceDate]);

  return <QMTPlanOverview currentContext={currentContext}
    strengthSessionsThisWeek={strengthSessionsThisWeek} strengthSessionsLast28d={strengthSessionsLast28d} runBaseline={runBaseline} />;
};
