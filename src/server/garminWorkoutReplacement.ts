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
    if (workoutId === verifiedReplaceWorkoutId) continue;

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
      throw new Error(
        `Une séance de course [QMT] (ID ${workoutId}) est déjà programmée sur Garmin le ${scheduledDate}. ` +
        'Création refusée; vérifiez manuellement cette séance avant de réessayer.'
      );
    }
  }
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
    // the old one.
    if (previousStillPresent === null) {
      throw manualReviewError(
        `Remplacement Garmin à vérifier : ancienne séance ${previousWorkoutId} et nouvelle séance ${newWorkoutId}; ` +
        'impossible de confirmer la suppression de l’ancienne séance.'
      );
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
