import type { CalendarEvent } from '../types/calendar';
import type { ActivityComparison, GarminActivity } from '../types/garmin';
import { isTrailOrRunning } from './activityClassifier';
import { addDays, formatDateKey, getGarminLocalDateKey, getMondayOfWeek, parseLocalDate } from './dateUtils';
import { effectiveActivityFeedback } from './activityFeedback';

export const activitySports = {
  all: 'Tous les sports',
  running: 'Course et trail',
  strength: 'Renforcement',
  cardio: 'Cardio',
  cycling: 'Vélo',
  walking: 'Marche et randonnée',
  other: 'Autres sports'
};

export const activityMetrics = {
  minutes: 'Durée',
  distance: 'Distance',
  elevation: 'Dénivelé +',
  sessions: 'Séances'
};

export type ActivitySport = keyof typeof activitySports;
export type ActivityMetric = keyof typeof activityMetrics;

export function activitySport(activity: GarminActivity): Exclude<ActivitySport, 'all'> {
  const key = activity.garminTypeKey?.toLowerCase() ?? '';
  // The Forerunner 55 also logs assigned strength sessions under the Cardio profile.
  // Use the recorded profile in the activity log. Plan matching stays independent.
  if (/^(cardio|indoor_cardio|hiit|elliptical|stair|rowing|swimming|fitness_equipment)/.test(key)) return 'cardio';
  switch (activity.activityType) {
    case 'RUNNING':
    case 'TRAIL_RUNNING': return 'running';
    case 'STRENGTH_TRAINING': return 'strength';
    case 'FITNESS_EQUIPMENT': return 'cardio';
    case 'CYCLING': return 'cycling';
    case 'WALKING': return 'walking';
    default: return 'other';
  }
}

export function sumActivityMetrics(activities: readonly GarminActivity[]): Record<ActivityMetric, number> {
  return activities.reduce((total, activity) => ({
    sessions: total.sessions + 1,
    minutes: total.minutes + activity.durationMinutes,
    distance: total.distance + (activity.distanceKm ?? 0),
    elevation: total.elevation + (activity.elevationGainM ?? 0)
  }), { sessions: 0, minutes: 0, distance: 0, elevation: 0 });
}

export function groupActivitiesByDay(activities: readonly GarminActivity[]) {
  const byDate = new Map<string, GarminActivity[]>();
  for (const activity of activities) {
    if (!activity.startTimeLocal) continue;
    const date = getGarminLocalDateKey(activity);
    const group = byDate.get(date) ?? [];
    group.push(activity);
    byDate.set(date, group);
  }
  return byDate;
}

