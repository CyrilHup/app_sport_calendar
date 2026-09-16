import { STORAGE_KEYS, storageGet, storageSet } from './storageService';

export type SyncDomain = 'manualPairs' | 'adaptiveOverrides' | 'postponeOverrides';
type SyncMetadata = Partial<Record<SyncDomain, string>>;

function loadMetadata(): SyncMetadata {
  return storageGet<SyncMetadata>(STORAGE_KEYS.SYNC_METADATA, {});
}

export function getLocalSyncTimestamp(domain: SyncDomain): string | null {
  return loadMetadata()[domain] || null;
}

export function setLocalSyncTimestamp(domain: SyncDomain, timestamp: string): void {
  storageSet(STORAGE_KEYS.SYNC_METADATA, { ...loadMetadata(), [domain]: timestamp });
}

export function markLocalSyncUpdated(domain: SyncDomain): string {
  const timestamp = new Date().toISOString();
  setLocalSyncTimestamp(domain, timestamp);
  return timestamp;
}

export function shouldAdoptCloudValue(
  cloudUpdatedAt: string | null | undefined,
  localUpdatedAt: string | null | undefined
): boolean {
  if (!cloudUpdatedAt) return !localUpdatedAt;
  if (!localUpdatedAt) return true;
  return new Date(cloudUpdatedAt).getTime() >= new Date(localUpdatedAt).getTime();
}
