import { describe, expect, it } from 'vitest';
import { parseICSString } from './icsParser';

describe('parseICSString', () => {
  it('interprets a TZID date consistently regardless of browser/server timezone', () => {
    const events = parseICSString(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:class-1
SUMMARY:Course
DTSTART;TZID=America/Toronto:20260916T090000
DTEND;TZID=America/Toronto:20260916T100000
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0].startDate.toISOString()).toBe('2026-09-16T13:00:00.000Z');
    expect(events[0].endDate.toISOString()).toBe('2026-09-16T14:00:00.000Z');
  });

  it('keeps UTC timestamps and rejects invalid event dates', () => {
    const events = parseICSString(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Valid
DTSTART:20260116T090000Z
DTEND:20260116T100000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Invalid
DTSTART:garbage
DTEND:20260116T100000Z
END:VEVENT
END:VCALENDAR`);

    expect(events).toHaveLength(1);
    expect(events[0].startDate.toISOString()).toBe('2026-01-16T09:00:00.000Z');
    expect(events[0].uid).toContain('Valid');
  });
});
