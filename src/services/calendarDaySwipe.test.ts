import { describe, expect, it } from 'vitest';
import { getCalendarDaySwipeDestination } from './calendarDaySwipe';

describe('getCalendarDaySwipeDestination', () => {
  it('advances a day on a clear left swipe', () => {
    expect(getCalendarDaySwipeDestination(2, 14, { x: 180, y: 120 }, { x: 105, y: 126 })).toBe(3);
  });

  it('goes back a day on a clear right swipe', () => {
    expect(getCalendarDaySwipeDestination(3, 14, { x: 100, y: 120 }, { x: 170, y: 114 })).toBe(2);
  });

  it('crosses week boundaries in the flattened calendar day sequence', () => {
    expect(getCalendarDaySwipeDestination(6, 14, { x: 180, y: 100 }, { x: 100, y: 100 })).toBe(7);
    expect(getCalendarDaySwipeDestination(7, 14, { x: 100, y: 100 }, { x: 180, y: 100 })).toBe(6);
  });

  it('ignores vertical scrolls and short horizontal taps', () => {
    expect(getCalendarDaySwipeDestination(2, 14, { x: 180, y: 100 }, { x: 135, y: 180 })).toBeNull();
    expect(getCalendarDaySwipeDestination(2, 14, { x: 180, y: 100 }, { x: 145, y: 105 })).toBeNull();
  });

  it('does not navigate beyond the calendar endpoints', () => {
    expect(getCalendarDaySwipeDestination(0, 14, { x: 100, y: 100 }, { x: 180, y: 100 })).toBeNull();
    expect(getCalendarDaySwipeDestination(13, 14, { x: 180, y: 100 }, { x: 100, y: 100 })).toBeNull();
  });

  it('rejects invalid positions and coordinates', () => {
    expect(getCalendarDaySwipeDestination(-1, 14, { x: 180, y: 120 }, { x: 100, y: 120 })).toBeNull();
    expect(getCalendarDaySwipeDestination(1, 14, { x: NaN, y: 120 }, { x: 100, y: 120 })).toBeNull();
  });
});
