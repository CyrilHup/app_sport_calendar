import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import { getGarminLocalDateKey, getMondayWeekKey } from './comparisonEngine';
import { formatDateKey } from './icsParser';

export type TimeRangeScope = 'all' | '12w' | '4w';

export interface WeeklyTrendPoint {
  weekKey: string; // YYYY-MM-DD of Monday
  weekLabel: string; // e.g. "Sem. 31 août"
  totalMinutes: number;
  runningMinutes: number;
  strengthMinutes: number;
  otherMinutes: number;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  avgHeartRate: number | null;
  sessionCount: number;
}

export interface GlobalStats {
  totalDurationMinutes: number;
  totalSessionsCount: number;
  activeWeeksCount: number;
  weeklyAverageMinutes: number;
  weeklyProgressionPct: number;
  progressionStatus: 'SAFE_PROGRESSION' | 'OVERLOAD_WARNING' | 'RECOVERY_MAINTENANCE' | 'STARTING';
  sportBreakdown: {
    running: { minutes: number; pct: number; count: number };
    strength: { minutes: number; pct: number; count: number };
    crossTraining: { minutes: number; pct: number; count: number };
    other: { minutes: number; pct: number; count: number };
  };
  weeklyTrend: WeeklyTrendPoint[];
}

export interface RunningStats {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  elevationDensityMPerKm: number;
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
}

export interface FullStatsReport {
  scope: TimeRangeScope;
  global: GlobalStats;
  running: RunningStats;
  strength: StrengthStats;
  heartRate: HeartRateStats;
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
  if (scope === 'all') return items;

  const asOfTime = asOfDate.getTime();
  const weeks = scope === '4w' ? 4 : 12;
  const daysLimit = weeks * 7;
  const startTime = asOfTime - daysLimit * 24 * 60 * 60 * 1000;
  const startDateStr = formatDateKey(new Date(startTime));
  const endDateStr = formatDateKey(asOfDate);

  return items.filter(item => item.date >= startDateStr && item.date <= endDateStr);
}

/**
 * Main computation entry point: evaluates completed activities from Garmin and/or comparisons.
 */
