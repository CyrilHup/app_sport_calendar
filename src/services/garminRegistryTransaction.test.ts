import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, from }) }));

describe('Garmin registry transaction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    { data: null, error: { message: 'conflicting exact IDs' } },
    { data: false, error: null }
  ])('preserves both rows when the atomic exchange is rejected: %j', async response => {
    rpc.mockResolvedValue(response);
    const { exchangeGarminRunRegistryEntries } = await import('./supabaseClient');
    const result = await exchangeGarminRunRegistryEntries('athlete', {
      eventId: 'a', workoutDate: '2026-09-29', workoutId: '123', signature: 'a-version'
    }, {
      eventId: 'b', workoutDate: '2026-09-30', workoutId: '456', signature: 'b-version'
    });
    expect(result).toBe(false);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });
});
