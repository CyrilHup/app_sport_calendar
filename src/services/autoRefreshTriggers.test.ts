import { describe, expect, it, vi } from 'vitest';
import {
  AppStateListenerSource,
  registerAutoRefreshTriggers,
  RemovableListener
} from './autoRefreshTriggers';

function eventTarget() {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    })
  };
}

describe('registerAutoRefreshTriggers', () => {
  it('removes a Capacitor listener that resolves after cleanup', async () => {
    let resolveListener!: (listener: RemovableListener) => void;
    const pendingListener = new Promise<RemovableListener>(resolve => { resolveListener = resolve; });
    const nativeApp: AppStateListenerSource = {
      addListener: vi.fn(() => pendingListener)
    };
    const documentTarget = Object.assign(eventTarget(), { visibilityState: 'visible' });
    const windowTarget = eventTarget();
    const clearInterval = vi.fn();
    const cleanup = registerAutoRefreshTriggers(vi.fn(), {
      nativeApp,
      document: documentTarget,
      window: windowTarget,
      setInterval: vi.fn(() => 42),
      clearInterval
    });

    cleanup();
    const remove = vi.fn();
    resolveListener({ remove });
    await pendingListener;
    await Promise.resolve();

    expect(remove).toHaveBeenCalledOnce();
    expect(documentTarget.removeEventListener).toHaveBeenCalledOnce();
    expect(windowTarget.removeEventListener).toHaveBeenCalledOnce();
    expect(clearInterval).toHaveBeenCalledOnce();
  });

  it('does not run the periodic refresh while the document is hidden', () => {
    const nativeApp: AppStateListenerSource = {
      addListener: vi.fn(async () => ({ remove: vi.fn() }))
    };
    const documentTarget = Object.assign(eventTarget(), { visibilityState: 'hidden' });
    const windowTarget = eventTarget();
    const triggerSync = vi.fn();
    let intervalCallback: (() => void) | undefined;

    const cleanup = registerAutoRefreshTriggers(triggerSync, {
      nativeApp,
      document: documentTarget,
      window: windowTarget,
      now: () => 1_000_000,
      throttleMs: 0,
      setInterval: vi.fn(callback => {
        intervalCallback = callback;
        return 42;
      }),
      clearInterval: vi.fn()
    });

    intervalCallback?.();
    expect(triggerSync).not.toHaveBeenCalled();

    documentTarget.visibilityState = 'visible';
    intervalCallback?.();
    expect(triggerSync).toHaveBeenCalledOnce();
    cleanup();
  });
});
