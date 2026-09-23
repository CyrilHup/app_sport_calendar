import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '../types/calendar';
import { pushWorkoutToGarmin } from './garminService';

vi.mock('./supabaseClient', () => ({
  getSupabaseAccessToken: vi.fn().mockResolvedValue('test-access-token')
}));

describe('Garmin workout push error contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserves the structured reauthentication code from the API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      code: 'GARMIN_AUTH_REQUIRED',
      error: 'Veuillez renseigner votre email et mot de passe Garmin Connect.'
    }), { status: 400 })));
    const event: CalendarEvent = {
      id: 'run-2026-09-23',
      category: 'sport',
      sportType: 'RUN_EASY',
      title: 'Footing facile',
      startDate: '2026-09-23T12:00:00.000Z',
      endDate: '2026-09-23T13:00:00.000Z',
      durationMinutes: 60,
      description: 'Footing',
      location: 'Parc',
      emoji: '🏃',
      colorId: '1',
      colorHex: '#000000'
    };

    const result = await pushWorkoutToGarmin(event);

    expect(result).toMatchObject({ success: false, errorCode: 'GARMIN_AUTH_REQUIRED' });
  });
});
