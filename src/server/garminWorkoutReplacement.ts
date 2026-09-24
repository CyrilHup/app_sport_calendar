interface GarminWorkoutDetail {
  workoutId?: string | number;
  workoutName?: string;
  sportType?: { sportTypeKey?: string };
}

interface GarminWorkoutReplacementClient {
  getWorkoutDetail(input: { workoutId: string }): Promise<GarminWorkoutDetail>;
  deleteWorkout(input: { workoutId: string }): Promise<unknown>;
}

interface GarminWorkoutCalendarClient extends GarminWorkoutReplacementClient {
  getMonthCalendarEvents(year: number, month: number): Promise<{
    calendarItems?: unknown;
  }>;
}

interface GarminWorkoutSchedulingClient extends GarminWorkoutCalendarClient {
  scheduleWorkout(input: { workoutId: string }, scheduledDate: string): Promise<unknown>;
}

/** Read back an exact workout ID after Garmin's scheduling response is lost. */
export async function isExactWorkoutScheduledOnDate(
  client: GarminWorkoutCalendarClient,
  scheduledDate: string,
  workoutId: string
): Promise<boolean> {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledDate);
  if (!dateMatch || !/^[1-9]\d{0,19}$/.test(workoutId)) {
    throw manualReviewError('La séance Garmin créée ne peut pas être vérifiée après programmation.');
  }
  const calendar = await client.getMonthCalendarEvents(Number(dateMatch[1]), Number(dateMatch[2]) - 1);
  if (!Array.isArray(calendar?.calendarItems)) {
    throw manualReviewError(`Le calendrier Garmin du ${scheduledDate} est incomplet.`);
  }
  for (const value of calendar.calendarItems) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw manualReviewError(`Une entrée du calendrier Garmin du ${scheduledDate} est illisible.`);
    }
    const item = value as { date?: unknown; workoutId?: unknown };
    if (item.date === scheduledDate && String(item.workoutId) === workoutId) return true;
  }
  return false;
}

