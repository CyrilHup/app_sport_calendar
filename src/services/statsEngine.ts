import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import { formatDateKey, getGarminLocalDateKey, getMondayWeekKey, toLocalDateKey, parseLocalDate, addDays } from './dateUtils';
import { isStrengthOrCalisthenics, isTrailOrRunning } from './activityClassifier';
import { GLOBAL_APP_CONFIG } from './periodizationEngine';
import {
  computeTrainingLoadStats,
  computeTrailSpecificStats,
  formatPace,
  TrainingLoadStats,
  TrailSpecificStats
} from './loadEngine';
import {
  calculateQmtRacePrediction,
  formatMinutes,
  parsePaceStringToSeconds,
  QmtRacePrediction
} from './racePredictorEngine';

// 100% Backward-compatible re-exports
export * from './loadEngine';
export * from './racePredictorEngine';

/**
 * Official start date of the preparation (reprise & fondations).
 * Linked to GLOBAL_APP_CONFIG.SPORT_START_DATE.
 */
export const PLAN_START_DATE = GLOBAL_APP_CONFIG.SPORT_START_DATE || '2026-09-01';

/**
 * Standard default weekly targets when no planned session is scheduled.
 */
export const DEFAULT_WEEKLY_TARGETS = {
  plannedDurationMin: 225,
  plannedElevationM: 780
};

export type TimeRangeScope = 'week' | 'plan' | '4w' | '12w' | 'all' | (string & {});

export interface WeeklyTrendPoint {
  weekKey: string; // YYYY-MM-DD of Monday
  weekLabel: string; // e.g. "Sem. 31 août"
  totalMinutes: number;
  plannedMinutes?: number;
  runningMinutes: number;
  strengthMinutes: number;
  otherMinutes: number;
  distanceKm: number;
  elevationGainM: number;
  plannedElevationGainM?: number;
  elevationLossM: number;
  avgHeartRate: number | null;
  sessionCount: number;
  plannedSessionCount?: number;
  bonusSessionCount: number;
}

export interface GlobalStats {
  totalDurationMinutes: number;
  totalSessionsCount: number;
  activeWeeksCount: number;
  weeklyAverageMinutes: number;
  weeklyProgressionPct: number;
  progressionStatus: 'SAFE_PROGRESSION' | 'OVERLOAD_WARNING' | 'RECOVERY_MAINTENANCE' | 'STARTING';
  progressionComparisonText: string;
  sportBreakdown: {
    running: { minutes: number; pct: number; count: number };
    strength: { minutes: number; pct: number; count: number };
    crossTraining: { minutes: number; pct: number; count: number };
    other: { minutes: number; pct: number; count: number };
  };
  weeklyTrend: WeeklyTrendPoint[];
  excludedBonusCount: number;
  excludedBonusMinutes: number;
  isFilteringBonuses: boolean;
  indicativeStrengthMinutes: number;
  indicativeStrengthCount: number;
}

export interface RunningStats {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  elevationDensityMPerKm: number;
  densityComparisonText: string;
  avgPaceMinKm: string;
  avgCadenceSpm: number;
  longestRun: {
    distanceKm: number;
    durationMinutes: number;
    date: string;
    name: string;
  } | null;
  maxElevationRun: {
    elevationGainM: number;
    distanceKm: number;
    durationMinutes: number;
    date: string;
    name: string;
  } | null;
  intensityDistribution: {
    zone2EnduranceMinutes: number;
    zone2Pct: number;
    zoneTempoThresholdMinutes: number;
    zoneTempoThresholdPct: number;
    zoneMaxMinutes: number;
    zoneMaxPct: number;
  };
}

export interface StrengthStats {
  totalDurationMinutes: number;
  totalSessionsCount: number;
  weeklyFrequency: number;
  categoryBreakdown: {
    calisthenicsMinutes: number;
    gymForceMinutes: number;
    coreMobilityMinutes: number;
  };
  strengthToRunRatioPct: number;
  quadArmorScore: number;
  quadArmorRating: 'Optimale' | 'En construction' | 'Initiale';
  streakWeeks: number;
}

export interface HeartRateStats {
  currentAvgHeartRate: number | null;
  previousAvgHeartRate: number | null;
  heartRateDeltaBpm: number | null;
  heartRateTrend: 'DECREASING' | 'STABLE' | 'INCREASING' | 'INSUFFICIENT_DATA';
  aerobicEfficiencyIndex: number | null; // meters per minute per bpm
  aerobicEfficiencyDeltaPct: number | null;
  summaryText: string;
  comparisonBaselineText: string;
  historicalPrePlanAvgHr: number | null;
  overallPeriodAvgHr?: number | null;
}

