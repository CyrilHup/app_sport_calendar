import { describe, expect, it } from 'vitest';
import {
  GARMIN_TRAINING_POLICY,
  isValidGarminMaxHeartRate,
  isValidRecordedHeartRatePeak
} from './garminTrainingPolicy';

describe('Garmin training policy', () => {
  it.each([undefined, null, '203', NaN, 140, 240, Infinity])(
    'rejects invalid Garmin max heart rate %s', value => {
      expect(isValidGarminMaxHeartRate(value)).toBe(false);
    }
  );

  it.each([141, 203, 239])('accepts Garmin max heart rate %s', value => {
    expect(isValidGarminMaxHeartRate(value)).toBe(true);
  });

  it('uses the same upper bound but a stricter lower bound for recorded peaks', () => {
    expect(isValidRecordedHeartRatePeak(150)).toBe(false);
    expect(isValidRecordedHeartRatePeak(151)).toBe(true);
    expect(isValidRecordedHeartRatePeak(239)).toBe(true);
    expect(isValidRecordedHeartRatePeak(240)).toBe(false);
  });

  it('retains the existing pace defaults used by Garmin workout generation', () => {
    expect(GARMIN_TRAINING_POLICY.initialBasePace).toBe('6:05');
    expect(GARMIN_TRAINING_POLICY.defaultPaceMarginSeconds).toBe(18);
    expect(GARMIN_TRAINING_POLICY.warmupPaceMarginSeconds).toBe(20);
  });
});
