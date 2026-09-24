import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarEvent } from '../types/calendar';
import { AthletePhysiologicalProfile } from '../services/garminService';
import { WorkoutDetailModal } from './WorkoutDetailModal';

const athleteProfile: AthletePhysiologicalProfile = {
  fcMax: 190,
  fcRest: 50,
  fcReserve: 140,
  trailAvgHr: 155,
  runEasyAvgHr: 140,
  calisthenicsAvgHr: 125,
  basePace: '6:05'
};

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'render-test-event',
    title: 'Repos complet',
    description: 'Repos',
    startDate: '2026-09-24T07:00:00',
    endDate: '2026-09-24T07:00:00',
    category: 'sport',
    colorId: 'sport',
    colorHex: '#ff5722',
    durationMinutes: 0,
    emoji: '',
    location: '',
    ...overrides
  };
}

describe('WorkoutDetailModal Garmin preview rendering', () => {
  it('does not generate a preview for its closed, zero-duration placeholder', () => {
    const html = renderToStaticMarkup(
      <WorkoutDetailModal event={null} onClose={() => undefined} athleteProfile={athleteProfile} />
    );

    expect(html).toBe('');
  });

  it('renders a zero-duration rest event without trying to build a Garmin workout', () => {
    const html = renderToStaticMarkup(
      <WorkoutDetailModal event={createEvent()} onClose={() => undefined} athleteProfile={athleteProfile} />
    );

    expect(html).toContain('Repos complet');
    expect(html).not.toContain('DÉROULÉ CONCRET DE LA SÉANCE');
  });

  it('still renders a Garmin preview for a valid running workout', () => {
    const html = renderToStaticMarkup(
      <WorkoutDetailModal
        event={createEvent({
          title: 'Footing aérobie',
          description: 'Séance de course',
          startDate: '2026-09-24T07:00:00',
          endDate: '2026-09-24T07:45:00',
          durationMinutes: 45,
          sportType: 'RUN_EASY'
        })}
        onClose={() => undefined}
        athleteProfile={athleteProfile}
      />
    );

    expect(html).toContain('DÉROULÉ CONCRET DE LA SÉANCE');
  });
});