export interface FullStatsReport {
  scope: TimeRangeScope;
  global: GlobalStats;
  running: RunningStats;
  strength: StrengthStats;
  heartRate: HeartRateStats;
  trainingLoad: TrainingLoadStats;
  trailSpecific: TrailSpecificStats;
  qmtPrediction: QmtRacePrediction;
}

/**
 * Filter activities and calendar events by the requested time window scope.
 */
export function filterItemsByScope<T extends { date: string }>(
  items: T[],
  scope: TimeRangeScope,
  asOfDate: Date = new Date()
): T[] {
  // 1. Current week scope: 'week' (from Monday to Sunday of asOfDate)
  if (scope === 'week') {
    const todayKey = formatDateKey(asOfDate);
    const mondayKey = getMondayWeekKey(todayKey);
    const monDate = parseLocalDate(mondayKey);
    const sunDate = addDays(monDate, 6);
    const sunKey = formatDateKey(sunDate);
    return items.filter(item => item.date >= mondayKey && item.date <= sunKey);
  }

  // 2. Specific week scope: 'week:YYYY-MM-DD' (from Monday to Sunday)
  if (scope.startsWith('week:')) {
    const mondayKey = scope.replace('week:', '');
    const monDate = parseLocalDate(mondayKey);
    const sunDate = addDays(monDate, 6);
    const sunKey = formatDateKey(sunDate);
    return items.filter(item => item.date >= mondayKey && item.date <= sunKey);
  }

  const endDateStr = formatDateKey(asOfDate);

  if (scope === 'plan') {
    // Default & main focus: from official plan start date (1er sept. 2026)
    return items.filter(item => item.date >= PLAN_START_DATE && item.date <= endDateStr);
  }

  if (scope === 'all') return items;

  const asOfTime = asOfDate.getTime();
  const weeks = scope === '4w' ? 4 : 12;
  const daysLimit = weeks * 7;
  const startTime = asOfTime - daysLimit * 24 * 60 * 60 * 1000;
  const startDateStr = formatDateKey(new Date(startTime));

  return items.filter(item => item.date >= startDateStr && item.date <= endDateStr);
}

/**
 * Main computation entry point: evaluates completed activities from Garmin and/or comparisons.
 */
