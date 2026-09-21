import { GarminActivity } from '../types/garmin.js';

export interface StravaActivitySummary {
  id: number | string;
  name?: string;
  start_date_local?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  elev_high?: number;
  elev_low?: number;
  sport_type?: string;
  type?: string;
}

export interface StravaActivityMatch {
  garminActivity: GarminActivity;
  stravaActivity: StravaActivitySummary;
  score: number;
}

export interface GarminActivityMatchInput {
  activityId: string;
  startTimeLocal: string;
  durationMinutes: number;
  distanceKm?: number;
  activityType?: string;
}

function readDateKey(value?: string): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

function readWallClockMinutes(value?: string): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60;
}

function dayNumber(value?: string): number | null {
  const key = readDateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Compares local activity clocks without assuming that Garmin's local string
 * has a timezone offset while Strava's one does.
 */
export function localStartDifferenceMinutes(left?: string, right?: string): number {
  const leftClock = readWallClockMinutes(left);
  const rightClock = readWallClockMinutes(right);
  const leftDay = dayNumber(left);
  const rightDay = dayNumber(right);
  if (leftClock === null || rightClock === null || leftDay === null || rightDay === null) {
    const leftTime = left ? Date.parse(left) : NaN;
    const rightTime = right ? Date.parse(right) : NaN;
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
    return Math.abs(leftTime - rightTime) / 60_000;
  }

  return Math.abs((leftDay - rightDay) * 1_440 + leftClock - rightClock);
}

export function isStravaRunningActivity(activity: StravaActivitySummary): boolean {
  const type = String(activity.sport_type || activity.type || '').toLowerCase().replace(/[^a-z]/g, '');
  return type === 'run' || type === 'trailrun' || type === 'virtualrun';
}

function isGarminRunningActivity(activity: GarminActivityMatchInput): boolean {
  const type = String(activity.activityType || '').toUpperCase();
  return type === 'RUNNING' || type === 'TRAIL_RUNNING';
}

function scoreCandidate(
  garminActivity: GarminActivityMatchInput,
  stravaActivity: StravaActivitySummary
): number | null {
  if (!isGarminRunningActivity(garminActivity) || !isStravaRunningActivity(stravaActivity)) return null;

  const startDifference = localStartDifferenceMinutes(garminActivity.startTimeLocal, stravaActivity.start_date_local);
  if (!Number.isFinite(startDifference) || startDifference > 90) return null;

  const stravaDuration = Number(stravaActivity.moving_time || stravaActivity.elapsed_time || 0);
  const garminDuration = Math.max(0, Number(garminActivity.durationMinutes || 0) * 60);
  const durationDifference = stravaDuration > 0 && garminDuration > 0
    ? Math.abs(stravaDuration - garminDuration) / 60
    : null;

  if (durationDifference !== null && durationDifference > Math.max(15, garminActivity.durationMinutes * 0.35)) {
    return null;
  }

  const stravaDistanceKm = Number(stravaActivity.distance || 0) / 1_000;
  const garminDistanceKm = Number(garminActivity.distanceKm || 0);
  const distanceDifferenceKm = stravaDistanceKm > 0 && garminDistanceKm > 0
    ? Math.abs(stravaDistanceKm - garminDistanceKm)
    : null;

  if (distanceDifferenceKm !== null && distanceDifferenceKm > Math.max(1.2, garminDistanceKm * 0.2)) {
    return null;
  }

  let score = startDifference <= 5 ? 50 : startDifference <= 15 ? 40 : startDifference <= 45 ? 30 : 20;
  if (durationDifference === null) score += 10;
  else if (durationDifference <= 2) score += 30;
  else if (durationDifference <= 5) score += 20;
  else if (durationDifference <= 10) score += 10;

  if (distanceDifferenceKm === null) score += 10;
  else if (distanceDifferenceKm <= Math.max(0.15, garminDistanceKm * 0.03)) score += 20;
  else if (distanceDifferenceKm <= Math.max(0.5, garminDistanceKm * 0.08)) score += 12;
  else score += 5;

  return score;
}

/**
 * Matches one Strava activity to at most one Garmin activity. Matching is
 * deliberately conservative: a false match would replace a correct Garmin
 * record with the wrong terrain profile.
 */
export function matchStravaActivities(
  garminActivities: GarminActivityMatchInput[],
  stravaActivities: StravaActivitySummary[]
): StravaActivityMatch[] {
  const candidates: Array<{ garminActivity: GarminActivityMatchInput; stravaActivity: StravaActivitySummary; score: number }> = [];

  for (const garminActivity of garminActivities) {
    for (const stravaActivity of stravaActivities) {
      const score = scoreCandidate(garminActivity, stravaActivity);
      if (score !== null && score >= 65) {
        candidates.push({ garminActivity, stravaActivity, score });
      }
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  const usedGarminIds = new Set<string>();
  const usedStravaIds = new Set<string>();
  const matches: StravaActivityMatch[] = [];

  for (const candidate of candidates) {
    const garminId = String(candidate.garminActivity.activityId);
    const stravaId = String(candidate.stravaActivity.id);
    if (usedGarminIds.has(garminId) || usedStravaIds.has(stravaId)) continue;
    usedGarminIds.add(garminId);
    usedStravaIds.add(stravaId);
    matches.push({
      garminActivity: candidate.garminActivity as GarminActivity,
      stravaActivity: candidate.stravaActivity,
      score: candidate.score
    });
  }

  return matches;
}

/**
 * Strava already smooths its altitude data before exposing activity metrics.
 * The threshold avoids turning tiny residual stream noise into downhill load.
 */
export function calculateElevationLossM(altitudes: unknown[], thresholdM = 2): number | undefined {
  const values = altitudes
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  if (values.length < 2) return undefined;

  let lossM = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta < -Math.max(0, thresholdM)) lossM += -delta;
  }
  return Math.round(lossM);
}
