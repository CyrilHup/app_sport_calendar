import { CalendarEvent } from '../types/calendar';
import { WorkoutPushResult } from '../types/garmin';
import {
  GARMIN_WORKOUT_DEFINITION_VERSION,
  getGarminWorkoutTargetMode,
  loadGarminCredentials,
  loadGarminCredentialsAsync,
  pushWorkoutToGarmin
} from './garminService';
import { STORAGE_KEYS, storageGet, storageSet } from './storageService';


export const GARMIN_AUTO_SYNC_ENABLED_KEY = STORAGE_KEYS.GARMIN_AUTO_SYNC_ENABLED;
// v2 deliberately invalidates the previous cache, which could contain false positives:
// the API used to report success even when Garmin rejected calendar scheduling.
export const GARMIN_SYNCED_SIGNATURES_KEY = STORAGE_KEYS.GARMIN_SYNCED_SIGNATURES;

export interface AutoSyncResult {
  success: boolean;
  pushedCount: number;
  totalWeekWorkouts: number;
  alreadyUpToDate: boolean;
  results: WorkoutPushResult[];
  error?: string;
  reason?: 'NO_CREDENTIALS' | 'DISABLED' | 'NO_WORKOUTS' | 'ERROR' | 'SUCCESS';
  lastSyncTimestamp?: string;
}

/**
 * Checks whether automatic Garmin synchronization for the current week is enabled.
 * Defaults to true if user hasn't explicitly disabled it.
 */
export function isGarminAutoSyncEnabled(): boolean {
  return storageGet<boolean>(GARMIN_AUTO_SYNC_ENABLED_KEY, true);
}

/**
 * Enables or disables automatic Garmin synchronization.
 */
export function setGarminAutoSyncEnabled(enabled: boolean): void {
  storageSet(GARMIN_AUTO_SYNC_ENABLED_KEY, enabled);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('garmin_auto_sync_config_changed', { detail: { enabled } }));
  }
}

/**
 * Computes a deterministic content signature for a workout.
 * Any modification (postponement, duration change, adapted status, elevation) changes this signature.
 */
export function computeWorkoutSyncSignature(event: CalendarEvent): string {
  return `${GARMIN_WORKOUT_DEFINITION_VERSION}::${event.id}::${JSON.stringify({
    startDate: event.startDate,
    durationMinutes: event.durationMinutes || 0,
    sportType: event.sportType || 'SPORT',
    title: event.title,
    description: event.description,
    targetMode: getGarminWorkoutTargetMode(),
    targetHeartRate: event.metadata?.targetHeartRate,
    targetHeartRateRange: event.metadata?.targetHeartRateRange,
    targetElevationM: event.metadata?.targetElevationM,
    targetCadence: event.metadata?.targetCadence,
    isAdapted: Boolean(event.metadata?.isAdapted),
    originalDate: event.metadata?.originalDate || ''
  })}`;
}

/**
 * Retrieves the stored map of synced workout signatures.
 */
export function getSyncedWeekWorkoutSignatures(): Record<string, string> {
  return storageGet<Record<string, string>>(GARMIN_SYNCED_SIGNATURES_KEY, {});
}

/**
 * Saves the map of synced workout signatures.
 */
export function saveSyncedWeekWorkoutSignatures(signatures: Record<string, string>): void {
  storageSet(GARMIN_SYNCED_SIGNATURES_KEY, signatures);
}

/** Returns true only when the current version of this exact workout was confirmed by Garmin. */
export function isWorkoutSyncedToGarmin(event: CalendarEvent): boolean {
  const signatures = getSyncedWeekWorkoutSignatures();
  return signatures[event.id] === computeWorkoutSyncSignature(event);
}

/**
 * Calculates the Monday Date of the week containing date.
 */
import { getMondayOfWeek, formatDateKey, toLocalDateKey } from './dateUtils';
export { getMondayOfWeek, formatDateKey, toLocalDateKey };

/**
 * Calculates start and end boundaries (Monday to Sunday) for the week containing referenceDate.
 */
