import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { GarminActivity, GarminWellnessData } from '../types/garmin';

const getEnv = (key: string): string => {
  return (import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};

const LEGACY_PERMANENT_BACKUP_KEY = 'sb-permanent-session-backup';

/**
 * Uses exactly one authoritative auth store per platform:
 * Capacitor Preferences on native and localStorage on the web.
 *
 * The previous cookie + permanent mirror implementation could resurrect a session
 * after sign-out and made it impossible to know which copy was authoritative.
 */
export const persistentAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      try {
        return (await Preferences.get({ key })).value;
      } catch (error) {
        console.warn('Unable to read native auth session:', error);
        return null;
      }
    }

    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch (error) {
      console.warn('Unable to read web auth session:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.set({ key, value });
      } catch (error) {
        console.warn('Unable to persist native auth session:', error);
      }
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Unable to persist web auth session:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.remove({ key });
      } catch (error) {
        console.warn('Unable to remove native auth session:', error);
      }
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn('Unable to remove web auth session:', error);
    }
  }
};

/**
 * Removes artifacts created by the former multi-layer auth store.
 */
export async function clearPermanentAuthBackup(): Promise<void> {
  try {
    await Preferences.remove({ key: LEGACY_PERMANENT_BACKUP_KEY });
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_PERMANENT_BACKUP_KEY);
    }
  } catch {}
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${encodeURIComponent(LEGACY_PERMANENT_BACKUP_KEY)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    }
  } catch {}
}

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: persistentAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : (null as unknown as SupabaseClient);

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('Unable to read Supabase access token:', error);
    return null;
  }
  return data.session?.access_token || null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  homeAddress?: string;
  campusAddress?: string;
  trailAddress?: string;
  fcMax?: number;
  raceName?: string;
  raceDate?: string;
  icalUrl?: string;
  shareSlug?: string;
  isPublic?: boolean;
}

/**
 * Fetch profile for the current user
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name || 'Athlète QMT',
      avatarUrl: data.avatar_url,
      homeAddress: data.home_address,
      campusAddress: data.campus_address,
      trailAddress: data.trail_address,
      fcMax: data.fc_max,
      raceName: data.race_name,
      raceDate: data.race_date,
      icalUrl: data.ical_url,
      shareSlug: data.share_slug,
      isPublic: data.is_public ?? false
    };
  } catch (err) {
    console.warn('Error fetching user profile:', err);
    return null;
  }
}

/**
 * Update user profile
 */
export async function upsertUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const row: any = {
      id: profile.id,
      updated_at: new Date().toISOString()
    };
    if (profile.displayName !== undefined) row.display_name = profile.displayName;
    if (profile.avatarUrl !== undefined) row.avatar_url = profile.avatarUrl;
    if (profile.email !== undefined) row.email = profile.email;
    if (profile.homeAddress !== undefined) row.home_address = profile.homeAddress;
    if (profile.campusAddress !== undefined) row.campus_address = profile.campusAddress;
    if (profile.trailAddress !== undefined) row.trail_address = profile.trailAddress;
    if (profile.fcMax !== undefined) row.fc_max = profile.fcMax;
    if (profile.raceName !== undefined) row.race_name = profile.raceName;
    if (profile.raceDate !== undefined) row.race_date = profile.raceDate;
    if (profile.icalUrl !== undefined) row.ical_url = profile.icalUrl;
    if (profile.shareSlug !== undefined) row.share_slug = profile.shareSlug;
    if (profile.isPublic !== undefined) row.is_public = profile.isPublic;

    const { error } = await supabase
      .from('profiles')
      .upsert(row);

    return !error;
  } catch (err) {
    console.warn('Error upserting user profile:', err);
    return false;
  }
}

/**
 * Sync user Garmin activities to Supabase (in chunks of 100 to handle large history safely)
 */
export async function syncActivitiesToCloud(userId: string, activities: GarminActivity[]): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId || activities.length === 0) return false;
  try {
    const rows = activities.map(act => ({
      user_id: userId,
      activity_id: act.activityId,
      name: act.activityName,
      activity_type: act.activityType,
      start_time: act.startTimeLocal,
      duration_minutes: act.durationMinutes,
      distance_km: act.distanceKm,
      elevation_gain_m: act.elevationGainM,
      avg_hr: act.avgHeartRate,
      max_hr: act.maxHeartRate,
      avg_pace: act.avgPaceMinKm,
      calories: act.calories,
      raw_payload: act,
      updated_at: new Date().toISOString()
    }));

    // Chunk upserts into batches of 100 for network efficiency and resilience
    let allSuccessful = true;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase
        .from('activities')
        .upsert(chunk, { onConflict: 'user_id,activity_id' });
      if (error) {
        console.warn('Error syncing activity chunk to Supabase:', error);
        allSuccessful = false;
      }
    }

    return allSuccessful;
  } catch (err) {
    console.warn('Error syncing activities to Supabase:', err);
    return false;
  }
}

