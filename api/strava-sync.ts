import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { applyApiCors, ensureResponseHelpers, requireAuthenticatedUser } from '../src/server/requestSecurity.js';
import { getServerProductionOrigin } from '../src/services/productionOrigin.js';
import { calculateElevationLossM, GarminActivityMatchInput, matchStravaActivities, StravaActivitySummary } from '../src/server/stravaMatching.js';
import {
  deleteStravaConnection,
  getStravaConnection,
  StravaConnection,
  upsertStravaConnection
} from '../src/server/stravaConnectionStore.js';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth';
// Keep the currently documented API base until Strava's announced hostname
// migration becomes available. The OAuth endpoint above is unchanged.
const STRAVA_API_URL = 'https://www.strava.com/api/v3';
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_MATCH_CANDIDATES = 2_000;
// Leave headroom under Strava's default read-rate limit: activity listing uses
// up to 20 calls, so a sync performs at most 150 additional stream requests.
const MAX_STREAM_REQUESTS_PER_SYNC = 150;

interface StravaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  scope?: string;
  athlete?: {
    id?: number;
    firstname?: string;
    lastname?: string;
  };
}

interface StravaElevationPatch {
  activityId: string;
  stravaActivityId: string;
  elevationGainM?: number;
  elevationLossM?: number;
  elevationSource: 'STRAVA_CORRECTED';
  elevationUpdatedAt: string;
  matchScore: number;
}

function env(name: string): string {
  return String((globalThis as any).process?.env?.[name] || '').trim();
}

function readHeader(req: any, name: string): string {
  const headers = req?.headers || {};
  const raw = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(raw) ? String(raw[0] || '') : String(raw || '');
}

