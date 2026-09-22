import { beforeEach, describe, expect, it } from 'vitest';
import { ensureLocalAccountOwner } from './localAccountScope';
import { STORAGE_KEYS, storageGetRaw, storageSetRaw } from './storageService';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  }
});

describe('local account ownership', () => {
  beforeEach(() => values.clear());

  it('discards unowned legacy data instead of uploading it to the first account', () => {
    storageSetRaw(STORAGE_KEYS.GARMIN_ACTIVITIES, 'legacy');
    expect(ensureLocalAccountOwner('account-a')).toBe(true);
    expect(storageGetRaw(STORAGE_KEYS.GARMIN_ACTIVITIES)).toBe('');
    expect(storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER)).toBe('account-a');
  });

  it('preserves the same account and isolates a subsequent account', () => {
    ensureLocalAccountOwner('account-a');
    storageSetRaw(STORAGE_KEYS.GARMIN_ACTIVITIES, 'a-activities');
    storageSetRaw(STORAGE_KEYS.ADAPTIVE_OVERRIDES, 'a-plan');
    storageSetRaw(STORAGE_KEYS.SYNC_METADATA, 'a-timestamps');
    expect(ensureLocalAccountOwner('account-a')).toBe(false);
    expect(storageGetRaw(STORAGE_KEYS.GARMIN_ACTIVITIES)).toBe('a-activities');
    expect(ensureLocalAccountOwner('account-b')).toBe(true);
    expect(storageGetRaw(STORAGE_KEYS.GARMIN_ACTIVITIES)).toBe('');
    expect(storageGetRaw(STORAGE_KEYS.ADAPTIVE_OVERRIDES)).toBe('');
    expect(storageGetRaw(STORAGE_KEYS.SYNC_METADATA)).toBe('');
  });
});
