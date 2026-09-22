/** Garmin-derived values and workout defaults, shared by the browser and API. */
export const GARMIN_TRAINING_POLICY = Object.freeze({
  maxHeartRateExclusiveMin: 140,
  maxHeartRateExclusiveMax: 240,
  recordedPeakExclusiveMin: 150,
  trailElevationMeters: 80,
  flatElevationMetersPerKm: 35,
  initialBasePace: '6:05',
  defaultPaceMarginSeconds: 18,
  warmupPaceMarginSeconds: 20,
  reserveFractions: Object.freeze({
    trail: 0.72,
    easyRun: 0.60,
    strength: 0.45,
    intenseTrail: 0.80,
    tempo: 0.75,
    other: 0.65
  })
});

export function isValidGarminMaxHeartRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    value > GARMIN_TRAINING_POLICY.maxHeartRateExclusiveMin &&
    value < GARMIN_TRAINING_POLICY.maxHeartRateExclusiveMax;
}

export function isValidRecordedHeartRatePeak(value: unknown): value is number {
  return isValidGarminMaxHeartRate(value) &&
    value > GARMIN_TRAINING_POLICY.recordedPeakExclusiveMin;
}
