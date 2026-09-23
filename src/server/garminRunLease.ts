import { randomUUID } from 'node:crypto';

interface GarminRunLease {
  markScheduled: () => void;
  confirm: (newWorkoutId: string) => Promise<void>;
  release: () => Promise<void>;
}

function bearerToken(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

/**
 * A Postgres row claim serializes Garmin creation across tabs and devices.
 * Both the target date and the exact prior ID are claimed atomically. A
 * production request without a working claim must never create a workout.
 */
export async function claimGarminRunLease(
  req: { headers?: Record<string, string | string[] | undefined> },
  workoutDate: string,
  replaceWorkoutId?: string
): Promise<GarminRunLease> {
  const token = bearerToken(req);
  if (!token && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    return { markScheduled: () => {}, confirm: async () => {}, release: async () => {} };
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) {
    throw new Error('Réservation Garmin indisponible : aucune séance créée.');
  }

  const claimId = randomUUID();
  const rpcBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const response = await fetch(`${rpcBase}/claim_garmin_run_sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_lock_date: workoutDate,
      p_replace_workout_id: replaceWorkoutId ?? null,
      p_claim_id: claimId
    }),
    signal: AbortSignal.timeout(8_000)
  });
  const claimResult = await response.json().catch(() => null) as { message?: string } | boolean | null;
  if (!response.ok || claimResult !== true) {
    if (typeof claimResult === 'object' && claimResult?.message?.includes('already in progress')) {
      throw new Error('Une synchronisation Garmin est déjà en cours pour cette date ou cette séance. Aucun nouvel entraînement créé.');
    }
    throw new Error('Protection anti-doublon Garmin indisponible. Aucun nouvel entraînement créé.');
  }

  let scheduled = false;
  let confirmed = false;
  return {
    markScheduled: () => { scheduled = true; },
    confirm: async newWorkoutId => {
      const confirmedResponse = await fetch(`${rpcBase}/confirm_garmin_run_sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_lock_date: workoutDate,
          p_previous_workout_id: replaceWorkoutId ?? null,
          p_new_workout_id: newWorkoutId,
          p_claim_id: claimId
        }),
        signal: AbortSignal.timeout(8_000)
      });
      if (!confirmedResponse.ok || await confirmedResponse.json().catch(() => null) !== true) {
        throw new Error('Séance Garmin créée mais son identifiant exact n’a pas pu être confirmé côté serveur. Vérification manuelle nécessaire.');
      }
      confirmed = true;
    },
    release: async () => {
      // After scheduling, an uncertain write must keep the other devices out
      // until the lease expires. Never release into an unrecorded duplicate.
      if (scheduled && !confirmed) return;
      const released = await fetch(`${rpcBase}/release_garmin_run_sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_claim_id: claimId }),
        signal: AbortSignal.timeout(8_000)
      });
      if (!released.ok) throw new Error('La réservation Garmin expirera automatiquement après dix minutes.');
    }
  };
}
