import { CalendarEvent } from '../types/calendar';
import { WorkoutPushResult } from '../types/garmin';
import {
  GARMIN_WORKOUT_DEFINITION_VERSION,
  AthletePhysiologicalProfile,
  cancelWorkoutOnGarmin,
  getGarminWorkoutTargetMode,
  getStoredAthleteProfile,
  isValidGarminWorkoutDuration,
  pushWorkoutToGarmin
} from './garminService';
import { STORAGE_KEYS, storageGet, storageGetRaw, storageSet } from './storageService';
import { isTrailOrRunning } from './activityClassifier';


export const GARMIN_AUTO_SYNC_ENABLED_KEY = STORAGE_KEYS.GARMIN_AUTO_SYNC_ENABLED;
// v2 deliberately invalidates the previous cache, which could contain false positives:
// the API used to report success even when Garmin rejected calendar scheduling.
export const GARMIN_SYNCED_SIGNATURES_KEY = STORAGE_KEYS.GARMIN_SYNCED_SIGNATURES;
export const GARMIN_SYNCED_WORKOUT_IDS_KEY = STORAGE_KEYS.GARMIN_SYNCED_WORKOUT_IDS;
export const GARMIN_REST_CANCELLED_SIGNATURE = 'cancelled-rest';

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
export function computeWorkoutSyncSignature(event: CalendarEvent, athleteProfile?: AthletePhysiologicalProfile): string {
  return `${GARMIN_WORKOUT_DEFINITION_VERSION}::${event.id}::${JSON.stringify({
    startDate: event.startDate,
    durationMinutes: event.durationMinutes || 0,
    sportType: event.sportType || 'SPORT',
    title: event.title,
    description: event.description,
    targetMode: getGarminWorkoutTargetMode(),
    athleteProfile: athleteProfile || getStoredAthleteProfile(),
    targetHeartRate: event.metadata?.targetHeartRate,
    targetHeartRateRange: event.metadata?.targetHeartRateRange,
    targetElevationM: event.metadata?.targetElevationM,
    targetCadence: event.metadata?.targetCadence,
    isAdapted: Boolean(event.metadata?.isAdapted),
    originalDate: event.metadata?.originalDate || ''
  })}`;
}

interface AutoSyncOptions {
  force?: boolean;
  /** Explicit retry from the error modal; still requires the exact stored Garmin ID. */
  retryManualReview?: boolean;
  athleteProfile?: AthletePhysiologicalProfile;
  userId?: string;
  completedEventIds?: readonly string[];
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
export function isWorkoutSyncedToGarmin(event: CalendarEvent, athleteProfile?: AthletePhysiologicalProfile): boolean {
  const signatures = getSyncedWeekWorkoutSignatures();
  return signatures[event.id] === computeWorkoutSyncSignature(event, athleteProfile);
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
    if (ev.metadata?.isOptional) return false;
    // A zero-minute adaptive REST is a calendar instruction, not a watch workout.
    if (!isValidGarminWorkoutDuration(ev.durationMinutes)) return false;
    const evDate = toLocalDateKey(ev.startDate);
    return evDate >= weekStartStr && evDate <= weekEndStr;
  });
}

/** A zero-minute adapted running session cancels a plan; it is never an upload. */
export function filterCurrentWeekRestCancellations(
  events: CalendarEvent[],
  referenceDate: Date = new Date()
): CalendarEvent[] {
  const { weekStartStr, weekEndStr } = getCurrentWeekDateBounds(referenceDate);
  return events.filter(event => {
    if (event.category !== 'sport' || event.metadata?.isPostponedPlaceholder ||
      !event.metadata?.isAdapted || event.durationMinutes !== 0 ||
      !isTrailOrRunning(event.metadata.originalSportType, event.metadata.originalTitle || event.title) ||
      new Date(event.startDate).getTime() <= referenceDate.getTime()) return false;
    const date = toLocalDateKey(event.startDate);
    return date >= weekStartStr && date <= weekEndStr;
  });
}

// All callers share the active operation. Changes arriving during a push are
// queued as one latest follow-up so a stale calendar is never the final state.
let autoSyncInFlight: Promise<AutoSyncResult> | null = null;
let activeRequestKey: string | null = null;
let queuedRequest: {
  events: CalendarEvent[];
  referenceDate: Date;
  options?: AutoSyncOptions;
  key: string;
} | null = null;

