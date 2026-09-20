export interface RemovableListener {
  remove: () => void | Promise<void>;
}

export interface AppStateListenerSource {
  addListener: (
    eventName: 'appStateChange',
    listener: (state: { isActive: boolean }) => void
  ) => Promise<RemovableListener>;
}

interface EventTargetLike {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface AutoRefreshTriggerEnvironment {
  nativeApp: AppStateListenerSource;
  document: EventTargetLike & { visibilityState: string };
  window: EventTargetLike;
  now?: () => number;
  setInterval?: (callback: () => void, delayMs: number) => unknown;
  clearInterval?: (intervalId: unknown) => void;
  throttleMs?: number;
  intervalMs?: number;
}

/**
 * Registers every automatic refresh signal behind one throttled callback.
 * Cleanup also covers the race where Capacitor resolves its listener handle
 * only after the owning component has already unmounted.
 */
export function registerAutoRefreshTriggers(
  triggerSync: () => void,
  environment: AutoRefreshTriggerEnvironment
): () => void {
  const now = environment.now || Date.now;
  const setIntervalFn = environment.setInterval || ((callback: () => void, delayMs: number) =>
    globalThis.setInterval(callback, delayMs));
  const clearIntervalFn = environment.clearInterval || ((intervalId: unknown) =>
    globalThis.clearInterval(intervalId as ReturnType<typeof globalThis.setInterval>));
  const throttleMs = environment.throttleMs ?? 120_000;
  const intervalMs = environment.intervalMs ?? 15 * 60 * 1000;

  let disposed = false;
  let nativeListener: RemovableListener | null = null;
  let lastAutoSyncAt = now();

  const triggerIfDue = () => {
    if (disposed) return;
    const currentTime = now();
    if (currentTime - lastAutoSyncAt < throttleMs) return;
    lastAutoSyncAt = currentTime;
    triggerSync();
  };

  void environment.nativeApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) triggerIfDue();
  }).then(listener => {
    if (disposed) {
      void listener.remove();
      return;
    }
    nativeListener = listener;
  }).catch(() => {});

  const handleVisibilityChange = () => {
    if (environment.document.visibilityState === 'visible') triggerIfDue();
  };
  environment.document.addEventListener('visibilitychange', handleVisibilityChange);
  environment.window.addEventListener('focus', triggerIfDue);

  const intervalId = setIntervalFn(() => {
    if (environment.document.visibilityState === 'visible') triggerIfDue();
  }, intervalMs);

  return () => {
    disposed = true;
    environment.document.removeEventListener('visibilitychange', handleVisibilityChange);
    environment.window.removeEventListener('focus', triggerIfDue);
    clearIntervalFn(intervalId);
    if (nativeListener) void nativeListener.remove();
  };
}
