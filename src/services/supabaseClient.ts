import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GarminActivity } from '../types/garmin';

const getEnv = (key: string): string => {
  return (import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : (null as unknown as SupabaseClient);

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
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
 * Sync user Garmin activities to Supabase
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

    const { error } = await supabase
      .from('activities')
      .upsert(rows, { onConflict: 'user_id,activity_id' });

    return !error;
  } catch (err) {
    console.warn('Error syncing activities to Supabase:', err);
    return false;
  }
}

/**
 * Fetch activities from Supabase for current user
 */
export async function fetchActivitiesFromCloud(userId: string): Promise<GarminActivity[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('raw_payload')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error || !data) return [];
    return data.map(d => d.raw_payload as GarminActivity).filter(Boolean);
  } catch (err) {
    console.warn('Error fetching activities from Supabase:', err);
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
