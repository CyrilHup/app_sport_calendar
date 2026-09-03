import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, ComparisonStatus, GarminActivity } from '../types/garmin';
import { formatDateKey } from './icsParser';

export interface WeeklyStatsSummary {
  plannedDurationMin: number;
  actualDurationMin: number;
  durationCompliancePct: number;
  plannedElevationM: number;
  actualElevationM: number;
  elevationCompliancePct: number;
  avgHeartRate: number;
  overallComplianceScore: number;
  compliantCount: number;
  partialCount: number;
  missedCount: number;
  unplannedCount: number;
  pendingCount: number;
  estimatedTss: number;
}

export function compareWorkoutsWithGarmin(
  plannedWorkouts: CalendarEvent[],
  garminActivities: GarminActivity[],
  manualPairs?: Record<string, string>, // planId -> garminActivityId
  asOfDate: Date = new Date('2026-09-02T23:59:59') // Current reference date
): ActivityComparison[] {
  const asOfKey = formatDateKey(asOfDate);

  // Index garmin activities by date
  const activitiesByDate = new Map<string, GarminActivity[]>();

  for (const act of garminActivities) {
    const actDate = new Date(act.startTimeLocal);
    const dateKey = formatDateKey(actDate);
    if (!activitiesByDate.has(dateKey)) activitiesByDate.set(dateKey, []);
    activitiesByDate.get(dateKey)!.push(act);
  }

  // Filter only sport workouts (exclude commutes, classes, stretches)
  const sportPlans = plannedWorkouts.filter(ev => ev.category === 'sport');
  const comparisons: ActivityComparison[] = [];
  const matchedGarminIds = new Set<string>();

  for (const plan of sportPlans) {
    const planDate = new Date(plan.startDate);
    const dateKey = formatDateKey(planDate);
    const dayActivities = activitiesByDate.get(dateKey) || [];

    // Do not evaluate future sessions (only sessions up to current reference date)
    if (dateKey > asOfKey) {
      continue;
    }

    let bestMatch: GarminActivity | undefined = undefined;

    // Check manual override first
    if (manualPairs && manualPairs[plan.id]) {
      bestMatch = dayActivities.find(a => a.activityId === manualPairs[plan.id]);
    }

    if (!bestMatch && dayActivities.length > 0) {
      // 1. Try to find activity that matches plan type or is 'OTHER' with compatible duration
      bestMatch = dayActivities.find(a =>
        !matchedGarminIds.has(a.activityId) && isActivityTypeCompatible(plan.sportType, a.activityType)
      );

      // 2. If not found, pick the closest unmatched activity by duration on that day
      if (!bestMatch) {
        const unmatched = dayActivities.filter(a => !matchedGarminIds.has(a.activityId));
        if (unmatched.length > 0) {
          unmatched.sort(
            (a, b) =>
              Math.abs(a.durationMinutes - plan.durationMinutes) -
              Math.abs(b.durationMinutes - plan.durationMinutes)
          );
          bestMatch = unmatched[0];
        }
      }
    }

    if (bestMatch) {
      matchedGarminIds.add(bestMatch.activityId);
      const comparison = evaluateSingleWorkout(plan, bestMatch, dateKey);
      comparisons.push(comparison);
    } else if (dateKey === asOfKey) {
      // Today's scheduled workout not yet uploaded
      comparisons.push({
        id: `comp-pending-${plan.id}`,
        date: dateKey,
        status: 'PENDING',
        plannedEvent: plan,
        durationDeltaMinutes: 0,
        complianceScore: 100,
        heartRateCompliance: 'N/A',
        feedbackNotes: [
          `Scheduled for today (${plan.durationMinutes} min target). Pending completion on Garmin.`,
          "Record your session to view live compliance telemetry."
        ]
      });
    } else {
      // Past days only: workout genuinely missed
      comparisons.push({
        id: `comp-missed-${plan.id}`,
        date: dateKey,
        status: 'MISSED',
        plannedEvent: plan,
        durationDeltaMinutes: -plan.durationMinutes,
        complianceScore: 0,
        heartRateCompliance: 'N/A',
        feedbackNotes: [
          `Past session not logged on Garmin Connect (${plan.durationMinutes} min prescribed).`,
          "If recorded under the 'Other' profile on a different date, you can pair it manually."
        ]
      });
    }
  }

  // Identify bonus / unplanned activities (only on or before asOfDate!)
  for (const act of garminActivities) {
    const actDate = new Date(act.startTimeLocal);
    const dateKey = formatDateKey(actDate);

    // Reject any activity with an impossible future date
    if (dateKey > asOfKey) {
      continue;
    }

    if (!matchedGarminIds.has(act.activityId)) {
      const inferred = inferOtherActivityCategory(act);

      comparisons.push({
        id: `comp-unplanned-${act.activityId}`,
        date: dateKey,
        status: 'UNPLANNED',
        actualActivity: act,
        durationDeltaMinutes: act.durationMinutes,
        complianceScore: 100,
        heartRateCompliance: 'OPTIMAL',
        inferredType: inferred,
        feedbackNotes: [
          `Garmin activity logged: ${act.activityName} (${act.durationMinutes} min)${act.activityType === 'OTHER' ? ` [Signature: ${inferred}]` : ''}.`,
          "Bonus session completed."
        ]
      });
    }
  }

  // Sort strictly from current day going back into the past (chronological descending)
  comparisons.sort((a, b) => b.date.localeCompare(a.date));

  return comparisons;
}

