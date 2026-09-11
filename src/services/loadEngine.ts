import { formatDateKey, getGarminLocalDateKey } from './dateUtils';
import { isStrengthOrCalisthenics, isTrailOrRunning } from './activityClassifier';
import { GLOBAL_APP_CONFIG } from './periodizationEngine';
import { getBaselineRestingHeartRate } from './readinessEngine';

export interface SessionTrimpOptions {
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  elevationGainM?: number | null;
  distanceKm?: number | null;
  athleteFcMax?: number | null;
  athleteFcRest?: number | null;
}

export interface SessionTrimpResult {
  trimp: number;
  cardioTrimp?: number;
  isMechanicalImpact: boolean;
  isRealTelemetry: boolean;
  factor: number;
  factorLabel: string;
  baseRate: number;
  ratePerMin: number;
  categoryLabel: string;
  formulaText: string;
  details: string;
}

export interface FitnessDayPoint {
  date: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "5 sept."
  ctl: number; // Fitness (42-day EWMA)
  atl: number; // Fatigue (7-day EWMA)
  tsb: number; // Form (CTL - ATL)
  dailyLoad: number;
}

export interface RecentSessionLoadItem {
  id: string;
  date: string;
  name: string;
  durationMinutes: number;
  sportType: string;
  trimp: number;
  isMechanicalImpact: boolean;
  categoryLabel: string;
  formulaText: string;
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
  totalTrailChronicLoad28d: number;
  fitnessTrend: FitnessDayPoint[];
  fitnessHistory?: FitnessDayPoint[];
  trailAcwrRatio: number;
  trailAcuteLoad7d: number;
  trailChronicLoad28dWeeklyAvg: number;
  trailAcwrStatus: 'UNDERLOAD' | 'OPTIMAL' | 'MODERATE_RISK' | 'DANGER_HIGH_RISK' | 'CALIBRATING';
  calisthenicsAcuteLoad7d: number;
  calisthenicsSessionsCount7d: number;
  totalSystemicAcuteLoad7d: number;
  recentSessions7d: RecentSessionLoadItem[];
}

export interface TrailSpecificStats {
  totalElevationLossM: number;
  avgVamMPerHour: number;
  maxVamMPerHour: number;
  downhillStressScore: number;
  downhillStressLabel: string;
  gradeAdjustedPaceMinKm: string;
}

/**
 * Formate une allure en secondes/km sous forme "M:SS/km".
 */