function readQuery(req: any): Record<string, string> {
  if (req?.query && typeof req.query === 'object') {
    return Object.fromEntries(Object.entries(req.query).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0] || '') : String(value || '')
    ]));
  }

  try {
    const url = new URL(req?.url || '', 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

function getStravaRedirectUri(): string {
  return env('STRAVA_REDIRECT_URI') || `${getServerProductionOrigin()}/api/strava-sync?action=callback`;
}

function getStravaConfig(): { clientId: string; clientSecret: string; stateSecret: string } {
  const clientId = env('STRAVA_CLIENT_ID');
  const clientSecret = env('STRAVA_CLIENT_SECRET');
  const stateSecret = env('STRAVA_STATE_SECRET');
  if (!clientId || !clientSecret || !stateSecret) {
    throw new Error('Strava OAuth n’est pas configuré côté serveur.');
  }
  return { clientId, clientSecret, stateSecret };
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

interface OAuthState {
  userId: string;
  returnOrigin: string;
  issuedAt: number;
  nonce: string;
}

function signOAuthState(state: OAuthState, secret: string): string {
  const payload = encodeBase64Url(JSON.stringify(state));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyOAuthState(rawState: string, secret: string): OAuthState | null {
  const [payload, signature] = String(rawState || '').split('.');
  if (!payload || !signature) return null;

  const expected = createHmac('sha256', secret).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const state = JSON.parse(decodeBase64Url(payload)) as OAuthState;
    if (!state.userId || !state.returnOrigin || !state.nonce || !Number.isFinite(state.issuedAt)) return null;
    if (Date.now() - state.issuedAt > 10 * 60 * 1000 || state.issuedAt - Date.now() > 60_000) return null;
    return state;
  } catch {
    return null;
  }
}

function safeReturnOrigin(req: any): string {
  const requestedOrigin = readHeader(req, 'origin');
  const configuredOrigins = String(env('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowed = new Set([
    getServerProductionOrigin(),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'capacitor://localhost',
    ...configuredOrigins
  ]);
  return allowed.has(requestedOrigin) ? requestedOrigin : getServerProductionOrigin();
}

function redirectToApp(res: any, origin: string, status: string, details?: string): void {
  try {
    const target = new URL(origin);
    target.searchParams.set('strava', status);
    if (details) target.searchParams.set('strava_error', details.slice(0, 160));
    res.statusCode = 302;
    res.setHeader('Location', target.toString());
    res.end();
  } catch {
    res.status(500).json({ error: 'Redirection Strava impossible.' });
  }
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);

  const raw = await new Promise<string>((resolve, reject) => {
    let content = '';
    const timer = setTimeout(() => reject(new Error('Request timeout')), 5_000);
    req.on('data', (chunk: any) => {
      content += String(chunk);
      if (content.length > MAX_REQUEST_BYTES) {
        clearTimeout(timer);
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      clearTimeout(timer);
      resolve(content);
    });
    req.on('error', (error: unknown) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid JSON request body.');
  }
  return parsed;
}

async function exchangeToken(form: Record<string, string>): Promise<StravaTokenResponse> {
  const response = await fetch(`${STRAVA_AUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.message || payload?.error || `Strava OAuth HTTP ${response.status}`));
  }
  return payload as StravaTokenResponse;
}

function requireTokenPayload(payload: StravaTokenResponse): Required<Pick<StravaTokenResponse, 'access_token' | 'refresh_token' | 'expires_at'>> {
  if (!payload.access_token || !payload.refresh_token || !Number.isFinite(payload.expires_at)) {
    throw new Error('Réponse Strava OAuth incomplète.');
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at as number
  };
}

async function refreshConnection(connection: StravaConnection): Promise<StravaConnection> {
  if (connection.expires_at > Math.floor(Date.now() / 1_000) + 120) return connection;

  const config = getStravaConfig();
  const tokenPayload = await exchangeToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token
  });
  const token = requireTokenPayload(tokenPayload);
  const refreshed = {
    ...connection,
    ...token,
    scope: tokenPayload.scope || connection.scope
  };
  await upsertStravaConnection(refreshed);
  return refreshed;
}

async function fetchStravaJson(pathname: string, accessToken: string): Promise<any> {
  const response = await fetch(`${STRAVA_API_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.message || payload?.error || `Strava API HTTP ${response.status}`));
  }
  return payload;
}

function parseGarminCandidates(raw: unknown): GarminActivityMatchInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_MATCH_CANDIDATES).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const candidate = value as Record<string, any>;
    const activityId = String(candidate.activityId || '').trim();
    const startTimeLocal = String(candidate.startTimeLocal || '').trim();
    const durationMinutes = Number(candidate.durationMinutes || 0);
    if (!activityId || !startTimeLocal || !Number.isFinite(Date.parse(startTimeLocal)) || durationMinutes <= 0) return [];
    return [{
      activityId,
      startTimeLocal,
      durationMinutes,
      distanceKm: Number.isFinite(Number(candidate.distanceKm)) ? Number(candidate.distanceKm) : undefined,
      activityType: String(candidate.activityType || '')
    }];
  });
}

async function fetchStravaActivities(
  accessToken: string,
  candidates: GarminActivityMatchInput[]
): Promise<StravaActivitySummary[]> {
  const timestamps = candidates
    .map(activity => Date.parse(activity.startTimeLocal))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return [];

  const after = Math.floor(Math.min(...timestamps) / 1_000) - 2 * 86_400;
  const before = Math.ceil(Math.max(...timestamps) / 1_000) + 2 * 86_400;
  const activities: StravaActivitySummary[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const query = new URLSearchParams({
      after: String(after),
      before: String(before),
      page: String(page),
      per_page: '200'
    });
    const batch = await fetchStravaJson(`/athlete/activities?${query.toString()}`, accessToken);
    if (!Array.isArray(batch) || batch.length === 0) break;
    activities.push(...batch as StravaActivitySummary[]);
    if (batch.length < 200) break;
  }

  return activities;
}

