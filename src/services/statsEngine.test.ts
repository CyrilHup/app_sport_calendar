import { describe, it, expect } from 'vitest';
import {
  computeFullStatsReport,
  computeTrainingLoadStats,
  calculateSessionTrimp,
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
    expect(report.heartRate.comparisonBaselineText).toContain('152 bpm');
  });

  it('filters out pre-September activities and bonus walks when focusing on the plan', () => {
    const mixedActivities: GarminActivity[] = [
      {
        activityId: 'act-july',
        activityName: 'Course été juillet',
        activityType: 'RUNNING',
        startTimeLocal: '2026-07-15T08:00:00',
        durationMinutes: 45,
        distanceKm: 7.5,
        avgHeartRate: 165,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-plan-run',
        activityName: 'Côtes Mont-Royal',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-02T08:00:00',
        durationMinutes: 50,
        distanceKm: 8.0,
        elevationGainM: 350,
        avgHeartRate: 148,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-plan-walk',
        activityName: 'Marche balade bonus',
        activityType: 'WALKING',
        startTimeLocal: '2026-09-03T18:00:00',
        durationMinutes: 40,
        distanceKm: 3.0,
        avgHeartRate: 98,
        source: 'GARMIN_CONNECT'
      }
    ];

    // Under 'plan' scope and includeBonusActivities: false
    const reportPlan = computeFullStatsReport(mixedActivities, [], [], 'plan', new Date('2026-09-07T12:00:00'), false);

    // July activity is excluded because scope is 'plan' (starts 2026-09-01)
    // Walk bonus activity is excluded from training volume
    expect(reportPlan.global.totalSessionsCount).toBe(1);
    expect(reportPlan.global.totalDurationMinutes).toBe(50);
    expect(reportPlan.global.excludedBonusCount).toBe(1);
    expect(reportPlan.global.excludedBonusMinutes).toBe(40);
    expect(reportPlan.running.totalDistanceKm).toBe(8.0);
    expect(reportPlan.heartRate.historicalPrePlanAvgHr).toBe(165); // Detected pre-plan HR baseline from July!
  });

  it('calculates QMT-80 finish time with quad armor bonus from strength workouts', () => {
    const reportWithoutStrength = calculateQmtRacePrediction(
      {
        totalDistanceKm: 40,
        totalDurationMinutes: 240,
        totalElevationGainM: 1200,
        totalElevationLossM: 1200,
        elevationDensityMPerKm: 30,
        densityComparisonText: '',
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
        summaryText: '',
        comparisonBaselineText: '',
        historicalPrePlanAvgHr: null
      },
      {
        totalDurationMinutes: 240,
        totalSessionsCount: 4,
        activeWeeksCount: 4,
        weeklyAverageMinutes: 60,
        weeklyProgressionPct: 0,
        progressionStatus: 'STARTING',
        progressionComparisonText: '',
        excludedBonusCount: 0,
        excludedBonusMinutes: 0,
        isFilteringBonuses: true,
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
        densityComparisonText: '',
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
        summaryText: '',
        comparisonBaselineText: '',
        historicalPrePlanAvgHr: null
      },
      {
        totalDurationMinutes: 420,
        totalSessionsCount: 8,
        activeWeeksCount: 4,
        weeklyAverageMinutes: 105,
        weeklyProgressionPct: 5,
        progressionStatus: 'SAFE_PROGRESSION',
        progressionComparisonText: '',
        excludedBonusCount: 0,
        excludedBonusMinutes: 0,
        isFilteringBonuses: true,
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

  it('computes CTL, ATL, TSB and ACWR injury ratio correctly', () => {
    const mockActivities: GarminActivity[] = [
      {
        activityId: 'act-1',
        activityName: 'Course longue',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-01T08:00:00',
        durationMinutes: 90,
        trainingLoad: 110,
        elevationGainM: 400,
        elevationLossM: 400,
        distanceKm: 14,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-2',
        activityName: 'Intervalles côtes',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-04T18:00:00',
        durationMinutes: 60,
        trainingLoad: 85,
        elevationGainM: 350,
        elevationLossM: 350,
        distanceKm: 9,
        source: 'GARMIN_CONNECT'
      }
    ];

    const report = computeFullStatsReport(mockActivities, [], [], 'all', new Date('2026-09-07T12:00:00'));

    expect(report.trainingLoad).toBeDefined();
    expect(report.trainingLoad.fitnessTrend.length).toBeGreaterThan(0);
    expect(report.trainingLoad.currentCtl).toBeGreaterThan(0);
    expect(report.trainingLoad.currentAtl).toBeGreaterThan(0);
    expect(typeof report.trainingLoad.acwrRatio).toBe('number');

    expect(report.trailSpecific).toBeDefined();
    expect(report.trailSpecific.totalElevationLossM).toBe(750);
    expect(report.trailSpecific.avgVamMPerHour).toBeGreaterThan(0);
    expect(report.trailSpecific.gradeAdjustedPaceMinKm).not.toBe('-');
  });

  it('includes unplanned and bonus runs by default in volume, distance and load', () => {
    const activitiesWithBonus: GarminActivity[] = [
      {
        activityId: 'act-plan-run',
        activityName: 'Sortie Mont-Royal',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-02T08:00:00',
        durationMinutes: 45,
        distanceKm: 7.5,
        avgHeartRate: 155,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-bonus-run-today',
        activityName: 'Montreal Running (Bonus)',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-07T14:00:00',
        durationMinutes: 18,
        distanceKm: 3.8,
        elevationGainM: 15,
        elevationLossM: 8,
        avgHeartRate: 162,
        source: 'GARMIN_CONNECT'
      }
    ];

    const comparisons = [
      {
        id: 'comp-unplanned-bonus',
        date: '2026-09-07',
        status: 'UNPLANNED' as const,
        actualActivity: activitiesWithBonus[1],
        durationDeltaMinutes: 18,
        complianceScore: 100,
        heartRateCompliance: 'OPTIMAL' as const,
        feedbackNotes: ['Séance bonus']
      }
    ];

    // By default (includeBonusActivities omitted), bonus run is included
    const defaultReport = computeFullStatsReport(
      activitiesWithBonus,
      comparisons,
      [],
      'plan',
      new Date('2026-09-07T18:00:00')
    );

    expect(defaultReport.global.totalSessionsCount).toBe(2);
    expect(defaultReport.global.totalDurationMinutes).toBe(63); // 45 + 18
    expect(defaultReport.running.totalDistanceKm).toBe(11.3); // 7.5 + 3.8
    expect(defaultReport.global.isFilteringBonuses).toBe(false);

    // If explicitly filtered
    const filteredReport = computeFullStatsReport(
      activitiesWithBonus,
      comparisons,
      [],
      'plan',
      new Date('2026-09-07T18:00:00'),
      false
    );

    expect(filteredReport.global.totalSessionsCount).toBe(1);
    expect(filteredReport.global.totalDurationMinutes).toBe(45);
    expect(filteredReport.running.totalDistanceKm).toBe(7.5);
    expect(filteredReport.global.excludedBonusCount).toBe(1);
    expect(filteredReport.global.isFilteringBonuses).toBe(true);
  });

  it('preserves historical July/August training in CTL and ACWR even when scope is plan', () => {
    const historicalAndCurrent: GarminActivity[] = [
      {
        activityId: 'august-run-1',
        activityName: 'Sortie d\'août',
        activityType: 'RUNNING',
        startTimeLocal: '2026-08-15T08:00:00',
        durationMinutes: 60,
        trainingLoad: 80,
        distanceKm: 10,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'august-run-2',
        activityName: 'Sortie d\'août 2',
        activityType: 'RUNNING',
        startTimeLocal: '2026-08-22T08:00:00',
        durationMinutes: 70,
        trainingLoad: 95,
        distanceKm: 11,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'sept-run-1',
        activityName: 'Course début septembre',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-02T08:00:00',
        durationMinutes: 50,
        trainingLoad: 70,
        distanceKm: 8,
        source: 'GARMIN_CONNECT'
      }
    ];

    const report = computeFullStatsReport(
      historicalAndCurrent,
      [],
      [],
      'plan',
      new Date('2026-09-07T12:00:00')
    );

    // Global volume only counts plan activities (September)
    expect(report.global.totalSessionsCount).toBe(1);
    expect(report.running.totalDistanceKm).toBe(8);

    // BUT physiological load includes August activities in the 90-day window!
    expect(report.trainingLoad.currentCtl).toBeGreaterThan(0);
    expect(report.trainingLoad.chronicLoad28dWeeklyAvg).toBeGreaterThan(15);
    expect(report.trainingLoad.acwrActionAdvice).toBeDefined();
  });

  it('excludes calisthenics from trail ACWR injury ratio while preserving whole-body fitness', () => {
    const runOnlyActivities: GarminActivity[] = [
      {
        activityId: 'run-1',
        activityName: 'Sortie Trail Mont-Royal',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-02T08:00:00',
        durationMinutes: 50,
        trainingLoad: 80,
        distanceKm: 8,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'run-2',
        activityName: 'Footing endurance',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-04T08:00:00',
        durationMinutes: 45,
        trainingLoad: 65,
        distanceKm: 7.5,
        source: 'GARMIN_CONNECT'
      }
    ];

    const activitiesWithHeavyCalisthenics: GarminActivity[] = [
      ...runOnlyActivities,
      {
        activityId: 'calis-1',
        activityName: 'Calisthenics Push & Core',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-01T17:00:00',
        durationMinutes: 65,
        trainingLoad: 110, // High training load from Garmin Connect
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'calis-2',
        activityName: 'Calisthenics Pull & Tractions',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-03T17:00:00',
        durationMinutes: 65,
        trainingLoad: 115,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'calis-3',
        activityName: 'Calisthenics Skills & Handstand',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-05T17:00:00',
        durationMinutes: 55,
        trainingLoad: 95,
        source: 'GARMIN_CONNECT'
      }
    ];

    const reportRunOnly = computeFullStatsReport(runOnlyActivities, [], [], 'all', new Date('2026-09-07T12:00:00'));
    const reportWithCalis = computeFullStatsReport(activitiesWithHeavyCalisthenics, [], [], 'all', new Date('2026-09-07T12:00:00'));

    // Trail injury load (acute load & ACWR) MUST be identical despite 3 heavy calisthenics workouts
    expect(reportWithCalis.trainingLoad.trailAcuteLoad7d).toBe(reportRunOnly.trainingLoad.trailAcuteLoad7d);
    expect(reportWithCalis.trainingLoad.acwrRatio).toBe(reportRunOnly.trainingLoad.acwrRatio);
    expect(reportWithCalis.trainingLoad.trailAcwrRatio).toBe(reportRunOnly.trainingLoad.trailAcwrRatio);

    // Calisthenics load is recorded separately
    expect(reportWithCalis.trainingLoad.calisthenicsAcuteLoad7d).toBe(320); // 110 + 115 + 95
    expect(reportWithCalis.trainingLoad.calisthenicsSessionsCount7d).toBe(3);

    // Whole-body systemic load (CTL/ATL) DOES include calisthenics
    expect(reportWithCalis.trainingLoad.totalSystemicAcuteLoad7d).toBeGreaterThan(reportRunOnly.trainingLoad.totalSystemicAcuteLoad7d);
    expect(reportWithCalis.trainingLoad.currentAtl).toBeGreaterThan(reportRunOnly.trainingLoad.currentAtl);
  });

  it('calculates accurate Banister TRIMP with real cardio telemetry vs theoretical planned workouts', () => {
    // 1. Theoretical planned 35-min footing without telemetry (Zone 1/2 baseline)
    const plannedEasy = calculateSessionTrimp(35, 'RUN_EASY', 'Footing Aérobie Doux & Récupération Z1/Z2 (35 min)');
    expect(plannedEasy.trimp).toBe(32);
    expect(plannedEasy.isRealTelemetry).toBe(false);
    expect(plannedEasy.ratePerMin).toBe(0.92);

    // 2. Theoretical planned 70-min hill workout (TRAIL_INTENSE)
    const plannedHills = calculateSessionTrimp(70, 'TRAIL_INTENSE', 'Côtes & D+ Mont-Royal');
    expect(plannedHills.trimp).toBe(76);
    expect(plannedHills.factor).toBe(1.35);

    // 3. Real 18-min run executed at 4:31/km with 162 bpm avg, 197 bpm peak, +15m D+
    const executedRun = calculateSessionTrimp(
      18,
      'RUNNING',
      'Course',
      null,
      {
        avgHeartRate: 162,
        maxHeartRate: 197,
        elevationGainM: 15,
        distanceKm: 4.09,
        athleteFcMax: 203,
        athleteFcRest: 48
      }
    );

    // 18 min at high intensity (162 bpm avg = 73.5% HRr, rate ~2.22 TRIMP/min) -> 40 TRIMP
    expect(executedRun.trimp).toBe(40);
    expect(executedRun.cardioTrimp).toBe(35);
    expect(executedRun.isRealTelemetry).toBe(true);
    expect(executedRun.ratePerMin).toBe(2.22);
    expect(executedRun.formulaText).toContain('18 min × 2.22 TRIMP/min = 40 TRIMP');
    expect(executedRun.formulaText).toContain('FC moy. 162 bpm');
    expect(executedRun.formulaText).toContain('Pic 197 bpm');
    expect(executedRun.details).toContain('Banister FC réelle');
    expect(executedRun.details).toContain('74% Réserve Cardiaque');

    // 4. Verification that computeTrainingLoadStats integrates real telemetry TRIMP
    const realActivities: GarminActivity[] = [
      {
        activityId: 'act-run-18m',
        activityName: 'Course 18 min soutenue',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-07T14:00:00',
        durationMinutes: 18,
        distanceKm: 4.09,
        elevationGainM: 15,
        avgHeartRate: 162,
        maxHeartRate: 197,
        source: 'GARMIN_CONNECT'
      }
    ];

    const tlStats = computeTrainingLoadStats(realActivities, new Date('2026-09-07T18:00:00'));
    // Acute load must be 40 TRIMP (not the generic 17 TRIMP from duration without cardio!)
    expect(tlStats.trailAcuteLoad7d).toBe(40);
    expect(tlStats.recentSessions7d[0].trimp).toBe(40);
    expect(tlStats.recentSessions7d[0].formulaText).toContain('40 TRIMP');
  });

  it('maintains timezone consistency for ACWR and acute load on reference date', () => {
    const activities: GarminActivity[] = [
      {
        activityId: 'act-sept1',
        activityName: 'Trail Mont-Royal',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-01T10:00:00',
        durationMinutes: 85,
        distanceKm: 12.0,
        elevationGainM: 420,
        avgHeartRate: 155,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-sept7',
        activityName: 'Course 18 min',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-07T14:00:00',
        durationMinutes: 18,
        distanceKm: 4.0,
        avgHeartRate: 162,
        maxHeartRate: 197,
        source: 'GARMIN_CONNECT'
      }
    ];

    // Reference date: Sept 8 noon vs Date object
    const dateObj = new Date('2026-09-08T14:00:00');
    const noonDate = new Date('2026-09-08T12:00:00');

    const stats1 = computeTrainingLoadStats(activities, dateObj);
    const stats2 = computeTrainingLoadStats(activities, noonDate);

    // Both must evaluate Sept 8 as day 0, meaning Sept 1 is 7 days prior (outside the 7d acute window)
    // and Sept 7 is 1 day prior (inside acute window)
    expect(stats1.trailAcuteLoad7d).toBe(stats2.trailAcuteLoad7d);
    expect(stats1.trailAcwrRatio).toBe(stats2.trailAcwrRatio);
    expect(stats1.trailAcuteLoad7d).toBe(40); // Only the Sept 7 run (40 TRIMP)
  });

  it('computes dynamic athlete base pace and filters out steep hill climbs', async () => {
    const { computeDynamicAthleteBasePace } = await import('./garminService');

    const flatRuns: GarminActivity[] = [
      {
        activityId: 'run-flat-1',
        activityName: 'Footing plat',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-02T10:00:00',
        durationMinutes: 30,
        distanceKm: 5.0,
        elevationGainM: 20, // 4 m/km < 35 m/km threshold
        avgPaceMinKm: '6:00',
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'run-steep-hill',
        activityName: 'Répétitions de côtes raides',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-03T10:00:00',
        durationMinutes: 45,
        distanceKm: 4.0,
        elevationGainM: 320, // 80 m/km > 35 m/km -> excluded from flat base pace
        avgPaceMinKm: '8:30',
        source: 'GARMIN_CONNECT'
      }
    ];

    const pace = computeDynamicAthleteBasePace(flatRuns);
    expect(pace).toBe('6:00');
  });

  it('computes resting heart rate baseline from wellness records', async () => {
    const { getBaselineRestingHeartRate, saveWellnessData } = await import('./readinessEngine');

    saveWellnessData({
      date: '2026-09-01',
      restingHeartRate: 46,
      syncedAt: new Date().toISOString()
    });
    saveWellnessData({
      date: '2026-09-02',
      restingHeartRate: 50,
      syncedAt: new Date().toISOString()
    });

    const baseline = getBaselineRestingHeartRate();
    expect(baseline).toBe(48); // Math.round((46 + 50) / 2)
  });

  it('filters activities for the current week correctly (Monday to Sunday)', async () => {
    const { filterItemsByScope } = await import('./statsEngine');

    // Thursday Sept 10, 2026 -> Monday is Sept 7, Sunday is Sept 13
    const asOfDate = new Date('2026-09-10T14:30:00');

    const items = [
      { id: '1', date: '2026-09-06' }, // Sunday prior week -> exclude
      { id: '2', date: '2026-09-07' }, // Monday current week -> include
      { id: '3', date: '2026-09-08' }, // Tuesday current week -> include
      { id: '4', date: '2026-09-10' }, // Thursday current week -> include
      { id: '5', date: '2026-09-13' }, // Sunday current week -> include
      { id: '6', date: '2026-09-14' }  // Monday next week -> exclude
    ];

    const filtered = filterItemsByScope(items, 'week', asOfDate);
    expect(filtered.map(i => i.id)).toEqual(['2', '3', '4', '5']);
  });

  it('aggregates all activities within a Monday-Sunday week into a single week bucket regardless of time of day', () => {
    const activities: GarminActivity[] = [
      {
        activityId: 'act-mon-morning',
        activityName: 'Footing lundi matin',
        activityType: 'RUNNING',
        startTimeLocal: '2026-09-07 07:15:00',
        durationMinutes: 45,
        distanceKm: 7.0,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-tue-night',
        activityName: 'Calisthénie mardi soir',
        activityType: 'STRENGTH_TRAINING',
        startTimeLocal: '2026-09-08 21:30:00',
        durationMinutes: 60,
        source: 'GARMIN_CONNECT'
      },
      {
        activityId: 'act-thu-afternoon',
        activityName: 'Sentiers jeudi',
        activityType: 'TRAIL_RUNNING',
        startTimeLocal: '2026-09-10 16:00:00',
        durationMinutes: 50,
        distanceKm: 8.0,
        source: 'GARMIN_CONNECT'
      }
    ];

    const report = computeFullStatsReport(activities, [], [], 'week', new Date('2026-09-10T18:00:00'));
    expect(report.global.weeklyTrend.length).toBe(1);
    expect(report.global.weeklyTrend[0].weekKey).toBe('2026-09-07');
    expect(report.global.weeklyTrend[0].totalMinutes).toBe(155); // 45 + 60 + 50
    expect(report.global.weeklyTrend[0].sessionCount).toBe(3);
  });
});



