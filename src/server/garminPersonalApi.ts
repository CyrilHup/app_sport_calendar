import { createHash } from 'node:crypto';

const GARMIN_PERSONAL_API_ORIGIN = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15_000;

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

export interface GarminPersonalApiOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const tokenCache = new Map<string, CachedToken>();
const tokenRequests = new Map<string, Promise<CachedToken>>();

class GarminPersonalApiResponseError extends Error {}

/** Server-side client for Garmin's Personal API. Keep the API key in server secrets. */
export class GarminPersonalApi {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: GarminPersonalApiOptions = {}) {
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('A Garmin Personal API key is required.');
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Garmin Personal API timeout must be a positive number.');
    }

    this.apiKey = apiKey.trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = timeoutMs;
  }

  async getActivities(start: number, limit: number): Promise<unknown> {
    if (!Number.isSafeInteger(start) || start < 0) {
      throw new Error('Garmin activity start must be a non-negative integer.');
    }
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new Error('Garmin activity limit must be a positive integer.');
    }

    const query = new URLSearchParams({ start: String(start), limit: String(limit) });
    return this.get(`/activitylist-service/activities/search/activities?${query}`);
  }

  async getActivity(input: { activityId: string | number }): Promise<unknown> {
    const activityId = String(input?.activityId ?? '');
    if (!/^[1-9]\d{0,19}$/.test(activityId)) {
      throw new Error('A valid Garmin activity ID is required.');
    }
    return this.get(`/activity-service/activity/${activityId}`);
  }

  async getUserSettings(): Promise<unknown> {
    return this.get('/userprofile-service/userprofile/settings');
  }

  /** Make an authenticated JSON GET against a Garmin Personal API relative path. */
  async get(path: string): Promise<unknown> {
    const url = this.resolvePath(path);
    const token = await this.getAccessToken();
    return this.request(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    }, async response => {
      if (response.status >= 300 && response.status < 400) {
        throw new GarminPersonalApiResponseError('Garmin Personal API does not allow redirects.');
      }
      if (!response.ok) {
        throw new GarminPersonalApiResponseError(
          `Garmin Personal API GET failed (HTTP ${response.status}).`
        );
      }

      const responseText = await this.readResponseText(response, 'GET');
      if (responseText.length === 0) return null;
      try {
        return JSON.parse(responseText) as unknown;
      } catch {
        throw new GarminPersonalApiResponseError('Garmin Personal API returned invalid JSON.');
      }
    });
  }

  private resolvePath(path: string): URL {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') ||
      path.includes('\\') || path.includes('#')) {
      throw new Error('Garmin Personal API path must be a relative path on the Garmin origin.');
    }

    const rawPath = path.split('?', 1)[0];
    let hasTraversalSegment: boolean;
    try {
      hasTraversalSegment = rawPath.split('/').some(segment => {
        const decoded = decodeURIComponent(segment);
        return decoded === '.' || decoded === '..';
      });
    } catch {
      throw new Error('Garmin Personal API path is invalid.');
    }
    if (hasTraversalSegment) {
      throw new Error('Garmin Personal API path must stay on the Garmin origin.');
    }

    const url = new URL(path, GARMIN_PERSONAL_API_ORIGIN);
    if (url.origin !== GARMIN_PERSONAL_API_ORIGIN) {
      throw new Error('Garmin Personal API path must stay on the Garmin origin.');
    }
    return url;
  }

  private async getAccessToken(): Promise<string> {
    const keyFingerprint = createHash('sha256')
      .update(`${GARMIN_PERSONAL_API_ORIGIN}\0${this.apiKey}`)
      .digest('hex');
    const cached = tokenCache.get(keyFingerprint);
    if (cached && cached.expiresAtMs - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
      return cached.accessToken;
    }

    const existingRequest = tokenRequests.get(keyFingerprint);
    if (existingRequest) return (await existingRequest).accessToken;

    const request = this.exchangeApiKey();
    tokenRequests.set(keyFingerprint, request);
    try {
      const token = await request;
      tokenCache.set(keyFingerprint, token);
      return token.accessToken;
    } finally {
      if (tokenRequests.get(keyFingerprint) === request) {
        tokenRequests.delete(keyFingerprint);
      }
    }
  }

  private async exchangeApiKey(): Promise<CachedToken> {
    const accessToken = await this.request(new URL(TOKEN_PATH, GARMIN_PERSONAL_API_ORIGIN), {
      method: 'POST',
      headers: {
        Accept: '*/*',
        Authorization: `ApiKey ${this.apiKey}`
      }
    }, async response => {
      if (response.status >= 300 && response.status < 400) {
        throw new GarminPersonalApiResponseError(
          'Garmin Personal API token exchange does not allow redirects.'
        );
      }
      if (!response.ok) {
        throw new GarminPersonalApiResponseError(
          `Garmin Personal API token exchange failed (HTTP ${response.status}).`
        );
      }
      return (await this.readResponseText(response, 'token exchange')).trim();
    });
    const expiresAtMs = readJwtExpiration(accessToken);
    if (!expiresAtMs || expiresAtMs <= Date.now()) {
      throw new Error('Garmin Personal API returned an invalid or expired access token.');
    }
    return { accessToken, expiresAtMs };
  }

  private async request<T>(
    url: URL,
    init: RequestInit,
    parseResponse: (response: Response) => Promise<T>
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        ...init,
        redirect: 'error',
        signal: controller.signal
      });
      return await parseResponse(response);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Garmin Personal API request timed out after ${this.timeoutMs} ms.`);
      }
      if (error instanceof GarminPersonalApiResponseError) throw error;
      throw new Error('Garmin Personal API request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponseText(response: Response, operation: string): Promise<string> {
    try {
      return await response.text();
    } catch {
      throw new Error(`Garmin Personal API ${operation} response could not be read.`);
    }
  }
}

function readJwtExpiration(accessToken: string): number | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
    const binaryPayload = atob(paddedPayload);
    const bytes = Uint8Array.from(binaryPayload, character => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