function readAltitudeStream(payload: any): unknown[] {
  if (Array.isArray(payload)) {
    const stream = payload.find(item => item?.type === 'altitude');
    return Array.isArray(stream?.data) ? stream.data : [];
  }
  return Array.isArray(payload?.altitude?.data) ? payload.altitude.data : [];
}

async function buildElevationPatch(
  match: ReturnType<typeof matchStravaActivities>[number],
  accessToken: string,
  includeAltitudeStream = true
): Promise<StravaElevationPatch | null> {
  const stravaActivity = match.stravaActivity;
  const patch: StravaElevationPatch = {
    activityId: String(match.garminActivity.activityId),
    stravaActivityId: String(stravaActivity.id),
    elevationSource: 'STRAVA_CORRECTED',
    elevationUpdatedAt: new Date().toISOString(),
    matchScore: match.score
  };

  if (typeof stravaActivity.total_elevation_gain === 'number' && Number.isFinite(stravaActivity.total_elevation_gain)) {
    patch.elevationGainM = Math.max(0, Math.round(stravaActivity.total_elevation_gain));
  }

  if (!includeAltitudeStream) {
    return patch.elevationGainM !== undefined || patch.elevationLossM !== undefined ? patch : null;
  }

  try {
    const encodedId = encodeURIComponent(String(stravaActivity.id));
    const streams = await fetchStravaJson(
      `/activities/${encodedId}/streams?keys=altitude&key_by_type=true`,
      accessToken
    );
    patch.elevationLossM = calculateElevationLossM(readAltitudeStream(streams));
  } catch (error) {
    // The corrected D+ summary remains useful even when a stream is not
    // available because of an activity permission or a provider-side issue.
    console.warn(`Could not fetch Strava altitude stream for ${stravaActivity.id}:`, error);
  }

  return patch.elevationGainM !== undefined || patch.elevationLossM !== undefined ? patch : null;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export default async function handler(req: any, res: any) {
  ensureResponseHelpers(res);
  if (!applyApiCors(req, res, 'GET,POST,OPTIONS')) return;
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const query = readQuery(req);
  const action = query.action || (req.method === 'GET' ? 'status' : 'sync');

  // OAuth callback is intentionally unauthenticated: its signed state binds
  // the callback to the user who initiated the flow.
  if (req.method === 'GET' && action === 'callback') {
    const returnOrigin = getServerProductionOrigin();
    try {
      const error = query.error;
      const rawState = query.state;
      const config = getStravaConfig();
      const state = verifyOAuthState(rawState, config.stateSecret);
      if (!state) {
        redirectToApp(res, returnOrigin, 'error', 'État OAuth Strava invalide ou expiré.');
        return;
      }
      if (error || !query.code) {
        redirectToApp(res, state.returnOrigin, 'error', 'Autorisation Strava refusée.');
        return;
      }

      const tokenPayload = await exchangeToken({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: query.code,
        grant_type: 'authorization_code',
        redirect_uri: getStravaRedirectUri()
      });
      const token = requireTokenPayload(tokenPayload);
      const athleteId = String(tokenPayload.athlete?.id || '').trim();
      if (!athleteId) throw new Error('Strava n’a pas retourné l’identifiant de l’athlète.');

      const existing = await getStravaConnection(state.userId);
      const athleteName = [tokenPayload.athlete?.firstname, tokenPayload.athlete?.lastname]
        .filter(Boolean)
        .join(' ')
        .trim();
      await upsertStravaConnection({
        user_id: state.userId,
        strava_athlete_id: athleteId,
        athlete_name: athleteName || existing?.athlete_name || null,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        scope: tokenPayload.scope || existing?.scope || null,
        last_sync_at: existing?.last_sync_at || null
      });
      redirectToApp(res, state.returnOrigin, 'connected');
    } catch (error) {
      console.error('Strava OAuth callback failed:', error);
      redirectToApp(res, returnOrigin, 'error', 'Connexion Strava impossible.');
    }
    return;
  }

  if (req.method === 'GET' && action === 'authorize') {
    const apiUser = await requireAuthenticatedUser(req, res);
    if (!apiUser) return;
    try {
      const config = getStravaConfig();
      const state = signOAuthState({
        userId: apiUser.id,
        returnOrigin: safeReturnOrigin(req),
        issuedAt: Date.now(),
        nonce: randomBytes(16).toString('hex')
      }, config.stateSecret);
      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: getStravaRedirectUri(),
        approval_prompt: 'auto',
        scope: 'read,activity:read_all',
        state
      });
      res.status(200).json({ success: true, authorizationUrl: `${STRAVA_AUTH_URL}/authorize?${params.toString()}` });
    } catch (error) {
      res.status(503).json({ success: false, error: error instanceof Error ? error.message : 'Strava OAuth non configuré.' });
    }
    return;
  }

  const apiUser = await requireAuthenticatedUser(req, res);
  if (!apiUser) return;

  if (req.method === 'GET' && action === 'status') {
    try {
      const connection = await getStravaConnection(apiUser.id);
      res.status(200).json({
        success: true,
        connected: Boolean(connection),
        athleteName: connection?.athlete_name || undefined,
        lastSyncAt: connection?.last_sync_at || undefined,
        scope: connection?.scope || undefined
      });
    } catch (error) {
      res.status(503).json({ success: false, error: error instanceof Error ? error.message : 'Statut Strava indisponible.' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  let body: Record<string, any>;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    res.status(error instanceof Error && error.message === 'Request too large' ? 413 : 400)
      .json({ error: error instanceof Error ? error.message : 'Invalid JSON request body.' });
    return;
  }

  if (action === 'disconnect') {
    try {
      const connection = await getStravaConnection(apiUser.id);
      if (connection?.access_token) {
        try {
          await fetch(`${STRAVA_AUTH_URL}/deauthorize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${connection.access_token}` },
            signal: AbortSignal.timeout(8_000)
          });
        } catch (error) {
          console.warn('Strava token revocation failed; deleting local connection anyway:', error);
        }
      }
      await deleteStravaConnection(apiUser.id);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(503).json({ success: false, error: error instanceof Error ? error.message : 'Dissociation Strava impossible.' });
    }
    return;
  }

  if (action !== 'sync') {
    res.status(400).json({ success: false, error: 'Action Strava inconnue.' });
    return;
  }

  try {
    let connection = await getStravaConnection(apiUser.id);
    if (!connection) {
      res.status(400).json({ success: false, connected: false, error: 'Strava n’est pas connecté.' });
      return;
    }

    const candidates = parseGarminCandidates(body.activities);
    if (candidates.length === 0) {
      res.status(200).json({ success: true, connected: true, matchedCount: 0, enrichedCount: 0, enrichments: [] });
      return;
    }

    connection = await refreshConnection(connection);
    const stravaActivities = await fetchStravaActivities(connection.access_token, candidates);
    const matches = matchStravaActivities(candidates, stravaActivities);
    const patches = (await mapWithConcurrency(
      matches,
      4,
      (match, index) => buildElevationPatch(
        match,
        connection!.access_token,
        index < MAX_STREAM_REQUESTS_PER_SYNC
      )
    ))
      .filter((patch): patch is StravaElevationPatch => patch !== null);

    const lastSyncAt = new Date().toISOString();
    await upsertStravaConnection({ ...connection, last_sync_at: lastSyncAt });
    res.status(200).json({
      success: true,
      connected: true,
      athleteName: connection.athlete_name || undefined,
      matchedCount: matches.length,
      enrichedCount: patches.length,
      unmatchedCount: Math.max(0, candidates.length - matches.length),
      lastSyncAt,
      enrichments: patches
    });
  } catch (error) {
    console.error('Strava elevation sync failed:', error);
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Synchronisation Strava impossible.' });
  }
}
