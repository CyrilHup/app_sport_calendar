import type {
  GarminActivitySyncMode,
  GarminActivitySyncResult,
  GarminCredentials
} from './garminService';

export interface RefreshRequest {
  manual?: boolean;
  /** False when only the calendar should be rebuilt, without fetching Garmin activities. */
  refreshGarmin?: boolean;
  garminSyncMode?: GarminActivitySyncMode;
  garminCredentials?: GarminCredentials;
  garminAccountId?: string | null;
  onGarminSyncComplete?: (result: GarminActivitySyncResult | null) => void;
}

interface GarminSyncCompletion {
  accountId?: string | null;
  resolve: (result: GarminActivitySyncResult | null) => void;
}

export interface EffectiveRefreshRequest {
  manual: boolean;
  refreshGarmin: boolean;
  garminSyncMode?: GarminActivitySyncMode;
  garminCredentials?: GarminCredentials;
  garminAccountId?: string | null;
  garminSyncCallbacks: GarminSyncCompletion[];
}

export interface LatestRerunCoordinator {
  run(request?: RefreshRequest): Promise<void>;
  setWorker(worker: (request: EffectiveRefreshRequest) => Promise<GarminActivitySyncResult | null | void>): void;
  isRunning(): boolean;
}

/**
 * Coalesces concurrent refresh requests into one active run plus, at most, one
 * follow-up run. A manual request is never lost when it arrives during a run.
 */
export function createLatestRerunCoordinator(
  initialWorker: (request: EffectiveRefreshRequest) => Promise<GarminActivitySyncResult | null | void>,
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
      const incoming: EffectiveRefreshRequest = {
        manual: request.manual === true,
        refreshGarmin: request.garminSyncMode !== undefined || request.refreshGarmin !== false,
        garminSyncMode: request.garminSyncMode,
        garminCredentials: request.garminCredentials,
        garminAccountId: request.garminSyncMode !== undefined ? request.garminAccountId : undefined,
        garminSyncCallbacks: request.onGarminSyncComplete
          ? [{ accountId: request.garminAccountId, resolve: request.onGarminSyncComplete }]
          : []
      };
      if (queued) {
        const incomingHasSync = incoming.garminSyncMode !== undefined;
        const sameSyncAccount = queued.garminAccountId === incoming.garminAccountId;
        const replaceSyncContext = incomingHasSync && queued.garminSyncMode !== undefined && !sameSyncAccount;
        const queuedMode = replaceSyncContext ? undefined : queued.garminSyncMode;
        const incomingMode = incoming.garminSyncMode;
        queued = {
          manual: queued.manual || incoming.manual,
          refreshGarmin: queued.refreshGarmin || incoming.refreshGarmin,
          garminSyncMode: queuedMode === 'full' || incomingMode === 'full'
            ? 'full'
            : (incomingMode ?? queuedMode),
          garminCredentials: replaceSyncContext
            ? incoming.garminCredentials
            : (incoming.garminCredentials ?? queued.garminCredentials),
          garminAccountId: incomingHasSync
            ? (replaceSyncContext ? incoming.garminAccountId : (queued.garminAccountId ?? incoming.garminAccountId))
            : queued.garminAccountId,
          garminSyncCallbacks: [...queued.garminSyncCallbacks, ...incoming.garminSyncCallbacks]
        };
      } else {
        queued = incoming;
      }
      if (active) return active;

      active = (async () => {
        options.onRunningChange?.(true);
        try {
          while (queued) {
            const current = queued;
            queued = null;
            let syncResult: GarminActivitySyncResult | null = null;
            try {
              syncResult = await worker(current) ?? null;
            } catch (error) {
              options.onError?.(error);
            }
            for (const callback of current.garminSyncCallbacks) {
              try {
                callback.resolve(callback.accountId === current.garminAccountId ? syncResult : null);
              }
              catch (error) { options.onError?.(error); }
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
