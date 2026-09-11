/**
 * Service de stockage local sécurisé et typé.
 * Centralise les clés de stockage de l'application et protège contre les erreurs de quota,
 * de JSON corrompu ou d'environnements d'exécution sans localStorage (SSR/Tests).
 */

export const STORAGE_KEYS = {
  // Garmin Sync & Credentials
  GARMIN_CREDS: 'garmin_credentials',
  GARMIN_ACTIVITIES: 'garmin_activities_synced',
  GARMIN_STATE: 'garmin_sync_state',
  GARMIN_MANUAL_PAIRS: 'garmin_manual_pairs',
  GARMIN_PUSHED_WORKOUTS: 'garmin_pushed_workouts',
  GARMIN_AUTO_SYNC_ENABLED: 'sport_calendar_garmin_auto_sync_enabled',
  GARMIN_SYNCED_SIGNATURES: 'sport_calendar_garmin_synced_week_signatures',

  // Entraînement et Calendrier
  POSTPONE_OVERRIDES: 'sport_calendar_postponed_workouts',
  ADAPTIVE_OVERRIDES: 'sport_calendar_adaptive_overrides',
  CACHED_ETS_ICS: 'cached_ets_ics',

  // Télémétrie et Bien-être
  WELLNESS_HISTORY: 'garmin_wellness_history',
  WEATHER_CACHE: 'mont_royal_weather_cache_v2',

  // Alarmes et Google Calendar
  ALARMS: 'app_scheduled_run_alarms',
  GCAL_EVENT_MAP: 'gcal_synced_events_map_v1',
  GCAL_CLIENT_ID: 'gcal_oauth_client_id'
} as const;

/**
 * Récupère un élément typé du localStorage avec valeur par défaut en cas d'absence ou d'erreur.
 */
export function storageGet<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') {
    return defaultValue;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[storageService] Erreur lors de la lecture de la clé "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Sauvegarde un élément sérialisé en JSON dans le localStorage.
 * Retourne true si l'écriture a réussi, false en cas d'échec (ex: quota dépassé).
 */
export function storageSet<T>(key: string, value: T): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storageService] Erreur lors de l'écriture de la clé "${key}":`, error);
    return false;
  }
}

/**
 * Récupère une chaîne brute non sérialisée en JSON.
 */
export function storageGetRaw(key: string, defaultValue: string = ''): string {
  if (typeof localStorage === 'undefined') {
    return defaultValue;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw !== null && raw !== undefined ? raw : defaultValue;
  } catch (error) {
    console.warn(`[storageService] Erreur lors de la lecture brute de la clé "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Sauvegarde une chaîne brute non sérialisée en JSON.
 */
export function storageSetRaw(key: string, value: string): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[storageService] Erreur lors de l'écriture brute de la clé "${key}":`, error);
    return false;
  }
}

/**
 * Supprime une clé du localStorage.
 */
export function storageRemove(key: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[storageService] Erreur lors de la suppression de la clé "${key}":`, error);
  }
}
