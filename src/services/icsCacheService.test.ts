import { beforeEach, describe, expect, it } from 'vitest';
import { parseICSString } from './icsParser';
import { resolveIcsCourses } from './icsCacheService';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(key => delete store[key]); }
};
(globalThis as any).localStorage = mockLocalStorage;

const populatedFeed = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:course-1
SUMMARY:MTR801
DTSTART:20260916T090000Z
DTEND:20260916T100000Z
END:VEVENT
END:VCALENDAR`;

const emptyFeed = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

describe('resolveIcsCourses', () => {
  beforeEach(() => localStorage.clear());

  it('accepts a valid empty feed and replaces older cached events with it', () => {
    expect(resolveIcsCourses('default:ets', populatedFeed, parseICSString)).toHaveLength(1);

    expect(resolveIcsCourses('default:ets', emptyFeed, parseICSString)).toEqual([]);
    expect(resolveIcsCourses('default:ets', null, parseICSString)).toEqual([]);
  });

  it('does not reuse a cached feed after the profile URL changes', () => {
    expect(resolveIcsCourses('custom:https://calendar.example/a.ics', populatedFeed, parseICSString)).toHaveLength(1);

    expect(resolveIcsCourses('custom:https://calendar.example/b.ics', null, parseICSString)).toEqual([]);
  });

  it('uses the same source cache when fetching or parsing the fresh feed fails', () => {
    resolveIcsCourses('custom:https://calendar.example/a.ics', populatedFeed, parseICSString);

    expect(resolveIcsCourses('custom:https://calendar.example/a.ics', null, parseICSString)).toHaveLength(1);
    expect(resolveIcsCourses('custom:https://calendar.example/a.ics', emptyFeed, content => {
      if (content === emptyFeed) throw new Error('parser failed');
      return parseICSString(content);
    })).toHaveLength(1);
  });

  it('falls back when the response is not a complete VCALENDAR', () => {
    resolveIcsCourses('default:ets', populatedFeed, parseICSString);

    expect(resolveIcsCourses('default:ets', 'BEGIN:VCALENDAR\n', parseICSString)).toHaveLength(1);
  });
});
