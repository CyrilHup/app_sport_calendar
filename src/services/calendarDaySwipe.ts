export interface SwipePoint {
  x: number;
  y: number;
}

const MIN_HORIZONTAL_SWIPE_PX = 48;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;

/** Return the adjacent day index for a deliberate horizontal swipe, or null. */
export function getCalendarDaySwipeDestination(
  currentDayIndex: number,
  totalDays: number,
  start: SwipePoint,
  end: SwipePoint
): number | null {
  if (!Number.isInteger(currentDayIndex) || !Number.isInteger(totalDays) ||
    totalDays <= 0 || currentDayIndex < 0 || currentDayIndex >= totalDays) {
    return null;
  }
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (Math.abs(deltaX) < MIN_HORIZONTAL_SWIPE_PX ||
    Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO) {
    return null;
  }

  const destination = currentDayIndex + (deltaX < 0 ? 1 : -1);
  return destination >= 0 && destination < totalDays ? destination : null;
}
