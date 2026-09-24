import { randomUUID } from 'node:crypto';

interface GarminRunLease {
  /** Call immediately before sending createWorkout so a lost response keeps the date locked. */
  markCreateStarted: () => void;
  confirm: (newWorkoutId: string) => Promise<void>;
  release: () => Promise<void>;
}

function bearerToken(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

function registryRequestContext(req: { headers?: Record<string, string | string[] | undefined> }) {
  const token = bearerToken(req);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) {
    throw new Error('Registre Garmin indisponible : aucune séance annulée.');
  }
  return {
    url: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/garmin_run_registry`,
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  };
}

/** RLS scopes this exact date-and-ID lookup to the authenticated athlete. */
export async function isRegisteredGarminRun(
  req: { headers?: Record<string, string | string[] | undefined> },
  workoutDate: string,
  workoutId: string
): Promise<boolean> {
  const { url, headers } = registryRequestContext(req);
  const query = new URLSearchParams({
    select: 'workout_id',
    workout_date: `eq.${workoutDate}`,
    workout_id: `eq.${workoutId}`,
    limit: '1'
  });
  const response = await fetch(`${url}?${query}`, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error('Registre Garmin illisible : aucune séance annulée.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Registre Garmin invalide : aucune séance annulée.');
  return rows.length === 1 && rows[0]?.workout_id === workoutId;
}

/** Persist a tombstone so a stale client cannot recreate the cancelled plan. */
export async function markRegisteredGarminRunCancelled(
  req: { headers?: Record<string, string | string[] | undefined> },
  workoutDate: string,
  workoutId: string
): Promise<void> {
  const { url, headers } = registryRequestContext(req);
  const query = new URLSearchParams({
    workout_date: `eq.${workoutDate}`,
    workout_id: `eq.${workoutId}`
  });
  try {
    const response = await fetch(`${url}?${query}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature: 'cancelled-rest', updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error('Mise à jour du registre Garmin refusée.');
  } catch (error) {
    if (!await hasCancelledRunTombstone(req, workoutDate, workoutId)) throw error;
  }
  if (!await hasCancelledRunTombstone(req, workoutDate, workoutId)) {
    throw new Error('Annulation Garmin non enregistrée dans le registre.');
  }
}

async function hasCancelledRunTombstone(
  req: { headers?: Record<string, string | string[] | undefined> },
  workoutDate: string,
  workoutId: string
): Promise<boolean> {
  const { url, headers } = registryRequestContext(req);
  const query = new URLSearchParams({
    select: 'workout_id,signature',
    workout_date: `eq.${workoutDate}`,
    workout_id: `eq.${workoutId}`,
    limit: '1'
  });
  const response = await fetch(`${url}?${query}`, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error('Registre Garmin illisible après annulation.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Registre Garmin invalide après annulation.');
  return rows.length === 1 && rows[0]?.workout_id === workoutId && rows[0]?.signature === 'cancelled-rest';
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
    return { markCreateStarted: () => {}, confirm: async () => {}, release: async () => {} };
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

  let createMayHaveSucceeded = false;
  let confirmed = false;
  return {
    markCreateStarted: () => { createMayHaveSucceeded = true; },
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
      // Once creation may have reached Garmin, an uncertain result must keep
      // other devices out until expiry. Never release into an unrecorded duplicate.
      if (createMayHaveSucceeded && !confirmed) return;
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
