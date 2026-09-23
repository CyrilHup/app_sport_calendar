import { AdaptiveWorkoutOverride, CalendarEvent, DailySchedule, WorkoutPostponeOverride } from '../types/calendar';
import { applyPostponements } from './postponeService';
import { applyAdaptiveModifications } from './adaptivePlanEngine';

export interface CalendarSnapshot {
  schedules: DailySchedule[];
  allEvents: CalendarEvent[];
}

/** One ordered projection from the base calendar to every UI and sync consumer. */
export function buildEffectiveCalendar(
  baseCalendar: CalendarSnapshot,
  postpones: Record<string, WorkoutPostponeOverride>,
  adaptations: Record<string, AdaptiveWorkoutOverride>
): CalendarSnapshot {
  const postponed = applyPostponements(baseCalendar.schedules, baseCalendar.allEvents, postpones);
  return applyAdaptiveModifications(postponed.schedules, postponed.allEvents, adaptations);
}
