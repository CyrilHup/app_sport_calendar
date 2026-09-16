export interface GarminPageResult<T> {
  activities: T[];
  nextOffset: number | null;
  truncated: boolean;
}

export const MAX_FULL_SYNC_ACTIVITIES = 5_000;

/** Bounded serverless page batch; the client continues from nextOffset. */
export async function fetchGarminActivityBatch<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  offset: number,
  pageSize = 100,
  maxPages = 2,
  maxActivities = MAX_FULL_SYNC_ACTIVITIES
): Promise<GarminPageResult<T>> {
  if (!Number.isInteger(offset) || offset < 0 || offset > maxActivities) {
    throw new Error('Invalid Garmin activity offset.');
  }

  const activities: T[] = [];
  let nextOffset: number | null = null;
  let truncated = false;
  let currentOffset = offset;
  for (let pageNumber = 0; pageNumber < maxPages && currentOffset < maxActivities; pageNumber++) {
    const limit = Math.min(pageSize, maxActivities - currentOffset);
    const page = await fetchPage(currentOffset, limit);
    if (!Array.isArray(page) || page.length > limit) throw new Error('Invalid Garmin activity page.');
    activities.push(...page);
    if (page.length < limit) {
      nextOffset = null;
      break;
    }
    currentOffset += page.length;
    if (currentOffset >= maxActivities) truncated = true;
    nextOffset = currentOffset < maxActivities ? currentOffset : null;
  }
  return { activities, nextOffset, truncated };
}
