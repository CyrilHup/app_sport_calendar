import { describe, expect, it } from 'vitest';
import { GarminActivity } from '../types/garmin';
import { extractGarminFeedback, effectiveActivityFeedback, publicActivity, recentSubjectiveSignals, sessionRpeLoad, weeklySessionRpeTrend } from './activityFeedback';
import { mergeGarminActivities } from './activityRepository';

const activity = (id: string, date: string): GarminActivity => ({
  activityId: id, activityName: 'Footing', activityType: 'RUNNING', startTimeLocal: date,
  durationMinutes: 40, source: 'GARMIN_CONNECT'
});

describe('private activity feedback', () => {
  it('extracts known Garmin self-evaluation values without filling absent fields', () => {
    expect(extractGarminFeedback({ directWorkoutRpe: 70, subjectiveFeeling: 75, description: 'Jambes solides' }))
      .toEqual({ perceivedEffort: 7, feeling: 'STRONG', notes: 'Jambes solides' });
    expect(extractGarminFeedback({ summaryDTO: { directWorkoutRpe: 80, subjectiveFeeling: 25 } }))
      .toEqual({ perceivedEffort: 8, feeling: 'WEAK', notes: undefined });
    expect(extractGarminFeedback({ directWorkoutRpe: 999, subjectiveFeeling: 42 })).toBeUndefined();
  });

  it('preserves newer manual notes during stale cloud/activity merges and strips them from public rows', () => {
    const local = { ...activity('1', '2026-09-25T12:00:00Z'),
      manualFeedback: { perceivedEffort: 8, pain: 2, notes: 'Privé', updatedAt: '2026-09-26T10:00:00Z' } };
    const stale = { ...activity('1', '2026-09-25T12:00:00Z'),
      garminFeedback: { perceivedEffort: 7 },
      manualFeedback: { perceivedEffort: 5, updatedAt: '2026-09-25T10:00:00Z' } };
    const merged = mergeGarminActivities([local], [stale])[0];
    expect(effectiveActivityFeedback(merged)).toMatchObject({ perceivedEffort: 8, pain: 2, notes: 'Privé' });
    expect(sessionRpeLoad(merged)).toBe(320);
    expect(publicActivity(merged)).not.toHaveProperty('manualFeedback');
    expect(publicActivity(merged)).not.toHaveProperty('garminFeedback');
  });

  it('treats repeated weak feelings and recent pain as explicit reports, without inferring them from RPE', () => {
    const first = { ...activity('1', '2026-09-24T10:00:00Z'), manualFeedback: { perceivedEffort: 9, feeling: 'WEAK' as const } };
    const second = { ...activity('2', '2026-09-25T10:00:00Z'), manualFeedback: { perceivedEffort: 3, feeling: 'VERY_WEAK' as const, pain: 4 } };
    const now = new Date('2026-09-26T10:00:00Z');
    expect(recentSubjectiveSignals([first], now).repeatedLowFeeling).toBe(false);
    expect(recentSubjectiveSignals([first, second], now)).toMatchObject({
      repeatedLowFeeling: true, recentPain: 4, ratedSessions: 2, totalSessionRpeLoad: 480
    });
  });

  it('shows rating coverage alongside each weekly subjective-load total', () => {
    const sessions = [
      { ...activity('1', '2026-09-25T12:00:00Z'), manualFeedback: { perceivedEffort: 6 } },
      activity('2', '2026-09-24T12:00:00Z'),
      { ...activity('3', '2026-09-18T12:00:00Z'), manualFeedback: { perceivedEffort: 4 } }
    ];
    const trend = weeklySessionRpeTrend(sessions, new Date('2026-09-26T12:00:00Z'));
    expect(trend).toHaveLength(4);
    expect(trend[2]).toMatchObject({ totalLoad: 160, ratedSessions: 1, recordedSessions: 1 });
    expect(trend[3]).toMatchObject({ totalLoad: 240, ratedSessions: 1, recordedSessions: 2 });
  });
});
