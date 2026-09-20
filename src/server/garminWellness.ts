import { GarminWellnessData } from '../types/garmin';

interface GarminWellnessClient {
  getSleepData(date: Date): Promise<any>;
  getHeartRate(date: Date): Promise<any>;
  client: { get(url: string): Promise<any> };
}

function optionalWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); }
    );
  });
}

export function getGarminLocalDate(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Montreal',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Fetch optional wellness signals independently; one unavailable signal cannot fail activity sync. */
export async function fetchGarminWellness(
  client: GarminWellnessClient,
  date: string,
  timeoutMs = 8_000,
  syncedAt = new Date().toISOString()
): Promise<GarminWellnessData> {
  const day = new Date(`${date}T12:00:00`);
  const [sleepResponse, heartRateResponse, hrvResponse, readinessResponse] = await Promise.all([
    optionalWithin(client.getSleepData(day), timeoutMs),
    optionalWithin(client.getHeartRate(day), timeoutMs),
    optionalWithin(client.client.get(`https://connectapi.garmin.com/hrv-service/hrv/${date}`), timeoutMs),
    optionalWithin(client.client.get(`https://connectapi.garmin.com/metrics-service/metrics/trainingreadiness/${date}`), timeoutMs)
  ]);

  const sleepDto = sleepResponse?.dailySleepDTO;
  const sleep = sleepDto ? {
    score: sleepDto.sleepScores?.overall?.value || sleepDto.sleepScoreFeedback || undefined,
    totalMinutes: sleepDto.sleepTimeSeconds ? Math.round(sleepDto.sleepTimeSeconds / 60) : 0,
    deepMinutes: sleepDto.deepSleepSeconds ? Math.round(sleepDto.deepSleepSeconds / 60) : undefined,
    remMinutes: sleepDto.remSleepSeconds ? Math.round(sleepDto.remSleepSeconds / 60) : undefined,
    lightMinutes: sleepDto.lightSleepSeconds ? Math.round(sleepDto.lightSleepSeconds / 60) : undefined,
    awakeMinutes: sleepDto.awakeSleepSeconds ? Math.round(sleepDto.awakeSleepSeconds / 60) : undefined,
    qualityMessage: sleepDto.sleepScores?.overall?.qualifierKey || undefined
  } : undefined;

  const hrvSource = hrvResponse?.hrvSummary;
  const hrv = hrvSource ? {
    lastNightAvg: hrvSource.lastNightAvg || undefined,
    weeklyAvg: hrvSource.weeklyAvg || undefined,
    baselineLow: hrvSource.baseline?.lowUpper || undefined,
    baselineHigh: hrvSource.baseline?.balancedLow || undefined,
    status: hrvSource.status || 'UNKNOWN'
  } : undefined;
  const readinessSource = Array.isArray(readinessResponse) ? readinessResponse[0] : readinessResponse;

  return {
    date,
    sleep,
    restingHeartRate: typeof heartRateResponse?.restingHeartRate === 'number'
      ? heartRateResponse.restingHeartRate : undefined,
    hrv,
    trainingReadinessScore: typeof readinessSource?.score === 'number' ? readinessSource.score : undefined,
    syncedAt
  };
}
