import { describe, expect, it, vi } from 'vitest';
import { createLatestRerunCoordinator } from './asyncCoordinator';
import type { EffectiveRefreshRequest } from './asyncCoordinator';
import type { GarminActivitySyncResult } from './garminService';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('createLatestRerunCoordinator', () => {
  it('coalesces concurrent requests into one latest rerun', async () => {
    const first = deferred();
    const calls: Array<{ manual: boolean; refreshGarmin: boolean }> = [];
    const worker = vi.fn(async request => {
      calls.push({ manual: request.manual, refreshGarmin: request.refreshGarmin });
      if (calls.length === 1) await first.promise;
    });
    const coordinator = createLatestRerunCoordinator(worker);

    const active = coordinator.run();
    const concurrent = coordinator.run();
    coordinator.run();

    expect(concurrent).toBe(active);
    expect(worker).toHaveBeenCalledTimes(1);
    first.resolve();
    await active;

    expect(worker).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      { manual: false, refreshGarmin: true },
      { manual: false, refreshGarmin: true }
    ]);
  });

  it('preserves a manual request queued during an automatic refresh', async () => {
    const first = deferred();
    const calls: Array<{ manual: boolean; refreshGarmin: boolean }> = [];
    const coordinator = createLatestRerunCoordinator(async request => {
      calls.push({ manual: request.manual, refreshGarmin: request.refreshGarmin });
      if (calls.length === 1) await first.promise;
    });

    const active = coordinator.run();
    coordinator.run({ manual: true, refreshGarmin: false });
    first.resolve();
    await active;

    expect(calls).toEqual([
      { manual: false, refreshGarmin: true },
      { manual: true, refreshGarmin: false }
    ]);
  });

  it('keeps a Garmin fetch when any concurrent request requires fresh data', async () => {
    const first = deferred();
    const calls: Array<{ manual: boolean; refreshGarmin: boolean }> = [];
    const coordinator = createLatestRerunCoordinator(async request => {
      calls.push({ manual: request.manual, refreshGarmin: request.refreshGarmin });
      if (calls.length === 1) await first.promise;
    });

    const active = coordinator.run({ refreshGarmin: false });
    coordinator.run({ manual: true, refreshGarmin: false });
    coordinator.run();
    first.resolve();
    await active;

    expect(calls).toEqual([
      { manual: false, refreshGarmin: false },
      { manual: true, refreshGarmin: true }
    ]);
  });

  it('routes a queued full-history sync through the coordinator and resolves every caller', async () => {
    const first = deferred();
    const calls: EffectiveRefreshRequest[] = [];
    const result = { success: true, activities: [], count: 0, syncMode: 'full' as const };
    const coordinator = createLatestRerunCoordinator(async request => {
      calls.push(request);
      if (calls.length === 1) await first.promise;
      return result;
    });

    const active = coordinator.run({ refreshGarmin: false });
    const fullSyncComplete = vi.fn();
    const incrementalComplete = vi.fn();
    coordinator.run({
      garminSyncMode: 'full',
      garminCredentials: { email: 'athlete@example.com', password: 'session-only' },
      garminAccountId: 'user-1',
      onGarminSyncComplete: fullSyncComplete
    });
    coordinator.run({ garminSyncMode: 'incremental', garminAccountId: 'user-1', onGarminSyncComplete: incrementalComplete });

    first.resolve();
    await active;

    expect(calls).toHaveLength(2);
    expect(calls[1].refreshGarmin).toBe(true);
    expect(calls[1].garminSyncMode).toBe('full');
    expect(calls[1].garminCredentials).toEqual({ email: 'athlete@example.com', password: 'session-only' });
    expect(calls[1].garminSyncCallbacks).toHaveLength(2);
    expect(fullSyncComplete).toHaveBeenCalledWith(result);
    expect(incrementalComplete).toHaveBeenCalledWith(result);
  });

  it('does not return one account’s sync result to another account’s queued caller', async () => {
    const first = deferred();
    const callbacks: Array<GarminActivitySyncResult | null> = [];
    const coordinator = createLatestRerunCoordinator(async request => {
      if (request.garminSyncMode === undefined) await first.promise;
      return { success: true, activities: [], count: 0 };
    });

    const active = coordinator.run({ refreshGarmin: false });
    coordinator.run({
      garminSyncMode: 'full',
      garminAccountId: 'user-1',
      onGarminSyncComplete: result => callbacks.push(result)
    });
    coordinator.run({
      garminSyncMode: 'incremental',
      garminCredentials: { email: 'other@example.com', password: 'other-session-only' },
      garminAccountId: 'user-2',
      onGarminSyncComplete: result => callbacks.push(result)
    });

    first.resolve();
    await active;

    expect(callbacks).toEqual([null, { success: true, activities: [], count: 0 }]);
  });

  it('releases the lock after errors and reports running state', async () => {
    const states: boolean[] = [];
    const errors: unknown[] = [];
    const worker = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const coordinator = createLatestRerunCoordinator(worker, {
      onRunningChange: state => states.push(state),
      onError: error => errors.push(error)
    });

    await coordinator.run();
    await coordinator.run();

    expect(worker).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(1);
    expect(states).toEqual([true, false, true, false]);
    expect(coordinator.isRunning()).toBe(false);
  });
});
