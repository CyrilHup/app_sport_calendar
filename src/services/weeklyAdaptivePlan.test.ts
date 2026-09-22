import { describe, expect, it } from 'vitest';
import { CalendarEvent } from '../types/calendar';
import { GarminActivity } from '../types/garmin';
import { ReadinessEvaluation } from './readinessEngine';
import { projectWeeklyAdaptivePlan } from './weeklyAdaptivePlan';

const readiness: ReadinessEvaluation = {
  score: 85, status: 'OPTIMAL', statusLabel: 'Prêt', badgeEmoji: '🟢',
  badgeColorHex: '#10b981', headline: 'Prêt', summary: 'Prêt',
  factors: { sleepScore: 85, sleepDurationHours: 8, hrvScore: 85, hrvStatus: 'BALANCED', rhrDeltaBpm: 0 }
};

function run(id: string, startDate: string, durationMinutes = 30): CalendarEvent {
  return {
    id, category: 'sport', sportType: 'RUN_EASY', title: 'Footing facile', startDate,
    endDate: new Date(new Date(startDate).getTime() + durationMinutes * 60000).toISOString(),
    location: '', description: '', emoji: '', colorId: '', colorHex: '', durationMinutes
  };
}

function actual(id: string, date: string, distanceKm: number): GarminActivity {
  return {
    activityId: id, activityName: 'Course', activityType: 'RUNNING',
    startTimeLocal: `${date}T08:00:00`, durationMinutes: 60,
    distanceKm, source: 'GARMIN_CONNECT'
  };
}

describe('weekly adaptive projection', () => {
  it('adds planned sessions to later rolling load', () => {
    const events = [
      run('first', '2026-09-07T12:00:00Z'),
      run('second', '2026-09-08T12:00:00Z')
    ];
    const result = projectWeeklyAdaptivePlan([], events, readiness, '2026-09-07', new Date('2026-09-07T09:00:00Z'));
    expect(result.projectedRatios.second).toBeGreaterThan(result.projectedRatios.first);
  });

  it('lets old actual load decay out of the seven-day window', () => {
    const events = [
      run('first', '2026-09-07T12:00:00Z', 10),
      run('second', '2026-09-08T12:00:00Z', 10)
    ];
    const result = projectWeeklyAdaptivePlan(
      [actual('old', '2026-09-01', 40)], events, readiness,
      '2026-09-07', new Date('2026-09-07T09:00:00Z')
    );
    expect(result.projectedRatios.second).toBeLessThan(result.projectedRatios.first);
  });

  it('never plans an already started or completed session', () => {
    const events = [
      run('started', '2026-09-07T08:00:00Z'),
      run('completed', '2026-09-08T12:00:00Z'),
      run('future', '2026-09-09T12:00:00Z')
    ];
    const result = projectWeeklyAdaptivePlan(
      [], events, readiness, '2026-09-07', new Date('2026-09-07T09:00:00Z'), new Set(['completed'])
    );
    expect(Object.keys(result.projectedRatios)).toEqual(['future']);
  });
});
