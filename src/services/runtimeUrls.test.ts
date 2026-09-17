import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCTION_ORIGIN, resolveProductionOrigin } from './runtimeUrls';

describe('production origin', () => {
  it('uses the single existing production origin by default', () => {
    expect(resolveProductionOrigin()).toBe(DEFAULT_PRODUCTION_ORIGIN);
  });

  it('normalizes an explicitly configured HTTPS deployment', () => {
    expect(resolveProductionOrigin('https://example.com/path/')).toBe('https://example.com');
  });

  it('does not accept an insecure or malformed production URL', () => {
    expect(resolveProductionOrigin('http://example.com')).toBe(DEFAULT_PRODUCTION_ORIGIN);
    expect(resolveProductionOrigin('not-a-url')).toBe(DEFAULT_PRODUCTION_ORIGIN);
  });
});
