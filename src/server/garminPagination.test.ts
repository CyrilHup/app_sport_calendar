import { describe, expect, it, vi } from 'vitest';
import { fetchGarminActivityBatch } from './garminPagination';

describe('fetchGarminActivityBatch', () => {
  it('returns the continuation offset after the bounded server batch', async () => {
    const fetchPage = vi.fn(async (offset: number, limit: number) =>
      Array.from({ length: limit }, (_, index) => offset + index));

    const result = await fetchGarminActivityBatch(fetchPage, 100);

    expect(result.activities).toHaveLength(200);
    expect(result.nextOffset).toBe(300);
    expect(result.truncated).toBe(false);
    expect(fetchPage.mock.calls).toEqual([[100, 100], [200, 100]]);
  });

  it('stops on a short page and never asks past the configured maximum', async () => {
    const short = await fetchGarminActivityBatch(async () => [1, 2], 0);
    const last = await fetchGarminActivityBatch(async (_offset, limit) => Array(limit).fill(1), 4_950);

    expect(short).toEqual({ activities: [1, 2], nextOffset: null, truncated: false });
    expect(last.activities).toHaveLength(50);
    expect(last.nextOffset).toBeNull();
    expect(last.truncated).toBe(true);
  });

  it('propagates page failures instead of silently reporting complete history', async () => {
    await expect(fetchGarminActivityBatch(async () => { throw new Error('timeout'); }, 0))
      .rejects.toThrow('timeout');
  });
});
