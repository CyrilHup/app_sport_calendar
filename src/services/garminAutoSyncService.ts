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
  /** Explicit calendar edits may publish beyond the automatic current-week window. */
  changedEventIds?: readonly string[];
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
    if (!isRestCancellation(event) ||
      toLocalDateKey(event.startDate) < toLocalDateKey(referenceDate)) return false;
    const date = toLocalDateKey(event.startDate);
    return date >= weekStartStr && date <= weekEndStr;
  });
}

function isRestCancellation(event: CalendarEvent): boolean {
  return event.category === 'sport' && !event.metadata?.isPostponedPlaceholder &&
    Boolean(event.metadata?.isAdapted) && event.durationMinutes === 0 &&
    isTrailOrRunning(event.metadata?.originalSportType, event.metadata?.originalTitle || event.title);
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
    changedEventIds: [...(options?.changedEventIds || [])].sort(),
    signatures: events.filter(event => event.category === 'sport' && !event.metadata?.isPostponedPlaceholder)
      .map(event => computeWorkoutSyncSignature(event, options?.athleteProfile)).sort()
  });
}

/**
 * Automatically pushes current week's sport workouts to Garmin Connect.
 * Compares workout signatures to avoid redundant pushes and duplicates on Garmin calendar.
 */
function signatureDate(signature?: string): string | undefined {
  if (!signature) return undefined;
  try {
    const jsonStart = signature.indexOf('::{');
    if (jsonStart < 0) return undefined;
    const date = JSON.parse(signature.slice(jsonStart + 2)).startDate;
    return typeof date === 'string' && !Number.isNaN(Date.parse(date)) ? toLocalDateKey(date) : undefined;
  } catch { return undefined; }
}

function isPublishableWorkout(event: CalendarEvent): boolean {
  return event.category === 'sport' && !event.metadata?.isPostponedPlaceholder &&
    !event.metadata?.isOptional && isValidGarminWorkoutDuration(event.durationMinutes);
}

