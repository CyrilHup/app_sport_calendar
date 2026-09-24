type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Recover once when Vite cannot load a lazy chunk, which commonly happens when
 * an open tab still runs an entry bundle from before the latest deployment.
 */
export function recoverFromVitePreloadError(
  event: Event,
  entrypoint: string,
  storage: RecoveryStorage,
  reload: () => void,
): boolean {
  const recoveryKey = `vite:preload-error-reloaded:${entrypoint}`;

  try {
    if (storage.getItem(recoveryKey) === '1') return false;
    storage.setItem(recoveryKey, '1');
  } catch {
    // If session storage is disabled or unavailable, don't risk a reload loop.
    return false;
  }

  event.preventDefault();
  reload();
  return true;
}
