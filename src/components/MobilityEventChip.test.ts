import { describe, expect, it } from 'vitest';
import { CalendarEvent } from '../types/calendar';
import { formatTime } from '../services/dateUtils';
import { getMobilityEventLabel } from './MobilityEventChip';

describe('mobility event label', () => {
  it('uses the event title, time and duration instead of fixed display values', () => {
    const event = {
      title: 'Séance mobilité ajustée',
      startDate: '2026-09-22T19:30:00',
      durationMinutes: 35
    } as CalendarEvent;

    expect(getMobilityEventLabel(event)).toBe(`Séance mobilité ajustée ${formatTime(event.startDate)} (35m)`);
  });
});
