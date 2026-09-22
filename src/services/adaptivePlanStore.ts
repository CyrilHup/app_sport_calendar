import type { AdaptiveWorkoutOverride } from '../types/calendar';

/** Version of the persisted adaptive-plan envelope. */
export const ADAPTIVE_PLAN_STATE_VERSION = 1 as const;

export interface WeeklyDecision {
  weekStart: string;
  decidedAt: string;
}

export interface AdaptivePlanState {
  overrides: Record<string, AdaptiveWorkoutOverride>;
  weeklyDecisions: Record<string, WeeklyDecision>;
}

const EMPTY_STATE: AdaptivePlanState = { overrides: {}, weeklyDecisions: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAdaptiveOverride(value: unknown): value is AdaptiveWorkoutOverride {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.eventId) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.originalTitle) &&
    isNonEmptyString(value.adaptedTitle) &&
    isFiniteNumber(value.originalDurationMinutes) &&
    isFiniteNumber(value.adaptedDurationMinutes) &&
    isNonEmptyString(value.adaptationReason) &&
    isNonEmptyString(value.coachingCue) &&
    isNonEmptyString(value.createdAt);
}

function sanitizeOverrides(value: unknown): Record<string, AdaptiveWorkoutOverride> {
  if (!isRecord(value)) return {};
  const result: Record<string, AdaptiveWorkoutOverride> = {};
  for (const [key, override] of Object.entries(value)) {
    if (isNonEmptyString(key) && isAdaptiveOverride(override)) result[key] = override;
  }
  return result;
}

function sanitizeWeeklyDecisions(value: unknown): Record<string, WeeklyDecision> {
  if (!isRecord(value)) return {};
  const result: Record<string, WeeklyDecision> = {};
  for (const [key, decision] of Object.entries(value)) {
    if (!isNonEmptyString(key) || !isRecord(decision)) continue;
    if (isNonEmptyString(decision.weekStart) && isNonEmptyString(decision.decidedAt)) {
      result[key] = { weekStart: decision.weekStart, decidedAt: decision.decidedAt };
    }
  }
  return result;
}

/**
 * Parse both the current envelope and the old top-level override map.
 * Invalid entries are discarded independently, so one corrupt record cannot
 * hide the rest of a user's plan or weekly decision history.
 */
export function parseAdaptivePlanState(input: unknown): AdaptivePlanState {
  if (!isRecord(input)) return { ...EMPTY_STATE };
  const isEnvelope = input.version === ADAPTIVE_PLAN_STATE_VERSION ||
    Object.prototype.hasOwnProperty.call(input, 'overrides') ||
    Object.prototype.hasOwnProperty.call(input, 'weeklyDecisions');
  if (!isEnvelope) return { overrides: sanitizeOverrides(input), weeklyDecisions: {} };
  return {
    overrides: sanitizeOverrides(input.overrides),
    weeklyDecisions: sanitizeWeeklyDecisions(input.weeklyDecisions),
  };
}

export function serializeAdaptivePlanState(state: AdaptivePlanState): string {
  const normalized = parseAdaptivePlanState(state);
  return JSON.stringify({
    version: ADAPTIVE_PLAN_STATE_VERSION,
    overrides: normalized.overrides,
    weeklyDecisions: normalized.weeklyDecisions,
  });
}

export function emptyAdaptivePlanState(): AdaptivePlanState {
  return { ...EMPTY_STATE };
}
