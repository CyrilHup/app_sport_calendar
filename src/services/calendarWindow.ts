import { getMondayOfWeek } from './dateUtils';

export const CALENDAR_HORIZON_DAYS = 84;

export interface CalendarBuildWindow {
  startMonday: Date;
  daysCount: number;
}

function calendarDaysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

/** Canonical window used by the UI, downloads and subscription feed. */
export function getCalendarBuildWindow(
  referenceDate: Date,
  sportStartDate: string,
  daysCount: number = CALENDAR_HORIZON_DAYS
): CalendarBuildWindow {
  const currentMonday = getMondayOfWeek(referenceDate);
  const configuredStart = new Date(`${sportStartDate}T00:00:00`);
  const planStartMonday = Number.isNaN(configuredStart.getTime())
    ? currentMonday
    : getMondayOfWeek(configuredStart);

  const startMonday = planStartMonday.getTime() < currentMonday.getTime() ? planStartMonday : currentMonday;
  return {
    startMonday,
    // Keep the plan history without allowing the current/future weeks to fall
    // outside a fixed-length window as the app ages.
    daysCount: calendarDaysBetween(startMonday, currentMonday) + daysCount
  };
}
