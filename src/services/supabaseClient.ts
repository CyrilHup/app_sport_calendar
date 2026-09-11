import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { GarminActivity, GarminWellnessData } from '../types/garmin';

const getEnv = (key: string): string => {
  return (import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || '';
};

const DEFAULT_SUPABASE_URL = 'https://iolvxwvjasawlnsxlmpi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbHZ4d3ZqYXNhd2xuc3hsbXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTE3OTUsImV4cCI6MjEwNDEyNzc5NX0.ZXDSu7yBu8h-loaoTkmWUUfmZgkRoMCX201LEJ9__rs';

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};

const PERMANENT_BACKUP_KEY = 'sb-permanent-session-backup';

/**
 * Resilient Triple-Layer persistent storage adapter with Permanent Recovery Mirror:
 * Layer 1: @capacitor/preferences (native SharedPreferences on Android, immune to process kills)
 * Layer 2: HTML5 window.localStorage (web DOM storage)
 * Layer 3: Persistent Document Cookie (365-day expiry with SameSite=Lax)
 * Mirror: Isolated permanent backup that survives transient offline refresh failures
 * Includes bidirectional automatic recovery to prevent session loss.
 */
export const persistentAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // 1. Try Capacitor Native Preferences
    try {
      const res = await Preferences.get({ key });
      if (res && typeof res.value === 'string' && res.value.trim().length > 0) {
        // Backfill localStorage and cookie to keep all layers in sync
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, res.value);
          }
        } catch {}
        return res.value;
      }
    } catch (e) {
      console.warn('Preferences.get notice:', e);
    }

    // 2. Try window.localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const localVal = window.localStorage.getItem(key);
        if (localVal && localVal.trim().length > 0) {
          // Backfill Capacitor Preferences so native storage is permanently populated
          try {
            await Preferences.set({ key, value: localVal });
          } catch {}
          return localVal;
        }
      }
    } catch {}

    // 3. Try Document Cookies fallback (useful if WebView restarted with clean web cache)
    try {
      if (typeof document !== 'undefined' && document.cookie) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(key).replace(/[-.+*]/g, '\\$&') + '=([^;]*)'));
        if (match && match[1]) {
          const cookieVal = decodeURIComponent(match[1]);
          if (cookieVal && cookieVal.trim().length > 0) {
            // Restore both Preferences and localStorage from Cookie
            try {
              await Preferences.set({ key, value: cookieVal });
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, cookieVal);
              }
            } catch {}
            return cookieVal;
          }
        }
      }
    } catch {}

    // 4. Fail-Safe Recovery from Permanent Backup Mirror (recovers session if offline launch caused Supabase to purge the active slot)
    if (key.includes('auth-token')) {
      try {
        const backupPref = await Preferences.get({ key: PERMANENT_BACKUP_KEY });
        if (backupPref && typeof backupPref.value === 'string' && backupPref.value.trim().length > 0) {
          // Re-populate the main key across layers
          await persistentAuthStorage.setItem(key, backupPref.value);
          return backupPref.value;
        }
      } catch {}

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const backupLocal = window.localStorage.getItem(PERMANENT_BACKUP_KEY);
          if (backupLocal && backupLocal.trim().length > 0) {
            await persistentAuthStorage.setItem(key, backupLocal);
            return backupLocal;
          }
        }
      } catch {}
    }

    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    // 1. Save to Capacitor Preferences (Android SharedPreferences)
    try {
      await Preferences.set({ key, value });
    } catch (e) {
      console.warn('Preferences.set notice:', e);
    }

    // 2. Save to window.localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}

    // 3. Save to Document Cookie (365 days)
    try {
      if (typeof document !== 'undefined') {
        const d = new Date();
        d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
        document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
      }
    } catch {}

    // 4. Maintain Permanent Recovery Mirror for auth tokens
    if (key.includes('auth-token')) {
      try {
        await Preferences.set({ key: PERMANENT_BACKUP_KEY, value });
      } catch {}
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(PERMANENT_BACKUP_KEY, value);
        }
      } catch {}
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await Preferences.remove({ key });
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    } catch {}
    // Note: PERMANENT_BACKUP_KEY is intentionally NOT deleted here so transient refresh failures
    // don't wipe the user's saved session. It is only purged when the user explicitly signs out.
  }
};

/**
 * Purges the permanent backup mirror. Only invoked during explicit user sign out.
 */
export async function clearPermanentAuthBackup(): Promise<void> {
  try {
    await Preferences.remove({ key: PERMANENT_BACKUP_KEY });
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(PERMANENT_BACKUP_KEY);
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

/**
 * Fetch activities from Supabase for current user (up to 2500 activities)
 */
export async function fetchActivitiesFromCloud(userId: string): Promise<GarminActivity[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('raw_payload')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(2500);

    if (error || !data) return [];
    return data.map(d => d.raw_payload as GarminActivity).filter(Boolean);
  } catch (err) {
    console.warn('Error fetching activities from Supabase:', err);
    return [];
  }
}

/**
 * Sync daily wellness data (resting HR, HRV, sleep) to Supabase
 */
export async function syncWellnessToCloud(userId: string, wellnessList: GarminWellnessData[]): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId || wellnessList.length === 0) return false;
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
        // Table might not exist yet if user hasn't run the updated SQL schema
        console.warn('Note: wellness table upsert in Supabase:', error.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn('Could not sync wellness to Supabase (run supabase_schema.sql if needed):', err);
    return false;
  }
}

/**
 * Fetch daily wellness history from Supabase for current user
 */
export async function fetchWellnessFromCloud(userId: string): Promise<GarminWellnessData[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('wellness')
      .select('raw_payload')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1000);

    if (error || !data) return [];
    return data.map(d => d.raw_payload as GarminWellnessData).filter(Boolean);
  } catch (err) {
    console.warn('Could not fetch wellness from Supabase:', err);
    return [];
  }
}

/**
 * Save manual pairs to Supabase
 */
export async function syncPairsToCloud(userId: string, pairs: Record<string, string>): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        manual_pairs: pairs,
        updated_at: new Date().toISOString()
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
export async function fetchPairsFromCloud(userId: string): Promise<Record<string, string> | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('manual_pairs')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data.manual_pairs || {};
  } catch (err) {
    console.warn('Error fetching pairs from cloud:', err);
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

    const { data: actData } = await supabase
      .from('activities')
      .select('raw_payload')
      .eq('user_id', profileData.id)
      .order('start_time', { ascending: false });

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
      activities: (actData || []).map(d => d.raw_payload as GarminActivity).filter(Boolean)
    };
  } catch (err) {
    console.warn('Error fetching shared data:', err);
    return null;
  }
}
