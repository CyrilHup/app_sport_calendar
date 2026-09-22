import { describe, expect, it } from 'vitest';
import { ACTIVITY_MATCH_POLICY, ACWR_POLICY, acwrGaugePosition, acwrGaugeWidth, classifyAcwr, TRAINING_LOAD_WINDOWS } from './trainingModelConfig';

describe('shared training model policy', () => {
  it('keeps physiological windows explicit and internally consistent', () => {
    expect(TRAINING_LOAD_WINDOWS.physiologicalHistoryDays).toBeGreaterThanOrEqual(TRAINING_LOAD_WINDOWS.chronicFitnessDays);
    expect(TRAINING_LOAD_WINDOWS.chronicRatioBaselineDays % TRAINING_LOAD_WINDOWS.acuteFatigueDays).toBe(0);
    expect(Object.isFrozen(TRAINING_LOAD_WINDOWS)).toBe(true);
  });

  it('represents incompatible activities without a magic finite score', () => {
    expect(ACTIVITY_MATCH_POLICY.minimumAutomaticScore).toBe(50);
    expect(ACTIVITY_MATCH_POLICY.incompatibleScore).toBe(Number.NEGATIVE_INFINITY);
  });

  it('maps the ACWR thresholds to one continuous gauge scale', () => {
    const boundaries = [
      0,
      ACWR_POLICY.underloadBelow,
      ACWR_POLICY.moderateAbove,
      ACWR_POLICY.highAbove,
      ACWR_POLICY.gaugeMaximum
    ];
    const widths = boundaries.slice(1).map((end, index) => parseFloat(acwrGaugeWidth(boundaries[index], end)));
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100);
    expect(acwrGaugePosition(ACWR_POLICY.underloadBelow)).toBe('40%');
    expect(acwrGaugePosition(ACWR_POLICY.highAbove)).toBe('75%');
    expect(acwrGaugePosition(99)).toBe('98%');
  });

  it('keeps enough warmup history for the chronic training window', () => {
    expect(TRAINING_LOAD_WINDOWS.warmupDays).toBeGreaterThanOrEqual(TRAINING_LOAD_WINDOWS.chronicRatioBaselineDays);
  });

  it('classifies exact boundaries consistently and prioritizes cold-start calibration', () => {
    expect(classifyAcwr(0.79, 10, 10)).toBe('UNDERLOAD');
    expect(classifyAcwr(0.8, 10, 10)).toBe('OPTIMAL');
    expect(classifyAcwr(1.3, 10, 10)).toBe('OPTIMAL');
    expect(classifyAcwr(1.31, 10, 10)).toBe('MODERATE_RISK');
    expect(classifyAcwr(1.5, 10, 10)).toBe('MODERATE_RISK');
    expect(classifyAcwr(1.51, 10, 10)).toBe('DANGER_HIGH_RISK');
    expect(classifyAcwr(1.51, 1, 10)).toBe('CALIBRATING');
  });
});
