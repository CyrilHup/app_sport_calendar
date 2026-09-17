import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncWithGarminAPI } from './garminService';

vi.mock('./supabaseClient', () => ({
  getSupabaseAccessToken: vi.fn().mockResolvedValue('test-access-token')
}));

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(key => delete store[key]); }
};
(globalThis as any).sessionStorage = {
  getItem: (key: string) => store[`session:${key}`] ?? null,
  setItem: (key: string, value: string) => { store[`session:${key}`] = value; },
  removeItem: (key: string) => { delete store[`session:${key}`]; }
};

const activity = (id: string) => ({
  activityId: id,
  activityName: `Run ${id}`,
  activityType: 'RUNNING',
  startTimeLocal: '2026-09-16T08:00:00',
  durationMinutes: 30,
  source: 'GARMIN_CONNECT'
});

describe('full Garmin pagination', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('requests the next offset and merges every page before reporting success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true, activities: [activity('one')], nextOffset: 100, syncMode: 'full'
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true, activities: [activity('two')], nextOffset: null, syncMode: 'full'
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncWithGarminAPI({ email: 'athlete@example.com', password: 'secret' }, { mode: 'full' });

    expect(result.success).toBe(true);
    expect(result.activities.map(item => item.activityId).sort()).toEqual(['one', 'two']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).offset).toBe(0);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).offset).toBe(100);
  });

  it('does not claim a full sync when the server reports a history cap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      activities: [activity('one')],
      nextOffset: null,
      historyTruncated: true
    }), { status: 200 })));

    const result = await syncWithGarminAPI({ email: 'athlete@example.com', password: 'secret' }, { mode: 'full' });

    expect(result.success).toBe(false);
    expect(result.count).toBe(1);
    expect(result.error).toContain('5 000');
  });

  it('keeps valid activities but reports incomplete normalization', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      activities: [activity('one')],
      skippedActivityCount: 1,
      nextOffset: null
    }), { status: 200 })));

    const result = await syncWithGarminAPI({ email: 'athlete@example.com', password: 'secret' });

    expect(result.success).toBe(false);
    expect(result.activities.map(item => item.activityId)).toEqual(['one']);
    expect(result.error).toContain('sans identifiant ou date fiable');
  });

  it('returns previously saved pages when a later request fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true, activities: [activity('one')], nextOffset: 100
      }), { status: 200 }))
      .mockRejectedValueOnce(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncWithGarminAPI({ email: 'athlete@example.com', password: 'secret' }, { mode: 'full' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('network unavailable');
    expect(result.activities.map(item => item.activityId)).toEqual(['one']);
    expect(result.count).toBe(1);
  });
});
