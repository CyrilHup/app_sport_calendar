import { CalendarEvent } from '../types/calendar';
import { GarminWellnessData } from '../types/garmin';

const WELLNESS_STORAGE_KEY = 'garmin_wellness_history';

/**
 * Loads all saved Garmin wellness history from local storage.
 * Map keyed by date YYYY-MM-DD.
 */
export function loadWellnessHistory(): Record<string, GarminWellnessData> {
  try {
    const raw = localStorage.getItem(WELLNESS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not load wellness history:', e);
  }
  return {};
}

/**
 * Persists a day's Garmin wellness data.
 */
export function saveWellnessData(data: GarminWellnessData): void {
  try {
    const history = loadWellnessHistory();
    history[data.date] = data;
    localStorage.setItem(WELLNESS_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save wellness data:', e);
  }
}

/**
 * Retrieves wellness data for a specific date (YYYY-MM-DD).
 */
export function getWellnessForDate(dateStr: string): GarminWellnessData | null {
  const history = loadWellnessHistory();
  return history[dateStr] || null;
}

/**
 * Retrieves the most recent wellness data available in history.
 */
export function getLatestWellnessData(): GarminWellnessData | null {
  const history = loadWellnessHistory();
  const dates = Object.keys(history).sort();
  if (dates.length === 0) return null;
  return history[dates[dates.length - 1]];
}

export type ReadinessStatus = 'OPTIMAL' | 'MODERATE' | 'LOW' | 'COMPLETED';

export interface ReadinessEvaluation {
  score: number; // 0 to 100
  status: ReadinessStatus;
  statusLabel: string;
  badgeEmoji: string;
  badgeColorHex: string;
  headline: string;
  summary: string;
  isCompleted?: boolean;
  isDefaultBaseline?: boolean;
  completedActivitiesCount?: number;
  intradayLoad?: number;
  factors: {
    sleepScore: number; // 0-100
    sleepDurationHours: number;
    hrvScore: number; // 0-100
    hrvStatus: string;
    rhrDeltaBpm: number;
    rhrBpm?: number;
  };
}

/**
 * Computes an athlete's physiological readiness score (0-100)
 * fusing Sleep (35%), Overnight HRV (40%) and Resting HR (25%).
 * Dynamically adjusts for same-day activities and workout completion.
 */
export function calculateReadinessScore(
  wellness: GarminWellnessData | null,
  baselineRhr: number = 48,
  todayActivities: Array<{ durationMinutes?: number; trainingLoad?: number; activityName?: string }> = [],
  isTodaySessionCompleted: boolean = false
): ReadinessEvaluation {
  if (!wellness) {
    if (isTodaySessionCompleted) {
      return {
        score: 85,
        status: 'COMPLETED',
        statusLabel: 'Séance Réalisée (Récupération)',
        badgeEmoji: '🏁',
        badgeColorHex: '#38bdf8',
        headline: 'Séance Validée : Assimilation en Cours',
        summary: 'Entraînement du jour terminé et synchronisé. Fenêtre de récupération active.',
        isCompleted: true,
        completedActivitiesCount: Math.max(1, todayActivities.length),
        factors: {
          sleepScore: 80,
          sleepDurationHours: 7.5,
          hrvScore: 80,
          hrvStatus: 'BALANCED',
          rhrDeltaBpm: 0,
          rhrBpm: baselineRhr
        }
      };
    }

    // Default neutral healthy baseline when no sync has occurred today yet
    return {
      score: 78,
      status: 'OPTIMAL',
      statusLabel: 'Forme Stable (Par défaut)',
      badgeEmoji: '🟢',
      badgeColorHex: '#10b981',
      headline: 'Prêt pour l\'entraînement',
      summary: 'Synchronisez Garmin Connect pour afficher votre score précis basé sur le sommeil et la VFC nocturne.',
      isDefaultBaseline: true,
      factors: {
        sleepScore: 80,
        sleepDurationHours: 7.5,
        hrvScore: 80,
        hrvStatus: 'BALANCED',
        rhrDeltaBpm: 0,
        rhrBpm: baselineRhr
      }
    };
  }

  // 1. Sleep Factor (Weight: 35%)
  let sleepScore = 75;
  let sleepDurationHours = 7.5;
  if (wellness.sleep) {
    sleepDurationHours = wellness.sleep.totalMinutes / 60;
    if (typeof wellness.sleep.score === 'number' && wellness.sleep.score > 0) {
      sleepScore = wellness.sleep.score;
    } else {
      // Approximate score from duration (ideal 7.5h to 9h)
      if (sleepDurationHours >= 7.5) sleepScore = 90;
      else if (sleepDurationHours >= 6.5) sleepScore = 75;
      else if (sleepDurationHours >= 5.5) sleepScore = 55;
      else sleepScore = 35;
    }
  }

  // 2. HRV Factor (Weight: 40%)
  let hrvScore = 75;
  let hrvStatus = wellness.hrv?.status || 'BALANCED';
  if (wellness.hrv) {
    switch (wellness.hrv.status) {
      case 'BALANCED':
        hrvScore = 90;
        break;
      case 'LOW':
        hrvScore = 45;
        break;
      case 'UNBALANCED':
        hrvScore = 55;
        break;
      case 'POOR':
        hrvScore = 25;
        break;
      default:
        hrvScore = 75;
    }
    // If we have precise ms compared to 7-day average
    if (wellness.hrv.lastNightAvg && wellness.hrv.weeklyAvg && wellness.hrv.weeklyAvg > 0) {
      const ratio = wellness.hrv.lastNightAvg / wellness.hrv.weeklyAvg;
      if (ratio >= 1.05) hrvScore = Math.min(100, hrvScore + 10);
      else if (ratio < 0.88) hrvScore = Math.max(20, hrvScore - 25);
    }
  }

  // 3. Resting HR Factor (Weight: 15%)
  let rhrScore = 80;
  let rhrDeltaBpm = 0;
  const currentRhr = wellness.restingHeartRate;
  if (currentRhr && currentRhr > 0) {
    rhrDeltaBpm = currentRhr - baselineRhr;
    if (rhrDeltaBpm <= -2) rhrScore = 95; // Excellent low resting HR
    else if (rhrDeltaBpm <= 2) rhrScore = 85; // Normal baseline
    else if (rhrDeltaBpm <= 5) rhrScore = 60; // Mild fatigue or dehydration
    else rhrScore = 30; // Elevated RHR (+6 bpm): viral infection or acute overreaching!
  }

  // Weighted composite score
  let compositeScore = Math.round(sleepScore * 0.35 + hrvScore * 0.40 + rhrScore * 0.25);

  // If Garmin provides a direct Firstbeat trainingReadinessScore, fuse it 50/50
  if (typeof wellness.trainingReadinessScore === 'number' && wellness.trainingReadinessScore > 0) {
    compositeScore = Math.round((compositeScore + wellness.trainingReadinessScore) / 2);
  }

  // Bound to 1 - 100
  compositeScore = Math.max(5, Math.min(100, compositeScore));

  // 4. Intraday Activity Modulation
  const todayTotalMins = todayActivities.reduce((acc, a) => acc + (a.durationMinutes || 0), 0);
  const todayTotalLoad = todayActivities.reduce((acc, a) => acc + (a.trainingLoad || Math.round((a.durationMinutes || 0) * 0.8)), 0);

  // Case A: The prescribed workout is already completed today!
  if (isTodaySessionCompleted) {
    return {
      score: compositeScore,
      status: 'COMPLETED',
      statusLabel: 'Séance Réalisée (Récupération)',
      badgeEmoji: '🏁',
      badgeColorHex: '#38bdf8',
      headline: 'Séance Validée : Assimilation en Cours',
      summary: `Entraînement complété aujourd'hui (${todayTotalMins > 0 ? todayTotalMins + ' min' : 'validé sur Garmin'}). Fenêtre de récupération active : reconstituez les réserves hydriques et glycogéniques.`,
      isCompleted: true,
      completedActivitiesCount: Math.max(1, todayActivities.length),
      intradayLoad: todayTotalLoad,
      factors: {
        sleepScore,
        sleepDurationHours: Math.round(sleepDurationHours * 10) / 10,
        hrvScore,
        hrvStatus,
        rhrDeltaBpm,
        rhrBpm: currentRhr
      }
    };
  }

  // Case B: Activities performed earlier today without yet completing the main prescribed workout
  if (todayActivities.length > 0 && todayTotalMins >= 20) {
    let fatiguePenalty = 10;
    if (todayTotalMins >= 60 || todayTotalLoad >= 100) {
      fatiguePenalty = 25;
    } else if (todayTotalMins >= 40 || todayTotalLoad >= 60) {
      fatiguePenalty = 18;
    }
    compositeScore = Math.max(15, compositeScore - fatiguePenalty);
  }

  let status: ReadinessStatus = 'OPTIMAL';
  let statusLabel = 'Prêt pour l\'intensité';
  let badgeEmoji = '🟢';
  let badgeColorHex = '#10b981';
  let headline = 'Feu Vert : Entraînement Cible Optimal';
  let summary = `Excellente récupération : Sommeil de ${Math.floor(sleepDurationHours)}h${Math.round((sleepDurationHours % 1) * 60)} et statut VFC équilibré. Vos capacités cardiorespiratoires sont au maximum pour les séances de puissance ou de côte.`;

  if (compositeScore < 50) {
    status = 'LOW';
    statusLabel = 'Alerte Récupération';
    badgeEmoji = '🔴';
    badgeColorHex = '#ef4444';
    headline = 'Vigilance : Système Nerveux Sous Tension';
    summary = `Fatigue accumulée détectée (Score ${compositeScore}/100) : VFC ${hrvStatus.toLowerCase()} et sommeil insuffisant (${sleepDurationHours.toFixed(1)}h). Recommandation : Alléger la séance du jour ou reporter les intensités.`;
  } else if (compositeScore < 75) {
    status = 'MODERATE';
    statusLabel = 'Récupération Modérée';
    badgeEmoji = '🟡';
    badgeColorHex = '#f59e0b';
    headline = 'Forme Moyenne : Privilégier l\'Endurance Z2';
    summary = `Niveau de fraîcheur intermédiaire (${compositeScore}/100). Vous pouvez vous entraîner, mais évitez de pousser dans les zones maximales (Z5). Privilégiez l'endurance fondamentale ou le renforcement sans échec musculaire.`;
  }

  // If activities were already performed earlier today, mention it clearly in the summary
  if (todayActivities.length > 0 && todayTotalMins >= 20) {
    summary += ` ⚠️ Activité préalable enregistrée ce matin (${todayTotalMins} min) : réserves partiellement entamées pour la séance du soir.`;
  }

  return {
    score: compositeScore,
    status,
    statusLabel,
    badgeEmoji,
    badgeColorHex,
    headline,
    summary,
    isCompleted: false,
    completedActivitiesCount: todayActivities.length,
    intradayLoad: todayTotalLoad,
    factors: {
      sleepScore,
      sleepDurationHours: Math.round(sleepDurationHours * 10) / 10,
      hrvScore,
      hrvStatus,
      rhrDeltaBpm,
      rhrBpm: currentRhr
    }
  };
}

export interface ProactivePlanRecommendation {
  shouldAdapt: boolean;
  actionType: 'NONE' | 'LIGHTEN' | 'POSTPONE';
  actionButtonText?: string;
  recommendationText: string;
  adaptedTitle?: string;
  adaptedDescription?: string;
  adaptedDurationMinutes?: number;
}

/**
 * Evaluates whether today's planned session should be proactively adapted
 * when Garmin reveals low readiness or severe nocturnal autonomic stress.
 * If the session is already completed or readiness status is COMPLETED, no adaptation alert is generated.
 */
export function getProactivePlanRecommendation(
  readiness: ReadinessEvaluation,
  todayEvent?: CalendarEvent | null,
  isCompleted: boolean = false
): ProactivePlanRecommendation {
  // If the session has already been executed, DO NOT ask the user to postpone or lighten it!
  if (isCompleted || readiness.status === 'COMPLETED') {
    return {
      shouldAdapt: false,
      actionType: 'NONE',
      recommendationText: 'Séance du jour déjà exécutée et validée sur Garmin Connect. Phase de récupération en cours.'
    };
  }

  if (!todayEvent || todayEvent.category !== 'sport' || readiness.status === 'OPTIMAL') {
    return {
      shouldAdapt: false,
      actionType: 'NONE',
      recommendationText: 'Votre état de forme est optimal pour exécuter le plan tel que prévu.'
    };
  }

  const isIntenseOrHill = todayEvent.sportType === 'TRAIL_INTENSE';
  const isLong = todayEvent.sportType === 'TRAIL_LONG';

  if (readiness.status === 'LOW') {
    if (isIntenseOrHill) {
      return {
        shouldAdapt: true,
        actionType: 'LIGHTEN',
        actionButtonText: 'Convertir en Footing Récup Z1 (35 min)',
        recommendationText: '⚠️ Alerte VFC basse : Vos réserves nerveuses sont entamées. Les répétitions de côtes à FC 180+ bpm risquent d\'engendrer un surentraînement ou une blessure tendineuse.',
        adaptedTitle: '🏃 Footing Aérobie Doux & Récupération Z1',
        adaptedDescription: '• Séance allégée automatique pour préserver le système nerveux :\n• 35 minutes de trot très souple strictly en Zone 1 (FC < 135 bpm).\n• Respiration 100% nasale, zéro intensité.',
        adaptedDurationMinutes: 35
      };
    }

    if (isLong) {
      return {
        shouldAdapt: true,
        actionType: 'POSTPONE',
        actionButtonText: 'Reporter la Sortie Longue',
        recommendationText: '⚠️ Sommeil et VFC dégradés avant une sortie longue : Il est recommandé de décaler la séance de 24h ou d\'écourter la durée.',
        adaptedDurationMinutes: Math.round(todayEvent.durationMinutes * 0.65)
      };
    }

    return {
      shouldAdapt: true,
      actionType: 'LIGHTEN',
      actionButtonText: 'Alléger la séance',
      recommendationText: 'Fatigue élevée détectée : Réduisez le volume de 30% et évitez d\'aller à l\'échec musculaire.',
      adaptedDurationMinutes: Math.max(25, Math.round(todayEvent.durationMinutes * 0.7))
    };
  }

  // MODERATE
  if (isIntenseOrHill) {
    return {
      shouldAdapt: true,
      actionType: 'LIGHTEN',
      actionButtonText: 'Réduire le nombre de répétitions (1 série au lieu de 2)',
      recommendationText: 'Récupération partielle : Vous pouvez faire les côtes, mais limitez le volume d\'intervalles pour ne pas creuser la dette de fatigue.',
      adaptedDurationMinutes: Math.round(todayEvent.durationMinutes * 0.85)
    };
  }

  return {
    shouldAdapt: false,
    actionType: 'NONE',
    recommendationText: 'Séance réalisable en contrôlant strictement les pulsations cardiaques en endurance de base.'
  };
}
