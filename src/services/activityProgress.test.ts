import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../types/calendar';
import type { ActivityComparison, GarminActivity } from '../types/garmin';
import { activitySport, buildActivityWeeks, buildPlanWeeks, buildTrainingReview, groupActivitiesByDay, measuredTotal,
  summarizeCurrentRunWeek, sumActivityMetrics } from './activityProgress';

const referenceDate = new Date(2026, 10, 18, 12);
const event = (id: string, date: string, metadata?: CalendarEvent['metadata']): CalendarEvent => ({
  id, category: 'sport', sportType: 'RUN_EASY', title: 'Course facile', startDate: `${date}T08:00:00`,
  endDate: `${date}T09:00:00`, durationMinutes: 60, location: '',
  description: '', emoji: '', colorId: '', colorHex: '', metadata
});
const recorded = (activityId: string, date: string, options: Partial<GarminActivity> = {}): GarminActivity => ({
  activityId, activityName: 'Course', activityType: 'RUNNING', source: 'GARMIN_CONNECT',
  startTimeLocal: `${date} 23:30:00`, durationMinutes: 30, ...options
});

describe('training progression', () => {
  it('builds Monday-first weeks across month and year boundaries', () => {
    const [week] = buildActivityWeeks(new Date(2027, 0, 1), 1, 0);
    expect(week[0]).toBe('2026-12-28');
    expect(week[6]).toBe('2027-01-03');
    expect(buildActivityWeeks(new Date(2027, 0, 1), 1, 1)[0][0]).toBe('2026-12-21');
  });

  it('keeps inactive planned weeks and excludes optional, postponed and future targets', () => {
    const weeks = buildPlanWeeks([], [
      event('past', '2026-11-10'),
      event('due', '2026-11-18'),
      event('future', '2026-11-20'),
      event('optional', '2026-11-17', { isOptional: true }),
      event('placeholder', '2026-11-17', { isPostponedPlaceholder: true })
    ], [], referenceDate);

    expect(weeks).toHaveLength(8);
    expect(weeks[6].planned.map(item => item.id)).toEqual(['past']);
    expect(weeks[6].recorded).toEqual([]);
    expect(weeks[7].planned.map(item => item.id)).toEqual(['due']);
  });

  it('uses an exact published target and counts linked fragments as one planned session', () => {
    const planned = event('planned', '2026-11-16', { targetElevationM: 100 });
    const first = recorded('123', '2026-11-17', { distanceKm: 3 });
    const second = recorded('456', '2026-11-17', { distanceKm: 2 });
    const linked: ActivityComparison = {
      id: 'comparison', date: '2026-11-17', plannedEvent: planned, actualActivity: first,
      subActivities: [first, second], durationDeltaMinutes: 0, complianceScore: 90, status: 'COMPLIANT',
      heartRateCompliance: 'N/A', feedbackNotes: []
    };
    const signature = (date: string) => `v1::planned::${JSON.stringify({
      startDate: `${date}T09:00:00`, durationMinutes: 45, targetHeartRateRange: [140, 150], targetElevationM: 80
    })}`;
    const weeks = buildPlanWeeks([first, second], [planned], [linked], referenceDate, 0, { planned: signature('2026-11-16') });
    const current = weeks[7];
    expect(current.planned[0].durationMinutes).toBe(45);
    expect(current.planned[0].metadata?.targetHeartRateRange).toEqual([140, 150]);
    expect(current.published.has('planned')).toBe(true);
    expect(current.matched.size).toBe(1);
    expect(sumActivityMetrics(current.recorded)).toEqual({ sessions: 2, minutes: 60, distance: 5, elevation: 0 });
    expect(groupActivitiesByDay(current.recorded).get('2026-11-17')).toHaveLength(2);

    const outdated = buildPlanWeeks([first], [planned], [linked], referenceDate, 0, { planned: signature('2026-11-13') })[7];
    expect(outdated.published.size).toBe(0);
    expect(outdated.planned[0].durationMinutes).toBe(60);
  });

  it('keeps the recorded Cardio profile visible even when paired with strength', () => {
    expect(activitySport(recorded('1', '2026-11-16', {
      activityName: 'Calisthénie / Renforcement', activityType: 'STRENGTH_TRAINING', garminTypeKey: 'cardio'
    }))).toBe('cardio');
    expect(activitySport(recorded('2', '2026-11-16', {
      activityType: 'STRENGTH_TRAINING', garminTypeKey: 'strength_training'
    }))).toBe('strength');
  });

  it('uses the full required plan for Planning, with actuals only through today', () => {
    const summary = summarizeCurrentRunWeek([
      recorded('current', '2026-11-17', { elevationGainM: 0 }),
      recorded('unknown', '2026-11-18'),
      recorded('future', '2026-11-19', { elevationGainM: 100 }),
      recorded('previous', '2026-11-15', { elevationGainM: 20 })
    ], [
      event('early', '2026-11-16'),
      event('next', '2026-11-21', { targetElevationM: 200 }),
      event('optional', '2026-11-19', { isOptional: true })
    ], referenceDate);

    expect(summary).toEqual({
      recordedMinutes: 60, recordedElevation: 0, elevationCoverage: 1, recordedSessions: 2,
      plannedMinutes: 120, plannedElevation: 200
    });
    expect(measuredTotal([recorded('unknown', '2026-11-18')], 'elevationGainM'))
      .toEqual({ total: undefined, measured: 0 });
  });

  it('uses equal completed weeks and reports coverage of measured training data', () => {
    const activities = [
      recorded('baseline', '2026-09-21', { durationMinutes: 25 }),
      recorded('first', '2026-10-19', { distanceKm: 5, avgHeartRate: 120 }),
      recorded('longest', '2026-11-15', {
        durationMinutes: 90, distanceKm: 12, elevationGainM: 350, avgHeartRate: 140, manualFeedback: { perceivedEffort: 7 }
      }),
      recorded('strength', '2026-11-15', { activityType: 'STRENGTH_TRAINING' }),
      recorded('in-progress', '2026-11-17', { durationMinutes: 120 })
    ];
    const review = buildTrainingReview(activities, [], referenceDate);
    expect([review.start, review.end, review.previousStart, review.previousEnd])
      .toEqual(['2026-10-19', '2026-11-15', '2026-09-21', '2026-10-18']);
    expect(review.spansPreviousPeriod).toBe(true);
    expect(review.weeks.map(week => week.runs)).toEqual([1, 0, 0, 1]);
    expect(review.recent).toMatchObject({
      runs: 2, days: 2, minutes: 120, longest: { activityId: 'longest' },
      distance: { measured: 2, total: 17 }, elevation: { measured: 1, total: 350 }
    });
    expect(review).toMatchObject({ strength: 1, hr: 135, hrCount: 2, rpe: 7, rpeCount: 1 });
    expect(buildTrainingReview(activities.slice(1), [], referenceDate).spansPreviousPeriod).toBe(false);
  });
});
