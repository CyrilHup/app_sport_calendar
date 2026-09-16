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
    const calls: boolean[] = [];
    const worker = vi.fn(async (manual: boolean) => {
      calls.push(manual);
      if (calls.length === 1) await first.promise;
    });
    const coordinator = createLatestRerunCoordinator(worker);

    const active = coordinator.run(false);
    const concurrent = coordinator.run(false);
    coordinator.run(false);

    expect(concurrent).toBe(active);
    expect(worker).toHaveBeenCalledTimes(1);
    first.resolve();
    await active;

    expect(worker).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([false, false]);
  });

  it('preserves a manual request queued during an automatic refresh', async () => {
    const first = deferred();
    const calls: boolean[] = [];
    const coordinator = createLatestRerunCoordinator(async manual => {
      calls.push(manual);
      if (calls.length === 1) await first.promise;
    });

    const active = coordinator.run(false);
    coordinator.run(true);
    first.resolve();
    await active;

    expect(calls).toEqual([false, true]);
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
