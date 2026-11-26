import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarminPersonalApi } from './garminPersonalApi';

function makeJwt(expirationSeconds = Math.floor(Date.now() / 1000) + 3_600): string {
  const payload = btoa(JSON.stringify({ exp: expirationSeconds }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `eyJhbGciOiJub25lIn0.${payload}.signature`;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function tokenResponse(token = makeJwt()): Response {
  return new Response(token, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

describe('GarminPersonalApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exchanges the API key and requests the documented Personal API endpoints', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const accessToken = makeJwt();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const request = init ?? {};
      calls.push({ url, init: request });
      if (url.endsWith('/personal-api-key/token')) return tokenResponse(accessToken);
      return jsonResponse({ requested: new URL(url).pathname });
    }) as typeof fetch;
    const api = new GarminPersonalApi('personal-key', { fetchImpl });

    await expect(api.getActivities(40, 25)).resolves.toEqual({
      requested: '/activitylist-service/activities/search/activities'
    });
    await expect(api.getActivity({ activityId: '123456' })).resolves.toEqual({
      requested: '/activity-service/activity/123456'
    });
    await expect(api.getUserSettings()).resolves.toEqual({
      requested: '/userprofile-service/userprofile/settings'
    });

    expect(calls).toHaveLength(4);
    expect(calls[0].url).toBe(
      'https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token'
    );
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBeUndefined();
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('ApiKey personal-key');
    expect(calls[0].init.redirect).toBe('error');

    const activitiesUrl = new URL(calls[1].url);
    expect(activitiesUrl.pathname).toBe('/activitylist-service/activities/search/activities');
    expect(activitiesUrl.searchParams.get('start')).toBe('40');
    expect(activitiesUrl.searchParams.get('limit')).toBe('25');
    expect(calls.slice(1).every(call => call.init.method === 'GET')).toBe(true);
    expect(calls.slice(1).every(call => call.init.redirect === 'error')).toBe(true);
    expect(calls.slice(1).every(call =>
      new Headers(call.init.headers).get('Accept') === 'application/json'
    )).toBe(true);
    expect(calls.slice(1).every(call =>
      new Headers(call.init.headers).get('Authorization') === `Bearer ${accessToken}`
    )).toBe(true);
  });

  it('reuses an in-flight token exchange for clients using the same key', async () => {
    let resolveTokenResponse: ((response: Response) => void) | undefined;
    const tokenExchange = new Promise<Response>(resolve => {
      resolveTokenResponse = resolve;
    });
    const firstFetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/personal-api-key/token')) return tokenExchange;
      return jsonResponse({ client: 'first' });
    });
    const secondFetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ client: 'second' })
    );
    const firstFetch = firstFetchMock as typeof fetch;
    const secondFetch = secondFetchMock as typeof fetch;
    const firstClient = new GarminPersonalApi('shared-key', { fetchImpl: firstFetch });
    const secondClient = new GarminPersonalApi('shared-key', { fetchImpl: secondFetch });

    const firstRequest = firstClient.get('/example/first');
    const secondRequest = secondClient.get('/example/second');
    resolveTokenResponse?.(tokenResponse());

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { client: 'first' },
      { client: 'second' }
    ]);
    expect(firstFetchMock).toHaveBeenCalledTimes(2);
    expect(secondFetchMock).toHaveBeenCalledTimes(1);
    expect(firstFetchMock.mock.calls[0][1]?.method).toBe('POST');
    expect(secondFetchMock.mock.calls[0][1]?.method).toBe('GET');
  });

  it('rejects paths that can change the Garmin origin before making a request', async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    const api = new GarminPersonalApi('invalid-path-key', { fetchImpl });

    await expect(api.get('https://example.com/private')).rejects.toThrow(/relative path/);
    await expect(api.get('//example.com/private')).rejects.toThrow(/relative path/);
    await expect(api.get('/example/../private')).rejects.toThrow(/origin/);
    await expect(api.get('/example\\private')).rejects.toThrow(/relative path/);
    await expect(api.get('/example#fragment')).rejects.toThrow(/relative path/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('validates activity pagination and activity IDs', async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    const api = new GarminPersonalApi('invalid-input-key', { fetchImpl });

    await expect(api.getActivities(-1, 20)).rejects.toThrow(/start/);
    await expect(api.getActivities(0, 0)).rejects.toThrow(/limit/);
    await expect(api.getActivity({ activityId: '../other' })).rejects.toThrow(/activity ID/);
    await expect(api.getActivity({ activityId: 0 })).rejects.toThrow(/activity ID/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not expose credentials or response bodies in HTTP errors', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/personal-api-key/token')) return tokenResponse();
      return new Response('private-key private-token response-body', { status: 401 });
    }) as typeof fetch;
    const api = new GarminPersonalApi('private-key', { fetchImpl });

    await expect(api.get('/example')).rejects.toThrow('HTTP 401');
    await expect(api.get('/example')).rejects.not.toThrow(/private-key|private-token|response-body/);
  });

  it('fails cleanly when a request exceeds the configured timeout', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
    ) as typeof fetch;
    const api = new GarminPersonalApi('timeout-key', { fetchImpl, timeoutMs: 5 });

    await expect(api.get('/example')).rejects.toThrow(/timed out after 5 ms/);
  });

  it('rejects token responses without a valid JWT expiry', async () => {
    const fetchImpl = vi.fn(async () => tokenResponse('not-a-jwt')) as typeof fetch;
    const api = new GarminPersonalApi('invalid-token-key', { fetchImpl });

    await expect(api.get('/example')).rejects.toThrow(/invalid or expired access token/);
  });
});
