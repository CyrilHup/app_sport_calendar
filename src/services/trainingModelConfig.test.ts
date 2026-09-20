import { describe, expect, it } from 'vitest';
import { ACTIVITY_MATCH_POLICY, TRAINING_LOAD_WINDOWS } from './trainingModelConfig';

describe('training model configuration', () => {
  it('keeps physiological windows explicit and internally consistent', () => {
    expect(TRAINING_LOAD_WINDOWS.physiologicalHistoryDays).toBeGreaterThanOrEqual(
      TRAINING_LOAD_WINDOWS.chronicFitnessDays
    );
    expect(TRAINING_LOAD_WINDOWS.chronicRatioBaselineDays % TRAINING_LOAD_WINDOWS.acuteFatigueDays).toBe(0);
    expect(Object.isFrozen(TRAINING_LOAD_WINDOWS)).toBe(true);
  });

  it('represents incompatible activities without a magic finite score', () => {
    expect(ACTIVITY_MATCH_POLICY.minimumAutomaticScore).toBe(50);
    expect(ACTIVITY_MATCH_POLICY.incompatibleScore).toBe(Number.NEGATIVE_INFINITY);
  });
});
