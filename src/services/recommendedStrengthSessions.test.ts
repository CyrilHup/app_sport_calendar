import { describe, expect, it } from 'vitest';
import { CalendarEvent, DailySchedule, PeriodizationContext } from '../types/calendar';
import { addRecommendedStrengthSessions } from './recommendedStrengthSessions';
import { applyPostponements, postponeWorkout } from './postponeService';

const context: PeriodizationContext = {
  phase: 'FONDATION', weekNumber: 2, isDeload: false, volumeFactor: 0.8,
  label: 'Fondations', daysToRace: 280, description: ''
};

function run(date: string, type: 'TRAIL_INTENSE' | 'RUN_EASY' | 'TRAIL_LONG'): CalendarEvent {
  return {
    id: `RUN_${date}`, category: 'sport', sportType: type, title: type,
    startDate: new Date(`${date}T10:00:00`).toISOString(), endDate: new Date(`${date}T11:00:00`).toISOString(),
    location: 'Parc', description: '', emoji: '🏃', colorId: '1', colorHex: '#fff', durationMinutes: 60
  };
}

function week(): DailySchedule[] {
  const runs = new Map([
    ['2026-09-22', run('2026-09-22', 'TRAIL_INTENSE')],
    ['2026-09-24', run('2026-09-24', 'RUN_EASY')],
    ['2026-09-26', run('2026-09-26', 'TRAIL_LONG')]
  ]);
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const date = `2026-09-${String(21 + dayOfWeek).padStart(2, '0')}`;
    const sportSession = runs.get(date);
    return { date, dayOfWeek, periodContext: context, events: sportSession ? [sportSession] : [], sportSession, hasCourse: false, hasIntensiveCourse: false };
  });
}

describe('recommended strength sessions', () => {
  it('puts three core and one optional movable sessions around key runs without replacing the primary run', () => {
    const base = week();
    const initial = addRecommendedStrengthSessions(base, base.flatMap(day => day.events));
    const strength = initial.allEvents.filter(event => event.metadata?.isRecommendedStrength);
    expect(strength).toHaveLength(4);
    expect(new Set(strength.map(event => event.id)).size).toBe(4);
    expect(strength.filter(event => !event.metadata?.isOptional)).toHaveLength(3);
    expect(strength.filter(event => event.metadata?.isOptional)).toHaveLength(1);
    expect(strength.filter(event => event.sportType === 'CALISTHENICS')).toHaveLength(3);
    expect(strength.filter(event => event.sportType === 'GYM_FORCE')).toHaveLength(1);
    expect(initial.schedules.find(day => day.date === '2026-09-24')?.sportSession?.sportType).toBe('RUN_EASY');
    expect(base.flatMap(day => day.events).filter(event => event.metadata?.isRecommendedStrength)).toHaveLength(0);

    const upper = strength.find(event => event.id.endsWith('_upper'))!;
    const originalDate = initial.schedules.find(day => day.events.some(event => event.id === upper.id))!.date;
    const moved = applyPostponements(initial.schedules, initial.allEvents,
      postponeWorkout({}, upper.id, originalDate, '2026-09-24', undefined, '19:00', upper));
    expect(moved.schedules.find(day => day.date === '2026-09-24')?.sportSession?.sportType).toBe('RUN_EASY');
    expect(moved.allEvents.find(event => event.id === upper.id)?.metadata?.isPostponed).toBe(true);
  });

  it('reduces the recommendation near race day and avoids a leg session', () => {
    const raceWeek = week().map(day => ({ ...day, periodContext: { ...context, phase: 'RACE_WEEK', daysToRace: 5 - day.dayOfWeek, isDeload: true } }));
    const result = addRecommendedStrengthSessions(raceWeek, raceWeek.flatMap(day => day.events));
    const strength = result.allEvents.filter(event => event.metadata?.isRecommendedStrength);
    expect(strength).toHaveLength(1);
    expect(strength[0].sportType).toBe('CALISTHENICS');
    expect(strength[0].durationMinutes).toBe(20);
  });

  it('starts with shorter sessions when recent strength history is sparse', () => {
    const base = week();
    const result = addRecommendedStrengthSessions(base, base.flatMap(day => day.events), 0);
    const strength = result.allEvents.filter(event => event.metadata?.isRecommendedStrength);
    expect(strength.filter(event => !event.metadata?.isOptional).every(event => event.durationMinutes <= 20)).toBe(true);
    expect(strength.find(event => event.metadata?.isOptional)?.durationMinutes).toBe(15);
  });
});