export function formatTrainingDuration(value: number): string {
  const total = Math.round(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours} h${minutes ? ` ${String(minutes).padStart(2, '0')}` : ''}` : `${minutes} min`;
}

export function measuredTotal(activities: readonly GarminActivity[], field: 'distanceKm' | 'elevationGainM') {
  const values = activities.map(activity => activity[field])
    .filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0);
  return { total: values.length ? values.reduce((sum, value) => sum + value, 0) : undefined, measured: values.length };
}

function isRequiredRun(event: CalendarEvent) {
  return event.category === 'sport' && event.sportType !== 'RACE_DAY' && !event.metadata?.isOptional &&
    !event.metadata?.isPostponedPlaceholder && isTrailOrRunning(event);
}

export interface WeeklyRunSummary {
  recordedMinutes: number;
  recordedElevation?: number;
  elevationCoverage: number;
  recordedSessions: number;
  plannedMinutes: number;
  plannedElevation?: number;
}

/** The Planning card uses the complete week's target and actuals through today. */
export function summarizeCurrentRunWeek(
  activities: readonly GarminActivity[],
  events: readonly CalendarEvent[],
  referenceDate: Date
): WeeklyRunSummary {
  const today = formatDateKey(referenceDate);
  const [week] = buildActivityWeeks(referenceDate, 1, 0);
  const recorded = activities.filter(activity => {
    const date = getGarminLocalDateKey(activity);
    return activitySport(activity) === 'running' && date >= week[0] && date <= today;
  });
  const planned = events.filter(event => {
    if (!isRequiredRun(event)) return false;
    const date = formatDateKey(new Date(event.startDate));
    return date >= week[0] && date <= week[6];
  });
  const elevationTargets = planned.map(event => event.metadata?.targetElevationM)
    .filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0);
  const elevation = measuredTotal(recorded, 'elevationGainM');
  return {
    recordedMinutes: sumActivityMetrics(recorded).minutes,
    recordedElevation: elevation.total,
    elevationCoverage: elevation.measured,
    recordedSessions: recorded.length,
    plannedMinutes: planned.reduce((total, event) => total + event.durationMinutes, 0),
    plannedElevation: elevationTargets.length ? elevationTargets.reduce((total, value) => total + value, 0) : undefined
  };
}

export function buildActivityWeeks(referenceDate: Date, count: number, offset: number) {
  const first = addDays(getMondayOfWeek(referenceDate), -7 * (count + offset - 1));
  return Array.from({ length: count }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => formatDateKey(addDays(first, weekIndex * 7 + dayIndex)))
  );
}

export interface PlanWeek {
  start: string;
  end: string;
  planned: CalendarEvent[];
  recorded: GarminActivity[];
  matched: Map<string, ActivityComparison>;
  published: Set<string>;
}

/** Read the recorded prescription only when its ID and scheduled date still match. */
function publishedPlanTarget(event: CalendarEvent, signature: string | undefined): CalendarEvent | undefined {
  if (!signature) return;
  const start = signature.indexOf('::{');
  if (start < 0 || !signature.slice(0, start).endsWith(`::${event.id}`)) return;
  try {
    const payload = JSON.parse(signature.slice(start + 2));
    if (typeof payload.startDate !== 'string' ||
      formatDateKey(new Date(payload.startDate)) !== formatDateKey(new Date(event.startDate)) ||
      !Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) return;
    return {
      ...event,
      title: typeof payload.title === 'string' ? payload.title : event.title,
      durationMinutes: payload.durationMinutes,
      metadata: {
        ...event.metadata,
        targetElevationM: Number.isFinite(payload.targetElevationM) ? payload.targetElevationM : undefined,
        targetHeartRateRange: Array.isArray(payload.targetHeartRateRange) && payload.targetHeartRateRange.length === 2 &&
          payload.targetHeartRateRange.every(Number.isFinite) ? payload.targetHeartRateRange : undefined
      }
    };
  } catch {
    return;
  }
}

export function buildPlanWeeks(
  activities: readonly GarminActivity[],
  events: readonly CalendarEvent[],
  comparisons: readonly ActivityComparison[],
  referenceDate: Date,
  offset = 0,
  publishedSignatures: Readonly<Record<string, string>> = {}
): PlanWeek[] {
  const today = formatDateKey(referenceDate);
  const activityDates = groupActivitiesByDay(activities.filter(activity => activitySport(activity) === 'running'));
  const matchedByEvent = new Map<string, ActivityComparison>();
  for (const comparison of comparisons) {
    if (comparison.plannedEvent && comparison.actualActivity &&
      getGarminLocalDateKey(comparison.actualActivity) <= today) {
      matchedByEvent.set(comparison.plannedEvent.id, comparison);
    }
  }
  const planByDate = new Map<string, CalendarEvent[]>();
  const publishedIds = new Set<string>();
  for (const event of events) {
    if (!isRequiredRun(event)) continue;
    const day = formatDateKey(new Date(event.startDate));
    if (day > today) continue;
    const published = publishedPlanTarget(event, publishedSignatures[event.id]);
    if (published) publishedIds.add(event.id);
    const dayEvents = planByDate.get(day) ?? [];
    dayEvents.push(published ?? event);
    planByDate.set(day, dayEvents);
  }
  return buildActivityWeeks(referenceDate, 8, offset).map(days => {
    const includedDays = days.filter(day => day <= today);
    const planned = includedDays.flatMap(day => planByDate.get(day) ?? []);
    const matched = new Map<string, ActivityComparison>();
    for (const event of planned) {
      const comparison = matchedByEvent.get(event.id);
      if (comparison) matched.set(event.id, comparison);
    }
    return {
      start: days[0],
      end: days[6],
      planned,
      recorded: includedDays.flatMap(day => activityDates.get(day) ?? []),
      matched,
      published: new Set(planned.filter(event => publishedIds.has(event.id)).map(event => event.id))
    };
  });
}

export function describeDateRange(start: string, end: string): string {
  const short = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' });
  const full = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  const endLabel = full.format(parseLocalDate(end));
  const startLabel = (start.slice(0, 4) === end.slice(0, 4) ? short : full).format(parseLocalDate(start));
  return start === end ? endLabel : `${startLabel} – ${endLabel}`;
}

function summarizeRuns(runs: GarminActivity[]) {
  const longest = runs.reduce<GarminActivity | undefined>((best, run) =>
    !best || run.durationMinutes > best.durationMinutes ? run : best, undefined);
  return {
    runs: runs.length,
    days: groupActivitiesByDay(runs).size,
    minutes: sumActivityMetrics(runs).minutes,
    distance: measuredTotal(runs, 'distanceKm'),
    elevation: measuredTotal(runs, 'elevationGainM'),
    longest
  };
}

/** Compare equal Monday–Sunday windows and keep the in-progress week out of the comparison. */
export function buildTrainingReview(
  activities: readonly GarminActivity[],
  comparisons: readonly ActivityComparison[],
  referenceDate: Date
) {
  const daysByWeek = buildActivityWeeks(referenceDate, 8, 1);
  const byDay = groupActivitiesByDay(activities);
  const blocks = daysByWeek.map(days => ({
    start: days[0],
    end: days[6],
    activities: days.flatMap(day => byDay.get(day) ?? [])
  }));
  const recent = blocks.slice(4).flatMap(block => block.activities);
  const recentRuns = recent.filter(activity => activitySport(activity) === 'running');
  const previousRuns = blocks.slice(0, 4).flatMap(block => block.activities)
    .filter(activity => activitySport(activity) === 'running');
  const strengthIds = new Set(comparisons.flatMap(comparison => {
    const sport = comparison.plannedEvent?.sportType;
    if ((sport !== 'CALISTHENICS' && sport !== 'GYM_FORCE') || !comparison.actualActivity) return [];
    return (comparison.subActivities?.length ? comparison.subActivities : [comparison.actualActivity])
      .map(activity => activity.activityId);
  }));
  const withHeartRate = recentRuns.filter(run => run.avgHeartRate !== undefined && Number.isFinite(run.avgHeartRate) &&
    run.avgHeartRate > 0 && run.durationMinutes > 0);
  const hrMinutes = withHeartRate.reduce((total, run) => total + run.durationMinutes, 0);
  const rpe = recentRuns.map(run => effectiveActivityFeedback(run).perceivedEffort)
    .filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 1 && value <= 10);
  return {
    start: blocks[4].start,
    end: blocks[7].end,
    previousStart: blocks[0].start,
    previousEnd: blocks[3].end,
    spansPreviousPeriod: [...byDay.keys()].some(day => day <= blocks[0].start),
    recent: summarizeRuns(recentRuns),
    previous: summarizeRuns(previousRuns),
    strength: recent.filter(activity => activitySport(activity) === 'strength' || strengthIds.has(activity.activityId)).length,
    hr: hrMinutes ? withHeartRate.reduce((total, run) => total + run.durationMinutes * (run.avgHeartRate ?? 0), 0) / hrMinutes :
      undefined,
    hrCount: withHeartRate.length,
    rpe: rpe.length ? rpe.reduce((total, value) => total + value, 0) / rpe.length : undefined,
    rpeCount: rpe.length,
    weeks: blocks.slice(4).map(block => ({
      start: block.start,
      end: block.end,
      ...summarizeRuns(block.activities.filter(activity => activitySport(activity) === 'running'))
    }))
  };
}
