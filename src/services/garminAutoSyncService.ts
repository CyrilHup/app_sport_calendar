import { CalendarEvent } from '../types/calendar';
import { WorkoutPushResult } from '../types/garmin';
import { loadGarminCredentials, loadGarminCredentialsAsync, pushWorkoutToGarmin, cleanDuplicateGarminWorkouts } from './garminService';


export const GARMIN_AUTO_SYNC_ENABLED_KEY = 'sport_calendar_garmin_auto_sync_enabled';
export const GARMIN_SYNCED_SIGNATURES_KEY = 'sport_calendar_garmin_synced_week_signatures';

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
  try {
    if (typeof localStorage === 'undefined') return true;
    const val = localStorage.getItem(GARMIN_AUTO_SYNC_ENABLED_KEY);
    if (val === null) return true; // Enabled by default
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Enables or disables automatic Garmin synchronization.
 */
export function setGarminAutoSyncEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GARMIN_AUTO_SYNC_ENABLED_KEY, String(enabled));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('garmin_auto_sync_config_changed', { detail: { enabled } }));
    }
  } catch (err) {
    console.warn('Could not persist garmin auto sync setting:', err);
  }
}

/**
 * Computes a deterministic content signature for a workout.
 * Any modification (postponement, duration change, adapted status, elevation) changes this signature.
 */
export function computeWorkoutSyncSignature(event: CalendarEvent): string {
  const dateStr = event.startDate.slice(0, 10);
  const dur = event.durationMinutes || 0;
  const sport = event.sportType || 'SPORT';
  const adapted = event.metadata?.isAdapted ? '1' : '0';
  const elev = event.metadata?.targetElevationM || 0;
  const originalDate = event.metadata?.originalDate || '';
  return `${event.id}::${dateStr}::${dur}::${sport}::${adapted}::${elev}::${originalDate}`;
}

/**
 * Retrieves the stored map of synced workout signatures.
 */
export function getSyncedWeekWorkoutSignatures(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(GARMIN_SYNCED_SIGNATURES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Saves the map of synced workout signatures.
 */
export function saveSyncedWeekWorkoutSignatures(signatures: Record<string, string>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GARMIN_SYNCED_SIGNATURES_KEY, JSON.stringify(signatures));
    }
  } catch (err) {
    console.warn('Could not save garmin synced signatures:', err);
  }
}

/**
 * Calculates the Monday Date of the week containing date.
 */
import { getMondayOfWeek, formatDateKey } from './dateUtils';
export { getMondayOfWeek, formatDateKey };

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
    const evDate = ev.startDate.slice(0, 10);
    return evDate >= weekStartStr && evDate <= weekEndStr;
  });
}

// Global in-flight lock to avoid duplicate parallel syncs
let isAutoSyncRunning = false;

/**
 * Automatically pushes current week's sport workouts to Garmin Connect.
 * Compares workout signatures to avoid redundant pushes and duplicates on Garmin calendar.
 */
export async function syncCurrentWeekWorkoutsToGarmin(
  events: CalendarEvent[],
  referenceDate: Date = new Date(),
  options?: { force?: boolean }
): Promise<AutoSyncResult> {
  if (isAutoSyncRunning) {
    return {
      success: true,
      pushedCount: 0,
      totalWeekWorkouts: 0,
      alreadyUpToDate: true,
      results: [],
      reason: 'SUCCESS'
    };
  }

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

  isAutoSyncRunning = true;
  try {
    const existingSignatures = getSyncedWeekWorkoutSignatures();
    const updatedSignatures = { ...existingSignatures };
    const toPush: CalendarEvent[] = [];

    for (const workout of weekWorkouts) {
      const sig = computeWorkoutSyncSignature(workout);
      const storedSig = existingSignatures[workout.id];
      if (options?.force || storedSig !== sig) {
        toPush.push(workout);
      }
    }

    if (toPush.length === 0) {
      const res: AutoSyncResult = {
        success: true,
        pushedCount: 0,
        totalWeekWorkouts: weekWorkouts.length,
        alreadyUpToDate: true,
        results: [],
        reason: 'SUCCESS',
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
      const dateStr = workout.startDate.slice(0, 10);
      const pushRes = await pushWorkoutToGarmin(workout, dateStr, 'FORERUNNER_55');
      results.push(pushRes);

      if (pushRes.success) {
        pushedCount++;
        // Update signature in map
        updatedSignatures[workout.id] = computeWorkoutSyncSignature(workout);
      }
    }

    saveSyncedWeekWorkoutSignatures(updatedSignatures);

    // Nettoyer en arrière-plan les anciens doublons résiduels sur Garmin Connect
    cleanDuplicateGarminWorkouts().catch(() => {});

    const res: AutoSyncResult = {
      success: pushedCount > 0 || toPush.length === 0,
      pushedCount,
      totalWeekWorkouts: weekWorkouts.length,
      alreadyUpToDate: false,
      results,
      reason: 'SUCCESS',
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
  } finally {
    isAutoSyncRunning = false;
  }
}