export function computeWeeklyTelemetry(
  comparisons: ActivityComparison[],
  targetDaysCountOrRange: number | { start: string; end: string } = 7,
  fullWeekTarget?: { plannedDurationMin: number; plannedElevationM: number }
): WeeklyStatsSummary {
  let currentDays: ActivityComparison[];
  if (typeof targetDaysCountOrRange === 'object' && targetDaysCountOrRange.start && targetDaysCountOrRange.end) {
    currentDays = comparisons.filter(c => c.date >= targetDaysCountOrRange.start && c.date <= targetDaysCountOrRange.end);
  } else {
    currentDays = comparisons.slice(0, typeof targetDaysCountOrRange === 'number' ? targetDaysCountOrRange : 7);
  }

  let plannedDurationMin = fullWeekTarget?.plannedDurationMin || 0;
  let actualDurationMin = 0;
  let plannedElevationM = fullWeekTarget?.plannedElevationM || 0;
  let actualElevationM = 0;
  let hrSum = 0;
  let hrCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  let compliantCount = 0;
  let partialCount = 0;
  let missedCount = 0;
  let unplannedCount = 0;
  let pendingCount = 0;

  for (const c of currentDays) {
    if (c.status === 'PENDING') {
      pendingCount++;
      continue; // Don't penalize pending workouts scheduled for later today
    }

    if (!fullWeekTarget && c.plannedEvent) {
      plannedDurationMin += c.plannedEvent.durationMinutes;
      plannedElevationM += c.plannedEvent.metadata?.targetElevationM || 0;
    }

    if (c.plannedEvent) {
      scoreSum += c.complianceScore;
      scoreCount++;
    }

    if (c.actualActivity) {
      actualDurationMin += c.actualActivity.durationMinutes;
      actualElevationM += c.actualActivity.elevationGainM || 0;
      if (c.actualActivity.avgHeartRate) {
        hrSum += c.actualActivity.avgHeartRate;
        hrCount++;
      }
    }

    if (c.status === 'COMPLIANT') compliantCount++;
    else if (c.status === 'PARTIAL') partialCount++;
    else if (c.status === 'MISSED') missedCount++;
    else if (c.status === 'UNPLANNED') unplannedCount++;
  }

  const durationCompliancePct =
    plannedDurationMin > 0 ? Math.min(100, Math.round((actualDurationMin / plannedDurationMin) * 100)) : 100;
  const elevationCompliancePct =
    plannedElevationM > 0 ? Math.min(100, Math.round((actualElevationM / plannedElevationM) * 100)) : 100;
  const overallComplianceScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 100;
  const avgHeartRate = hrCount > 0 ? Math.round(hrSum / hrCount) : 148;

  // Estimated Training Stress Score (TSS) based on duration and intensity factor
  const estimatedTss = Math.round((actualDurationMin / 60) * ((avgHeartRate / 203) ** 2) * 100);

  return {
    plannedDurationMin,
    actualDurationMin,
    durationCompliancePct,
    plannedElevationM,
    actualElevationM,
    elevationCompliancePct,
    avgHeartRate,
    overallComplianceScore,
    compliantCount,
    partialCount,
    missedCount,
    unplannedCount,
    pendingCount,
    estimatedTss
  };
}

