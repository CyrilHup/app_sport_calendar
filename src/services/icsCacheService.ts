import { STORAGE_KEYS, storageGet, storageSet } from './storageService';

interface CachedIcsFeed {
  source: string;
  content: string;
}

type IcsParser<T> = (content: string) => T[];

const CACHE_VERSION = 'v2';

function isCompleteCalendar(content: string): boolean {
  const lines = content.split(/\r?\n/).map(line => line.trim().toUpperCase());
  return lines.includes('BEGIN:VCALENDAR') && lines.includes('END:VCALENDAR');
}

function hashSource(source: string): string {
  // Keep localStorage keys compact. The source is also stored in the record and
  // checked on read, so a hash collision can never return another feed's data.
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16);
}

function cacheKey(source: string): string {
  return `${STORAGE_KEYS.CACHED_ETS_ICS}:${CACHE_VERSION}:${hashSource(source)}`;
}

function readCachedCalendar(source: string): string {
  const cached = storageGet<CachedIcsFeed | null>(cacheKey(source), null);
  if (
    !cached ||
    cached.source !== source ||
    typeof cached.content !== 'string' ||
    !isCompleteCalendar(cached.content)
  ) {
    return '';
  }
  return cached.content;
}

/**
 * Use a fresh complete VCALENDAR when it parses, including when it has no
 * events. Fall back to cached data only when the response is absent, invalid,
 * or cannot be parsed. Cached records are isolated by their feed source.
 */
export function resolveIcsCourses<T>(
  source: string,
  fetchedContent: string | null,
  parse: IcsParser<T>
): T[] {
  if (fetchedContent !== null && isCompleteCalendar(fetchedContent)) {
    try {
      const courses = parse(fetchedContent);
      storageSet(cacheKey(source), { source, content: fetchedContent } satisfies CachedIcsFeed);
      return courses;
    } catch {
      // Keep the last successfully parsed feed available during parser failures.
    }
  }

  const cachedContent = readCachedCalendar(source);
  if (!cachedContent) return [];

  try {
    return parse(cachedContent);
  } catch {
    return [];
  }
}
