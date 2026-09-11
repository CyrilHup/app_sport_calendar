import { describe, it, expect } from 'vitest';
import {
  classifyGarminActivityType,
  inferOtherProfileCategory,
  formatGarminActivityName,
  getGarminExecutionBadge,
  isStrengthOrCalisthenics,
  isTrailOrRunning,
  isCycling,
  isClimbing,
  isWalking
} from './activityClassifier';
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
    expect(classifyGarminActivityType('cardio_training', 'Montréal Cardio')).toBe('STRENGTH_TRAINING');
    expect(classifyGarminActivityType('indoor_cardio', 'Renfo maison')).toBe('STRENGTH_TRAINING');
    expect(classifyGarminActivityType('cardio_training', 'Cardio')).toBe('STRENGTH_TRAINING');
  });

  it('unifies generic Garmin Cardio names with planned workouts or fallback', () => {
    // When matched with a planned workout, display the planned workout title
    expect(formatGarminActivityName('Cardio', 'Calisthenics 1 (Push & Core)')).toBe('Calisthenics 1 (Push & Core)');
    expect(formatGarminActivityName('cardio_training', 'Calisthenics 2 (Pull)')).toBe('Calisthenics 2 (Pull)');
    // When no planned workout exists, display Calisthénie / Renforcement
    expect(formatGarminActivityName('Cardio', undefined)).toBe('Calisthénie / Renforcement');
    expect(formatGarminActivityName('indoor cardio', '')).toBe('Calisthénie / Renforcement');
    // Keeps specific custom titles intact
    expect(formatGarminActivityName('Montreal Running', 'Trail: Hill Repeats D+')).toBe('Montreal Running');
    expect(formatGarminActivityName('Séance Pectoraux', undefined)).toBe('Séance Pectoraux');
  });

  it('generates dynamic, accurate execution badges for calisthenics vs running vs trail', () => {
    const strengthBadge = getGarminExecutionBadge({
      activityType: 'STRENGTH_TRAINING',
      activityName: 'Cardio'
    });
    expect(strengthBadge.label).toBe('Calisthénie Réalisée (Garmin)');
    expect(strengthBadge.icon).toBe('💪');

    const runBadge = getGarminExecutionBadge({
      activityType: 'RUNNING',
      activityName: 'Montreal Running'
    });
    expect(runBadge.label).toBe('Course Réalisée (Garmin)');
    expect(runBadge.icon).toBe('🏃');

    const trailBadge = getGarminExecutionBadge({
      activityType: 'TRAIL_RUNNING',
      activityName: 'Mont-Royal D+'
    });
    expect(trailBadge.label).toBe('Trail Réalisé (Garmin)');
    expect(trailBadge.icon).toBe('⛰️');

    const bikeBadge = getGarminExecutionBadge({
      activityType: 'CYCLING',
      activityName: 'Sortie vélo'
    });
    expect(bikeBadge.label).toBe('Sortie Vélo Réalisée (Garmin)');
    expect(bikeBadge.icon).toBe('🚴');
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

  it('correctly evaluates centralized activity predicates', () => {
    // Strength & Calisthenics
    expect(isStrengthOrCalisthenics('CALISTHENICS', 'Calisthenics 1 (Push & Core)')).toBe(true);
    expect(isStrengthOrCalisthenics('STRENGTH_TRAINING', 'Muscu jambes')).toBe(true);
    expect(isStrengthOrCalisthenics('FITNESS_EQUIPMENT', 'Cardio')).toBe(true);
    expect(isStrengthOrCalisthenics(undefined, 'Renforcement gainage & tractions')).toBe(true);
    expect(isStrengthOrCalisthenics(undefined, 'Séance Dips & Pompes')).toBe(true);
    expect(isStrengthOrCalisthenics({ activityType: 'OTHER', activityName: 'Cardio training' })).toBe(true);
    expect(isStrengthOrCalisthenics('RUNNING', 'Footing endurance')).toBe(false);
    // CRUCIAL: Trail sessions with "strength" or "renfo" in title MUST NEVER be classified as strength
    expect(isStrengthOrCalisthenics('TRAIL_INTENSE', 'Trail: Hill Repeats D+ (Mont-Royal) + Leg Strength')).toBe(false);
    expect(isStrengthOrCalisthenics(undefined, 'Trail: Hill Repeats D+ (Mont-Royal) + Leg Strength')).toBe(false);
    expect(isStrengthOrCalisthenics('TRAIL_LONG', 'Sortie longue Trail D+ et renfo')).toBe(false);

    // Trail & Running
    expect(isTrailOrRunning('TRAIL_RUNNING', 'Mont-Royal D+')).toBe(true);
    expect(isTrailOrRunning('RUN_EASY', 'Footing 45 min')).toBe(true);
    expect(isTrailOrRunning(undefined, 'Côtes et fartlek')).toBe(true);
    expect(isTrailOrRunning('TRAIL_INTENSE', 'Trail: Hill Repeats D+ (Mont-Royal) + Leg Strength')).toBe(true);
    expect(isTrailOrRunning(undefined, 'Trail: Hill Repeats D+ (Mont-Royal) + Leg Strength')).toBe(true);
    expect(isTrailOrRunning('CLIMBING', 'Bloc')).toBe(false);
    expect(isTrailOrRunning(undefined, 'Cours magistral LOG792')).toBe(false);

    // Cycling
    expect(isCycling('CYCLING', 'Sortie route')).toBe(true);
    expect(isCycling(undefined, 'Trajet vélo')).toBe(true);

    // Climbing
    expect(isClimbing('CLIMBING', 'Alpinisme')).toBe(true);
    expect(isClimbing(undefined, 'Bloc shop session')).toBe(true);

    // Walking
    expect(isWalking('WALKING', 'Marche')).toBe(true);
    expect(isWalking(undefined, 'Rando Mont-Tremblant')).toBe(true);
  });
});
