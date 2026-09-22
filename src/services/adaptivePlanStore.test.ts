import { describe, it, expect } from 'vitest';
import {
  ADAPTIVE_PLAN_STATE_VERSION,
  emptyAdaptivePlanState,
  parseAdaptivePlanState,
  serializeAdaptivePlanState,
} from './adaptivePlanStore';
import type { AdaptiveWorkoutOverride } from '../types/calendar';

const override: AdaptiveWorkoutOverride = {
  eventId: 'run-1', date: '2026-09-21', originalTitle: 'Tempo', adaptedTitle: 'Tempo allégé',
  originalDurationMinutes: 60, adaptedDurationMinutes: 45, adaptationReason: 'charge',
  coachingCue: 'Rester facile', createdAt: '2026-09-21T08:00:00.000Z',
};

describe('adaptivePlanStore', () => {
  it('migrates a legacy top-level override map', () => {
    expect(parseAdaptivePlanState({ 'run-1': override })).toEqual({
      overrides: { 'run-1': override }, weeklyDecisions: {},
    });
  });

  it('round-trips the versioned envelope, including a no-action decision', () => {
    const state = {
      overrides: { 'run-1': override },
      weeklyDecisions: { '2026-09-21': { weekStart: '2026-09-21', decidedAt: '2026-09-21T06:00:00Z' } },
    };
    const parsed = JSON.parse(serializeAdaptivePlanState(state));
    expect(parsed.version).toBe(ADAPTIVE_PLAN_STATE_VERSION);
    expect(parseAdaptivePlanState(parsed)).toEqual(state);
  });

  it('drops malformed entries while retaining valid state', () => {
    const state = parseAdaptivePlanState({
      version: 1,
      overrides: { good: override, bad: { eventId: 'bad', adaptedDurationMinutes: 'nope' } },
      weeklyDecisions: {
        good: { weekStart: '2026-09-21', decidedAt: 'now' },
        bad: { weekStart: '', decidedAt: 42 },
      },
    });
    expect(state.overrides).toEqual({ good: override });
    expect(state.weeklyDecisions).toEqual({ good: { weekStart: '2026-09-21', decidedAt: 'now' } });
    expect(parseAdaptivePlanState(null)).toEqual(emptyAdaptivePlanState());
    expect(parseAdaptivePlanState('{bad json')).toEqual(emptyAdaptivePlanState());
  });
});
