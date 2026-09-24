import { describe, expect, it, vi } from 'vitest';
import { recoverFromVitePreloadError } from './moduleLoadRecovery';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('Vite lazy-module load recovery', () => {
  it('prevents the failed import and reloads once for the current entrypoint', () => {
    const storage = createStorage();
    const reload = vi.fn();
    const event = new Event('vite:preloadError', { cancelable: true });

    expect(recoverFromVitePreloadError(event, '/assets/index-old.js', storage, reload)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload repeatedly when the same entrypoint is still stale', () => {
    const storage = createStorage();
    const reload = vi.fn();

    recoverFromVitePreloadError(
      new Event('vite:preloadError', { cancelable: true }),
      '/assets/index-old.js',
      storage,
      reload,
    );
    const secondEvent = new Event('vite:preloadError', { cancelable: true });

    expect(recoverFromVitePreloadError(secondEvent, '/assets/index-old.js', storage, reload)).toBe(false);
    expect(secondEvent.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('allows recovery again after the entry bundle changes', () => {
    const storage = createStorage();
    const reload = vi.fn();

    recoverFromVitePreloadError(
      new Event('vite:preloadError', { cancelable: true }),
      '/assets/index-old.js',
      storage,
      reload,
    );

    expect(recoverFromVitePreloadError(
      new Event('vite:preloadError', { cancelable: true }),
      '/assets/index-new.js',
      storage,
      reload,
    )).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when session storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: vi.fn(),
    };
    const reload = vi.fn();
    const event = new Event('vite:preloadError', { cancelable: true });

    expect(recoverFromVitePreloadError(event, '/assets/index-old.js', storage, reload)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
