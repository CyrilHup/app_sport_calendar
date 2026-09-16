import React, { useMemo } from 'react';
import { CalendarEvent, PeriodizationContext } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import { computeFullStatsReport } from '../services/statsEngine';
import { getBaselineRestingHeartRate } from '../services/readinessEngine';
import { QMTPlanOverview } from './QMTPlanOverview';

interface PeriodizationTabProps {
  currentContext: PeriodizationContext;
  activities: GarminActivity[];
  comparisons: ActivityComparison[];
  events: CalendarEvent[];
  referenceDate: Date;
  fcMax: number;
}

export const PeriodizationTab: React.FC<PeriodizationTabProps> = ({
  currentContext,
  activities,
  comparisons,
  events,
  referenceDate,
  fcMax
}) => {
  const prediction = useMemo(() => computeFullStatsReport(
    activities,
    comparisons,
    events,
    'plan',
    referenceDate,
    true,
    { fcMax, fcRest: getBaselineRestingHeartRate() }
  ).qmtPrediction, [activities, comparisons, events, referenceDate, fcMax]);

  return <QMTPlanOverview currentContext={currentContext} qmtPrediction={prediction} />;
};
