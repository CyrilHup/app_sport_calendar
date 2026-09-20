import { describe, expect, it } from 'vitest';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { ActivityComparison } from '../types/garmin';
import { buildCalendarDayViewModel, CalendarFilterCategory } from './calendarDayViewModel';

function event(id: string, category: CalendarEvent['category'], metadata?: CalendarEvent['metadata']): CalendarEvent {
  return {
    id,
    category,
    sportType: category === 'sport' ? 'RUN_EASY' : undefined,
    title: id,
    startDate: '2026-09-08T08:00:00',
    endDate: '2026-09-08T09:00:00',
    location: 'Test',
    description: '',
    emoji: '•',
    colorId: '1',
    colorHex: '#fff',
    durationMinutes: 60,
    metadata
  };
}

function comparison(plannedEvent: CalendarEvent): ActivityComparison {
  return {
    id: `comparison-${plannedEvent.id}`,
    date: '2026-09-10',
    status: 'COMPLIANT',
    plannedEvent,
    durationDeltaMinutes: 0,
    heartRateCompliance: 'OPTIMAL',
    complianceScore: 100,
    feedbackNotes: [],
    isPostponedCatchup: true,
    executedDate: '2026-09-10'
  };
}

describe('buildCalendarDayViewModel', () => {
  const course = event('course', 'course');
  const mobility = event('mobility', 'mobility');
  const plannedSport = event('planned-sport', 'sport');
  const ghost = event('ghost', 'sport', { isPostponedPlaceholder: true });
  const catchupElsewhere = event('catchup-elsewhere', 'sport');
  const day: DailySchedule = {
    date: '2026-09-08',
    dayOfWeek: 1,
    periodContext: {
      phase: 'TEST',
      weekNumber: 1,
      isDeload: false,
      volumeFactor: 1,
      label: 'Test',
      daysToRace: 100,
      description: ''
    },
    hasCourse: true,
    hasIntensiveCourse: false,
    events: [course, mobility, plannedSport, ghost, catchupElsewhere]
  };
  const comparisons = [comparison(catchupElsewhere)];

  it('builds one shared projection for every event category', () => {
    const model = buildCalendarDayViewModel(day, comparisons, 'all', { fcMax: 190, fcRest: 50 });

    expect(model.courseEvents.map(item => item.id)).toEqual(['course']);
    expect(model.mobilityEvent?.id).toBe('mobility');
    expect(model.ghostEvents.map(item => item.id)).toEqual(['ghost']);
    expect(model.catchupExecutedElsewhere.map(item => item.id)).toEqual(['catchup-elsewhere']);
    expect(model.unifiedSportGroups).toHaveLength(1);
    expect(model.unifiedSportGroups[0].mainPlannedEvent?.id).toBe('planned-sport');
    expect(model.displayCount).toBe(5);
    expect(model.hasAnyDisplayableItem).toBe(true);
  });

  it.each<[CalendarFilterCategory, number]>([
    ['all', 5],
    ['sport', 3],
    ['course', 1],
    ['mobility', 1]
  ])('keeps count and empty-state aligned for the %s filter', (filter, expectedCount) => {
    const model = buildCalendarDayViewModel(day, comparisons, filter);
    expect(model.displayCount).toBe(expectedCount);
    expect(model.hasAnyDisplayableItem).toBe(expectedCount > 0);
  });

  it('reports an empty filtered day consistently', () => {
    const emptyDay = { ...day, events: [course] };
    const model = buildCalendarDayViewModel(emptyDay, [], 'sport');
    expect(model.displayCount).toBe(0);
    expect(model.hasAnyDisplayableItem).toBe(false);
  });
});
