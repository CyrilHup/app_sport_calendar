import { AdaptiveWorkoutAction, CalendarEvent, SportType } from '../types/calendar';
import { GarminActivity } from '../types/garmin';
import { ReadinessEvaluation } from './readinessEngine';
import { computeTrainingLoadStats } from './loadEngine';
import { evaluateAdaptivePlanStatus } from './adaptivePlanEngine';
import { addDays, formatDateKey, parseLocalDate, toLocalDateKey } from './dateUtils';
import { recentSubjectiveSignals } from './activityFeedback';

type ProjectedActivity = {
  date: string;
  durationMinutes: number;
  type?: SportType;
  name: string;
  elevationGainM: number;
};

function nominalEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    title: event.metadata?.originalTitle ?? event.title,
    durationMinutes: event.metadata?.originalDurationMinutes ?? event.durationMinutes,
    sportType: event.metadata?.originalSportType ?? event.sportType,
    metadata: {
      ...event.metadata,
      targetElevationM: event.metadata?.originalElevationM ?? event.metadata?.targetElevationM
    }
  };
}

function projectedActivity(event: CalendarEvent, action?: AdaptiveWorkoutAction): ProjectedActivity {
  return {
    date: toLocalDateKey(event.startDate),
    durationMinutes: action?.adaptedDurationMinutes ?? event.durationMinutes,
    type: action?.adaptedSportType ?? event.sportType,
    name: action?.adaptedTitle ?? event.title,
    elevationGainM: action?.adaptedElevationM ?? event.metadata?.targetElevationM ?? 0
  };
}

/**
 * One planning pass for the current week. Each session is evaluated against
 * the rolling load *after* its proposed execution. Previous projected sessions
 * then contribute at their adapted load, while old real sessions leave the
 * 7/28-day windows naturally as the date advances.
 */
export function projectWeeklyAdaptivePlan(
  activities: GarminActivity[],
  events: CalendarEvent[],
  readiness: ReadinessEvaluation,
  weekStart: string,
  now: Date,
  completedIds: Set<string> = new Set(),
  athlete?: { fcMax?: number; fcRest?: number }
): { actions: AdaptiveWorkoutAction[]; projectedRatios: Record<string, number> } {
  const weekEnd = formatDateKey(addDays(parseLocalDate(weekStart), 6));
  const future = events
    .filter(event => event.category === 'sport' && !event.metadata?.isPostponedPlaceholder && !event.metadata?.isOptional)
    .filter(event => {
      const date = toLocalDateKey(event.startDate);
      return date >= weekStart && date <= weekEnd && new Date(event.startDate).getTime() > now.getTime()
        && !event.metadata?.isCompleted && !completedIds.has(event.id);
    })
    .map(nominalEvent)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const projected: ProjectedActivity[] = [];
  const actions: AdaptiveWorkoutAction[] = [];
  const projectedRatios: Record<string, number> = {};
  const repeatedLowFeeling = recentSubjectiveSignals(activities, now).repeatedLowFeeling;
  for (const event of future) {
    const candidate = projectedActivity(event);
    const eventDate = parseLocalDate(candidate.date);
    const load = computeTrainingLoadStats([...activities, ...projected, candidate], eventDate, 60, athlete);
    projectedRatios[event.id] = load.trailAcwrRatio;
    const action = evaluateAdaptivePlanStatus(load, readiness, [event], {}, now, new Set(), repeatedLowFeeling).recommendedActions[0];
    if (action) actions.push(action);
    projected.push(projectedActivity(event, action));
  }
  return { actions, projectedRatios };
}
