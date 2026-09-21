import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface StravaConnection {
  user_id: string;
  strava_athlete_id: string;
  athlete_name?: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string | null;
  last_sync_at?: string | null;
  updated_at?: string | null;
}

function getServerEnv(name: string): string {
  return String((globalThis as any).process?.env?.[name] || '').trim();
}

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('La persistance Strava nécessite SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY côté serveur.');
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return adminClient;
}

export async function getStravaConnection(userId: string): Promise<StravaConnection | null> {
  const { data, error } = await getAdminClient()
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Impossible de lire la connexion Strava : ${error.message}`);
  return (data as StravaConnection | null) || null;
}

export async function upsertStravaConnection(connection: StravaConnection): Promise<void> {
  const { error } = await getAdminClient()
    .from('strava_connections')
    .upsert({
      ...connection,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  if (error) throw new Error(`Impossible de sauvegarder la connexion Strava : ${error.message}`);
}

export async function deleteStravaConnection(userId: string): Promise<void> {
  const { error } = await getAdminClient()
    .from('strava_connections')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(`Impossible de dissocier Strava : ${error.message}`);
}