/** Never treat a lost scheduling response as proof that Garmin rejected it. */
export async function scheduleWorkoutWithReadback(
  client: GarminWorkoutSchedulingClient,
  workoutId: string,
  scheduledDate: string
): Promise<void> {
  try {
    await client.scheduleWorkout({ workoutId }, scheduledDate);
    return;
  } catch (scheduleError) {
    let confirmedScheduled = false;
    try {
      confirmedScheduled = await isExactWorkoutScheduledOnDate(client, scheduledDate, workoutId);
    } catch (lookupError) {
      console.warn('Could not verify Garmin scheduling after error:', lookupError);
    }
    if (confirmedScheduled) return;

    try {
      await client.deleteWorkout({ workoutId });
    } catch (cleanupError) {
      console.warn('Could not clean up uncertain Garmin workout:', cleanupError);
      throw manualReviewError(
        `Programmation Garmin à vérifier : nouvelle séance ${workoutId} le ${scheduledDate}.`
      );
    }
    throw new Error(
      `Séance créée mais non programmée dans le calendrier Garmin pour le ${scheduledDate}: ` +
      `${scheduleError instanceof Error ? scheduleError.message : 'erreur Garmin inconnue'}`
    );
  }
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function isDefinitiveNotFound(error: unknown): boolean {
  return errorStatus(error) === 404;
}

function manualReviewError(message: string): Error {
  return new Error(`${message} Vérifiez manuellement le calendrier Garmin avant de réessayer.`);
}

/** Confirm an exact ID belongs to an app-created workout before replacing it. */
export async function verifyReplaceableWorkout(
  client: GarminWorkoutReplacementClient,
  workoutId: string
): Promise<void> {
  if (!/^[1-9]\d{0,19}$/.test(workoutId)) {
    throw new Error('La séance Garmin précédente ne peut pas être vérifiée. Aucun remplacement effectué.');
  }
  const previous = await client.getWorkoutDetail({ workoutId });
  if (String(previous?.workoutId) !== workoutId ||
    typeof previous?.workoutName !== 'string' || !previous.workoutName.startsWith('[QMT] ')) {
    throw new Error('La séance Garmin précédente ne peut pas être vérifiée. Aucun remplacement effectué.');
  }
}

/**
 * Prevent a second app-created running workout from being scheduled on a date.
 * Garmin calendar items only expose a workout ID, so inspect exact-date items
 * and verify their details before deciding whether they are QMT running plans.
 */
export async function assertNoConflictingScheduledQmtRun(
  client: GarminWorkoutCalendarClient,
  scheduledDate: string,
  verifiedReplaceWorkoutId?: string
): Promise<void> {
  const existingIds = await findScheduledQmtRunIds(client, scheduledDate, verifiedReplaceWorkoutId);
  const conflict = existingIds.find(id => id !== verifiedReplaceWorkoutId);
  if (conflict) {
    throw new Error(
      `Une séance de course [QMT] (ID ${conflict}) est déjà programmée sur Garmin le ${scheduledDate}. ` +
      'Création refusée; vérifiez manuellement cette séance avant de réessayer.'
    );
  }
}

/** Exact IDs of app-tagged running workouts on one Garmin calendar date. */
export async function findScheduledQmtRunIds(
  client: GarminWorkoutCalendarClient,
  scheduledDate: string,
  verifiedReplaceWorkoutId?: string
): Promise<string[]> {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledDate);
  if (!dateMatch) {
    throw manualReviewError(`La date ${scheduledDate} ne permet pas de vérifier le calendrier Garmin.`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  let monthCalendar: { calendarItems?: unknown };
  try {
    monthCalendar = await client.getMonthCalendarEvents(year, month);
  } catch {
    throw manualReviewError(`Impossible de lire le calendrier Garmin du ${scheduledDate}; création refusée.`);
  }

  if (!monthCalendar || !Array.isArray(monthCalendar.calendarItems)) {
    throw manualReviewError(`Le calendrier Garmin du ${scheduledDate} est incomplet; création refusée.`);
  }

  const foundIds: string[] = [];
  for (const value of monthCalendar.calendarItems) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw manualReviewError(`Une entrée du calendrier Garmin du ${scheduledDate} est illisible; création refusée.`);
    }
    const item = value as { date?: unknown; workoutId?: unknown };
    if (item.date !== scheduledDate || item.workoutId === null || item.workoutId === undefined) continue;

    const workoutId = String(item.workoutId);
    if (!/^[1-9]\d{0,19}$/.test(workoutId)) {
      throw manualReviewError(`Un entraînement du ${scheduledDate} a un identifiant illisible; création refusée.`);
    }
    if (workoutId === verifiedReplaceWorkoutId) {
      if (!foundIds.includes(workoutId)) foundIds.push(workoutId);
      continue;
    }
    let detail: GarminWorkoutDetail;
    try {
      detail = await client.getWorkoutDetail({ workoutId });
    } catch {
      throw manualReviewError(`Impossible de vérifier l'entraînement Garmin ${workoutId} du ${scheduledDate}; création refusée.`);
    }

    if (!detail || String(detail.workoutId) !== workoutId ||
      typeof detail.workoutName !== 'string' || typeof detail.sportType?.sportTypeKey !== 'string') {
      throw manualReviewError(`Les détails de l'entraînement Garmin ${workoutId} du ${scheduledDate} sont incomplets; création refusée.`);
    }

    if (detail.workoutName.startsWith('[QMT] ') && detail.sportType.sportTypeKey.toLowerCase() === 'running') {
      if (!foundIds.includes(workoutId)) foundIds.push(workoutId);
    }
  }
  return foundIds;
}

/**
 * Resolve only app-owned Garmin IDs that are safe to retire after a replacement.
 * Runs additionally collect same-day legacy QMT duplicates; other sports only
 * replace the exact ID already recorded for that app event.
 */
export async function findScheduledQmtWorkoutReplacementIds(
  client: GarminWorkoutCalendarClient,
  scheduledDate: string,
  sportType: string,
  replaceWorkoutId?: string
): Promise<string[]> {
  if (!replaceWorkoutId) {
    return sportType === 'RUNNING'
      ? findScheduledQmtRunIds(client, scheduledDate)
      : [];
  }

  await verifyReplaceableWorkout(client, replaceWorkoutId);

  if (sportType === 'RUNNING') {
    const runIds = await findScheduledQmtRunIds(client, scheduledDate, replaceWorkoutId);
    if (!runIds.includes(replaceWorkoutId)) {
      throw manualReviewError(
        `La séance exacte ${replaceWorkoutId} n'est plus programmée le ${scheduledDate}.`
      );
    }
    return runIds;
  }

  if (!await isExactWorkoutScheduledOnDate(client, scheduledDate, replaceWorkoutId)) {
    throw manualReviewError(
      `La séance exacte ${replaceWorkoutId} n'est plus programmée le ${scheduledDate}.`
    );
  }
  return [replaceWorkoutId];
}

