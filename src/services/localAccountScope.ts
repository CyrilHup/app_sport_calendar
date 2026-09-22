import { STORAGE_KEYS, storageGetRaw, storageRemove, storageSetRaw } from './storageService';

/** Device-local copies of cloud-owned data and account-specific Garmin state. */
const ACCOUNT_SCOPED_KEYS = [
  STORAGE_KEYS.GARMIN_ACTIVITIES,
  STORAGE_KEYS.GARMIN_STATE,
  STORAGE_KEYS.GARMIN_MANUAL_PAIRS,
  STORAGE_KEYS.GARMIN_PUSHED_WORKOUTS,
  STORAGE_KEYS.GARMIN_SYNCED_SIGNATURES,
  STORAGE_KEYS.GARMIN_SYNCED_WORKOUT_IDS,
  STORAGE_KEYS.GARMIN_ATHLETE_BASE_PACE,
  STORAGE_KEYS.ATHLETE_FC_MAX,
  STORAGE_KEYS.POSTPONE_OVERRIDES,
  STORAGE_KEYS.ADAPTIVE_OVERRIDES,
  STORAGE_KEYS.CACHED_ETS_ICS,
  STORAGE_KEYS.SYNC_METADATA,
  STORAGE_KEYS.WELLNESS_HISTORY,
  STORAGE_KEYS.GCAL_EVENT_MAP
] as const;

/**
 * Legacy unowned data is deliberately not uploaded to the first signed-in user.
 * The app is personal-use; cloud data is rehydrated for the new account.
 * Returns true when the in-memory account state must also be cleared.
 */
export function ensureLocalAccountOwner(userId: string): boolean {
  if (!userId) return false;
  if (storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER) === userId) return false;
  for (const key of ACCOUNT_SCOPED_KEYS) storageRemove(key);
  storageSetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER, userId);
  return true;
}
