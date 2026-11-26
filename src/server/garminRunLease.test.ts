import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimGarminRunLease, isRegisteredGarminRun, markRegisteredGarminRunCancelled } from './garminRunLease';

describe('cross-device Garmin run lease', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('claims the date and exact prior ID before allowing creation', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);

    const lease = await claimGarminRunLease(
      { headers: { authorization: 'Bearer athlete-token' } },
      '2026-09-23',
      '123'
    );
    const claimPayload = JSON.parse(request.mock.calls[0][1].body);
    expect(claimPayload).toEqual({
      p_lock_date: '2026-09-23',
      p_replace_workout_id: '123',
      p_replace_workout_date: '2026-09-23',
      p_claim_id: expect.any(String)
    });
    expect(request.mock.calls[0][0]).toContain('/rpc/claim_garmin_run_sync');
    await lease.release();
    expect(JSON.parse(request.mock.calls[1][1].body).p_claim_id).toBe(claimPayload.p_claim_id);
  });

  it('fails closed when another device already holds the claim', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"Garmin run sync already in progress for date"}', { status: 409 })));

    await expect(claimGarminRunLease(
      { headers: { authorization: 'Bearer athlete-token' } }, '2026-09-23', '123'
    )).rejects.toThrow('déjà en cours');
  });

  it('claims the source and target of a move and confirms the complete event signature', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    const request = vi.fn().mockImplementation(async () => new Response('true', { status: 200 }));
    vi.stubGlobal('fetch', request);
    const lease = await claimGarminRunLease(
      { headers: { authorization: 'Bearer athlete-token' } }, '2026-10-01', '123', '2026-09-30'
    );
    expect(request.mock.calls[0][0]).toContain('/rpc/claim_garmin_run_sync_v2');
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
      p_lock_date: '2026-10-01', p_replace_workout_date: '2026-09-30', p_replace_workout_id: '123'
    });
    lease.markCreateStarted();
    await lease.confirm('456', 'sport-2026-09-30', 'version::complete-definition');
    expect(request.mock.calls[1][0]).toContain('/rpc/confirm_garmin_run_sync_v2');
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
      p_lock_date: '2026-10-01', p_replace_workout_date: '2026-09-30',
      p_previous_workout_id: '123', p_new_workout_id: '456',
      p_event_id: 'sport-2026-09-30', p_signature: 'version::complete-definition'
    });
  });

  it('commits the exact new ID before releasing the date to another device', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const lease = await claimGarminRunLease(
      { headers: { authorization: 'Bearer athlete-token' } }, '2026-09-23', '123'
    );

    lease.markCreateStarted();
    await lease.confirm('456');
    await lease.release();

    expect(request.mock.calls[1][0]).toContain('/rpc/confirm_garmin_run_sync');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      p_lock_date: '2026-09-23',
      p_previous_workout_id: '123',
      p_new_workout_id: '456',
      p_replace_workout_date: '2026-09-23',
      p_event_id: 'garmin-date:2026-09-23',
      p_signature: 'pending-server-confirmation',
      p_claim_id: expect.any(String)
    });
    expect(request.mock.calls[2][0]).toContain('/rpc/release_garmin_run_sync');
  });

  it('keeps an uncertain create result locked until expiry', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    const request = vi.fn().mockResolvedValue(new Response('true', { status: 200 }));
    vi.stubGlobal('fetch', request);
    const lease = await claimGarminRunLease(
      { headers: { authorization: 'Bearer athlete-token' } }, '2026-09-23'
    );
    lease.markCreateStarted();
    await lease.release();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not create in production when the claim cannot be authenticated', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(claimGarminRunLease({ headers: {} }, '2026-09-23'))
      .rejects.toThrow('aucune séance créée');
  });

  it('requires the athlete-owned exact registry ID before cancellation', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    const request = vi.fn().mockResolvedValue(new Response('[{"workout_id":"123"}]', { status: 200 }));
    vi.stubGlobal('fetch', request);
    const req = { headers: { authorization: 'Bearer athlete-token' } };

    await expect(isRegisteredGarminRun(req, '2026-09-24', '123')).resolves.toBe(true);
    expect(request.mock.calls[0][0]).toContain('workout_date=eq.2026-09-24');
    expect(request.mock.calls[0][0]).toContain('workout_id=eq.123');
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer athlete-token');
  });

  it('marks only the exact ID cancelled and verifies the tombstone', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'publishable');
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('[{"workout_id":"123","signature":"cancelled-rest"}]', { status: 200 }));
    vi.stubGlobal('fetch', request);

    await markRegisteredGarminRunCancelled(
      { headers: { authorization: 'Bearer athlete-token' } }, '2026-09-24', '123'
    );
    expect(request.mock.calls[0][1].method).toBe('PATCH');
    expect(request.mock.calls[0][0]).toContain('workout_id=eq.123');
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ signature: 'cancelled-rest' });
  });
});