/** Fetch the complete activity history with deterministic pagination. */
export async function fetchActivitiesFromCloud(userId: string): Promise<GarminActivity[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  try {
    const pageSize = 1000;
    const activities: GarminActivity[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('activities')
        .select('raw_payload')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.warn('Error fetching activities from Supabase:', error);
        return activities;
      }
      const page = data || [];
      activities.push(...page.map(row => row.raw_payload as GarminActivity).filter(Boolean));
      if (page.length < pageSize) break;
    }
    return activities;
  } catch (err) {
    console.warn('Error fetching activities from Supabase:', err);
    return [];
  }
}

/**
 * Circuit breaker to track if the wellness table is available in Supabase.
 * If PostgREST returns PGRST205 (table not found in schema cache) or 404,
 * we flag it as false to avoid spamming 404 network requests and console errors.
 */
let isWellnessTableAvailable: boolean | null = null;

function isTableMissingError(error: any): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.status === 404 ||
    (typeof error.message === 'string' &&
      (error.message.includes('public.wellness') || error.message.includes('schema cache')))
  );
}

export interface GarminRunRegistryEntry {
  eventId: string;
  workoutDate: string;
  workoutId: string;
  signature: string;
}

/** Exact app-created Garmin IDs survive browser storage resets and device changes. */
export async function fetchGarminRunRegistry(userId: string): Promise<GarminRunRegistryEntry[] | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('garmin_run_registry')
      .select('event_id, workout_date, workout_id, signature')
      .eq('user_id', userId);
    if (error) {
      console.warn('Could not fetch Garmin workout IDs from cloud:', error);
      return null;
    }
    return (data || []).map(row => ({
      eventId: row.event_id,
      workoutDate: row.workout_date,
      workoutId: row.workout_id,
      signature: row.signature
    }));
  } catch (error) {
    console.warn('Could not fetch Garmin workout IDs from cloud:', error);
    return null;
  }
}

export async function saveGarminRunRegistryEntry(userId: string, entry: GarminRunRegistryEntry): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const { error } = await supabase.from('garmin_run_registry').upsert({
      user_id: userId,
      event_id: entry.eventId,
      workout_date: entry.workoutDate,
      workout_id: entry.workoutId,
      signature: entry.signature,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,workout_date' });
    if (error) console.warn('Could not save exact Garmin workout ID to cloud:', error);
    return !error;
  } catch (error) {
    console.warn('Could not save exact Garmin workout ID to cloud:', error);
    return false;
  }
}

export function resetWellnessTableAvailability(): void {
  isWellnessTableAvailable = null;
}

/**
 * Sync daily wellness data (resting HR, HRV, sleep) to Supabase
 */
export async function syncWellnessToCloud(userId: string, wellnessList: GarminWellnessData[]): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId || wellnessList.length === 0) return false;
  if (isWellnessTableAvailable === false) return false;
  try {
    const rows = wellnessList.map(w => ({
      user_id: userId,
      date: w.date,
      resting_hr: w.restingHeartRate,
      sleep_score: w.sleep?.score,
      sleep_minutes: w.sleep?.totalMinutes,
      hrv_last_night: w.hrv?.lastNightAvg,
      hrv_status: w.hrv?.status,
      readiness_score: w.trainingReadinessScore,
      raw_payload: w,
      updated_at: new Date().toISOString()
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase
        .from('wellness')
        .upsert(chunk, { onConflict: 'user_id,date' });
      if (error) {
        if (isTableMissingError(error)) {
          if (isWellnessTableAvailable === null) {
            isWellnessTableAvailable = false;
            console.info(
              '[Supabase] Note: Table "public.wellness" non encore créée dans Supabase. Les données de récupération (FC repos, VRC, sommeil) restent sauvegardées localement. Exécutez le script SQL (section 4 de supabase_schema.sql) pour synchroniser dans le cloud.'
            );
          } else {
            isWellnessTableAvailable = false;
          }
          return false;
        }
        console.warn('Note: wellness table upsert in Supabase:', error.message);
        return false;
      }
    }
    isWellnessTableAvailable = true;
    return true;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      isWellnessTableAvailable = false;
      return false;
    }
    console.warn('Could not sync wellness to Supabase (run supabase_schema.sql if needed):', err);
    return false;
  }
}

/**
 * Fetch daily wellness history from Supabase for current user
 */
