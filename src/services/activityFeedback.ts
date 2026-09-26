import { ActivityFeedback, GarminActivity, SubjectiveFeeling } from '../types/garmin';

const feelings: SubjectiveFeeling[] = ['VERY_WEAK', 'WEAK', 'NORMAL', 'STRONG', 'VERY_STRONG'];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readRpe(value: unknown, scaledToHundred: boolean): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return undefined;
  const rpe = scaledToHundred ? number / 10 : number;
  return rpe >= 1 && rpe <= 10 ? Math.round(rpe * 10) / 10 : undefined;
}

function readFeeling(value: unknown): SubjectiveFeeling | undefined {
  if (typeof value === 'number') {
    const index = [0, 25, 50, 75, 100].indexOf(value);
    return index >= 0 ? feelings[index] : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase().replace(/[ -]+/g, '_');
  return feelings.includes(normalized as SubjectiveFeeling) ? normalized as SubjectiveFeeling : undefined;
}

/** Reads only fields observed in Garmin self-evaluation responses; missing data stays missing. */
export function extractGarminFeedback(raw: unknown): ActivityFeedback | undefined {
  const record = asRecord(raw);
  const selfEvaluation = asRecord(record.selfEvaluation);
  // Garmin's activity-detail response places self-evaluation in summaryDTO;
  // activity-list responses can expose the same fields at the top level.
  const summary = asRecord(record.summaryDTO);
  const rpe = readRpe(record.directWorkoutRpe ?? summary.directWorkoutRpe ?? selfEvaluation.directWorkoutRpe, true) ??
    readRpe(record.perceivedEffort ?? summary.perceivedEffort ?? selfEvaluation.perceivedEffort, false);
  const feeling = readFeeling(record.subjectiveFeeling ?? summary.subjectiveFeeling ?? selfEvaluation.subjectiveFeeling);
  const rawNotes = record.description ?? summary.description;
  const notes = typeof rawNotes === 'string' ? rawNotes.trim().slice(0, 2000) : undefined;
  if (rpe === undefined && feeling === undefined && !notes) return undefined;
  return { perceivedEffort: rpe, feeling, notes: notes || undefined };
}

export function effectiveActivityFeedback(activity: GarminActivity): ActivityFeedback {
  const manual = Object.fromEntries(Object.entries(activity.manualFeedback || {})
    .filter(([, value]) => value !== undefined && value !== ''));
  return { ...activity.garminFeedback, ...manual };
}

export function sessionRpeLoad(activity: GarminActivity): number | undefined {
  const rpe = effectiveActivityFeedback(activity).perceivedEffort;
  return rpe === undefined ? undefined : Math.round(activity.durationMinutes * rpe);
}

/** Four rolling seven-day windows, with coverage so missing ratings are visible. */
export function weeklySessionRpeTrend(activities: GarminActivity[], asOf: Date): {
  totalLoad: number;
  ratedSessions: number;
  recordedSessions: number;
  start: Date;
  end: Date;
}[] {
  const end = new Date(asOf);
  end.setHours(23, 59, 59, 999);
  const dayMs = 86400_000;
  return Array.from({ length: 4 }, (_, index) => {
    const weeksAgo = 3 - index;
    const windowEnd = new Date(end.getTime() - weeksAgo * 7 * dayMs);
    const windowStart = new Date(windowEnd.getTime() - 7 * dayMs + 1);
    const sessions = activities.filter(activity => {
      const timestamp = Date.parse(activity.startTimeLocal);
      return Number.isFinite(timestamp) && timestamp >= windowStart.getTime() && timestamp <= windowEnd.getTime();
    });
    const loads = sessions.map(sessionRpeLoad).filter((load): load is number => load !== undefined);
    return {
      totalLoad: loads.reduce((sum, load) => sum + load, 0),
      ratedSessions: loads.length,
      recordedSessions: sessions.length,
      start: windowStart,
      end: windowEnd
    };
  });
}

export function recentSubjectiveSignals(activities: GarminActivity[], now: Date): {
  repeatedLowFeeling: boolean;
  recentPain: number | undefined;
  ratedSessions: number;
  totalSessionRpeLoad: number;
} {
  const recent = activities.filter(a => {
    const age = now.getTime() - Date.parse(a.startTimeLocal);
    return Number.isFinite(age) && age >= 0 && age <= 7 * 86400_000;
  });
  const lowFeelings = recent.filter(a =>
    ['WEAK', 'VERY_WEAK'].includes(effectiveActivityFeedback(a).feeling || '')
  ).length;
  const pain = recent.filter(a => now.getTime() - Date.parse(a.startTimeLocal) <= 3 * 86400_000)
    .map(a => effectiveActivityFeedback(a).pain).filter((value): value is number => value !== undefined);
  const loads = recent.map(sessionRpeLoad).filter((value): value is number => value !== undefined);
  return {
    repeatedLowFeeling: lowFeelings >= 2,
    recentPain: pain.length ? Math.max(...pain) : undefined,
    ratedSessions: loads.length,
    totalSessionRpeLoad: loads.reduce((sum, value) => sum + value, 0)
  };
}

export function sanitizeManualFeedback(value: ActivityFeedback): ActivityFeedback {
  const perceivedEffort = readRpe(value.perceivedEffort, false);
  const pain = typeof value.pain === 'number' && Number.isInteger(value.pain) && value.pain >= 0 && value.pain <= 10
    ? value.pain : undefined;
  return {
    perceivedEffort,
    feeling: readFeeling(value.feeling),
    notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 2000) : undefined,
    pain,
    updatedAt: new Date().toISOString()
  };
}

/** Public spectator shares must not expose free-text or subjective feedback. */
export function publicActivity(activity: GarminActivity): GarminActivity {
  const { garminFeedback: _garminFeedback, manualFeedback: _manualFeedback,
    garminFeedbackCheckedAt: _checkedAt, ...publicFields } = activity;
  return publicFields;
}
