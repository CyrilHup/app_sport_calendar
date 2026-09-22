import { describe, expect, it, vi } from 'vitest';
import { createLatestRerunCoordinator } from './asyncCoordinator';

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
      calls.push(request);
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
      calls.push(request);
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
      calls.push(request);
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
