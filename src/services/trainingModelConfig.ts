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