function evaluateSingleWorkout(
  plan: CalendarEvent,
  act: GarminActivity,
  dateKey: string
): ActivityComparison {
  const durationDelta = act.durationMinutes - plan.durationMinutes;
  const feedbackNotes: string[] = [];
  let score = 100;

  // Signature analysis if activity was recorded as OTHER
  const isOther = act.activityType === 'OTHER';
  let inferredType: string | undefined = undefined;

  if (isOther) {
    inferredType = inferOtherActivityCategory(act);
    feedbackNotes.push(
      `🏷️ Recorded on Garmin watch under "Other" profile → Matched as: ${inferredType}.`
    );
  }

  // 1. Duration Evaluation
  const durationDiffPercent = Math.abs(durationDelta) / plan.durationMinutes;
  if (durationDiffPercent > 0.35) {
    score -= 25;
    feedbackNotes.push(
      durationDelta > 0
        ? `Duration: +${durationDelta} min (${act.durationMinutes} min actual vs ${plan.durationMinutes} min planned).`
        : `Duration: -${Math.abs(durationDelta)} min (${act.durationMinutes} min actual vs ${plan.durationMinutes} min planned).`
    );
  } else if (durationDiffPercent > 0.12) {
    score -= 10;
    feedbackNotes.push(
      `Duration compliant (${act.durationMinutes} min actual vs ${plan.durationMinutes} min target, delta ${durationDelta > 0 ? '+' : ''}${durationDelta} min).`
    );
  } else {
    feedbackNotes.push(`Prescribed workout duration strictly achieved (${act.durationMinutes} min).`);
  }

  // 2. Heart Rate Evaluation (FCmax = 203 bpm)
  let hrCompliance: 'OPTIMAL' | 'TOO_HIGH' | 'TOO_LOW' | 'N/A' = 'OPTIMAL';
  const targetRange = plan.metadata?.targetHeartRateRange;

  if (act.avgHeartRate && targetRange) {
    const [minTarget, maxTarget] = targetRange;
    if (act.avgHeartRate > maxTarget + 5) {
      hrCompliance = 'TOO_HIGH';
      score -= 20;
      feedbackNotes.push(
        `⚠️ Heart rate elevated: avg ${act.avgHeartRate} bpm (target ceiling: ${maxTarget} bpm). Risk of premature fatigue.`
      );
    } else if (act.avgHeartRate < minTarget - 12) {
      hrCompliance = 'TOO_LOW';
      score -= 10;
      feedbackNotes.push(
        `Heart rate below target zone (${act.avgHeartRate} bpm vs target ${minTarget}-${maxTarget} bpm). Very relaxed recovery effort.`
      );
    } else {
      hrCompliance = 'OPTIMAL';
      feedbackNotes.push(
        `🎯 Optimal cardio: avg HR ${act.avgHeartRate} bpm perfectly locked in target zone (${minTarget}-${maxTarget} bpm).`
      );
    }
  }

  // 3. Elevation Gain Evaluation (for Trail sessions)
  let elevationDeltaM: number | undefined = undefined;
  if (plan.metadata?.targetElevationM && act.elevationGainM !== undefined) {
    elevationDeltaM = act.elevationGainM - plan.metadata.targetElevationM;
    if (Math.abs(elevationDeltaM) > 70) {
      feedbackNotes.push(
        `Elevation D+: ${act.elevationGainM} m completed (${elevationDeltaM > 0 ? '+' : ''}${elevationDeltaM} m vs target ${plan.metadata.targetElevationM} m).`
      );
    } else {
      feedbackNotes.push(`Elevation D+ target met: +${act.elevationGainM} m (target ~${plan.metadata.targetElevationM} m).`);
    }
  }

  const finalScore = Math.max(10, Math.min(100, score));
  const status: ComparisonStatus = finalScore >= 80 ? 'COMPLIANT' : 'PARTIAL';

  return {
    id: `comp-${plan.id}-${act.activityId}`,
    date: dateKey,
    status,
    plannedEvent: plan,
    actualActivity: act,
    durationDeltaMinutes: durationDelta,
    elevationDeltaM,
    heartRateCompliance: hrCompliance,
    complianceScore: finalScore,
    inferredType,
    feedbackNotes
  };
}

function isActivityTypeCompatible(planType?: string, actType?: string): boolean {
  if (!planType || !actType) return false;
  // If user records workouts under 'OTHER' on their Garmin watch, consider compatible for matching!
  if (actType === 'OTHER') return true;
  if ((planType === 'TRAIL_INTENSE' || planType === 'TRAIL_LONG') && actType === 'TRAIL_RUNNING') return true;
  if (planType === 'RUN_EASY' && (actType === 'RUNNING' || actType === 'TRAIL_RUNNING')) return true;
  if (
    (planType === 'CALISTHENICS' || planType === 'GYM_FORCE') &&
    (actType === 'STRENGTH_TRAINING' || actType === 'FITNESS_EQUIPMENT')
  ) {
    return true;
  }
  return false;
}

function inferOtherActivityCategory(act: GarminActivity): string {
  const name = (act.activityName || '').toLowerCase();
  const dPlus = act.elevationGainM || 0;
  const hr = act.avgHeartRate || 0;
  const dist = act.distanceKm || 0;

  if (dPlus > 120 || name.includes('mont-royal') || name.includes('côte') || name.includes('trail') || name.includes('hill')) {
    return 'Trail / Hill Repeats (Mont-Royal)';
  }
  if (hr > 165 || name.includes('fractionné') || name.includes('interval') || name.includes('intense')) {
    return 'High-Intensity Cardio (Zone 4/5)';
  }
  if (dist > 3 || (act.avgCadence && act.avgCadence > 150) || name.includes('course') || name.includes('footing') || name.includes('run')) {
    return 'Aerobic Base Running (Z2)';
  }
  if (name.includes('gym') || name.includes('calisth') || name.includes('dips') || name.includes('pull') || dist === 0) {
    return 'Calisthenics / Strength (ÉTS Gym)';
  }
  return 'General Training Session';
}
