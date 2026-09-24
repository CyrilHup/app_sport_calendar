import { MAX_FULL_SYNC_ACTIVITIES } from './garminPagination.js';

export type GarminAction = 'sync' | 'push-workout' | 'cancel-workout' | 'get-wellness';
export type GarminSyncMode = 'full' | 'incremental';

export interface ValidatedGarminRequest {
  email: string;
  password: string;
  action: GarminAction;
  syncMode: GarminSyncMode;
  clientDate?: string;
  limit: number;
  offset: number;
  workout?: {
    title: string;
    scheduledDate: string;
    sportType: 'RUNNING' | 'CARDIO' | 'STRENGTH';
    steps: Array<Record<string, unknown>>;
    targetWatch?: string;
    description?: string;
    replaceWorkoutId?: string;
  };
  cancellation?: { scheduledDate: string; workoutId: string };
}

export function validateGarminRequest(input: unknown): ValidatedGarminRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Corps de requête Garmin invalide.');
  }
  const body = input as Record<string, unknown>;
  const action = body.action ?? 'sync';
  if (action !== 'sync' && action !== 'push-workout' && action !== 'cancel-workout' && action !== 'get-wellness') {
    throw new Error('Action Garmin non reconnue.');
  }
  const syncMode = body.syncMode ?? body.mode ?? 'incremental';
  if (syncMode !== 'full' && syncMode !== 'incremental') {
    throw new Error('Mode de synchronisation Garmin invalide.');
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 320 || password.length > 1024) {
    throw new Error('Identifiants Garmin trop longs.');
  }
  const clientDate = typeof body.clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate)
    ? body.clientDate
    : undefined;
  const limit = typeof body.limit === 'number' && Number.isFinite(body.limit)
    ? Math.min(100, Math.max(20, Math.floor(body.limit)))
    : 50;
  if (body.offset !== undefined &&
    (typeof body.offset !== 'number' || !Number.isInteger(body.offset) || body.offset < 0 || body.offset > MAX_FULL_SYNC_ACTIVITIES)) {
    throw new Error('Position de pagination Garmin invalide.');
  }
  const offset = typeof body.offset === 'number' ? body.offset : 0;

  if (action === 'cancel-workout') {
    const cancellation = body.cancellation;
    if (!cancellation || typeof cancellation !== 'object' || Array.isArray(cancellation)) {
      throw new Error('Annulation Garmin manquante.');
    }
    const data = cancellation as Record<string, unknown>;
    if (typeof data.scheduledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.scheduledDate) ||
      typeof data.workoutId !== 'string' || !/^[1-9]\d{0,19}$/.test(data.workoutId)) {
      throw new Error('Date ou identifiant exact de la séance Garmin à annuler invalide.');
    }
    return {
      email, password, action, syncMode, clientDate, limit, offset,
      cancellation: { scheduledDate: data.scheduledDate, workoutId: data.workoutId }
    };
  }
  if (action !== 'push-workout') return { email, password, action, syncMode, clientDate, limit, offset };
  const workout = body.workout;
  if (!workout || typeof workout !== 'object' || Array.isArray(workout)) {
    throw new Error('Séance Garmin manquante.');
  }
  const data = workout as Record<string, unknown>;
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) {
    throw new Error('Titre de séance Garmin invalide.');
  }
  if (typeof data.scheduledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.scheduledDate)) {
    throw new Error('Date de programmation Garmin invalide.');
  }
  if (data.sportType !== 'RUNNING' && data.sportType !== 'CARDIO' && data.sportType !== 'STRENGTH') {
    throw new Error('Type de séance Garmin invalide.');
  }
  if (!Array.isArray(data.steps) || data.steps.length < 1 || data.steps.length > 100 ||
    data.steps.some(step => !step || typeof step !== 'object' || Array.isArray(step) ||
      !['WARMUP', 'INTERVAL', 'RECOVERY', 'REST', 'COOLDOWN'].includes(step.stepType))) {
    throw new Error('Étapes de séance Garmin invalides.');
  }
  if (data.replaceWorkoutId !== undefined &&
    (typeof data.replaceWorkoutId !== 'string' || !/^[1-9]\d{0,19}$/.test(data.replaceWorkoutId))) {
    throw new Error('Identifiant de séance Garmin à remplacer invalide.');
  }
  return {
    email,
    password,
    action,
    syncMode,
    clientDate,
    limit,
    offset,
    workout: {
      title: data.title,
      scheduledDate: data.scheduledDate,
      sportType: data.sportType,
      steps: data.steps as Array<Record<string, unknown>>,
      targetWatch: typeof data.targetWatch === 'string' ? data.targetWatch : undefined,
      description: typeof data.description === 'string' ? data.description.slice(0, 2000) : undefined,
      replaceWorkoutId: data.replaceWorkoutId as string | undefined
    }
  };
}
