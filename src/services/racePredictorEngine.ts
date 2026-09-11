import type { GlobalStats, RunningStats, StrengthStats, HeartRateStats } from './statsEngine';
import { TrainingLoadStats, TrailSpecificStats, formatPace } from './loadEngine';

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

/**
 * Formate une durée en minutes en "Xh YYm" ou "X min".
 */
export function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Analyse une chaîne d'allure "M:SS" ou "M:SS/km" en secondes/km.
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
 * Simulateur dynamique de chrono officiel QMT-80.
 * Modèle ultra-trail utilisant la distance à plat équivalente + facteur de fatigue montagnarde,
 * ajusté selon le volume d'entraînement, l'allure GAP et le score de blindage musculaire.
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
  const officialCutoffMinutes = 19 * 60; // 1 140 min

  // Base standard pour amateur sur le parcours technique du QMT-80 : 13h30 (810 min)
  let basePredictionMin = 810;
  const baselinePredictedMinutes = 820; // ~13h40 au lancement du plan le 1er sept. 2026

  // 1. Facteur Allure Aérobie (Allure ajustée à la pente - GAP)
  const rawPaceSec = parsePaceStringToSeconds(running.avgPaceMinKm) || (5 * 60 + 30);
  const gapPaceSec = parsePaceStringToSeconds(trailSpecific?.gradeAdjustedPaceMinKm);
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

  // 2. Facteur Consistance du Volume d'Entraînement
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

  // 3. Tendance FC à la baisse (Efficience cardiovasculaire)
  if (heartRate.heartRateTrend === 'DECREASING' && heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm <= -2) {
    const bonus = Math.min(25, Math.abs(heartRate.heartRateDeltaBpm) * 5);
    basePredictionMin -= bonus;
  }

  // 4. Renforcement Musculaire & Tolérance Excentrique aux Descentes
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

  // 5. Facteur Qualité de Charge CTL & ACWR
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

  // Bornage réaliste ultra-trail (700 min = 11h40, 1080 min = 18h00)
  const predictedMinutes = Math.max(700, Math.min(1080, Math.round(basePredictionMin)));
  const ambitiousMinutes = Math.max(660, Math.round(predictedMinutes * 0.92));
  const conservativeMinutes = Math.min(officialCutoffMinutes - 30, Math.round(predictedMinutes * 1.12));

  const evolutionDeltaMinutes = predictedMinutes - baselinePredictedMinutes;
  const cutoffMarginMinutes = officialCutoffMinutes - predictedMinutes;

  const evolutionComparisonText = `${formatMinutes(predictedMinutes)} estimé aujourd'hui comparé à ${formatMinutes(baselinePredictedMinutes)} au lancement du plan le 1er sept. (${evolutionDeltaMinutes < 0 ? 'Gain de ' + Math.abs(evolutionDeltaMinutes) + ' min' : 'Stable'})`;

  // Calcul des temps de passage aux 6 ravitaillements officiels
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
