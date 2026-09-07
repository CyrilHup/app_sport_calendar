import { describe, it, expect } from 'vitest';
import {
  computeFullStatsReport,
  formatMinutes,
  formatPace,
  parsePaceStringToSeconds,
  calculateQmtRacePrediction
} from './statsEngine';
import { GarminActivity } from '../types/garmin';

describe('statsEngine unit tests', () => {
  it('formats minutes and pace correctly', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(125)).toBe('2h05');
    expect(formatMinutes(600)).toBe('10h00');

    expect(formatPace(330)).toBe('5:30/km');
    expect(formatPace(0)).toBe('-');
    expect(parsePaceStringToSeconds('5:45')).toBe(345);
    expect(parsePaceStringToSeconds('6:12/km')).toBe(372);
  });

  it('computes aggregates accurately from sample Garmin activities', () => {
    const mockActivities: GarminActivity[] = [
      {
        activityId: 'act-1',
        activityName: 'Sortie longue Mont-Royal',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-01T08:00:00',
        durationMinutes: 90,
        distanceKm: 14.5,
        elevationGainM: 450,
        elevationLossM: 450,
        avgHeartRate: 148,
        avgCadence: 168,
        avgPaceMinKm: '6:12',
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-2',
        activityName: 'Calisthénie Gym ÉTS',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-03T17:00:00',
        durationMinutes: 60,
        avgHeartRate: 115,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-3',
        activityName: 'Côtes & D+ Mont-Royal',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-05T09:00:00',
        durationMinutes: 50,
        distanceKm: 8.0,
        elevationGainM: 380,
        elevationLossM: 380,
        avgHeartRate: 162,
        avgCadence: 172,
        avgPaceMinKm: '6:15',
        source: 'GARMIN_CONNECT'
      }
    ];

    const report = computeFullStatsReport(mockActivities, [], [], 'all', new Date('2026-09-07T12:00:00'));

    expect(report.global.totalDurationMinutes).toBe(200); // 90 + 60 + 50
    expect(report.global.totalSessionsCount).toBe(3);
    expect(report.global.sportBreakdown.running.minutes).toBe(140);
    expect(report.global.sportBreakdown.strength.minutes).toBe(60);
    expect(report.global.sportBreakdown.running.pct).toBe(70);
    expect(report.global.sportBreakdown.strength.pct).toBe(30);

    // Running stats
    expect(report.running.totalDistanceKm).toBe(22.5);
    expect(report.running.totalElevationGainM).toBe(830);
    expect(report.running.longestRun?.distanceKm).toBe(14.5);
    expect(report.running.maxElevationRun?.elevationGainM).toBe(450);

    // Strength stats
    expect(report.strength.totalDurationMinutes).toBe(60);
    expect(report.strength.totalSessionsCount).toBe(1);
    expect(report.strength.categoryBreakdown.calisthenicsMinutes).toBe(60);

    // QMT Prediction
    expect(report.qmtPrediction.predictedMinutes).toBeGreaterThan(500);
    expect(report.qmtPrediction.predictedMinutes).toBeLessThan(1140); // Well under 19h cutoff
    expect(report.qmtPrediction.aidStationSplits.length).toBe(6);
  });

  it('detects a downward trend in heart rate across weeks', () => {
    // Week 1: 160 bpm average
    // Week 2: 152 bpm average (-8 bpm)
    const mockActivities: GarminActivity[] = [
      {
        activityId: 'act-w1-1',
        activityName: 'Footing Semaine 1',
        activityType: 'RUNNING',
        startTimeLocal: '2026-08-25T08:00:00',
        durationMinutes: 60,
        distanceKm: 10,
        avgHeartRate: 160,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-w2-1',
        activityName: 'Footing Semaine 2',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-02T08:00:00',
        durationMinutes: 60,
        distanceKm: 10,
        avgHeartRate: 152,
        source: 'GARMIN_CONNECT'
      }
    ];

    const report = computeFullStatsReport(mockActivities, [], [], 'all', new Date('2026-09-07T12:00:00'));

    expect(report.heartRate.heartRateTrend).toBe('DECREASING');
    expect(report.heartRate.heartRateDeltaBpm).toBe(-8);
    expect(report.heartRate.currentAvgHeartRate).toBe(152);
    expect(report.heartRate.previousAvgHeartRate).toBe(160);
  });

  it('calculates QMT-80 finish time with quad armor bonus from strength workouts', () => {
    const reportWithoutStrength = calculateQmtRacePrediction(
      {
        totalDistanceKm: 40,
        totalDurationMinutes: 240,
        totalElevationGainM: 1200,
        totalElevationLossM: 1200,
        elevationDensityMPerKm: 30,
        avgPaceMinKm: '5:45',
        avgCadenceSpm: 168,
        longestRun: null,
        maxElevationRun: null,
        intensityDistribution: {
          zone2EnduranceMinutes: 180,
          zone2Pct: 75,
          zoneTempoThresholdMinutes: 50,
          zoneTempoThresholdPct: 20,
          zoneMaxMinutes: 10,
          zoneMaxPct: 5
        }
      },
      {
        totalDurationMinutes: 0,
        totalSessionsCount: 0,
        weeklyFrequency: 0,
        categoryBreakdown: { calisthenicsMinutes: 0, gymForceMinutes: 0, coreMobilityMinutes: 0 },
        strengthToRunRatioPct: 0,
        quadArmorScore: 10,
        quadArmorRating: 'Initiale',
        streakWeeks: 0
      },
      {
        currentAvgHeartRate: 150,
        previousAvgHeartRate: 150,
        heartRateDeltaBpm: 0,
        heartRateTrend: 'STABLE',
        aerobicEfficiencyIndex: 1.1,
        aerobicEfficiencyDeltaPct: 0,
        summaryText: ''
      },
      {
        totalDurationMinutes: 240,
        totalSessionsCount: 4,
        activeWeeksCount: 4,
        weeklyAverageMinutes: 60,
        weeklyProgressionPct: 0,
        progressionStatus: 'STARTING',
        sportBreakdown: {
          running: { minutes: 240, pct: 100, count: 4 },
          strength: { minutes: 0, pct: 0, count: 0 },
          crossTraining: { minutes: 0, pct: 0, count: 0 },
          other: { minutes: 0, pct: 0, count: 0 }
        },
        weeklyTrend: []
      }
    );

    const reportWithStrength = calculateQmtRacePrediction(
      {
        totalDistanceKm: 40,
        totalDurationMinutes: 240,
        totalElevationGainM: 1200,
        totalElevationLossM: 1200,
        elevationDensityMPerKm: 30,
        avgPaceMinKm: '5:45',
        avgCadenceSpm: 168,
        longestRun: null,
        maxElevationRun: null,
        intensityDistribution: {
          zone2EnduranceMinutes: 180,
          zone2Pct: 75,
          zoneTempoThresholdMinutes: 50,
          zoneTempoThresholdPct: 20,
          zoneMaxMinutes: 10,
          zoneMaxPct: 5
        }
      },
      {
        totalDurationMinutes: 180,
        totalSessionsCount: 4,
        weeklyFrequency: 2.2,
        categoryBreakdown: { calisthenicsMinutes: 120, gymForceMinutes: 60, coreMobilityMinutes: 0 },
        strengthToRunRatioPct: 75,
        quadArmorScore: 85,
        quadArmorRating: 'Optimale',
        streakWeeks: 4
      },
      {
        currentAvgHeartRate: 150,
        previousAvgHeartRate: 150,
        heartRateDeltaBpm: 0,
        heartRateTrend: 'STABLE',
        aerobicEfficiencyIndex: 1.1,
        aerobicEfficiencyDeltaPct: 0,
        summaryText: ''
      },
      {
        totalDurationMinutes: 420,
        totalSessionsCount: 8,
        activeWeeksCount: 4,
        weeklyAverageMinutes: 105,
        weeklyProgressionPct: 5,
        progressionStatus: 'SAFE_PROGRESSION',
        sportBreakdown: {
          running: { minutes: 240, pct: 57, count: 4 },
          strength: { minutes: 180, pct: 43, count: 4 },
          crossTraining: { minutes: 0, pct: 0, count: 0 },
          other: { minutes: 0, pct: 0, count: 0 }
        },
        weeklyTrend: []
      }
    );

    // High quad armor saves time on mountain downhills in the late stage
    expect(reportWithStrength.predictedMinutes).toBeLessThan(reportWithoutStrength.predictedMinutes);
    expect(reportWithStrength.factors.downhillResistanceImpactMin).toBe(-40);
  });
});
