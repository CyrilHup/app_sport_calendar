import { CalendarEvent, DailySchedule } from '../types/calendar';
import { ActivityComparison } from '../types/garmin';
import { groupDaySportWorkouts, UnifiedDayWorkoutGroup } from './workoutAggregator';

export type CalendarFilterCategory = 'all' | 'sport' | 'course' | 'mobility';

export interface CalendarDayViewModel {
  courseEvents: CalendarEvent[];
  mobilityEvent?: CalendarEvent;
  ghostEvents: CalendarEvent[];
  catchupExecutedElsewhere: CalendarEvent[];
  unifiedSportGroups: UnifiedDayWorkoutGroup[];
  hasAnyDisplayableItem: boolean;
  displayCount: number;
}

/** Shared projection consumed by the grid/day and list calendar renderers. */
export function buildCalendarDayViewModel(
  day: DailySchedule,
  comparisons: ActivityComparison[],
  filter: CalendarFilterCategory,
  athlete?: { fcMax?: number; fcRest?: number }
): CalendarDayViewModel {
  const courseEvents = day.events.filter(event => event.category === 'course');
  const mobilityEvent = day.events.find(event => event.category === 'mobility');
  const ghostEvents = day.events.filter(event =>
    event.category === 'sport' && Boolean(event.metadata?.isPostponedPlaceholder)
  );
  const catchupExecutedElsewhere = day.events.filter(event => {
    if (event.category !== 'sport') return false;
    const comparison = comparisons.find(candidate => candidate.plannedEvent?.id === event.id);
    return Boolean(
      comparison?.isPostponedCatchup &&
      comparison.executedDate &&
      comparison.executedDate !== day.date
    );
  });
  const unifiedSportGroups = groupDaySportWorkouts(
    day.events.filter(event => event.category === 'sport'),
    comparisons,
    day.date,
    athlete
  );

  const displayCount =
    (filter === 'all' || filter === 'sport'
      ? unifiedSportGroups.length + ghostEvents.length + catchupExecutedElsewhere.length
      : 0) +
    (filter === 'all' || filter === 'course' ? courseEvents.length : 0) +
    ((filter === 'all' || filter === 'mobility') && mobilityEvent ? 1 : 0);

  return {
    courseEvents,
    mobilityEvent,
    ghostEvents,
    catchupExecutedElsewhere,
    unifiedSportGroups,
    hasAnyDisplayableItem: displayCount > 0,
    displayCount
  };
}