export function getCurrentWeekDateBounds(referenceDate: Date = new Date()): {
  weekStartStr: string;
  weekEndStr: string;
  monday: Date;
  sunday: Date;
} {
  const monday = getMondayOfWeek(referenceDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekStartStr = formatDateKey(monday);
  const weekEndStr = formatDateKey(sunday);

  return { weekStartStr, weekEndStr, monday, sunday };
}

/**
 * Filters all calendar events down to only valid sport workouts scheduled for the current week.
 */
export function filterCurrentWeekSportWorkouts(
  events: CalendarEvent[],
  referenceDate: Date = new Date()
): CalendarEvent[] {
  const { weekStartStr, weekEndStr } = getCurrentWeekDateBounds(referenceDate);

  return events.filter(ev => {
    if (ev.category !== 'sport') return false;
    if (ev.metadata?.isPostponedPlaceholder) return false;
    const evDate = toLocalDateKey(ev.startDate);
    return evDate >= weekStartStr && evDate <= weekEndStr;
  });
}

// All callers share the active operation. Changes arriving during a push are
// queued as one latest follow-up so a stale calendar is never the final state.
let autoSyncInFlight: Promise<AutoSyncResult> | null = null;
let activeRequestKey: string | null = null;
let queuedRequest: {
  events: CalendarEvent[];
  referenceDate: Date;
  options?: { force?: boolean };
  key: string;
} | null = null;

function workoutSyncRequestKey(
  events: CalendarEvent[],
  referenceDate: Date,
  options?: { force?: boolean }
): string {
  return JSON.stringify({
    week: getCurrentWeekDateBounds(referenceDate).weekStartStr,
    force: Boolean(options?.force),
    signatures: filterCurrentWeekSportWorkouts(events, referenceDate)
      .map(computeWorkoutSyncSignature)
      .sort()
  });
}

/**
 * Automatically pushes current week's sport workouts to Garmin Connect.
 * Compares workout signatures to avoid redundant pushes and duplicates on Garmin calendar.
 */
async function runCurrentWeekWorkoutSync(
  events: CalendarEvent[],
  referenceDate: Date = new Date(),
  options?: { force?: boolean }
): Promise<AutoSyncResult> {
  const isEnabled = isGarminAutoSyncEnabled();
  if (!isEnabled && !options?.force) {
    return {
      success: false,
      pushedCount: 0,
      totalWeekWorkouts: 0,
      alreadyUpToDate: false,
      results: [],
      reason: 'DISABLED'
    };
  }

  const creds = loadGarminCredentials() || (await loadGarminCredentialsAsync());
  if (!creds?.email || !creds?.password) {
    return {
      success: false,
      pushedCount: 0,
      totalWeekWorkouts: 0,
      alreadyUpToDate: false,
      results: [],
      reason: 'NO_CREDENTIALS',
      error: 'Identifiants Garmin Connect non configurés.'
    };
  }

  const weekWorkouts = filterCurrentWeekSportWorkouts(events, referenceDate);
  if (weekWorkouts.length === 0) {
    return {
      success: true,
      pushedCount: 0,
      totalWeekWorkouts: 0,
      alreadyUpToDate: true,
      results: [],
      reason: 'NO_WORKOUTS'
    };
  }

  try {
    const existingSignatures = getSyncedWeekWorkoutSignatures();
    const updatedSignatures = { ...existingSignatures };
    const toPush: CalendarEvent[] = [];
    let legacyStaleCount = 0;

    for (const workout of weekWorkouts) {
      const sig = computeWorkoutSyncSignature(workout);
      const storedSig = existingSignatures[workout.id];
      // Old records prove that a workout was already scheduled but contain no
      // Garmin workout ID. Re-creating it automatically would make a duplicate.
      if (storedSig?.startsWith('recovery-2min-v1::')) {
        legacyStaleCount++;
        continue;
      }
      if (options?.force || storedSig !== sig) {
        toPush.push(workout);
      }
    }

    const legacyWarning = legacyStaleCount > 0
      ? `${legacyStaleCount} séance(s) Garmin déjà programmée(s) ont une ancienne définition. Mise à jour automatique suspendue pour éviter les doublons.`
      : undefined;

    if (toPush.length === 0) {
      const res: AutoSyncResult = {
        success: legacyStaleCount === 0,
        pushedCount: 0,
        totalWeekWorkouts: weekWorkouts.length,
        alreadyUpToDate: legacyStaleCount === 0,
        results: [],
        reason: legacyStaleCount === 0 ? 'SUCCESS' : 'ERROR',
        error: legacyWarning,
        lastSyncTimestamp: new Date().toISOString()
      };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('garmin_auto_sync_status', { detail: res }));
      }
      return res;
    }

    const results: WorkoutPushResult[] = [];
    let pushedCount = 0;

    for (const workout of toPush) {
      const dateStr = toLocalDateKey(workout.startDate);
      const pushRes = await pushWorkoutToGarmin(workout, dateStr, 'FORERUNNER_55');
      results.push(pushRes);

      if (pushRes.success) {
        pushedCount++;
        // Update signature in map
        updatedSignatures[workout.id] = computeWorkoutSyncSignature(workout);
      }
    }

    saveSyncedWeekWorkoutSignatures(updatedSignatures);

    const failedResults = results.filter(result => !result.success);
    const res: AutoSyncResult = {
      success: failedResults.length === 0 && legacyStaleCount === 0,
      pushedCount,
      totalWeekWorkouts: weekWorkouts.length,
      alreadyUpToDate: false,
      results,
      reason: failedResults.length === 0 && legacyStaleCount === 0 ? 'SUCCESS' : 'ERROR',
      error: [legacyWarning, ...failedResults.map(result => result.error || 'Échec Garmin inconnu')]
        .filter(Boolean).join(' | ') || undefined,
      lastSyncTimestamp: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('garmin_auto_sync_status', { detail: res }));
    }

    return res;
  } catch (err: any) {
    const errorRes: AutoSyncResult = {
      success: false,
      pushedCount: 0,
      totalWeekWorkouts: weekWorkouts.length,
      alreadyUpToDate: false,
      results: [],
      reason: 'ERROR',
      error: err?.message || 'Erreur lors de la synchronisation automatique Garmin.'
    };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('garmin_auto_sync_status', { detail: errorRes }));
    }
    return errorRes;
  }
}

export function syncCurrentWeekWorkoutsToGarmin(
  events: CalendarEvent[],
  referenceDate: Date = new Date(),
  options?: { force?: boolean }
): Promise<AutoSyncResult> {
  const key = workoutSyncRequestKey(events, referenceDate, options);
  if (autoSyncInFlight) {
    if (key === activeRequestKey) {
      queuedRequest = null;
    } else {
      queuedRequest = { events, referenceDate, options, key };
    }
    return autoSyncInFlight;
  }

  activeRequestKey = key;
  const operation = (async () => {
    let current: NonNullable<typeof queuedRequest> = { events, referenceDate, options, key };
    let result: AutoSyncResult;
    do {
      result = await runCurrentWeekWorkoutSync(current.events, current.referenceDate, current.options);
      if (!queuedRequest) break;
      current = queuedRequest;
      queuedRequest = null;
      activeRequestKey = current.key;
    } while (true);
    return result;
  })();
  autoSyncInFlight = operation;
  void operation.finally(() => {
    if (autoSyncInFlight === operation) {
      autoSyncInFlight = null;
      activeRequestKey = null;
    }
  }).catch(() => {});
  return operation;
}
