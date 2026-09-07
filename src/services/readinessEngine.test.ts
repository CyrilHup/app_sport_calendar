import { describe, it, expect } from 'vitest';
import { calculateReadinessScore, getProactivePlanRecommendation } from './readinessEngine';
import { GarminWellnessData } from '../types/garmin';
import { CalendarEvent } from '../types/calendar';

describe('readinessEngine', () => {
  it('should return a healthy baseline when no wellness data is available', () => {
    const res = calculateReadinessScore(null);
    expect(res.score).toBeGreaterThanOrEqual(75);
    expect(res.status).toBe('OPTIMAL');
  });

  it('should detect high fatigue when sleep is low and HRV is poor', () => {
    const poorWellness: GarminWellnessData = {
      date: '2026-09-07',
      sleep: {
        score: 42,
        totalMinutes: 290 // ~4.8 hours
      },
      hrv: {
        status: 'POOR',
        lastNightAvg: 28,
        weeklyAvg: 45
      },
      restingHeartRate: 56, // +8 bpm above 48 bpm baseline
      syncedAt: new Date().toISOString()
    };

    const res = calculateReadinessScore(poorWellness, 48);
    expect(res.score).toBeLessThan(50);
    expect(res.status).toBe('LOW');
    expect(res.badgeEmoji).toBe('🔴');

    const intenseEvent: CalendarEvent = {
      id: 'plan-tue',
      title: 'Trail: Hill Repeats D+',
      startDate: '2026-09-07T18:00:00',
      endDate: '2026-09-07T19:15:00',
      durationMinutes: 75,
      category: 'sport',
      sportType: 'TRAIL_INTENSE',
      location: 'Mont-Royal',
      description: '',
      colorId: '1',
      colorHex: '#ff5722',
      emoji: '⚡'
    };

    const rec = getProactivePlanRecommendation(res, intenseEvent);
    expect(rec.shouldAdapt).toBe(true);
    expect(rec.actionType).toBe('LIGHTEN');
    expect(rec.adaptedDurationMinutes).toBe(35);
  });

  it('should return optimal readiness when sleep is >8h and HRV balanced', () => {
    const goodWellness: GarminWellnessData = {
      date: '2026-09-07',
      sleep: {
        score: 92,
        totalMinutes: 510 // 8.5 hours
      },
      hrv: {
        status: 'BALANCED',
        lastNightAvg: 52,
        weeklyAvg: 49
      },
      restingHeartRate: 46,
      syncedAt: new Date().toISOString()
    };

    const res = calculateReadinessScore(goodWellness, 48);
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.status).toBe('OPTIMAL');
  });
});