async function runCurrentWeekWorkoutSync(
  events: CalendarEvent[],
  referenceDate: Date = new Date(),
  options?: AutoSyncOptions
): Promise<AutoSyncResult> {
  const startingOwner = storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER);
  const assertOwner = () => {
    if (storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER) !== startingOwner) {
      throw new Error('Le compte a changé pendant la synchronisation Garmin.');
    }
  };
  const signatures = getSyncedWeekWorkoutSignatures();
  const ids = storageGet<Record<string, string>>(GARMIN_SYNCED_WORKOUT_IDS_KEY, {});
  const changedIds = new Set(options?.changedEventIds);
  const weeklyIds = new Set(filterCurrentWeekSportWorkouts(events, referenceDate).map(event => event.id));
  const today = toLocalDateKey(referenceDate);
  // Explicit edits and previously published future sessions remain eligible on
  // retry. A Sunday-to-Monday move must not disappear from synchronization.
  const workouts = events.filter(event => isPublishableWorkout(event) &&
    (weeklyIds.has(event.id) || changedIds.has(event.id) ||
      (event.metadata?.isPostponed && toLocalDateKey(event.startDate) >= today) ||
      (ids[event.id] && toLocalDateKey(event.startDate) >= today)));
  const rests = filterCurrentWeekRestCancellations(events, referenceDate);
  for (const event of events) {
    if (isRestCancellation(event) && changedIds.has(event.id) &&
      toLocalDateKey(event.startDate) >= today && !rests.some(rest => rest.id === event.id)) rests.push(event);
  }
  const results: WorkoutPushResult[] = [];
  const errors: string[] = [];
  let pushedCount = 0;
  let cancelledCount = 0;
  let authRequired = false;
  const finish = (reason?: AutoSyncResult['reason']): AutoSyncResult => {
    const success = errors.length === 0 && results.every(result => result.success);
    const result: AutoSyncResult = {
      success, pushedCount, totalWeekWorkouts: workouts.length,
      alreadyUpToDate: success && pushedCount === 0 && cancelledCount === 0,
      results, reason: reason || (authRequired ? 'NO_CREDENTIALS' : success ? 'SUCCESS' : 'ERROR'),
      error: [...new Set([...errors, ...results.filter(result => !result.success).map(result => result.error)]
        .filter(Boolean))].join(' | ') || undefined,
      lastSyncTimestamp: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('garmin_auto_sync_status', { detail: result }));
    }
    return result;
  };
  const persist = () => {
    assertOwner();
    storageSet(GARMIN_SYNCED_WORKOUT_IDS_KEY, ids);
    saveSyncedWeekWorkoutSignatures(signatures);
  };
  if (!isGarminAutoSyncEnabled() && !options?.force) {
    errors.push('Synchronisation automatique Garmin désactivée. Planning enregistré dans l’application.');
    return finish('DISABLED');
  }
  if (!workouts.length && !rests.length && !options?.userId) return finish('NO_WORKOUTS');

  try {
    const registryClient = options?.userId ? await import('./supabaseClient') : null;
    const registry = options?.userId && registryClient
      ? await registryClient.fetchGarminRunRegistry(options.userId) : null;
    assertOwner();
    if (options?.userId && !registry) {
      throw new Error('Registre Garmin indisponible. Planning enregistré ; aucune séance envoyée.');
    }
    // Cloud ownership also restores future edits/undo after local storage is
    // lost; keep automatically generated, unpublished future sessions out.
    const publishedEventIds = new Set(registry?.map(entry => entry.eventId));
    const selectedIds = new Set(workouts.map(event => event.id));
    for (const event of events) {
      if (isPublishableWorkout(event) && !selectedIds.has(event.id) &&
        publishedEventIds.has(event.id) && toLocalDateKey(event.startDate) >= today) workouts.push(event);
      if (isRestCancellation(event) && publishedEventIds.has(event.id) &&
        toLocalDateKey(event.startDate) >= today && !rests.some(rest => rest.id === event.id)) rests.push(event);
    }
    if (!workouts.length && !rests.length) return finish('NO_WORKOUTS');
    const completedIds = new Set(options?.completedEventIds);
    const completed = (event: CalendarEvent) => completedIds.has(event.id) || Boolean(event.metadata?.isCompleted);
    const isRun = (event: CalendarEvent) => isTrailOrRunning(event.sportType, event.title);
    const validId = (id?: string): id is string => Boolean(id && /^[1-9]\d{0,19}$/.test(id));
    const byDate = (date: string) => registry?.find(entry => entry.workoutDate === date);
    const byEvent = (event: CalendarEvent) => registry?.find(entry => entry.eventId === event.id);
    const desiredSignatures = new Map(workouts.map(event => [event.id, computeWorkoutSyncSignature(event, options?.athleteProfile)]));
    const blocked = new Set<string>();
    const pairs: Array<[CalendarEvent, CalendarEvent]> = [];
    const pairMembers = new Set<string>();

    // Detect exchanges from confirmed placement, not permanent original-date
    // metadata. This also handles undo and exchanging previously moved sessions.
    for (const event of workouts.filter(isRun)) {
      if (pairMembers.has(event.id)) continue;
      const source = byEvent(event);
      const target = byDate(toLocalDateKey(event.startDate));
      if (!source || !target || target.eventId === event.id) continue;
      const partner = workouts.find(candidate => candidate.id === target.eventId && isRun(candidate) &&
        toLocalDateKey(candidate.startDate) === source.workoutDate);
      if (!partner) continue;
      pairs.push([event, partner]);
      pairMembers.add(event.id);
      pairMembers.add(partner.id);
      if (completed(event) || completed(partner) || source.workoutDate < today || target.workoutDate < today) {
        errors.push(`Échange ${source.workoutDate} ↔ ${target.workoutDate} : une activité réalisée est déjà associée à une séance ou une date est passée. Vérification manuelle nécessaire.`);
        blocked.add(event.id); blocked.add(partner.id);
      }
    }

    for (const rest of rests) {
      if (completed(rest)) continue;
      const date = toLocalDateKey(rest.startDate);
      if (events.some(event => isPublishableWorkout(event) && isRun(event) && toLocalDateKey(event.startDate) === date) ||
        rests.filter(event => toLocalDateKey(event.startDate) === date).length > 1) {
        errors.push(`Repos du ${date} ambigu : annulation Garmin suspendue.`); continue;
      }
      if (!options?.userId || !registry) {
        errors.push(`Identifiant Garmin du ${date} invérifiable dans le compte : annulation suspendue.`); continue;
      }
      const entry = byEvent(rest) || byDate(date);
      const localId = ids[rest.id];
      if (entry && localId && entry.workoutId !== localId && entry.signature !== GARMIN_REST_CANCELLED_SIGNATURE) {
        errors.push(`Identifiants Garmin divergents pour le repos du ${date} : vérification manuelle nécessaire.`); continue;
      }
      if (entry?.signature === GARMIN_REST_CANCELLED_SIGNATURE) {
        ids[rest.id] = entry.workoutId; signatures[rest.id] = GARMIN_REST_CANCELLED_SIGNATURE;
        persist(); continue;
      }
      if (!entry && signatures[rest.id] === GARMIN_REST_CANCELLED_SIGNATURE && localId) continue;
      const workoutId = entry?.workoutId || localId;
      if (!validId(workoutId)) {
        if (signatures[rest.id]) errors.push(`Séance Garmin du ${date} remplacée par un repos sans identifiant exact enregistré : annulation non tentée.`);
        continue;
      }
      const sourceDate = entry?.workoutDate || signatureDate(signatures[rest.id]) || date;
      if (sourceDate < today) { errors.push(`Repos du ${date} : ancienne séance passée, vérifier Garmin manuellement.`); continue; }
      const cancellation = await cancelWorkoutOnGarmin(sourceDate, workoutId);
      assertOwner();
      if (!cancellation.success) { errors.push(`Repos du ${date} non répercuté sur Garmin : ${cancellation.error || 'annulation non confirmée'}`); continue; }
      ids[rest.id] = workoutId; signatures[rest.id] = GARMIN_REST_CANCELLED_SIGNATURE;
      cancelledCount++; persist();
    }

    for (const event of workouts) {
      const targetDate = toLocalDateKey(event.startDate);
      if (blocked.has(event.id)) continue;
      if (completed(event) || targetDate < today) {
        if (changedIds.has(event.id)) errors.push(`Séance ${targetDate} enregistrée dans l’application ; activité réalisée ou date passée, vérifier Garmin manuellement.`);
        continue;
      }
      if (isRun(event) && events.filter(candidate => isPublishableWorkout(candidate) && isRun(candidate) &&
        toLocalDateKey(candidate.startDate) === targetDate).length > 1) {
        errors.push(`Plusieurs séances de course prévues le ${targetDate} : synchronisation Garmin suspendue pour ce jour.`);
        blocked.add(event.id); continue;
      }
      const sig = desiredSignatures.get(event.id)!;
      const targetEntry = isRun(event) ? byDate(targetDate) : undefined;
      // Only a server-confirmed exact version can heal a lost response. A sole
      // foreign QMT workout on this day is not evidence of matching content.
      if (targetEntry?.signature === sig && validId(targetEntry.workoutId)) {
        ids[event.id] = targetEntry.workoutId; signatures[event.id] = sig;
        persist();
      }
      const entry = isRun(event) ? (pairMembers.has(event.id) ? targetEntry : byEvent(event) || targetEntry) : undefined;
      if (entry && entry.eventId !== event.id && !pairMembers.has(event.id) &&
        !entry.eventId.startsWith('garmin-date:') && entry.signature !== sig) {
        errors.push(`Identifiants Garmin divergents pour ${event.id} : la date cible appartient à une autre séance.`);
        blocked.add(event.id); continue;
      }
      const localId = ids[event.id];
      const storedSig = signatures[event.id];
      const legacyConflict = storedSig?.startsWith('replacement-review::Une séance de course [QMT]');
      if (entry && localId && localId !== entry.workoutId && !pairMembers.has(event.id)) {
        errors.push(`Identifiants Garmin divergents pour ${event.id} : vérification manuelle nécessaire.`);
        blocked.add(event.id); continue;
      }
      if (pairMembers.has(event.id) && entry && localId && localId !== entry.workoutId && storedSig === sig) {
        errors.push(`Identifiants Garmin divergents pour ${event.id} : la version locale n’est pas confirmée par le registre.`);
        blocked.add(event.id); continue;
      }
      const replaceId = entry?.workoutId || localId;
      const sourceDate = entry?.workoutDate || signatureDate(storedSig) || event.metadata?.originalDate || targetDate;
      if (entry && !storedSig) signatures[event.id] = entry.signature;
      if (entry && validId(entry.workoutId)) ids[event.id] = entry.workoutId;
      if (signatures[event.id] === sig && !options?.force) continue;
      if (storedSig?.startsWith('replacement-review::') && !legacyConflict &&
        (!options?.retryManualReview || !validId(replaceId))) {
        errors.push(storedSig.slice('replacement-review::'.length)); continue;
      }
      if (signatures[event.id] && !validId(replaceId) && !legacyConflict) {
        errors.push(`Séance Garmin ${event.id} sans identifiant exact enregistré. Mise à jour suspendue pour éviter les doublons.`); continue;
      }
      if (replaceId && sourceDate < today) {
        errors.push(`Ancienne séance Garmin du ${sourceDate} passée : déplacement suspendu pour vérification manuelle.`); continue;
      }
      assertOwner();
      const pushed = await pushWorkoutToGarmin(event, targetDate, 'FORERUNNER_55', options?.athleteProfile,
        replaceId, replaceId ? sourceDate : undefined, sig);
      results.push(pushed);
      // Account switches must not copy an old account's IDs into new storage.
      assertOwner();
      if (pushed.errorCode === 'GARMIN_AUTH_REQUIRED') { authRequired = true; break; }
      if (pushed.success && validId(pushed.workoutId)) {
        pushedCount++;
        ids[event.id] = pushed.workoutId; signatures[event.id] = sig;
        persist();
        if (entry) { entry.workoutId = pushed.workoutId; entry.signature = sig; }
        // The server commits the exact run ID and signature before reporting
        // success. A second browser write could race another device's move.
      } else if (pushed.success) {
        pushed.success = false;
        pushed.error = 'Garmin a confirmé la séance sans identifiant exact. Vérification manuelle nécessaire.';
        signatures[event.id] = `replacement-review::${pushed.error}`; persist();
      } else if (pushed.errorCode === 'GARMIN_REPLACE_MISSING' ||
        /Remplacement Garmin (incomplet|à vérifier)|Programmation Garmin à vérifier|Vérification manuelle nécessaire|Manual review required/.test(pushed.error || '')) {
        signatures[event.id] = `replacement-review::${pushed.error}`; persist();
      }
    }

    for (const [first, second] of pairs) {
      if (blocked.has(first.id) || blocked.has(second.id)) continue;
      const sigA = desiredSignatures.get(first.id)!;
      const sigB = desiredSignatures.get(second.id)!;
      if (signatures[first.id] !== sigA || signatures[second.id] !== sigB ||
        !validId(ids[first.id]) || !validId(ids[second.id])) continue;
      if (!await registryClient!.exchangeGarminRunRegistryEntries(options!.userId!, {
        eventId: first.id, workoutDate: toLocalDateKey(first.startDate), workoutId: ids[first.id], signature: sigA
      }, {
        eventId: second.id, workoutDate: toLocalDateKey(second.startDate), workoutId: ids[second.id], signature: sigB
      })) errors.push('Échange programmé sur Garmin mais registre non réconcilié. Réessayez pour confirmer les deux séances.');
    }
    persist();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Erreur lors de la synchronisation Garmin.');
  }
  return finish();
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