function workoutSyncRequestKey(
  events: CalendarEvent[],
  referenceDate: Date,
  options?: AutoSyncOptions
): string {
  return JSON.stringify({
    week: getCurrentWeekDateBounds(referenceDate).weekStartStr,
    force: Boolean(options?.force),
    retryManualReview: Boolean(options?.retryManualReview),
    userId: options?.userId,
    athlete: options?.athleteProfile,
    completedEventIds: [...(options?.completedEventIds || [])].sort(),
    signatures: [
      ...filterCurrentWeekSportWorkouts(events, referenceDate),
      ...filterCurrentWeekRestCancellations(events, referenceDate)
    ].map(event => computeWorkoutSyncSignature(event, options?.athleteProfile)).sort()
  });
}

/**
 * Automatically pushes current week's sport workouts to Garmin Connect.
 * Compares workout signatures to avoid redundant pushes and duplicates on Garmin calendar.
 */
async function runCurrentWeekWorkoutSync(
  events: CalendarEvent[],
  referenceDate: Date = new Date(),
  options?: AutoSyncOptions
): Promise<AutoSyncResult> {
  const startingOwner = storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER);
  const sameLocalOwner = () => storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER) === startingOwner;
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

  const weekWorkouts = filterCurrentWeekSportWorkouts(events, referenceDate);
  const restCancellations = filterCurrentWeekRestCancellations(events, referenceDate);
  if (weekWorkouts.length === 0 && restCancellations.length === 0) {
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
    const registryClient = options?.userId ? await import('./supabaseClient') : null;
    const cloudRegistry = options?.userId && registryClient
      ? await registryClient.fetchGarminRunRegistry(options.userId)
      : null;
    if (!sameLocalOwner()) throw new Error('Le compte a changé pendant la synchronisation Garmin.');
    const existingSignatures = getSyncedWeekWorkoutSignatures();
    const existingWorkoutIds = storageGet<Record<string, string>>(GARMIN_SYNCED_WORKOUT_IDS_KEY, {});
    const updatedSignatures = { ...existingSignatures };
    const updatedWorkoutIds = { ...existingWorkoutIds };
    const toPush: CalendarEvent[] = [];
    let legacyStaleCount = 0;
    const manualReviewErrors: string[] = [];
    const cloudWarnings: string[] = [];
    const conflictingEventIds = new Set<string>();
    const completedEventIds = new Set(options?.completedEventIds);
    let cancelledCount = 0;
    const runningByDate = new Map<string, number>();
    for (const workout of weekWorkouts) {
      if (!isTrailOrRunning(workout.sportType, workout.title)) continue;
      const date = toLocalDateKey(workout.startDate);
      runningByDate.set(date, (runningByDate.get(date) || 0) + 1);
    }

    // For a two-day exchange, each date's registered Garmin ID is the exact
    // workout to replace on that date. Keep the pair together so a partially
    // completed exchange can safely resume after a lost response.
    const exchangedTargetIds = new Map<string, string>();
    const reviewedExchangeIds = new Set<string>();
    for (const workout of weekWorkouts) {
      if (!cloudRegistry || !isTrailOrRunning(workout.sportType, workout.title) ||
        !workout.metadata?.originalDate || exchangedTargetIds.has(workout.id) || reviewedExchangeIds.has(workout.id)) continue;
      const targetDate = toLocalDateKey(workout.startDate);
      const originalDate = workout.metadata.originalDate;
      const partner = weekWorkouts.find(candidate => candidate.id !== workout.id &&
        isTrailOrRunning(candidate.sportType, candidate.title) &&
        candidate.metadata?.originalDate === targetDate && toLocalDateKey(candidate.startDate) === originalDate);
      if (!partner || runningByDate.get(targetDate) !== 1 || runningByDate.get(originalDate) !== 1) continue;
      const originalEntry = cloudRegistry.find(entry => entry.eventId === workout.id && entry.workoutDate === originalDate);
      const partnerEntry = cloudRegistry.find(entry => entry.eventId === partner.id && entry.workoutDate === targetDate);
      if (!originalEntry || !partnerEntry ||
        !/^[1-9]\d{0,19}$/.test(originalEntry.workoutId) || !/^[1-9]\d{0,19}$/.test(partnerEntry.workoutId) ||
        (existingWorkoutIds[workout.id] && existingWorkoutIds[workout.id] !== originalEntry.workoutId) ||
        (existingWorkoutIds[partner.id] && existingWorkoutIds[partner.id] !== partnerEntry.workoutId)) continue;
      if (new Date(workout.startDate).getTime() <= referenceDate.getTime() ||
        new Date(partner.startDate).getTime() <= referenceDate.getTime() ||
        completedEventIds.has(workout.id) || completedEventIds.has(partner.id) ||
        workout.metadata?.isCompleted || partner.metadata?.isCompleted) {
        manualReviewErrors.push(`Échange ${originalDate} ↔ ${targetDate} : au moins une séance a commencé. Planning modifié ici ; vérifier Garmin manuellement.`);
        reviewedExchangeIds.add(workout.id);
        reviewedExchangeIds.add(partner.id);
        continue;
      }
      exchangedTargetIds.set(workout.id, partnerEntry.workoutId);
      exchangedTargetIds.set(partner.id, originalEntry.workoutId);
    }
    for (const [eventId, targetId] of exchangedTargetIds) updatedWorkoutIds[eventId] = targetId;

    for (const rest of restCancellations) {
      if (completedEventIds.has(rest.id) || rest.metadata?.isCompleted) continue;
      const date = toLocalDateKey(rest.startDate);
      if (weekWorkouts.some(workout =>
        isTrailOrRunning(workout.sportType, workout.title) && toLocalDateKey(workout.startDate) === date
      ) || restCancellations.filter(candidate => toLocalDateKey(candidate.startDate) === date).length > 1) {
        manualReviewErrors.push(`Repos du ${date} ambigu : annulation Garmin suspendue.`);
        continue;
      }
      if (!options?.userId || !cloudRegistry) {
        manualReviewErrors.push(`Identifiant Garmin du ${date} invérifiable dans le compte : annulation suspendue.`);
        continue;
      }
      const cloudEntry = cloudRegistry.find(entry => entry.workoutDate === date);
      const localId = existingWorkoutIds[rest.id];
      if (cloudEntry && localId && cloudEntry.workoutId !== localId) {
        manualReviewErrors.push(`Identifiants Garmin divergents pour le repos du ${date} : vérification manuelle nécessaire.`);
        continue;
      }
      if (cloudEntry?.signature === GARMIN_REST_CANCELLED_SIGNATURE) {
        updatedWorkoutIds[rest.id] = cloudEntry.workoutId;
        updatedSignatures[rest.id] = GARMIN_REST_CANCELLED_SIGNATURE;
        storageSet(GARMIN_SYNCED_WORKOUT_IDS_KEY, updatedWorkoutIds);
        saveSyncedWeekWorkoutSignatures(updatedSignatures);
        continue;
      }
      if (!cloudEntry && existingSignatures[rest.id] === GARMIN_REST_CANCELLED_SIGNATURE && localId) {
        continue;
      }
      // A lost cancellation response can leave the browser ID behind after
      // the server has already removed the cloud row. The server accepts that
      // exact ID only if Garmin also confirms it is no longer scheduled.
      const workoutId = cloudEntry?.workoutId || localId;
      if (!workoutId) {
        if (existingSignatures[rest.id] && existingSignatures[rest.id] !== GARMIN_REST_CANCELLED_SIGNATURE) {
          manualReviewErrors.push(
            `Séance Garmin du ${date} remplacée par un repos sans identifiant exact enregistré : annulation non tentée.`
          );
        }
        continue;
      }
      if (!/^[1-9]\d{0,19}$/.test(workoutId)) {
        manualReviewErrors.push(`Identifiant Garmin invalide pour le repos du ${date}.`);
        continue;
      }
      if (!sameLocalOwner()) throw new Error('Le compte a changé pendant la synchronisation Garmin.');
      const cancellation = await cancelWorkoutOnGarmin(date, workoutId);
      if (!cancellation.success) {
        manualReviewErrors.push(`Repos du ${date} non répercuté sur Garmin : ${cancellation.error || 'annulation non confirmée'}`);
        continue;
      }
      if (!sameLocalOwner()) throw new Error('Le compte a changé pendant la synchronisation Garmin.');
      updatedWorkoutIds[rest.id] = workoutId;
      updatedSignatures[rest.id] = GARMIN_REST_CANCELLED_SIGNATURE;
      storageSet(GARMIN_SYNCED_WORKOUT_IDS_KEY, updatedWorkoutIds);
      saveSyncedWeekWorkoutSignatures(updatedSignatures);
      cancelledCount++;
    }

    for (const entry of cloudRegistry || []) {
      if (!/^[1-9]\d{0,19}$/.test(entry.workoutId)) continue;
      const matchingWorkout = weekWorkouts.find(workout =>
        isTrailOrRunning(workout.sportType, workout.title) &&
        toLocalDateKey(workout.startDate) === entry.workoutDate
      );
      if (!matchingWorkout) continue;
      const eventId = matchingWorkout.id;
      if (reviewedExchangeIds.has(eventId)) continue;
      const localId = updatedWorkoutIds[eventId];
      if (localId && localId !== entry.workoutId) {
        manualReviewErrors.push(`Identifiants Garmin divergents pour ${eventId} : vérification manuelle nécessaire.`);
        conflictingEventIds.add(eventId);
        continue;
      }
      updatedWorkoutIds[eventId] = entry.workoutId;
      if (!existingSignatures[eventId]) updatedSignatures[eventId] = entry.signature;
    }

    for (const workout of weekWorkouts) {
      const date = toLocalDateKey(workout.startDate);
      if (reviewedExchangeIds.has(workout.id)) continue;
      if (isTrailOrRunning(workout.sportType, workout.title) && (runningByDate.get(date) || 0) > 1) {
        manualReviewErrors.push(`Plusieurs séances de course prévues le ${date} : synchronisation Garmin suspendue pour ce jour.`);
        continue;
      }
      // A session already started (or completed early) must not be rewritten
      // on Garmin after an algorithm/configuration change.
      if (completedEventIds.has(workout.id) || workout.metadata?.isCompleted ||
        new Date(workout.startDate).getTime() <= referenceDate.getTime()) {
        continue;
      }
      const sig = computeWorkoutSyncSignature(workout, options?.athleteProfile);
      const storedSig = updatedSignatures[workout.id];
      const recoverableLegacyConflict = storedSig?.startsWith(
        'replacement-review::Une séance de course [QMT]'
      );
      if (conflictingEventIds.has(workout.id)) continue;
      if (storedSig?.startsWith('replacement-review::') && !recoverableLegacyConflict) {
        const hasExactStoredId = /^[1-9]\d{0,19}$/.test(updatedWorkoutIds[workout.id] || '');
        if (!options?.retryManualReview || !hasExactStoredId) {
          manualReviewErrors.push(storedSig.slice('replacement-review::'.length));
          continue;
        }
      }
      // Old records prove that a workout was already scheduled but contain no
      // Garmin workout ID. Re-creating it automatically would make a duplicate.
      if (storedSig && (options?.force || storedSig !== sig) &&
        !/^[1-9]\d{0,19}$/.test(updatedWorkoutIds[workout.id] || '') &&
        !recoverableLegacyConflict) {
        legacyStaleCount++;
        continue;
      }
      if (options?.force || storedSig !== sig) {
        toPush.push(workout);
      }
    }

    const legacyWarning = [
      legacyStaleCount > 0
        ? `${legacyStaleCount} séance(s) Garmin déjà programmée(s) n'ont pas d'identifiant exact enregistré. Mise à jour automatique suspendue pour éviter les doublons.`
        : undefined,
      ...manualReviewErrors
    ].filter(Boolean).join(' | ') || undefined;

    storageSet(GARMIN_SYNCED_WORKOUT_IDS_KEY, updatedWorkoutIds);
    saveSyncedWeekWorkoutSignatures(updatedSignatures);
    if (cloudRegistry && options?.userId) {
      for (const workout of weekWorkouts) {
        if (!isTrailOrRunning(workout.sportType, workout.title) || conflictingEventIds.has(workout.id)) continue;
        const workoutId = updatedWorkoutIds[workout.id];
        const signature = updatedSignatures[workout.id];
        const date = toLocalDateKey(workout.startDate);
        if (!/^[1-9]\d{0,19}$/.test(workoutId || '') ||
          signature !== computeWorkoutSyncSignature(workout, options?.athleteProfile) ||
          cloudRegistry.some(entry => entry.eventId === workout.id && entry.workoutId === workoutId &&
            entry.workoutDate === date && entry.signature === signature)) continue;
        if (!await registryClient!.saveGarminRunRegistryEntry(options.userId, {
          eventId: workout.id, workoutDate: date, workoutId, signature
        })) {
          cloudWarnings.push(`Identifiant Garmin du ${date} non sauvegardé dans le cloud.`);
        }
      }
    }

    if (toPush.length === 0) {
      const res: AutoSyncResult = {
        success: legacyStaleCount === 0 && manualReviewErrors.length === 0 && cloudWarnings.length === 0,
        pushedCount: 0,
        totalWeekWorkouts: weekWorkouts.length,
        alreadyUpToDate: cancelledCount === 0 && legacyStaleCount === 0 && manualReviewErrors.length === 0 && cloudWarnings.length === 0,
        results: [],
        reason: legacyStaleCount === 0 && manualReviewErrors.length === 0 && cloudWarnings.length === 0 ? 'SUCCESS' : 'ERROR',
        error: [legacyWarning, ...cloudWarnings].filter(Boolean).join(' | ') || undefined,
        lastSyncTimestamp: new Date().toISOString()
      };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('garmin_auto_sync_status', { detail: res }));
      }
      return res;
    }

    const results: WorkoutPushResult[] = [];
    let pushedCount = 0;
    let authRequired = false;

    for (const workout of toPush) {
      if (!sameLocalOwner()) throw new Error('Le compte a changé pendant la synchronisation Garmin.');
      const dateStr = toLocalDateKey(workout.startDate);
      const pushRes = await pushWorkoutToGarmin(
        workout, dateStr, 'FORERUNNER_55', options?.athleteProfile, updatedWorkoutIds[workout.id]
      );
      results.push(pushRes);
      if (pushRes.errorCode === 'GARMIN_AUTH_REQUIRED') authRequired = true;

      if (!sameLocalOwner()) {
        if (pushRes.success && pushRes.workoutId && options?.userId &&
          isTrailOrRunning(workout.sportType, workout.title)) {
          await registryClient!.saveGarminRunRegistryEntry(options.userId, {
            eventId: workout.id,
            workoutDate: dateStr,
            workoutId: pushRes.workoutId,
            signature: computeWorkoutSyncSignature(workout, options?.athleteProfile)
          });
        }
        throw new Error('Le compte a changé pendant la synchronisation Garmin.');
      }

      if (pushRes.success && pushRes.workoutId && /^[1-9]\d{0,19}$/.test(pushRes.workoutId)) {
        pushedCount++;
        updatedSignatures[workout.id] = computeWorkoutSyncSignature(workout, options?.athleteProfile);
        updatedWorkoutIds[workout.id] = pushRes.workoutId;
        // Persist the exact new ID immediately. A later workout failure must
        // not lose an earlier confirmed replacement from this batch.
        storageSet(GARMIN_SYNCED_WORKOUT_IDS_KEY, updatedWorkoutIds);
        saveSyncedWeekWorkoutSignatures(updatedSignatures);
        if (options?.userId && isTrailOrRunning(workout.sportType, workout.title) &&
          !await registryClient!.saveGarminRunRegistryEntry(options.userId, {
            eventId: workout.id,
            workoutDate: dateStr,
            workoutId: pushRes.workoutId,
            signature: updatedSignatures[workout.id]
          })) {
          cloudWarnings.push(`Identifiant Garmin créé le ${dateStr} mais non sauvegardé dans le cloud ; vérifier depuis cet appareil.`);
        }
      } else if (pushRes.success) {
        // Scheduling succeeded but there is no usable ID. A retry could
        // duplicate the workout, so require manual review first.
        pushRes.success = false;
        pushRes.error = 'Garmin a confirmé la séance sans fournir son identifiant exact. Vérification manuelle nécessaire avant une nouvelle tentative.';
        updatedSignatures[workout.id] = `replacement-review::${pushRes.error}`;
      } else if (pushRes.error?.startsWith('Remplacement Garmin incomplet') ||
        pushRes.error?.startsWith('Remplacement Garmin à vérifier') ||
        pushRes.error?.startsWith('Programmation Garmin à vérifier') ||
        pushRes.error?.startsWith('Une séance de course [QMT]') ||
        pushRes.error?.includes('Vérification manuelle nécessaire') ||
        pushRes.error?.includes('Manual review required')) {
        // Both IDs may still exist. Never retry automatically in this state.
        updatedSignatures[workout.id] = `replacement-review::${pushRes.error}`;
      }
      if (authRequired) break;
    }

    storageSet(GARMIN_SYNCED_WORKOUT_IDS_KEY, updatedWorkoutIds);
    saveSyncedWeekWorkoutSignatures(updatedSignatures);

    const failedResults = results.filter(result => !result.success);
    const res: AutoSyncResult = {
      success: failedResults.length === 0 && legacyStaleCount === 0 && manualReviewErrors.length === 0 && cloudWarnings.length === 0,
      pushedCount,
      totalWeekWorkouts: weekWorkouts.length,
      alreadyUpToDate: false,
      results,
      reason: authRequired ? 'NO_CREDENTIALS' :
        failedResults.length === 0 && legacyStaleCount === 0 && manualReviewErrors.length === 0 && cloudWarnings.length === 0 ? 'SUCCESS' : 'ERROR',
      error: [legacyWarning, ...cloudWarnings, ...failedResults.map(result => result.error || 'Échec Garmin inconnu')]
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
  options?: AutoSyncOptions
): Promise<AutoSyncResult> {
  const key = workoutSyncRequestKey(events, referenceDate, options);
  if (autoSyncInFlight) {
    // An already-running duplicate must not erase a newer changed calendar.
    if (key !== activeRequestKey) {
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
