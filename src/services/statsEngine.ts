import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import { getGarminLocalDateKey, getMondayWeekKey } from './comparisonEngine';
import { formatDateKey } from './icsParser';
import { GLOBAL_APP_CONFIG } from './periodizationEngine';

/**
 * Official start date of the preparation (reprise & fondations).
 * Linked to GLOBAL_APP_CONFIG.SPORT_START_DATE.
 */
export const PLAN_START_DATE = GLOBAL_APP_CONFIG.SPORT_START_DATE || '2026-09-01';

/**
 * Standard default weekly targets when no planned session is scheduled.
 */
export const DEFAULT_WEEKLY_TARGETS = {
  plannedDurationMin: 285,
  plannedElevationM: 780
};

export type TimeRangeScope = 'plan' | '4w' | '12w' | 'all' | (string & {});

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

export interface AidStationSplit {
  name: string;
  km: number;
  elevationGainM: number;
  splitMinutes: number;
  elapsedMinutes: number;
  elapsedFormatted: string;
  paceMinKm: string;
  notes: string;
}

export interface QmtRacePrediction {
  targetRaceName: string;
  officialDistanceKm: number;
  officialElevationGainM: number;
  officialCutoffMinutes: number;
  predictedMinutes: number;
  baselinePredictedMinutes: number;
  ambitiousMinutes: number;
  conservativeMinutes: number;
  evolutionDeltaMinutes: number;
  cutoffMarginMinutes: number;
  factors: {
    volumeScore: number;
    aerobicPaceScore: number;
    strengthArmorScore: number;
    downhillResistanceImpactMin: number;
  };
  aidStationSplits: AidStationSplit[];
  predictionAnalysis: string;
  evolutionComparisonText: string;
}

export interface FitnessDayPoint {
  date: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "5 sept."
  ctl: number; // Fitness (42-day EWMA)
  atl: number; // Fatigue (7-day EWMA)
  tsb: number; // Form (CTL - ATL)
  dailyLoad: number;
}

export interface TrainingLoadStats {
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  formStatus: 'OPTIMAL_BUILD' | 'RACE_PEAK' | 'TRANSITION_FRESH' | 'FATIGUED' | 'HIGH_OVERLOAD';
  formLabel: string;
  acwrRatio: number;
  acwrStatus: 'UNDERLOAD' | 'OPTIMAL' | 'MODERATE_RISK' | 'DANGER_HIGH_RISK' | 'CALIBRATING';
  acwrStatusLabel?: string;
  acwrLabel: string;
  acwrActionAdvice?: string;
  isCalibrating?: boolean;
  acuteLoad7d: number;
  chronicLoad28dWeeklyAvg: number;
  fitnessTrend: FitnessDayPoint[];
  trailAcwrRatio: number;
  trailAcuteLoad7d: number;
  trailChronicLoad28dWeeklyAvg: number;
  trailAcwrStatus: 'UNDERLOAD' | 'OPTIMAL' | 'MODERATE_RISK' | 'DANGER_HIGH_RISK' | 'CALIBRATING';
  calisthenicsAcuteLoad7d: number;
  calisthenicsSessionsCount7d: number;
  totalSystemicAcuteLoad7d: number;
}