export function formatPace(paceSecPerKm: number): string {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm)) return '-';
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}/km`;
}

/**
 * Calcule la charge physiologique individuelle d'une séance (en TRIMP)
 * et détermine si elle engendre des impacts articulaires mécaniques (Course/Trail)
 * ou s'il s'agit de renforcement/calisthénie sans choc au sol.
 * 
 * Si des données cardio réelles sont disponibles (ex: montre Garmin Connect sans Firstbeat EPOC),
 * applique le modèle exponentiel de Banister (1991) basé sur la réserve cardiaque (HRr).
 */
export function calculateSessionTrimp(
  durationMinutes: number,
  typeOrSportType?: string,
  name?: string,
  garminLoad?: number | null,
  options?: SessionTrimpOptions
): SessionTrimpResult {
  const dur = Math.max(0, durationMinutes || 0);
  const actType = String(typeOrSportType || '').toUpperCase();
  const actName = String(name || '').toLowerCase();

  const isCalisthenics = isStrengthOrCalisthenics(typeOrSportType, name);
  const isRunningDiscipline = isTrailOrRunning(typeOrSportType, name);
  const hasRunningImpact = isRunningDiscipline && !isCalisthenics;

  // 1. Charge EPOC native Firstbeat de Garmin prioritaire si présente
  if (typeof garminLoad === 'number' && garminLoad > 0) {
    const isImpact = hasRunningImpact;
    return {
      trimp: Math.round(garminLoad),
      cardioTrimp: Math.round(garminLoad),
      isMechanicalImpact: isImpact,
      isRealTelemetry: true,
      factor: 1.0,
      factorLabel: 'Charge réelle Garmin (EPOC)',
      baseRate: Math.round((garminLoad / Math.max(1, durationMinutes)) * 100) / 100,
      ratePerMin: Math.round((garminLoad / Math.max(1, durationMinutes)) * 100) / 100,
      categoryLabel: isImpact ? 'Impact Trail & Course' : (isCalisthenics ? 'Calisthénie (Sans impact)' : 'Activité générale'),
      formulaText: `Charge EPOC Garmin : ${Math.round(garminLoad)} TRIMP`,
      details: 'Mesuré directement via le capteur cardiofréquencemètre et la consommation excessive d’oxygène post-exercice (EPOC) de la montre Garmin.'
    };
  }

  // 2. Détermination du facteur d'impact mécanique et de terrain
  let factor = 1.0;
  let factorLabel = 'Endurance générale (×1.0)';
  let categoryLabel = 'Endurance générale';

  const hasHighElevation = typeof options?.elevationGainM === 'number' && options.elevationGainM >= 100;

  if (actType === 'TRAIL_RUNNING' || actType === 'TRAIL_INTENSE' || actType === 'TRAIL_LONG' || actName.includes('trail') || actName.includes('côtes') || hasHighElevation) {
    factor = 1.35;
    factorLabel = 'Trail D+ & Côtes (×1.35)';
    categoryLabel = 'Trail & Côtes (Impact excentrique élevé)';
  } else if (actType === 'RUNNING' || actType === 'RUN_EASY' || actType === 'RUN_TEMPO' || actName.includes('footing') || actName.includes('course') || hasRunningImpact) {
    factor = 1.15;
    factorLabel = 'Course sur plat (×1.15)';
    categoryLabel = 'Course sur plat (Impact modéré)';
  } else if (isCalisthenics) {
    factor = 0.85;
    factorLabel = 'Calisthénie & Force (×0.85)';
    categoryLabel = 'Calisthénie & Force (Zéro onde de choc articulaire)';
  } else {
    factor = 0.75;
    factorLabel = 'Récupération & Mobilité (×0.75)';
    categoryLabel = 'Récupération active & Mobilité';
  }

  const isMechanicalImpact = hasRunningImpact;

  // 3. Calcul Banister physiologique si cardiofréquencemètre réel disponible
  if (typeof options?.avgHeartRate === 'number' && options.avgHeartRate > 55 && dur > 0) {
    const fcMax = options.athleteFcMax || GLOBAL_APP_CONFIG.ATHLETE_FC_MAX || 203;
    const fcRest = options.athleteFcRest || getBaselineRestingHeartRate();
    const avgHr = options.avgHeartRate;

    // Fraction de réserve cardiaque (Heart Rate Reserve ratio)
    const hrReserveFraction = Math.max(0.05, Math.min(1.0, (avgHr - fcRest) / Math.max(40, fcMax - fcRest)));
    // Formule classique Banister (1991) pour hommes : y = 0.64 * e^(1.92 * HRr)
    const banisterExp = 0.64 * Math.exp(1.92 * hrReserveFraction);
    const baseRate = Math.round(hrReserveFraction * banisterExp * 100) / 100; // Taux physiologique net / min
    const cardioTrimp = Math.round(dur * baseRate);
    const ratePerMin = Math.round(baseRate * factor * 100) / 100;
    const trimp = Math.round(dur * ratePerMin);

    const hrReservePct = Math.round(hrReserveFraction * 100);
    const maxHrStr = options.maxHeartRate ? `, Pic ${Math.round(options.maxHeartRate)} bpm` : '';

    return {
      trimp,
      cardioTrimp,
      isMechanicalImpact,
      isRealTelemetry: true,
      factor,
      factorLabel,
      baseRate,
      ratePerMin,
      categoryLabel,
      formulaText: `${dur} min × ${ratePerMin} TRIMP/min = ${trimp} TRIMP (FC moy. ${Math.round(avgHr)} bpm${maxHrStr})`,
      details: `Banister FC réelle (${baseRate} TRIMP/min, ${hrReservePct}% Réserve Cardiaque) × Impact ${factorLabel}`
    };
  }

  // 4. Repli standard basé sur l'endurance aérobie théorique Z2 (séance planifiée non encore exécutée)
  const baseRate = 0.8; // 0.80 TRIMP/min = référence aérobie Banister Z2 douce
  const ratePerMin = Math.round(baseRate * factor * 100) / 100; // ex: 0.8 * 1.15 = 0.92 TRIMP/min
  const trimp = Math.round(dur * ratePerMin);

  return {
    trimp,
    cardioTrimp: Math.round(dur * baseRate),
    isMechanicalImpact,
    isRealTelemetry: false,
    factor,
    factorLabel,
    baseRate,
    ratePerMin,
    categoryLabel,
    formulaText: `${dur} min × ${ratePerMin} TRIMP/min = ${trimp} TRIMP`,
    details: `Base aérobie Banister Z2 (${baseRate} TRIMP/min) × Coeff. d'impact ${factorLabel}`
  };
}

