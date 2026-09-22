export interface RefreshRequest {
  manual?: boolean;
  /** False when Garmin activities were just fetched by the manual full-history flow. */
  refreshGarmin?: boolean;
}

export interface EffectiveRefreshRequest {
  manual: boolean;
  refreshGarmin: boolean;
}

export interface LatestRerunCoordinator {
  run(request?: RefreshRequest): Promise<void>;
  setWorker(worker: (request: EffectiveRefreshRequest) => Promise<void>): void;
  isRunning(): boolean;
}

/**
 * Coalesces concurrent refresh requests into one active run plus, at most, one
 * follow-up run. A manual request is never lost when it arrives during a run.
 */
export function createLatestRerunCoordinator(
  initialWorker: (request: EffectiveRefreshRequest) => Promise<void>,
  options: {
    onRunningChange?: (running: boolean) => void;
    onError?: (error: unknown) => void;
  } = {}
): LatestRerunCoordinator {
  let worker = initialWorker;
  let active: Promise<void> | null = null;
  let queued: EffectiveRefreshRequest | null = null;

  return {
    setWorker(nextWorker) {
      worker = nextWorker;
    },

    isRunning() {
      return active !== null;
    },

    run(request = {}) {
      const incoming = { manual: request.manual === true, refreshGarmin: request.refreshGarmin !== false };
      queued = queued
        ? { manual: queued.manual || incoming.manual, refreshGarmin: queued.refreshGarmin || incoming.refreshGarmin }
        : incoming;
      if (active) return active;

      active = (async () => {
        options.onRunningChange?.(true);
        try {
          while (queued) {
            const current = queued;
            queued = null;
            try {
              await worker(current);
            } catch (error) {
              options.onError?.(error);
            }
          }
        } finally {
          active = null;
          options.onRunningChange?.(false);
        }
      })();

      return active;
    }
  };
}
