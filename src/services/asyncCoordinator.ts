export interface LatestRerunCoordinator {
  run(manual?: boolean): Promise<void>;
  setWorker(worker: (manual: boolean) => Promise<void>): void;
  isRunning(): boolean;
}

/**
 * Coalesces concurrent refresh requests into one active run plus, at most, one
 * follow-up run. A manual request is never lost when it arrives during a run.
 */
export function createLatestRerunCoordinator(
  initialWorker: (manual: boolean) => Promise<void>,
  options: {
    onRunningChange?: (running: boolean) => void;
    onError?: (error: unknown) => void;
  } = {}
): LatestRerunCoordinator {
  let worker = initialWorker;
  let active: Promise<void> | null = null;
  let rerunQueued = false;
  let manualQueued = false;

  return {
    setWorker(nextWorker) {
      worker = nextWorker;
    },

    isRunning() {
      return active !== null;
    },

    run(manual = false) {
      manualQueued ||= manual;
      if (active) {
        rerunQueued = true;
        return active;
      }

      active = (async () => {
        options.onRunningChange?.(true);
        try {
          do {
            rerunQueued = false;
            const currentManual = manualQueued;
            manualQueued = false;
            try {
              await worker(currentManual);
            } catch (error) {
              options.onError?.(error);
            }
          } while (rerunQueued);
        } finally {
          active = null;
          options.onRunningChange?.(false);
        }
      })();

      return active;
    }
  };
}