export function computeFullStatsReport(
  garminActivities: GarminActivity[],
  comparisons: ActivityComparison[] = [],
  _plannedEvents: CalendarEvent[] = [],
  scope: TimeRangeScope = 'plan',
  asOfDate: Date = new Date(),
  includeBonusActivities: boolean = true
): FullStatsReport {
  // Identify which activities are "Bonus" (unplanned non-prescribed activities)
  const bonusActIds = new Set<string>();
  for (const c of comparisons) {
    if (c.status === 'UNPLANNED' && c.actualActivity) {
      bonusActIds.add(c.actualActivity.activityId);
    }
  }

  interface NormalizedAct {
    id: string;
    date: string;
    name: string;
    type: string;
    durationMinutes: number;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number;
    avgHeartRate: number | null;
    maxHeartRate?: number | null;
    avgCadence: number | null;
    avgPaceSecPerKm: number | null;
    trainingLoad: number | null;
    isBonus: boolean;
    isPrePlan: boolean;
  }

  const rawList: NormalizedAct[] = [];

  // Ingest Garmin activities
  if (garminActivities && garminActivities.length > 0) {
    for (const act of garminActivities) {
      const date = getGarminLocalDateKey(act);
      let paceSec: number | null = parsePaceStringToSeconds(act.avgPaceMinKm);
      if (!paceSec && act.distanceKm && act.distanceKm > 0 && act.durationMinutes > 0) {
        paceSec = (act.durationMinutes * 60) / act.distanceKm;
      }

      const isBonus = bonusActIds.has(act.activityId) ||
        (date >= PLAN_START_DATE && act.activityType === 'WALKING' && !act.activityName.toLowerCase().includes('randonn'));
      const isPrePlan = date < PLAN_START_DATE;

      rawList.push({
        id: act.activityId,
        date,
        name: act.activityName || 'Séance',
        type: act.activityType || 'OTHER',
        durationMinutes: act.durationMinutes || 0,
        distanceKm: act.distanceKm || 0,
        elevationGainM: act.elevationGainM || 0,
        elevationLossM: act.elevationLossM || 0,
        avgHeartRate: act.avgHeartRate || null,
        maxHeartRate: act.maxHeartRate || null,
        avgCadence: act.avgCadence || null,
        avgPaceSecPerKm: paceSec,
        trainingLoad: act.trainingLoad || null,
        isBonus,
        isPrePlan
      });
    }
  } else if (comparisons && comparisons.length > 0) {
    for (const comp of comparisons) {
      if (comp.status === 'MISSED' || comp.status === 'PENDING') continue;
      const act = comp.actualActivity;
      const plan = comp.plannedEvent;
      const date = comp.date;
      const duration = act?.durationMinutes || plan?.durationMinutes || 0;
      const dGain = act?.elevationGainM || plan?.metadata?.targetElevationM || 0;
      const dLoss = act?.elevationLossM || 0;
      const dist = act?.distanceKm || 0;
      const hr = act?.avgHeartRate || null;
      const type = act?.activityType || (plan?.sportType === 'CALISTHENICS' || plan?.sportType === 'GYM_FORCE' ? 'STRENGTH_TRAINING' : 'RUNNING');
      const isBonus = comp.status === 'UNPLANNED';
      const isPrePlan = date < PLAN_START_DATE;

      rawList.push({
        id: comp.id,
        date,
        name: act?.activityName || plan?.title || 'Séance',
        type,
        durationMinutes: duration,
        distanceKm: dist,
        elevationGainM: dGain,
        elevationLossM: dLoss,
        avgHeartRate: hr,
        maxHeartRate: act?.maxHeartRate || null,
        avgCadence: act?.avgCadence || null,
        avgPaceSecPerKm: parsePaceStringToSeconds(act?.avgPaceMinKm),
        trainingLoad: act?.trainingLoad || null,
        isBonus,
        isPrePlan
      });
    }
  }

  // 1. Scoped activities based on the selected time window (default: from 1er sept. 2026)
  const scopedList = filterItemsByScope(rawList, scope, asOfDate);

  // 2. Separate training plan activities from bonuses
  let excludedBonusCount = 0;
  let excludedBonusMinutes = 0;

  for (const act of scopedList) {
    if (act.isBonus) {
      excludedBonusCount++;
      excludedBonusMinutes += act.durationMinutes;
    }
  }

  // If user requests to exclude bonuses (default), filter them out of volume and mileage
  const activeActivities = includeBonusActivities
    ? scopedList
    : scopedList.filter(a => !a.isBonus);

  // Group training activities by week (Monday)
  const weekMap = new Map<string, NormalizedAct[]>();
  for (const act of activeActivities) {
    const mondayKey = getMondayWeekKey(act.date);
    if (!weekMap.has(mondayKey)) {
      weekMap.set(mondayKey, []);
    }
    weekMap.get(mondayKey)!.push(act);
  }

  // Build a map of planned target minutes & D+ by Monday week key
  // Strictly counts running/trail workouts for prescribed plan targets
  const plannedWeekMap = new Map<string, { minutes: number; elevationM: number; count: number }>();
  for (const ev of _plannedEvents) {
    if (ev.category === 'sport' && !ev.metadata?.isPostponedPlaceholder && isTrailOrRunning(ev)) {
      const dKey = toLocalDateKey(ev.startDate);
      const mKey = getMondayWeekKey(dKey);
      const existing = plannedWeekMap.get(mKey) || { minutes: 0, elevationM: 0, count: 0 };
      existing.minutes += ev.durationMinutes || 0;
      existing.elevationM += ev.metadata?.targetElevationM || 0;
      existing.count += 1;
      plannedWeekMap.set(mKey, existing);
    }
  }

  // Also track bonus counts per week
  const bonusWeekMap = new Map<string, number>();
  for (const act of scopedList) {
    if (act.isBonus) {
      const mondayKey = getMondayWeekKey(act.date);
      bonusWeekMap.set(mondayKey, (bonusWeekMap.get(mondayKey) || 0) + 1);
    }
  }

  // Sort weeks chronologically
  const sortedWeekKeys = Array.from(weekMap.keys()).sort();

  const weeklyTrend: WeeklyTrendPoint[] = sortedWeekKeys.map(wKey => {
    const acts = weekMap.get(wKey)!;
    let runMin = 0;
    let strengthMin = 0;
    let otherMin = 0;
    let distKm = 0;
    let dPlus = 0;
    let dMinus = 0;
    let hrSum = 0;
    let hrCount = 0;
    let runningSessionsCount = 0;

    for (const a of acts) {
      const isRun = isTrailOrRunning(a.type, a.name);
      const isStr = !isRun && isStrengthOrCalisthenics(a.type, a.name);

      dPlus += a.elevationGainM;
      dMinus += a.elevationLossM;
      distKm += a.distanceKm;

      if (a.avgHeartRate && a.avgHeartRate > 0) {
        hrSum += a.avgHeartRate * a.durationMinutes;
        hrCount += a.durationMinutes;
      }

      if (isRun) {
        runMin += a.durationMinutes;
        runningSessionsCount += 1;
      } else if (isStr) {
        strengthMin += a.durationMinutes;
      } else {
        otherMin += a.durationMinutes;
      }
    }

    const dDate = new Date(wKey + 'T12:00:00');
    const isDifferentYear = dDate.getFullYear() !== asOfDate.getFullYear();
    const dateFormatted = isDifferentYear
      ? `${dDate.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} '${String(dDate.getFullYear()).slice(-2)}`
      : dDate.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
    const weekLabel = `Sem. ${dateFormatted}`;
    const planTarget = plannedWeekMap.get(wKey);

    return {
      weekKey: wKey,
      weekLabel,
      totalMinutes: runMin, // Training plan volume is strictly course/trail
      plannedMinutes: planTarget?.minutes || 0,
      runningMinutes: runMin,
      strengthMinutes: strengthMin, // Retained purely for indicative tooltips
      otherMinutes: otherMin,
      distanceKm: Math.round(distKm * 10) / 10,
      elevationGainM: dPlus,
      plannedElevationGainM: planTarget?.elevationM || 0,
      elevationLossM: dMinus,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
      sessionCount: runningSessionsCount, // Count of prescribed plan running sessions
      plannedSessionCount: planTarget?.count || 0,
      bonusSessionCount: bonusWeekMap.get(wKey) || 0
    };
  });

  // Global aggregates - strictly centered on course à pied / trail
  const runningActivities = activeActivities.filter(a => isTrailOrRunning(a.type, a.name));
  const indicativeStrengthActs = activeActivities.filter(a => !isTrailOrRunning(a.type, a.name) && isStrengthOrCalisthenics(a.type, a.name));

  const totalDurationMinutes = runningActivities.reduce((acc, a) => acc + a.durationMinutes, 0);
  const totalSessionsCount = runningActivities.length;
  const indicativeStrengthMinutes = indicativeStrengthActs.reduce((acc, a) => acc + a.durationMinutes, 0);
  const indicativeStrengthCount = indicativeStrengthActs.length;

  const activeWeeksCount = Math.max(1, weeklyTrend.length);
  const weeklyAverageMinutes = Math.round(totalDurationMinutes / activeWeeksCount);

  // Progression calculation with explicit "Compared to what?"
  let weeklyProgressionPct = 0;
  let progressionStatus: GlobalStats['progressionStatus'] = 'STARTING';
  let progressionComparisonText = `Volume actuel : ${formatMinutes(totalDurationMinutes)} sur la première semaine du plan QMT.`;

  const curMondayKey = getMondayWeekKey(formatDateKey(asOfDate));

  if (scope.startsWith('week:')) {
    const mondayKey = scope.replace('week:', '');
    const planTarget = plannedWeekMap.get(mondayKey);
    const plannedMins = planTarget?.minutes || 0;
    const dDate = new Date(mondayKey + 'T12:00:00');
    const wLabel = `Semaine du ${dDate.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}`;

    if (plannedMins > 0) {
      const compliancePct = Math.round((totalDurationMinutes / plannedMins) * 100);
      weeklyProgressionPct = compliancePct;
      progressionStatus = compliancePct >= 85 ? 'SAFE_PROGRESSION' : (compliancePct >= 50 ? 'RECOVERY_MAINTENANCE' : 'STARTING');
      progressionComparisonText = `${wLabel} : ${formatMinutes(totalDurationMinutes)} réalisées sur ${formatMinutes(plannedMins)} prescrites (${compliancePct}% de conformité du volume).`;
    } else {
      progressionComparisonText = `${wLabel} : ${formatMinutes(totalDurationMinutes)} réalisées sur ${totalSessionsCount} séance(s).`;
    }
  } else if (weeklyTrend.length >= 2) {
    const curW = weeklyTrend[weeklyTrend.length - 1];
    const prevW = weeklyTrend[weeklyTrend.length - 2];
    const isCurWeekInProgress = curW.weekKey === curMondayKey;

    if (isCurWeekInProgress) {
      if (weeklyTrend.length >= 3) {
        // Compare the two previous completed weeks
        const lastComplete = weeklyTrend[weeklyTrend.length - 2];
        const prevComplete = weeklyTrend[weeklyTrend.length - 3];
        const diffMin = lastComplete.totalMinutes - prevComplete.totalMinutes;
        if (prevComplete.totalMinutes > 0) {
          weeklyProgressionPct = Math.round((diffMin / prevComplete.totalMinutes) * 100);
        }
        const lastRunMin = lastComplete.runningMinutes || 0;
        const prevRunMin = prevComplete.runningMinutes || 0;
        const runDiffMin = lastRunMin - prevRunMin;
        const runProgressionPct = prevRunMin > 0 ? Math.round((runDiffMin / prevRunMin) * 100) : 0;
        const lastLabel = lastComplete.weekLabel.replace('Sem. ', '');
        const prevLabel = prevComplete.weekLabel.replace('Sem. ', '');

        progressionComparisonText = `Semaines complètes : Sem. ${lastLabel} (${formatMinutes(lastComplete.totalMinutes)}) vs Sem. ${prevLabel} (${formatMinutes(prevComplete.totalMinutes)}) : ${diffMin >= 0 ? '+' : ''}${formatMinutes(Math.abs(diffMin))} (${weeklyProgressionPct > 0 ? '+' : ''}${weeklyProgressionPct}%). Semaine actuelle en cours (${formatMinutes(curW.totalMinutes)}).`;

        if (runProgressionPct > 20) {
          progressionStatus = 'OVERLOAD_WARNING';
        } else if (weeklyProgressionPct > 20 && runProgressionPct <= 10) {
          progressionStatus = 'SAFE_PROGRESSION';
        } else if (weeklyProgressionPct > 20) {
          progressionStatus = 'OVERLOAD_WARNING';
        } else if (weeklyProgressionPct >= 5) {
          progressionStatus = 'SAFE_PROGRESSION';
        } else {
          progressionStatus = 'RECOVERY_MAINTENANCE';
        }
      } else {
        // Only 1 completed week + current week in progress
        weeklyProgressionPct = 0;
        progressionStatus = 'STARTING';
        progressionComparisonText = `Semaine 1 complétée : ${formatMinutes(prevW.totalMinutes)}. Semaine 2 en cours : ${formatMinutes(curW.totalMinutes)} ce lundi.`;
      }
    } else {
      const diffMin = curW.totalMinutes - prevW.totalMinutes;
      if (prevW.totalMinutes > 0) {
        weeklyProgressionPct = Math.round((diffMin / prevW.totalMinutes) * 100);
      }
      const lastRunMin = curW.runningMinutes || 0;
      const prevRunMin = prevW.runningMinutes || 0;
      const runDiffMin = lastRunMin - prevRunMin;
      const runProgressionPct = prevRunMin > 0 ? Math.round((runDiffMin / prevRunMin) * 100) : 0;

      const curLabel = curW.weekLabel.replace('Sem. ', '');
      const prevLabel = prevW.weekLabel.replace('Sem. ', '');
      progressionComparisonText = `Volume sem. ${curLabel} (${formatMinutes(curW.totalMinutes)}) comparé à sem. ${prevLabel} (${formatMinutes(prevW.totalMinutes)}) : ${diffMin >= 0 ? '+' : ''}${formatMinutes(Math.abs(diffMin))} (${weeklyProgressionPct > 0 ? '+' : ''}${weeklyProgressionPct}%)`;

      if (runProgressionPct > 20) {
        progressionStatus = 'OVERLOAD_WARNING';
      } else if (weeklyProgressionPct > 20 && runProgressionPct <= 10) {
        progressionStatus = 'SAFE_PROGRESSION';
      } else if (weeklyProgressionPct > 20) {
        progressionStatus = 'OVERLOAD_WARNING';
      } else if (weeklyProgressionPct >= 5 && weeklyProgressionPct <= 20) {
        progressionStatus = 'SAFE_PROGRESSION';
      } else {
        progressionStatus = 'RECOVERY_MAINTENANCE';
      }
    }
  }

  // Sport breakdown
  let totalRunMin = 0;
  let runCount = 0;
  let totalStrengthMin = 0;
  let strengthCount = 0;
  let totalCrossMin = 0;
  let crossCount = 0;
  let totalOtherMin = 0;
  let otherCount = 0;

  for (const a of activeActivities) {
    if (a.type === 'RUNNING' || a.type === 'TRAIL_RUNNING') {
      totalRunMin += a.durationMinutes;
      runCount++;
    } else if (a.type === 'STRENGTH_TRAINING' || a.type === 'FITNESS_EQUIPMENT') {
      totalStrengthMin += a.durationMinutes;
      strengthCount++;
    } else if (a.type === 'CYCLING' || a.type === 'WALKING' || a.type === 'CLIMBING') {
      totalCrossMin += a.durationMinutes;
      crossCount++;
    } else {
      totalOtherMin += a.durationMinutes;
      otherCount++;
    }
  }

  const denom = (totalRunMin + totalStrengthMin + totalCrossMin + totalOtherMin) || 1;
  const sportBreakdown = {
    running: {
      minutes: totalRunMin,
      pct: Math.round((totalRunMin / denom) * 100),
      count: runCount
    },
    strength: {
      minutes: totalStrengthMin,
      pct: Math.round((totalStrengthMin / denom) * 100),
      count: strengthCount
    },
    crossTraining: {
      minutes: totalCrossMin,
      pct: Math.round((totalCrossMin / denom) * 100),
      count: crossCount
    },
    other: {
      minutes: totalOtherMin,
      pct: Math.round((totalOtherMin / denom) * 100),
      count: otherCount
    }
  };

  const global: GlobalStats = {
    totalDurationMinutes,
    totalSessionsCount,
    activeWeeksCount,
    weeklyAverageMinutes,
    weeklyProgressionPct,
    progressionStatus,
    progressionComparisonText,
    sportBreakdown,
    weeklyTrend,
    excludedBonusCount,
    excludedBonusMinutes,
    isFilteringBonuses: !includeBonusActivities,
    indicativeStrengthMinutes,
    indicativeStrengthCount
  };

  // Running Deep-Dive
  const runActivities = activeActivities.filter(a => a.type === 'RUNNING' || a.type === 'TRAIL_RUNNING');
  let runDistTotal = 0;
  let runElevGainTotal = 0;
  let runElevLossTotal = 0;
  let totalPaceTimeWeighted = 0;
  let paceTimeWeight = 0;
  let cadenceSum = 0;
  let cadenceCount = 0;

  let longestRun: RunningStats['longestRun'] = null;
  let maxElevationRun: RunningStats['maxElevationRun'] = null;

  let z2Min = 0;
  let zTempoMin = 0;
  let zMaxMin = 0;

  for (const r of runActivities) {
    runDistTotal += r.distanceKm;
    runElevGainTotal += r.elevationGainM;
    runElevLossTotal += r.elevationLossM;

    if (!longestRun || r.distanceKm > longestRun.distanceKm) {
      longestRun = {
        distanceKm: Math.round(r.distanceKm * 10) / 10,
        durationMinutes: r.durationMinutes,
        date: r.date,
        name: r.name
      };
    }

    if (!maxElevationRun || r.elevationGainM > maxElevationRun.elevationGainM) {
      maxElevationRun = {
        elevationGainM: r.elevationGainM,
        distanceKm: Math.round(r.distanceKm * 10) / 10,
        durationMinutes: r.durationMinutes,
        date: r.date,
        name: r.name
      };
    }

    if (r.avgPaceSecPerKm && r.avgPaceSecPerKm > 0) {
      totalPaceTimeWeighted += r.avgPaceSecPerKm * r.durationMinutes;
      paceTimeWeight += r.durationMinutes;
    }

    if (r.avgCadence && r.avgCadence > 0) {
      cadenceSum += r.avgCadence;
      cadenceCount++;
    }

    // Heart rate zone breakdown
    if (r.avgHeartRate) {
      if (r.avgHeartRate < 155) {
        z2Min += r.durationMinutes;
      } else if (r.avgHeartRate <= 175) {
        zTempoMin += r.durationMinutes;
      } else {
        zMaxMin += r.durationMinutes;
      }
    } else {
      z2Min += r.durationMinutes * 0.75;
      zTempoMin += r.durationMinutes * 0.20;
      zMaxMin += r.durationMinutes * 0.05;
    }
  }

  const runDurationTotal = totalRunMin;
  const avgPaceSec = paceTimeWeight > 0 ? totalPaceTimeWeighted / paceTimeWeight : 0;
  const avgPaceMinKm = formatPace(avgPaceSec);
  const avgCadenceSpm = cadenceCount > 0 ? Math.round(cadenceSum / cadenceCount) : 166;
  const elevationDensityMPerKm = runDistTotal > 0 ? Math.round(runElevGainTotal / runDistTotal) : 0;
  const densityComparisonText = `${elevationDensityMPerKm} m D+/km actuel comparé aux 44 m D+/km requis sur le QMT-80 (${Math.min(100, Math.round((elevationDensityMPerKm / 44) * 100))}% de spécificité montagne atteinte)`;

  const totalZoneMin = z2Min + zTempoMin + zMaxMin || 1;
  const intensityDistribution: RunningStats['intensityDistribution'] = {
    zone2EnduranceMinutes: Math.round(z2Min),
    zone2Pct: Math.round((z2Min / totalZoneMin) * 100),
    zoneTempoThresholdMinutes: Math.round(zTempoMin),
    zoneTempoThresholdPct: Math.round((zTempoMin / totalZoneMin) * 100),
    zoneMaxMinutes: Math.round(zMaxMin),
    zoneMaxPct: Math.round((zMaxMin / totalZoneMin) * 100)
  };

  const running: RunningStats = {
    totalDistanceKm: Math.round(runDistTotal * 10) / 10,
    totalDurationMinutes: runDurationTotal,
    totalElevationGainM: runElevGainTotal,
    totalElevationLossM: runElevLossTotal,
    elevationDensityMPerKm,
    densityComparisonText,
    avgPaceMinKm,
    avgCadenceSpm,
    longestRun,
    maxElevationRun,
    intensityDistribution
  };

  // Strength Deep-Dive
  const strengthActivities = activeActivities.filter(a => a.type === 'STRENGTH_TRAINING' || a.type === 'FITNESS_EQUIPMENT');
  let calisthenicsMin = 0;
  let gymForceMin = 0;
  let coreMobilityMin = 0;

  for (const s of strengthActivities) {
    const lowerName = s.name.toLowerCase();
    if (lowerName.includes('calisth') || lowerName.includes('poids du corps')) {
      calisthenicsMin += s.durationMinutes;
    } else if (lowerName.includes('mobil') || lowerName.includes('gainage') || lowerName.includes('étir')) {
      coreMobilityMin += s.durationMinutes;
    } else {
      gymForceMin += s.durationMinutes;
    }
  }

  const weeklyStrengthFrequency = Math.round((strengthCount / activeWeeksCount) * 10) / 10;
  const strengthToRunRatioPct = totalRunMin > 0 ? Math.round((totalStrengthMin / totalRunMin) * 100) : 100;

  let quadArmorScore = Math.min(100, Math.round(weeklyStrengthFrequency * 35 + (runElevLossTotal > 1500 ? 30 : (runElevLossTotal / 1500) * 30)));
  if (strengthActivities.length === 0 && runActivities.length === 0) {
    quadArmorScore = 50;
  }

  let quadArmorRating: StrengthStats['quadArmorRating'] = 'Initiale';
  if (quadArmorScore >= 75) quadArmorRating = 'Optimale';
  else if (quadArmorScore >= 45) quadArmorRating = 'En construction';

  const strength: StrengthStats = {
    totalDurationMinutes: totalStrengthMin,
    totalSessionsCount: strengthCount,
    weeklyFrequency: weeklyStrengthFrequency,
    categoryBreakdown: {
      calisthenicsMinutes: calisthenicsMin,
      gymForceMinutes: gymForceMin,
      coreMobilityMinutes: coreMobilityMin
    },
    strengthToRunRatioPct,
    quadArmorScore,
    quadArmorRating,
    streakWeeks: weeklyTrend.filter(w => w.strengthMinutes > 0).length
  };

  // Heart Rate Trends ("is my average heart rate going down? Compared to what?")
  // 1. Calculate Historical Pre-Plan Baseline (avril - août 2026)
  const prePlanActs = rawList.filter(a => a.isPrePlan && a.avgHeartRate && a.avgHeartRate > 0);
  let historicalPrePlanAvgHr: number | null = null;
  if (prePlanActs.length > 0) {
    const preHrDur = prePlanActs.reduce((s, a) => s + (a.avgHeartRate! * a.durationMinutes), 0);
    const preDur = prePlanActs.reduce((s, a) => s + a.durationMinutes, 0);
    historicalPrePlanAvgHr = preDur > 0 ? Math.round(preHrDur / preDur) : null;
  }

  // 2. Calculate Heart Rate on active scoped activities
  const weeksWithHr = weeklyTrend.filter(w => w.avgHeartRate !== null && w.avgHeartRate > 0);
  let currentAvgHeartRate: number | null = null;
  let previousAvgHeartRate: number | null = null;
  let heartRateDeltaBpm: number | null = null;
  let heartRateTrend: HeartRateStats['heartRateTrend'] = 'INSUFFICIENT_DATA';
  let aerobicEfficiencyIndex: number | null = null;
  let aerobicEfficiencyDeltaPct: number | null = null;
  let hrSummaryText = "Synchronisez plusieurs séances avec cardio-fréquencemètre pour afficher la tendance.";
  let comparisonBaselineText = "En attente de données cardio comparatives.";

  if (weeksWithHr.length >= 2) {
    const mid = Math.floor(weeksWithHr.length / 2);
    const olderWeeks = weeksWithHr.slice(0, mid);
    const newerWeeks = weeksWithHr.slice(mid);

    const oldHr = Math.round(olderWeeks.reduce((s, w) => s + (w.avgHeartRate || 0), 0) / olderWeeks.length);
    const newHr = Math.round(newerWeeks.reduce((s, w) => s + (w.avgHeartRate || 0), 0) / newerWeeks.length);

    currentAvgHeartRate = newHr;
    previousAvgHeartRate = oldHr;
    heartRateDeltaBpm = newHr - oldHr;

    if (heartRateDeltaBpm <= -2) {
      heartRateTrend = 'DECREASING';
      hrSummaryText = `🎉 Excellente adaptation aérobie : Fréquence cardiaque moyenne en baisse de ${Math.abs(heartRateDeltaBpm)} bpm. Votre cœur travaille plus efficacement à allure égale.`;
    } else if (heartRateDeltaBpm >= 3) {
      heartRateTrend = 'INCREASING';
      hrSummaryText = `Attention : FC moyenne en hausse de +${heartRateDeltaBpm} bpm. Surveillez la fatigue accumulée, le sommeil ou l'intensité des sorties.`;
    } else {
      heartRateTrend = 'STABLE';
      hrSummaryText = `FC aérobie stable (variation de ${heartRateDeltaBpm > 0 ? '+' : ''}${heartRateDeltaBpm} bpm). Votre socle d'endurance de base est bien en place.`;
    }

    const baselineLabel = historicalPrePlanAvgHr
      ? `la période pré-plan avril-août (${historicalPrePlanAvgHr} bpm)`
      : `les séances initiales de reprise de début septembre (${oldHr} bpm)`;
    const refHr = historicalPrePlanAvgHr || oldHr;
    const diff = newHr - refHr;

    comparisonBaselineText = `${newHr} bpm actuellement comparé à ${baselineLabel} : ${diff < 0 ? 'Baisse de ' + Math.abs(diff) + ' bpm' : (diff > 0 ? 'Hausse de +' + diff + ' bpm' : 'Stable')}`;

    // Aerobic Efficiency Index (Speed in m/min / HR)
    if (avgPaceSec > 0 && currentAvgHeartRate > 0) {
      const speedMPerMin = 1000 / (avgPaceSec / 60);
      aerobicEfficiencyIndex = Math.round((speedMPerMin / currentAvgHeartRate) * 100) / 100;
      if (diff < 0) {
        aerobicEfficiencyDeltaPct = Math.round((Math.abs(diff) / refHr) * 100);
      }
    }
  } else if (weeksWithHr.length === 1) {
    currentAvgHeartRate = weeksWithHr[0].avgHeartRate;
    if (historicalPrePlanAvgHr && currentAvgHeartRate) {
      previousAvgHeartRate = historicalPrePlanAvgHr;
      heartRateDeltaBpm = currentAvgHeartRate - historicalPrePlanAvgHr;
      heartRateTrend = heartRateDeltaBpm <= -2 ? 'DECREASING' : (heartRateDeltaBpm >= 3 ? 'INCREASING' : 'STABLE');
      comparisonBaselineText = `${currentAvgHeartRate} bpm sur le plan QMT comparé à ${historicalPrePlanAvgHr} bpm en pré-plan (avril - août) : ${heartRateDeltaBpm < 0 ? 'Baisse de ' + Math.abs(heartRateDeltaBpm) + ' bpm' : 'Hausse de +' + heartRateDeltaBpm + ' bpm'}`;
      hrSummaryText = heartRateDeltaBpm <= -2
        ? `Baisse de ${Math.abs(heartRateDeltaBpm)} bpm observée par rapport à votre moyenne pré-plan (avril - août).`
        : `FC moyenne actuelle : ${currentAvgHeartRate} bpm.`;
    } else {
      heartRateTrend = 'STABLE';
      comparisonBaselineText = `FC moyenne actuelle : ${currentAvgHeartRate} bpm sur la semaine active.`;
      hrSummaryText = `FC moyenne de reprise : ${currentAvgHeartRate} bpm. Poursuivez l'enregistrement pour mesurer la baisse au fil des semaines.`;
    }
  }

  let scopedHrSum = 0;
  let scopedHrDuration = 0;
  for (const a of activeActivities) {
    if (a.avgHeartRate && a.avgHeartRate > 0) {
      scopedHrSum += a.avgHeartRate * a.durationMinutes;
      scopedHrDuration += a.durationMinutes;
    }
  }
  const overallPeriodAvgHr = scopedHrDuration > 0 ? Math.round(scopedHrSum / scopedHrDuration) : currentAvgHeartRate;

  const heartRate: HeartRateStats = {
    currentAvgHeartRate,
    previousAvgHeartRate,
    heartRateDeltaBpm,
    heartRateTrend,
    aerobicEfficiencyIndex,
    aerobicEfficiencyDeltaPct,
    summaryText: hrSummaryText,
    comparisonBaselineText,
    historicalPrePlanAvgHr,
    overallPeriodAvgHr
  };

  // Training Load & Fatigue (CTL / ATL / TSB / ACWR)
  // Physiological load & ACWR must ALWAYS be evaluated on the complete 90-day history (rawList)
  // regardless of the display timeline scope, preserving the 42-day CTL decay and 28-day chronic baseline.
  const trainingLoad = computeTrainingLoadStats(rawList, asOfDate, 90);

  // Trail-specific metrics (D-, VAM, GAP)
  const trailSpecific = computeTrailSpecificStats(runActivities);

  // Dynamic QMT-80 Race Time Predictor (incorporates GAP & trail specific terrain)
  const qmtPrediction = calculateQmtRacePrediction(running, strength, heartRate, global, trainingLoad, trailSpecific);

  return {
    scope,
    global,
    running,
    strength,
    heartRate,
    trainingLoad,
    trailSpecific,
    qmtPrediction
  };
}