/**
 * Calcule la Charge Chronique (CTL - Fitness), la Charge Aiguë (ATL - Fatigue),
 * l'Équilibre de Stress (TSB - Forme) et le Ratio Aigu/Chronique (ACWR).
 * L'ACWR pour le risque de blessure est calculé exclusivement sur la Course & le Trail,
 * en isolant la calisthénie et le renforcement sans impact.
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

    const sessionInfo = calculateSessionTrimp(dur, actType, actName, act.trainingLoad, {
      avgHeartRate: act.avgHeartRate,
      maxHeartRate: act.maxHeartRate,
      elevationGainM: act.elevationGainM,
      distanceKm: act.distanceKm,
      athleteFcMax: GLOBAL_APP_CONFIG.ATHLETE_FC_MAX
    });
    const load = sessionInfo.trimp;

    // Moteur de charge centré exclusivement sur la Course & le Trail (renforcement exclu)
    if (sessionInfo.isMechanicalImpact || isTrailOrRunning(act)) {
      dailyLoads[dKey] = (dailyLoads[dKey] || 0) + load;
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

  // Detect calibration/cold-start
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

  // 7-day window individual sessions
  const recentSessions7d: RecentSessionLoadItem[] = [];
  const min7d = new Date(asOfDate);
  min7d.setDate(asOfDate.getDate() - 6);
  const min7dKey = formatDateKey(min7d);
  const asOfDateKey = formatDateKey(asOfDate);

  for (const act of activities) {
    const dKey = act.date || (act.startTimeLocal ? getGarminLocalDateKey(act) : formatDateKey(new Date()));
    if (dKey >= min7dKey && dKey <= asOfDateKey) {
      const dur = act.durationMinutes || 0;
      const actType = String(act.activityType || act.type || '');
      const actName = String(act.name || act.activityName || 'Séance');
      const sessionInfo = calculateSessionTrimp(dur, actType, actName, act.trainingLoad, {
        avgHeartRate: act.avgHeartRate,
        maxHeartRate: act.maxHeartRate,
        elevationGainM: act.elevationGainM,
        distanceKm: act.distanceKm,
        athleteFcMax: GLOBAL_APP_CONFIG.ATHLETE_FC_MAX
      });
      recentSessions7d.push({
        id: act.id || `${dKey}-${actName}-${recentSessions7d.length}`,
        date: dKey,
        name: actName,
        durationMinutes: dur,
        sportType: actType,
        trimp: sessionInfo.trimp,
        isMechanicalImpact: sessionInfo.isMechanicalImpact,
        categoryLabel: sessionInfo.categoryLabel,
        formulaText: sessionInfo.formulaText
      });
    }
  }
  recentSessions7d.sort((a, b) => b.date.localeCompare(a.date));

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
    totalTrailChronicLoad28d: trailChronicSum,
    fitnessTrend,
    fitnessHistory: fitnessTrend,
    trailAcwrRatio,
    trailAcuteLoad7d: trailAcuteSum,
    trailChronicLoad28dWeeklyAvg: trailChronicWeeklyAvg,
    trailAcwrStatus: acwrStatus,
    calisthenicsAcuteLoad7d: calisthenicsAcuteSum,
    calisthenicsSessionsCount7d,
    totalSystemicAcuteLoad7d: totalSystemicAcuteSum,
    recentSessions7d
  };
}

/**
 * Calcule les statistiques spécifiques au Trail : Dénivelé négatif D-, VAM (m/h) et GAP.
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