/** Cancel only one exact, verified app-created run; never touch recorded activities. */
export async function cancelExactScheduledQmtRun(
  client: GarminWorkoutCalendarClient,
  scheduledDate: string,
  workoutId: string
): Promise<void> {
  if (!/^[1-9]\d{0,19}$/.test(workoutId)) {
    throw manualReviewError('Identifiant Garmin à annuler invalide.');
  }
  const verifiedRunIds = await findScheduledQmtRunIds(client, scheduledDate);
  if (!verifiedRunIds.includes(workoutId)) {
    if (await isExactWorkoutScheduledOnDate(client, scheduledDate, workoutId)) {
      throw manualReviewError(`La séance ${workoutId} n'est pas une course [QMT] vérifiée le ${scheduledDate}.`);
    }
    // A previous request may have succeeded even when its response was lost.
    return;
  }

  let deletionError: unknown;
  try {
    await client.deleteWorkout({ workoutId });
  } catch (error) {
    deletionError = error;
  }
  try {
    if (!await isExactWorkoutScheduledOnDate(client, scheduledDate, workoutId)) return;
  } catch {
    throw manualReviewError(`Annulation Garmin ${workoutId} à vérifier : lecture du calendrier impossible.`);
  }
  throw manualReviewError(
    `La séance Garmin ${workoutId} reste programmée le ${scheduledDate}` +
    (deletionError instanceof Error ? ` (${deletionError.message})` : '') + '.'
  );
}

/** Registry ownership is checked before Garmin deletion and cleared only after readback. */
export async function cancelRegisteredGarminRun(
  client: GarminWorkoutCalendarClient,
  scheduledDate: string,
  workoutId: string,
  registry: { contains: () => Promise<boolean>; markCancelled: () => Promise<void> }
): Promise<void> {
  if (!await registry.contains()) {
    // Safe idempotency after a lost response: an unregistered ID may be
    // acknowledged only if it is already absent from Garmin's calendar.
    if (await isExactWorkoutScheduledOnDate(client, scheduledDate, workoutId)) {
      throw new Error('Identifiant Garmin non confirmé dans le registre du compte. Aucune séance annulée.');
    }
    return;
  }
  await cancelExactScheduledQmtRun(client, scheduledDate, workoutId);
  await registry.markCancelled();
}

/** Delete only the verified previous ID; roll back the new workout if that fails. */
export async function finishWorkoutReplacement(
  client: GarminWorkoutReplacementClient,
  previousWorkoutId: string,
  newWorkoutId: string
): Promise<void> {
  try {
    await client.deleteWorkout({ workoutId: previousWorkoutId });
  } catch (replaceErr: any) {
    let previousStillPresent: boolean | null = null;
    try {
      const previous = await client.getWorkoutDetail({ workoutId: previousWorkoutId });
      if (String(previous?.workoutId) === previousWorkoutId) previousStillPresent = true;
    } catch (lookupErr) {
      if (isDefinitiveNotFound(lookupErr)) return;
    }

    // If the lookup itself is ambiguous, preserve the new workout: deleting it
    // could leave the athlete with neither version when Garmin already removed
    // the old one. Retry only the already verified old ID; an exact-ID delete
    // is idempotent if the first request succeeded but its response was lost.
    if (previousStillPresent === null) {
      try {
        await client.deleteWorkout({ workoutId: previousWorkoutId });
        return;
      } catch (retryErr) {
        if (isDefinitiveNotFound(retryErr)) return;
        throw manualReviewError(
          `Remplacement Garmin à vérifier : ancienne séance ${previousWorkoutId} et nouvelle séance ${newWorkoutId}; ` +
          'la suppression exacte n’a pas pu être confirmée après une relance.'
        );
      }
    }

    try {
      await client.deleteWorkout({ workoutId: newWorkoutId });
    } catch (rollbackErr) {
      console.error('Could not roll back newly scheduled Garmin workout:', rollbackErr);
      throw manualReviewError(`Remplacement Garmin incomplet : ancienne séance ${previousWorkoutId} et nouvelle séance ${newWorkoutId}.`);
    }
    throw new Error(`Ancienne séance Garmin ${previousWorkoutId} toujours présente ; la nouvelle ${newWorkoutId} a été annulée : ${replaceErr?.message || 'erreur inconnue'}`);
  }
}

/** Retire every verified historical version after the new one is scheduled. */
export async function finishWorkoutReplacements(
  client: GarminWorkoutReplacementClient,
  previousWorkoutIds: readonly string[],
  newWorkoutId: string
): Promise<void> {
  for (const previousId of previousWorkoutIds) {
    await finishWorkoutReplacement(client, previousId, newWorkoutId);
  }
}

/** Schedule and confirm the new version before retiring any previous IDs. */
export async function scheduleAndReplacePreviousWorkouts(
  client: GarminWorkoutSchedulingClient,
  newWorkoutId: string,
  scheduledDate: string,
  previousWorkoutIds: readonly string[]
): Promise<void> {
  await scheduleWorkoutWithReadback(client, newWorkoutId, scheduledDate);
  await finishWorkoutReplacements(client, previousWorkoutIds, newWorkoutId);
}