export function computeFullStatsReport(
  garminActivities: GarminActivity[],
  comparisons: ActivityComparison[] = [],
  _plannedEvents: CalendarEvent[] = [],
  scope: TimeRangeScope = 'all',
  asOfDate: Date = new Date()
): FullStatsReport {
  // 1. Build unified activity list
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
  }

  const rawList: NormalizedAct[] = [];

  // Use Garmin activities if available
  if (garminActivities && garminActivities.length > 0) {
    for (const act of garminActivities) {
      const date = getGarminLocalDateKey(act);
      let paceSec: number | null = parsePaceStringToSeconds(act.avgPaceMinKm);
      if (!paceSec && act.distanceKm && act.distanceKm > 0 && act.durationMinutes > 0) {
        paceSec = (act.durationMinutes * 60) / act.distanceKm;
      }

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
        trainingLoad: act.trainingLoad || null
      });
    }
  } else if (comparisons && comparisons.length > 0) {
    // Fallback on comparisons if garminActivities array is empty
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
      let type = act?.activityType || (plan?.sportType === 'CALISTHENICS' || plan?.sportType === 'GYM_FORCE' ? 'STRENGTH_TRAINING' : 'RUNNING');

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
        trainingLoad: act?.trainingLoad || null
      });
    }
  }

  // Filter by requested scope
  const activeActivities = filterItemsByScope(rawList, scope, asOfDate);

  // Group by week (Monday)
  const weekMap = new Map<string, NormalizedAct[]>();
  for (const act of activeActivities) {
    const mondayKey = getMondayWeekKey(act.date);
    if (!weekMap.has(mondayKey)) {
      weekMap.set(mondayKey, []);
    }
    weekMap.get(mondayKey)!.push(act);
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
    const weekLabel = `Sem. ${dDate.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}`;

    return {
      weekKey: wKey,
      weekLabel,
      totalMinutes: totalMin,
      runningMinutes: runMin,
      strengthMinutes: strengthMin,
      otherMinutes: otherMin,
      distanceKm: Math.round(distKm * 10) / 10,
      elevationGainM: dPlus,
      elevationLossM: dMinus,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
      sessionCount: acts.length
    };
  });

  // Global aggregates
  const totalDurationMinutes = activeActivities.reduce((acc, a) => acc + a.durationMinutes, 0);
  const totalSessionsCount = activeActivities.length;
  const activeWeeksCount = Math.max(1, weeklyTrend.length);
  const weeklyAverageMinutes = Math.round(totalDurationMinutes / activeWeeksCount);

  // Progression calculation: compare the last 2 weeks to the previous 2 weeks
  let weeklyProgressionPct = 0;
  let progressionStatus: GlobalStats['progressionStatus'] = 'STARTING';

  if (weeklyTrend.length >= 2) {
    const half = Math.floor(weeklyTrend.length / 2);
    const firstHalf = weeklyTrend.slice(0, half);
    const secondHalf = weeklyTrend.slice(half);

    const avgFirst = firstHalf.reduce((s, w) => s + w.totalMinutes, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((s, w) => s + w.totalMinutes, 0) / (secondHalf.length || 1);

    if (avgFirst > 0) {
      weeklyProgressionPct = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);
    }

    if (weeklyProgressionPct > 20) {
      progressionStatus = 'OVERLOAD_WARNING';
    } else if (weeklyProgressionPct >= 5 && weeklyProgressionPct <= 20) {
      progressionStatus = 'SAFE_PROGRESSION';
    } else if (weeklyProgressionPct >= -10 && weeklyProgressionPct < 5) {
      progressionStatus = 'RECOVERY_MAINTENANCE';
    } else {
      progressionStatus = 'RECOVERY_MAINTENANCE';
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
    sportBreakdown,
    weeklyTrend
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

    // Rough heart rate zone breakdown based on average HR
    if (r.avgHeartRate) {
      if (r.avgHeartRate < 155) {
        z2Min += r.durationMinutes;
      } else if (r.avgHeartRate <= 175) {
        zTempoMin += r.durationMinutes;
      } else {
        zMaxMin += r.durationMinutes;
      }
    } else {
      // Default estimation: 75% aerobic base, 20% tempo, 5% high intensity
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

  // Quad Armor Score: assesses resistance against downhill muscle micro-tears
  // Ideal: 1.5 to 2.5 strength sessions per week + progressive negative elevation
  let quadArmorScore = Math.min(100, Math.round(weeklyStrengthFrequency * 35 + (runElevLossTotal > 1500 ? 30 : (runElevLossTotal / 1500) * 30)));
  if (strengthActivities.length === 0 && runActivities.length === 0) {
    quadArmorScore = 50; // Neutral starting score
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

  // Heart Rate Trends ("is my average heart rate going down?")
  const weeksWithHr = weeklyTrend.filter(w => w.avgHeartRate !== null && w.avgHeartRate > 0);
  let currentAvgHeartRate: number | null = null;
  let previousAvgHeartRate: number | null = null;
  let heartRateDeltaBpm: number | null = null;
  let heartRateTrend: HeartRateStats['heartRateTrend'] = 'INSUFFICIENT_DATA';
  let aerobicEfficiencyIndex: number | null = null;
  let aerobicEfficiencyDeltaPct: number | null = null;
  let hrSummaryText = "Synchronisez plusieurs séances avec cardio-fréquencemètre pour afficher la tendance.";

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
      hrSummaryText = `🎉 Excellente adaptation : Fréquence cardiaque moyenne en baisse de ${Math.abs(heartRateDeltaBpm)} bpm. Votre cœur travaille plus efficacement.`;
    } else if (heartRateDeltaBpm >= 3) {
      heartRateTrend = 'INCREASING';
      hrSummaryText = `Attention : FC moyenne en hausse de +${heartRateDeltaBpm} bpm. Surveillez la fatigue accumulée, le sommeil ou l'intensité des sorties.`;
    } else {
      heartRateTrend = 'STABLE';
      hrSummaryText = `FC aérobie très stable (variation de ${heartRateDeltaBpm > 0 ? '+' : ''}${heartRateDeltaBpm} bpm). Votre socle d'endurance de base est consolidé.`;
    }

    // Aerobic Efficiency Index (Speed in m/min / HR)
    if (avgPaceSec > 0 && currentAvgHeartRate > 0) {
      const speedMPerMin = 1000 / (avgPaceSec / 60);
      aerobicEfficiencyIndex = Math.round((speedMPerMin / currentAvgHeartRate) * 100) / 100;
      if (heartRateDeltaBpm < 0) {
        aerobicEfficiencyDeltaPct = Math.round((Math.abs(heartRateDeltaBpm) / oldHr) * 100);
      }
    }
  } else if (weeksWithHr.length === 1) {
    currentAvgHeartRate = weeksWithHr[0].avgHeartRate;
    heartRateTrend = 'STABLE';
    hrSummaryText = `FC moyenne actuelle : ${currentAvgHeartRate} bpm. Poursuivez l'enregistrement pour comparer avec les prochaines semaines.`;
  }

  const heartRate: HeartRateStats = {
    currentAvgHeartRate,
    previousAvgHeartRate,
    heartRateDeltaBpm,
    heartRateTrend,
    aerobicEfficiencyIndex,
    aerobicEfficiencyDeltaPct,
    summaryText: hrSummaryText
  };

  // Dynamic QMT-80 Race Time Predictor
  // Official specs: 77 km, +3,370 m D+, 19h00 (1,140 minutes) max cutoff
  const qmtPrediction = calculateQmtRacePrediction(running, strength, heartRate, global);

  return {
    scope,
    global,
    running,
    strength,
    heartRate,
    qmtPrediction
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
  global: GlobalStats
): QmtRacePrediction {
  const officialDistanceKm = 77;
  const officialElevationGainM = 3370;
  const officialCutoffMinutes = 19 * 60; // 1,140 min

  // Baseline standard finisher expectation for a well-prepared amateur: 11h30 (690 min)
  let basePredictionMin = 690;

  // 1. Aerobic Pace Factor
  let paceSec = parsePaceStringToSeconds(running.avgPaceMinKm) || (5 * 60 + 30); // default 5:30/km flat
  let aerobicPaceScore = 70;

  if (paceSec < 5 * 60) {
    // Fast runner
    basePredictionMin -= 45;
    aerobicPaceScore = 90;
  } else if (paceSec < 5 * 60 + 45) {
    basePredictionMin -= 20;
    aerobicPaceScore = 80;
  } else if (paceSec > 6 * 60 + 30) {
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

  // 3. Heart Rate Downward Trend Bonus ("is heart rate going down?")
  if (heartRate.heartRateTrend === 'DECREASING' && heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm <= -2) {
    const bonus = Math.min(25, Math.abs(heartRate.heartRateDeltaBpm) * 5);
    basePredictionMin -= bonus;
  }

  // 4. Strength Training & Downhill Resistance Factor
  // In QMT-80, 3,370m of steep rocky downhill destroys unconditioned quads by KM 50 (Saint-Tite to Mestachibo).
  // Strong eccentric quad armor eliminates the 40-minute downhill walking breakdown!
  let downhillResistanceImpactMin = 0;
  const strengthScore = strength.quadArmorScore;

  if (strengthScore >= 80) {
    downhillResistanceImpactMin = -40; // Shaves 40 min off late-race walking
  } else if (strengthScore >= 60) {
    downhillResistanceImpactMin = -25;
  } else if (strengthScore < 40) {
    downhillResistanceImpactMin = +20; // Quad fatigue penalty
  }

  basePredictionMin += downhillResistanceImpactMin;

  // Bound predictions within realistic ultra-trail boundaries
  const predictedMinutes = Math.max(570, Math.min(1080, Math.round(basePredictionMin))); // between 9h30 and 18h00
  const ambitiousMinutes = Math.max(540, Math.round(predictedMinutes * 0.92));
  const conservativeMinutes = Math.min(officialCutoffMinutes - 30, Math.round(predictedMinutes * 1.12));

  // Evolution Delta: how much the prediction has improved with ongoing training
  // If quad armor is high and HR is down, user has gained significant time!
  let evolutionDeltaMinutes = -18; // Default progressive adaptation gain
  if (heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0) {
    evolutionDeltaMinutes += heartRate.heartRateDeltaBpm * 4;
  }
  if (strength.weeklyFrequency >= 1.5) {
    evolutionDeltaMinutes -= 10;
  }

  const cutoffMarginMinutes = officialCutoffMinutes - predictedMinutes;

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
    analysis += `Votre régularité en renforcement musculaire/calisthénie protège vos quadriceps et vous fait gagner ${Math.abs(downhillResistanceImpactMin)} min sur la seconde moitié de course. `;
  }
  analysis += `Vous disposez d'une marge de confort de ${formatMinutes(cutoffMarginMinutes)} sur la barrière horaire de 19h00.`;

  return {
    targetRaceName: 'Québec Méga Trail QMT-80',
    officialDistanceKm,
    officialElevationGainM,
    officialCutoffMinutes,
    predictedMinutes,
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
    predictionAnalysis: analysis
  };
}
