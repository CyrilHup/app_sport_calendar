/** Named parameters shared by training calculations and their UI explanations. */
export const TRAINING_LOAD_WINDOWS = Object.freeze({
  physiologicalHistoryDays: 90,
  chronicFitnessDays: 42,
  acuteFatigueDays: 7,
  chronicRatioBaselineDays: 28,
  warmupDays: 35
});

/** One policy for ACWR classification, adaptive decisions and the displayed scale. */
export const ACWR_POLICY = Object.freeze({
  underloadBelow: 0.8,
  severeUnderloadBelow: 0.6,
  severeFatigueTsbBelow: -25,
  lowReadinessBelow: 50,
  moderateAbove: 1.3,
  highAbove: 1.5,
  calibratingAbove: 1.4,
  minimumActiveDays: 3,
  minimumChronicWeeklyKmEffort: 5,
  gaugeMaximum: 2
});

/** Recipe values for adaptive workout changes; keeping them together prevents drift between rules and copy. */
export const ADAPTIVE_WORKOUT_POLICY = Object.freeze({
  longWorkoutThresholdMinutes: 50,
  defaultTrailElevationMeters: 380,
  assumedTrailElevationPerMinuteMeters: 3.5,
  highRisk: Object.freeze({
    hillRecoveryCapMinutes: 35,
    longTrailMinimumMinutes: 45,
    longTrailDurationFactor: 0.72,
    longTrailElevationFactor: 0.55,
    easyRunCapMinutes: 30,
    walkingInclineThresholdPercent: 8,
    recoveryHeartRateRangeBpm: Object.freeze([130, 150] as const),
    longTrailHeartRateRangeBpm: Object.freeze([135, 158] as const)
  }),
  moderateRisk: Object.freeze({
    hillMinimumMinutes: 40,
    hillDurationFactor: 0.85,
    hillElevationFactor: 0.6,
    hillWarmupMinutes: 15,
    hillSetCount: 1,
    originalHillSetCount: 2,
    hillRepetitionCount: 5,
    hillRepetitionDurationMinutes: 1,
    hillTargetHeartRateRangeBpm: Object.freeze([160, 175] as const)
  }),
  underload: Object.freeze({
    hillDurationMinutes: 40,
    hillElevationMeters: 200,
    hillSetCount: 1,
    hillRepetitionRange: Object.freeze([4, 5] as const),
    hillTargetHeartRateRangeBpm: Object.freeze([160, 172] as const),
    maximumProgressionPercent: 10
  })
});

export type AcwrStatus = 'UNDERLOAD' | 'OPTIMAL' | 'MODERATE_RISK' | 'DANGER_HIGH_RISK' | 'CALIBRATING';

export function classifyAcwr(ratio: number, activeDays: number, acuteLoad: number): AcwrStatus {
  if (activeDays < ACWR_POLICY.minimumActiveDays && acuteLoad > 0 && ratio > ACWR_POLICY.calibratingAbove) return 'CALIBRATING';
  if (ratio < ACWR_POLICY.underloadBelow) return 'UNDERLOAD';
  if (ratio > ACWR_POLICY.highAbove) return 'DANGER_HIGH_RISK';
  if (ratio > ACWR_POLICY.moderateAbove) return 'MODERATE_RISK';
  return 'OPTIMAL';
}

export function acwrGaugeWidth(start: number, end: number): string {
  return `${((end - start) / ACWR_POLICY.gaugeMaximum) * 100}%`;
}

export function acwrGaugePosition(ratio: number): string {
  return `${Math.min(98, Math.max(2, (ratio / ACWR_POLICY.gaugeMaximum) * 100))}%`;
}

export const ACTIVITY_MATCH_POLICY = Object.freeze({
  minimumAutomaticScore: 50,
  incompatibleScore: Number.NEGATIVE_INFINITY
});
