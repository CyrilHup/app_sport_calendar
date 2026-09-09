import { describe, it, expect, beforeEach } from 'vitest';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
(globalThis as any).localStorage = mockLocalStorage;

import {
  STORAGE_KEYS,
  storageGet,
  storageSet,
  storageGetRaw,
  storageSetRaw,
  storageRemove
} from './storageService';

describe('storageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves JSON objects safely', () => {
    const data = { id: 'test-1', count: 42, active: true };
    const saved = storageSet(STORAGE_KEYS.POSTPONE_OVERRIDES, data);
    expect(saved).toBe(true);

    const retrieved = storageGet(STORAGE_KEYS.POSTPONE_OVERRIDES, {});
    expect(retrieved).toEqual(data);
  });

  it('returns default fallback value when key is absent', () => {
    const fallback = { empty: true };
    const retrieved = storageGet('non_existent_key', fallback);
    expect(retrieved).toBe(fallback);
  });

  it('returns default fallback value when JSON is corrupted', () => {
    localStorage.setItem('corrupted_key', '{ invalid json ...');
    const fallback = { safe: true };
    const retrieved = storageGet('corrupted_key', fallback);
    expect(retrieved).toBe(fallback);
  });

  it('handles raw string storage and retrieval without JSON serialization', () => {
    const rawIcs = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
    storageSetRaw(STORAGE_KEYS.CACHED_ETS_ICS, rawIcs);

    const retrieved = storageGetRaw(STORAGE_KEYS.CACHED_ETS_ICS, '');
    expect(retrieved).toBe(rawIcs);
  });

  it('removes keys properly', () => {
    storageSet(STORAGE_KEYS.GARMIN_STATE, { status: 'idle' });
    expect(storageGet(STORAGE_KEYS.GARMIN_STATE, null)).toEqual({ status: 'idle' });

    storageRemove(STORAGE_KEYS.GARMIN_STATE);
    expect(storageGet(STORAGE_KEYS.GARMIN_STATE, null)).toBeNull();
  });
});