export async function fetchWellnessFromCloud(userId: string): Promise<GarminWellnessData[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  if (isWellnessTableAvailable === false) return [];
  try {
    const pageSize = 1000;
    const wellness: GarminWellnessData[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('wellness')
        .select('raw_payload')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        if (isTableMissingError(error)) {
          if (isWellnessTableAvailable === null) {
            console.info('[Supabase] Table "public.wellness" absente; le suivi reste local.');
          }
          isWellnessTableAvailable = false;
          return [];
        }
        console.warn('Could not fetch wellness from Supabase:', error.message);
        return wellness;
      }
      const page = data || [];
      wellness.push(...page.map(row => row.raw_payload as GarminWellnessData).filter(Boolean));
      if (page.length < pageSize) break;
    }
    isWellnessTableAvailable = true;
    return wellness;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      isWellnessTableAvailable = false;
      return [];
    }
    console.warn('Could not fetch wellness from Supabase:', err);
    return [];
  }
}

/**
 * Save manual pairs to Supabase
 */
export async function syncPairsToCloud(
  userId: string,
  pairs: Record<string, string>,
  updatedAt: string = new Date().toISOString()
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        manual_pairs: pairs,
        manual_pairs_updated_at: updatedAt,
        updated_at: updatedAt
      }, { onConflict: 'user_id' });

    return !error;
  } catch (err) {
    console.warn('Error saving pairs to cloud:', err);
    return false;
  }
}

/**
 * Fetch manual pairs from Supabase
 */
export async function fetchPairsFromCloud(userId: string): Promise<{
  value: Record<string, string>;
  updatedAt: string | null;
} | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('manual_pairs, manual_pairs_updated_at, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return {
      value: data.manual_pairs || {},
      updatedAt: data.manual_pairs_updated_at || data.updated_at || null
    };
  } catch (err) {
    console.warn('Error fetching pairs from cloud:', err);
    return null;
  }
}

/**
 * Save adaptive & postpone overrides to Supabase user_settings
 */
export async function syncOverridesToCloud(
  userId: string,
  overrides: {
    adaptiveOverrides?: Record<string, any>;
    postponeOverrides?: Record<string, any>;
    adaptiveUpdatedAt?: string;
    postponeUpdatedAt?: string;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const payload: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString()
    };
    if (overrides.adaptiveOverrides !== undefined) {
      payload.adaptive_overrides = overrides.adaptiveOverrides;
      payload.adaptive_overrides_updated_at = overrides.adaptiveUpdatedAt || payload.updated_at;
    }
    if (overrides.postponeOverrides !== undefined) {
      payload.postpone_overrides = overrides.postponeOverrides;
      payload.postpone_overrides_updated_at = overrides.postponeUpdatedAt || payload.updated_at;
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('Error saving overrides to cloud:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error saving overrides to cloud:', err);
    return false;
  }
}

/**
 * Fetch adaptive & postpone overrides from Supabase user_settings
 */
export async function fetchOverridesFromCloud(userId: string): Promise<{
  adaptiveOverrides: { value: Record<string, any>; updatedAt: string | null };
  postponeOverrides: { value: Record<string, any>; updatedAt: string | null };
} | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('adaptive_overrides, postpone_overrides, adaptive_overrides_updated_at, postpone_overrides_updated_at, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return {
      adaptiveOverrides: {
        value: data.adaptive_overrides || {},
        updatedAt: data.adaptive_overrides_updated_at || data.updated_at || null
      },
      postponeOverrides: {
        value: data.postpone_overrides || {},
        updatedAt: data.postpone_overrides_updated_at || data.updated_at || null
      }
    };
  } catch (err) {
    console.warn('Error fetching overrides from cloud:', err);
    return null;
  }
}


/**
 * Fetch shared public profile & activities for spectators (friends)
 */
export async function fetchPublicSharedData(slugOrUserId: string): Promise<{
  profile: UserProfile;
  activities: GarminActivity[];
} | null> {
  if (!isSupabaseConfigured() || !slugOrUserId) return null;
  try {
    // Try by share_slug or id
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`share_slug.eq.${slugOrUserId},id.eq.${slugOrUserId}`)
      .eq('is_public', true)
      .single();

    if (error || !profileData) return null;

    const pageSize = 1000;
    const sharedActivities: GarminActivity[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data: actData, error: activitiesError } = await supabase
        .from('activities')
        .select('raw_payload')
        .eq('user_id', profileData.id)
        .order('start_time', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (activitiesError) {
        console.warn('Error fetching public shared activities:', activitiesError);
        break;
      }
      const page = actData || [];
      sharedActivities.push(...page.map(row => row.raw_payload as GarminActivity).filter(Boolean));
      if (page.length < pageSize) break;
    }

    return {
      profile: {
        id: profileData.id,
        email: '', // Never leak email to spectators
        displayName: profileData.display_name || 'Athlète QMT',
        trailAddress: profileData.trail_address,
        fcMax: profileData.fc_max,
        raceName: profileData.race_name,
        raceDate: profileData.race_date,
        shareSlug: profileData.share_slug,
        isPublic: true
      },
      activities: sharedActivities
    };
  } catch (err) {
    console.warn('Error fetching shared data:', err);
    return null;
  }
}