export interface TrailSpecificStats {
  totalElevationLossM: number;
  avgVamMPerHour: number;
  maxVamMPerHour: number;
  downhillStressScore: number;
  downhillStressLabel: string;
  gradeAdjustedPaceMinKm: string;
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
 * Formats a duration in minutes to "Xh YYm" or "X min".
 */
export function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Formats pace in seconds/km to "M:SS /km".
 */
export function formatPace(paceSecPerKm: number): string {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm)) return '-';
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}/km`;
}

/**
 * Parses pace string like "5:30" or "5:30/km" into seconds per km.
 */
export function parsePaceStringToSeconds(paceStr?: string): number | null {
  if (!paceStr) return null;
  const match = paceStr.match(/(\d+):(\d+)/);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  return m * 60 + s;
}

/**
 * Filter activities and calendar events by the requested time window scope.
 */
export function filterItemsByScope<T extends { date: string }>(
  items: T[],
  scope: TimeRangeScope,
  asOfDate: Date = new Date()
): T[] {
  // 1. Specific week scope: 'week:YYYY-MM-DD' (from Monday to Sunday)
  if (scope.startsWith('week:')) {
    const mondayKey = scope.replace('week:', '');
    const monDate = new Date(mondayKey + 'T12:00:00');
    const sunDate = new Date(monDate);
    sunDate.setDate(monDate.getDate() + 6);
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
  const plannedWeekMap = new Map<string, { minutes: number; elevationM: number; count: number }>();
  for (const ev of _plannedEvents) {
    if (ev.category === 'sport' && !ev.metadata?.isPostponedPlaceholder) {
      const dKey = ev.startDate.slice(0, 10);
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
    let totalMin = 0;
    let runMin = 0;
    let strengthMin = 0;
    let otherMin = 0;
    let distKm = 0;
    let dPlus = 0;
    let dMinus = 0;
    let hrSum = 0;
    let hrCount = 0;

    for (const a of acts) {
      totalMin += a.durationMinutes;
      dPlus += a.elevationGainM;
      dMinus += a.elevationLossM;
      distKm += a.distanceKm;

      if (a.avgHeartRate && a.avgHeartRate > 0) {
        hrSum += a.avgHeartRate * a.durationMinutes;
        hrCount += a.durationMinutes;
      }

      if (a.type === 'RUNNING' || a.type === 'TRAIL_RUNNING') {
        runMin += a.durationMinutes;
      } else if (a.type === 'STRENGTH_TRAINING' || a.type === 'FITNESS_EQUIPMENT') {
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
      totalMinutes: totalMin,
      plannedMinutes: planTarget?.minutes || 0,
      runningMinutes: runMin,
      strengthMinutes: strengthMin,
      otherMinutes: otherMin,
      distanceKm: Math.round(distKm * 10) / 10,
      elevationGainM: dPlus,
      plannedElevationGainM: planTarget?.elevationM || 0,
      elevationLossM: dMinus,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
      sessionCount: acts.length,
      plannedSessionCount: planTarget?.count || 0,
      bonusSessionCount: bonusWeekMap.get(wKey) || 0
    };
  });

  // Global aggregates
  const totalDurationMinutes = activeActivities.reduce((acc, a) => acc + a.durationMinutes, 0);
  const totalSessionsCount = activeActivities.length;
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

  const denom = totalDurationMinutes || 1;
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
    isFilteringBonuses: !includeBonusActivities
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

/**
 * Calcule la charge physiologique individuelle d'une séance (en TRIMP)
 * et détermine si elle engendre des impacts articulaires mécaniques (Course/Trail)
 * ou s'il s'agit de renforcement/calisthénie sans choc au sol.
 */
export function calculateSessionTrimp(
  durationMinutes: number,
  typeOrSportType?: string,
  name?: string,
  garminLoad?: number | null
): {
  trimp: number;
  isMechanicalImpact: boolean;
  factor: number;
  categoryLabel: string;
  formulaText: string;
} {
  const dur = Math.max(0, durationMinutes || 0);
  const actType = String(typeOrSportType || '').toUpperCase();
  const actName = String(name || '').toLowerCase();

  const isCalisthenics =
    actType === 'STRENGTH_TRAINING' ||
    actType === 'FITNESS_EQUIPMENT' ||
    actType === 'CALISTHENICS' ||
    actType === 'GYM_FORCE' ||
    actName.includes('calisth') ||
    actName.includes('muscu') ||
    actName.includes('force') ||
    actName.includes('dips') ||
    actName.includes('traction') ||
    actName.includes('gainage');

  const isTrailOrRunning =
    actType === 'TRAIL_RUNNING' ||
    actType === 'TRAIL_INTENSE' ||
    actType === 'TRAIL_LONG' ||
    actType === 'RUNNING' ||
    actType === 'RUN_EASY' ||
    actType === 'RUN_TEMPO' ||
    actName.includes('trail') ||
    actName.includes('côtes') ||
    actName.includes('footing') ||
    (actName.includes('course') && !actName.includes('cours') && !actName.includes('calisth'));

  if (typeof garminLoad === 'number' && garminLoad > 0) {
    const isImpact = isTrailOrRunning && !isCalisthenics;
    return {
      trimp: Math.round(garminLoad),
      isMechanicalImpact: isImpact,
      factor: 1.0,
      categoryLabel: isImpact ? 'Impact Trail & Course' : (isCalisthenics ? 'Calisthénie (Sans impact)' : 'Activité générale'),
      formulaText: `Charge EPOC Garmin : ${Math.round(garminLoad)} TRIMP`
    };
  }

  let factor = 1.0;
  let categoryLabel = 'Endurance générale';

  if (actType === 'TRAIL_RUNNING' || actType === 'TRAIL_INTENSE' || actType === 'TRAIL_LONG' || actName.includes('trail') || actName.includes('côtes')) {
    factor = 1.35;
    categoryLabel = 'Trail & Côtes (Impact excentrique élevé)';
  } else if (actType === 'RUNNING' || actType === 'RUN_EASY' || actType === 'RUN_TEMPO' || actName.includes('footing') || actName.includes('course')) {
    factor = 1.15;
    categoryLabel = 'Course sur plat (Impact modéré)';
  } else if (isCalisthenics) {
    factor = 0.85;
    categoryLabel = 'Calisthénie & Force (Zéro onde de choc articulaire)';
  } else {
    factor = 0.75;
    categoryLabel = 'Récupération active & Mobilité';
  }

  const trimp = Math.round(dur * factor * 0.8);
  const isMechanicalImpact = isTrailOrRunning && !isCalisthenics;

  return {
    trimp,
    isMechanicalImpact,
    factor,
    categoryLabel,
    formulaText: `${dur} min × facteur ${factor} × 0.8 = ${trimp} TRIMP`
  };
}

/**
 * Computes Chronic Training Load (CTL), Acute Training Load (ATL),
 * Training Stress Balance (TSB), and Acute:Chronic Workload Ratio (ACWR).
 * Note: ACWR for injury risk is computed strictly on Trail & Running activities,
 * excluding calisthenics and strength training to avoid false overload alerts.
 */
export function computeTrainingLoadStats(
  activities: Array<any>,
  asOfDate: Date = new Date(),
  daysToAnalyze: number = 60
): TrainingLoadStats {
  const dailyLoads: Record<string, number> = {};
  const dailyTrailLoads: Record<string, number> = {};
  const dailyCalisthenicsLoads: Record<string, number> = {};
  const calisthenicsSessionsByDay: Record<string, number> = {};

  for (const act of activities) {
    const dKey = act.date || (act.startTimeLocal ? getGarminLocalDateKey(act) : formatDateKey(new Date()));
    const dur = act.durationMinutes || 0;
    const actType = String(act.activityType || act.type || '');
    const actName = String(act.name || act.activityName || '');

    const sessionInfo = calculateSessionTrimp(dur, actType, actName, act.trainingLoad);
    const load = sessionInfo.trimp;

    // Systemic whole-body load (CTL, ATL, TSB)
    dailyLoads[dKey] = (dailyLoads[dKey] || 0) + load;

    // Musculoskeletal mechanical impact load (Trail & Running exclusively)
    if (sessionInfo.isMechanicalImpact) {
      dailyTrailLoads[dKey] = (dailyTrailLoads[dKey] || 0) + load;
    } else {
      dailyCalisthenicsLoads[dKey] = (dailyCalisthenicsLoads[dKey] || 0) + load;
      calisthenicsSessionsByDay[dKey] = (calisthenicsSessionsByDay[dKey] || 0) + 1;
    }
  }

  const fitnessTrend: FitnessDayPoint[] = [];
  let prevCtl = 0;
  let prevAtl = 0;

  const warmupDays = 35;
  const totalDays = daysToAnalyze + warmupDays;
  const startDay = new Date(asOfDate);
  startDay.setDate(asOfDate.getDate() - totalDays);

  const ctlDecay = Math.exp(-1 / 42);
  const atlDecay = Math.exp(-1 / 7);

  for (let i = 0; i <= totalDays; i++) {
    const cur = new Date(startDay);
    cur.setDate(startDay.getDate() + i);
    const dateKey = formatDateKey(cur);
    const dayLoad = dailyLoads[dateKey] || 0;

    const currentCtl = Math.round((prevCtl * ctlDecay + dayLoad * (1 - ctlDecay)) * 10) / 10;
    const currentAtl = Math.round((prevAtl * atlDecay + dayLoad * (1 - atlDecay)) * 10) / 10;
    const currentTsb = Math.round((currentCtl - currentAtl) * 10) / 10;

    prevCtl = currentCtl;
    prevAtl = currentAtl;

    if (i >= warmupDays) {
      fitnessTrend.push({
        date: dateKey,
        dateLabel: cur.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }),
        ctl: currentCtl,
        atl: currentAtl,
        tsb: currentTsb,
        dailyLoad: dayLoad
      });
    }
  }

  const latestPoint = fitnessTrend[fitnessTrend.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
  const currentCtl = latestPoint.ctl;
  const currentAtl = latestPoint.atl;
  const currentTsb = latestPoint.tsb;

  // Trail-specific ACWR (Gabbett model applied exclusively to mechanical ground impact)
  // Calisthenics is strictly excluded from injury risk to prevent false positives.
  let trailAcuteSum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(asOfDate);
    d.setDate(asOfDate.getDate() - i);
    trailAcuteSum += (dailyTrailLoads[formatDateKey(d)] || 0);
  }

  let trailChronicSum = 0;
  let trailActiveDaysInLast28 = 0;
  for (let i = 0; i < 28; i++) {
    const d = new Date(asOfDate);
    d.setDate(asOfDate.getDate() - i);
    const dLoad = dailyTrailLoads[formatDateKey(d)] || 0;
    trailChronicSum += dLoad;
    if (dLoad > 0) trailActiveDaysInLast28++;
  }
  const trailChronicWeeklyAvg = Math.max(15, Math.round(trailChronicSum / 4));
  const trailAcwrRatio = Math.round((trailAcuteSum / trailChronicWeeklyAvg) * 100) / 100;

  // Calisthenics & Strength metrics over last 7 days (non-impact)
  let calisthenicsAcuteSum = 0;
  let calisthenicsSessionsCount7d = 0;
  let totalSystemicAcuteSum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(asOfDate);
    d.setDate(asOfDate.getDate() - i);
    const dKey = formatDateKey(d);
    calisthenicsAcuteSum += (dailyCalisthenicsLoads[dKey] || 0);
    calisthenicsSessionsCount7d += (calisthenicsSessionsByDay[dKey] || 0);
    totalSystemicAcuteSum += (dailyLoads[dKey] || 0);
  }

  // Detect calibration/cold-start: when trail chronic history has very few recorded trail days
  const isCalibrating = trailActiveDaysInLast28 < 4 && trailAcuteSum > 0;

  let acwrStatus: TrainingLoadStats['acwrStatus'] = 'OPTIMAL';
  let acwrLabel = 'Zone Optimale Trail (0.8 - 1.3) : Progression saine et risque de blessure articulaire minimal. Calisthénie bien tolérée.';
  let acwrActionAdvice = 'Charge d\'impact Trail parfaitement assimilée. Poursuivez sur cette régularité.';

  if (isCalibrating && trailAcwrRatio > 1.4) {
    acwrStatus = 'CALIBRATING';
    acwrLabel = 'Reprise / Calibration Trail : Données chroniques de course (28j) en cours d\'accumulation suite à la reprise. Calisthénie exclue.';
    acwrActionAdvice = 'Privilégiez 80% de votre volume en endurance fondamentale (Zone 2) et veillez à vos jours de repos.';
  } else if (trailAcwrRatio < 0.8) {
    acwrStatus = 'UNDERLOAD';
    acwrLabel = 'Sous-charge Trail (< 0.8) : Stimulus mécanique de course allégé ou période de récupération active.';
    acwrActionAdvice = 'Pieds et tendons frais. Profitez-en pour le renforcement postural et la mobilité.';
  } else if (trailAcwrRatio > 1.5) {
    acwrStatus = 'DANGER_HIGH_RISK';
    acwrLabel = 'Zone Critique Trail (> 1.5) : Augmentation rapide du volume d\'impact course (+50% vs moyenne sur 4 semaines). Risque tendineux élevé.';
    acwrActionAdvice = 'Allégez la prochaine séance de côtes ou écourtez la sortie longue. Maintenez la calisthénie sans chocs.';
  } else if (trailAcwrRatio > 1.3) {
    acwrStatus = 'MODERATE_RISK';
    acwrLabel = 'Zone d\'Attention Trail (1.3 - 1.5) : Montée de charge mécanique soutenue. Surveillez mollets et tendons.';
    acwrActionAdvice = 'Maintenez les allures d\'endurance sans forcer et surveillez les courbatures.';
  }

  let formStatus: TrainingLoadStats['formStatus'] = 'OPTIMAL_BUILD';
  let formLabel = 'Phase de développement optimale (Charge bien assimilée)';
  if (currentTsb > 15) {
    formStatus = 'RACE_PEAK';
    formLabel = 'Pic de Fraîcheur Course (Fraîcheur maximale, prêt pour le départ)';
  } else if (currentTsb > 5) {
    formStatus = 'TRANSITION_FRESH';
    formLabel = 'Très frais (Période d\'assimilation ou reprise)';
  } else if (currentTsb < -25) {
    formStatus = 'HIGH_OVERLOAD';
    formLabel = 'Surmenage / Fatigue sévère (Délestage nécessaire)';
  } else if (currentTsb < -10) {
    formStatus = 'FATIGUED';
    formLabel = 'Fatigue productive accumulée (Bloc en cours)';
  }

  const acwrStatusLabel = acwrStatus === 'OPTIMAL'
    ? 'Sweet Spot Optimal (Trail)'
    : (acwrStatus === 'CALIBRATING'
      ? 'Calibration Trail'
      : (acwrStatus === 'UNDERLOAD'
        ? 'Sous-charge Trail'
        : (acwrStatus === 'DANGER_HIGH_RISK'
          ? 'Pic de Charge Trail Élevé'
          : 'Charge Trail Soutenue')));

  return {
    currentCtl,
    currentAtl,
    currentTsb,
    formStatus,
    formLabel,
    acwrRatio: trailAcwrRatio,
    acwrStatus,
    acwrStatusLabel,
    acwrLabel,
    acwrActionAdvice,
    isCalibrating,
    acuteLoad7d: trailAcuteSum,
    chronicLoad28dWeeklyAvg: trailChronicWeeklyAvg,
    fitnessTrend,
    trailAcwrRatio,
    trailAcuteLoad7d: trailAcuteSum,
    trailChronicLoad28dWeeklyAvg: trailChronicWeeklyAvg,
    trailAcwrStatus: acwrStatus,
    calisthenicsAcuteLoad7d: calisthenicsAcuteSum,
    calisthenicsSessionsCount7d,
    totalSystemicAcuteLoad7d: totalSystemicAcuteSum
  };
}

/**
 * Computes trail specific metrics: Elevation loss D-, VAM (m/h), and Grade Adjusted Pace (GAP).
 */
export function computeTrailSpecificStats(
  runActivities: Array<{
    elevationLossM?: number;
    elevationGainM?: number;
    distanceKm?: number;
    durationMinutes?: number;
    avgPaceSecPerKm?: number | null;
    avgHeartRate?: number | null;
  }>
): TrailSpecificStats {
  let totalDMinus = 0;
  let vamSum = 0;
  let vamCount = 0;
  let maxVam = 0;

  let totalMovingSec = 0;
  let totalDistKm = 0;
  let totalDPlus = 0;

  for (const act of runActivities) {
    if (act.elevationLossM) totalDMinus += act.elevationLossM;
    if (act.elevationGainM) totalDPlus += act.elevationGainM;
    if (act.distanceKm) totalDistKm += act.distanceKm;

    const durMin = act.durationMinutes || 0;
    const movingSec = durMin * 60;
    totalMovingSec += movingSec;

    if (act.elevationGainM && act.elevationGainM >= 70 && durMin >= 15) {
      const actVam = Math.round((act.elevationGainM / durMin) * 60);
      if (actVam > 150 && actVam < 2000) {
        vamSum += actVam;
        vamCount++;
        if (actVam > maxVam) maxVam = actVam;
      }
    }
  }

  const avgVamMPerHour = vamCount > 0 ? Math.round(vamSum / vamCount) : 480;
  const maxVamMPerHour = maxVam > 0 ? maxVam : avgVamMPerHour;

  let gradeAdjustedPaceMinKm = '-';
  if (totalDistKm > 0.5 && totalMovingSec > 60) {
    const rawPaceSecPerKm = totalMovingSec / totalDistKm;
    const avgSlopePct = Math.min(25, (totalDPlus / (totalDistKm * 1000)) * 100);
    const gapFactor = 1 + (avgSlopePct * 0.035);
    const gapPaceSec = Math.round(rawPaceSecPerKm / gapFactor);
    gradeAdjustedPaceMinKm = formatPace(gapPaceSec);
  }

  const downhillStressScore = Math.min(100, Math.round((totalDMinus / 2500) * 100));
  let downhillStressLabel = 'Conditionnement initial des quadriceps';
  if (downhillStressScore >= 80) downhillStressLabel = 'Excellente tolérance excentrique aux descentes raides';
  else if (downhillStressScore >= 50) downhillStressLabel = 'Adaptation en cours (continuer les descentes régulières)';

  return {
    totalElevationLossM: totalDMinus,
    avgVamMPerHour,
    maxVamMPerHour,
    downhillStressScore,
    downhillStressLabel,
    gradeAdjustedPaceMinKm
  };
}

/**
 * Dynamic QMT-80 finish time calculator.
 * Ultra-trail model using flat-equivalent distance + mountain fatigue factor,
 * adjusted dynamically based on athlete's volume, aerobic efficiency, and strength training quad armor.
 */
export function calculateQmtRacePrediction(
  running: RunningStats,
  strength: StrengthStats,
  heartRate: HeartRateStats,
  global: GlobalStats,
  trainingLoad?: TrainingLoadStats,
  trailSpecific?: TrailSpecificStats
): QmtRacePrediction {
  const officialDistanceKm = 77;
  const officialElevationGainM = 3370;
  const officialCutoffMinutes = 19 * 60; // 1,140 min

  // Baseline standard finisher expectation for a regular amateur on the rugged QMT-80: 13h30 (810 min)
  let basePredictionMin = 810;
  const baselinePredictedMinutes = 820; // ~13h40 au lancement du plan le 1er sept. 2026

  // 1. Aerobic Pace Factor (Adaptive Grade-Adjusted Pace for mountain terrain)
  const rawPaceSec = parsePaceStringToSeconds(running.avgPaceMinKm) || (5 * 60 + 30);
  const gapPaceSec = parsePaceStringToSeconds(trailSpecific?.gradeAdjustedPaceMinKm);
  // When running on mountain trails (density >= 25 m/km), use GAP to avoid penalizing technical climbs
  const paceSec = (running.elevationDensityMPerKm >= 25 && gapPaceSec) ? gapPaceSec : rawPaceSec;
  let aerobicPaceScore = 70;

  if (paceSec < 5 * 60) {
    basePredictionMin -= 40;
    aerobicPaceScore = 90;
  } else if (paceSec < 5 * 60 + 45) {
    basePredictionMin -= 20;
    aerobicPaceScore = 80;
  } else if (paceSec > 6 * 60 + 30 && running.elevationDensityMPerKm < 35) {
    basePredictionMin += 35;
    aerobicPaceScore = 55;
  }

  // 2. Training Volume Consistency Factor
  const weeklyHours = global.weeklyAverageMinutes / 60;
  let volumeScore = 70;

  if (weeklyHours >= 6.5) {
    basePredictionMin -= 35;
    volumeScore = 95;
  } else if (weeklyHours >= 4.5) {
    basePredictionMin -= 15;
    volumeScore = 80;
  } else if (weeklyHours < 3.0 && global.activeWeeksCount > 2) {
    basePredictionMin += 45;
    volumeScore = 50;
  }

  // 3. Heart Rate Downward Trend Bonus
  if (heartRate.heartRateTrend === 'DECREASING' && heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm <= -2) {
    const bonus = Math.min(25, Math.abs(heartRate.heartRateDeltaBpm) * 5);
    basePredictionMin -= bonus;
  }

  // 4. Strength Training & Downhill Resistance Factor
  let downhillResistanceImpactMin = 0;
  const strengthScore = strength.quadArmorScore;

  if (strengthScore >= 80) {
    downhillResistanceImpactMin = -40;
  } else if (strengthScore >= 60) {
    downhillResistanceImpactMin = -25;
  } else if (strengthScore < 40) {
    downhillResistanceImpactMin = +20;
  }

  basePredictionMin += downhillResistanceImpactMin;

  // 5. Training Load (CTL Fitness) & ACWR Workload Quality Factor
  if (trainingLoad) {
    if (trainingLoad.currentCtl >= 55) {
      basePredictionMin -= 20;
    } else if (trainingLoad.currentCtl >= 40) {
      basePredictionMin -= 10;
    }
    if (trainingLoad.acwrStatus === 'OPTIMAL') {
      basePredictionMin -= 8;
    } else if (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK') {
      basePredictionMin += 15;
    }
  }

  // Bound predictions within realistic ultra-trail boundaries (700 min = 11h40 min, 1080 min = 18h00)
  const predictedMinutes = Math.max(700, Math.min(1080, Math.round(basePredictionMin)));
  const ambitiousMinutes = Math.max(660, Math.round(predictedMinutes * 0.92));
  const conservativeMinutes = Math.min(officialCutoffMinutes - 30, Math.round(predictedMinutes * 1.12));

  // Evolution Delta compared to initial plan launch (1er sept. 2026)
  const evolutionDeltaMinutes = predictedMinutes - baselinePredictedMinutes;
  const cutoffMarginMinutes = officialCutoffMinutes - predictedMinutes;

  const evolutionComparisonText = `${formatMinutes(predictedMinutes)} estimé aujourd'hui comparé à ${formatMinutes(baselinePredictedMinutes)} au lancement du plan le 1er sept. (${evolutionDeltaMinutes < 0 ? 'Gain de ' + Math.abs(evolutionDeltaMinutes) + ' min' : 'Stable'})`;

  // Calculate realistic Splits for the 6 Official Aid Stations
  const splitsData = [
    { name: 'R1 — Le Massif', km: 14.5, elevationGainM: 750, pctOfTotalTime: 0.19, notes: 'Montée initiale raide du fleuve vers le sommet' },
    { name: 'R2 — Cap du Salut', km: 30.0, elevationGainM: 1350, pctOfTotalTime: 0.38, notes: 'Sentier des Caps en autonomie, sentiers côtiers techniques' },
    { name: 'R3 — Cap Gribane', km: 44.0, elevationGainM: 1950, pctOfTotalTime: 0.56, notes: 'Dalles de granit, racines humides' },
    { name: 'R4 — Saint-Tite (Drop Bag)', km: 57.0, elevationGainM: 2400, pctOfTotalTime: 0.72, notes: 'Poste charnière : ravitaillement complet, frontale' },
    { name: 'R5 — Sentier Mestachibo', km: 67.0, elevationGainM: 2750, pctOfTotalTime: 0.86, notes: 'Chaos rocheux très technique, bâtons interdits' },
    { name: 'Arrivée — Mont-Sainte-Anne', km: 77.0, elevationGainM: 3370, pctOfTotalTime: 1.00, notes: 'Montée finale MSA et descente vers l’arche' }
  ];

  let prevElapsed = 0;
  const aidStationSplits: AidStationSplit[] = splitsData.map(st => {
    const elapsedMinutes = Math.round(predictedMinutes * st.pctOfTotalTime);
    const splitMinutes = elapsedMinutes - prevElapsed;
    prevElapsed = elapsedMinutes;

    const kmSection = st.km - (splitsData[splitsData.indexOf(st) - 1]?.km || 0);
    const paceSecPerKm = kmSection > 0 ? (splitMinutes * 60) / kmSection : 0;

    return {
      name: st.name,
      km: st.km,
      elevationGainM: st.elevationGainM,
      splitMinutes,
      elapsedMinutes,
      elapsedFormatted: formatMinutes(elapsedMinutes),
      paceMinKm: formatPace(paceSecPerKm),
      notes: st.notes
    };
  });

  let analysis = `À votre allure aérobie actuelle et avec ${global.weeklyAverageMinutes > 0 ? formatMinutes(global.weeklyAverageMinutes) : '5h'} d'entraînement moyen/semaine, votre chrono cible est estimé à ${formatMinutes(predictedMinutes)}. `;
  if (downhillResistanceImpactMin < 0) {
    analysis += `Votre régularité en renforcement musculaire protège vos quadriceps et vous fait gagner ${Math.abs(downhillResistanceImpactMin)} min sur la seconde moitié de course. `;
  }
  analysis += `Vous disposez d'une marge de confort de ${formatMinutes(cutoffMarginMinutes)} sur la barrière horaire de 19h00.`;

  return {
    targetRaceName: 'Québec Méga Trail QMT-80',
    officialDistanceKm,
    officialElevationGainM,
    officialCutoffMinutes,
    predictedMinutes,
    baselinePredictedMinutes,
    ambitiousMinutes,
    conservativeMinutes,
    evolutionDeltaMinutes,
    cutoffMarginMinutes,
    factors: {
      volumeScore,
      aerobicPaceScore,
      strengthArmorScore: strengthScore,
      downhillResistanceImpactMin
    },
    aidStationSplits,
    predictionAnalysis: analysis,
    evolutionComparisonText
  };
}
