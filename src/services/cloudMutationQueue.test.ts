import { describe, expect, it, vi } from 'vitest';
import { createCloudMutationQueue } from './cloudMutationQueue';

describe('cloud mutation queue', () => {
  it('serializes writes and continues after a reported failure', async () => {
    const events: string[] = [];
    const onResult = vi.fn();
    const queue = createCloudMutationQueue(onResult);
    let finishFirst!: (value: boolean) => void;

    const first = queue.enqueue('manualPairs', () => new Promise<boolean>(resolve => {
      events.push('first-start');
      finishFirst = resolve;
    }));
    const second = queue.enqueue('postponeOverrides', async () => {
      events.push('second-start');
      return true;
    });
    await Promise.resolve();
    expect(events).toEqual(['first-start']);
    finishFirst(false);

    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(events).toEqual(['first-start', 'second-start']);
    expect(onResult).toHaveBeenCalledWith('manualPairs', false);
    expect(onResult).toHaveBeenCalledWith('postponeOverrides', true);
  });

  it('converts thrown failures to false without poisoning later writes', async () => {
    const onResult = vi.fn();
    const queue = createCloudMutationQueue(onResult);
    expect(await queue.enqueue('activities', async () => { throw new Error('offline'); })).toBe(false);
    expect(await queue.enqueue('activities', async () => true)).toBe(true);
    expect(onResult).toHaveBeenCalledWith('activities', false, expect.any(Error));
  });
});
