/** Named parameters shared by training calculations and their UI explanations. */
export const TRAINING_LOAD_WINDOWS = Object.freeze({
  physiologicalHistoryDays: 90,
  chronicFitnessDays: 42,
  acuteFatigueDays: 7,
  chronicRatioBaselineDays: 28
});

export const ACTIVITY_MATCH_POLICY = Object.freeze({
  minimumAutomaticScore: 50,
  incompatibleScore: Number.NEGATIVE_INFINITY
});
