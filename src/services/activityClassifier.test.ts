import { describe, it, expect } from 'vitest';
import { classifyGarminActivityType, inferOtherProfileCategory } from './activityClassifier';
import { getPeriodizationContext } from './periodizationEngine';
import { parseICSString } from './icsParser';
import { generateICSContent } from './googleCalendarService';
import { CalendarEvent } from '../types/calendar';

describe('Activity Classifier', () => {
  it('correctly classifies running keywords', () => {
    expect(classifyGarminActivityType('running', 'Course du matin')).toBe('RUNNING');
    expect(classifyGarminActivityType(undefined, 'Footing facile')).toBe('RUNNING');
  });

  it('correctly classifies trail running', () => {
    expect(classifyGarminActivityType('trail_running', 'Mont-Royal')).toBe('TRAIL_RUNNING');
  });

  it('correctly classifies climbing and bouldering', () => {
    expect(classifyGarminActivityType('bouldering', 'Bloc shop')).toBe('CLIMBING');
    expect(classifyGarminActivityType('other', 'Escalade intérieure')).toBe('CLIMBING');
  });

  it('correctly classifies strength and calisthenics', () => {
    expect(classifyGarminActivityType('strength_training', 'Muscu')).toBe('STRENGTH_TRAINING');
    expect(classifyGarminActivityType(undefined, 'Calisthénie Gym ÉTS')).toBe('STRENGTH_TRAINING');
  });

  it('infers other profile category from objective telemetry', () => {
    const inferredTrail = inferOtherProfileCategory({
      activityId: '1',
      activityName: 'Autre',
      activityType: 'OTHER',
      startTimeLocal: '2026-09-01T10:00:00',
      durationMinutes: 60,
      distanceKm: 8.5,
      elevationGainM: 350,
      avgCadence: 168,
      source: 'GARMIN_CONNECT'
    });
    expect(inferredTrail).toBe('Trail / Dénivelé');
  });
});

describe('Periodization Engine', () => {
  it('returns valid ramp-up phase for September 2026', () => {
    const ctx = getPeriodizationContext(new Date('2026-09-03T12:00:00'));
    expect(ctx.phase).toBe('FONDATION_RAMP_1');
    expect(ctx.volumeFactor).toBe(0.55);
    expect(ctx.daysToRace).toBeGreaterThan(0);
  });
});

describe('Calendar ICS Generation', () => {
  it('generates valid RFC 5545 iCalendar content', () => {
    const sampleEvent: CalendarEvent = {
      id: 'SPORT_TEST_1',
      category: 'sport',
      sportType: 'TRAIL_LONG',
      title: '🏔️ Trail Long',
      startDate: '2026-09-05T14:00:00.000Z',
      endDate: '2026-09-05T16:00:00.000Z',
      location: 'Mont-Royal',
      description: 'Test workout',
      emoji: '🏔️',
      colorId: '6',
      colorHex: '#ff6b35',
      durationMinutes: 120
    };

    const ics = generateICSContent([sampleEvent]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:🏔️ Trail Long');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('parses basic ICS string', () => {
    const icsRaw = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-uid-123
SUMMARY:LOG792 - Projet
LOCATION:A-1234
DTSTART:20260908T133000Z
DTEND:20260908T170000Z
DESCRIPTION:Cours magistral
END:VEVENT
END:VCALENDAR`;

    const parsed = parseICSString(icsRaw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].summary).toBe('LOG792 - Projet');
    expect(parsed[0].location).toBe('A-1234');
  });
});
