interface GarminWorkoutReplacementClient {
  getWorkoutDetail(input: { workoutId: string }): Promise<{ workoutId?: string | number; workoutName?: string }>;
  deleteWorkout(input: { workoutId: string }): Promise<unknown>;
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

/** Delete only the verified previous ID; roll back the new workout if that fails. */
export async function finishWorkoutReplacement(
  client: GarminWorkoutReplacementClient,
  previousWorkoutId: string,
  newWorkoutId: string
): Promise<void> {
  try {
    await client.deleteWorkout({ workoutId: previousWorkoutId });
  } catch (replaceErr: any) {
    try {
      await client.deleteWorkout({ workoutId: newWorkoutId });
    } catch (rollbackErr) {
      console.error('Could not roll back newly scheduled Garmin workout:', rollbackErr);
      throw new Error(`Remplacement Garmin incomplet : ancienne séance ${previousWorkoutId} et nouvelle séance ${newWorkoutId} à vérifier manuellement.`);
    }
    throw new Error(`Ancienne séance Garmin ${previousWorkoutId} non supprimée ; la nouvelle a été annulée : ${replaceErr?.message || 'erreur inconnue'}`);
  }
}
