import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, ComparisonStatus, GarminActivity } from '../types/garmin';
import { classifyGarminActivityType, inferOtherProfileCategory } from './activityClassifier';
import { formatDateKey } from './icsParser';
import { GLOBAL_APP_CONFIG } from './periodizationEngine';

export interface WeeklyStatsSummary {
  plannedDurationMin: number;
  actualDurationMin: number;
  durationCompliancePct: number;
  plannedElevationM: number;
  actualElevationM: number;
  actualElevationLossM: number;
  elevationCompliancePct: number;
  avgHeartRate: number;
  overallComplianceScore: number;
  compliantCount: number;
  partialCount: number;
  missedCount: number;
  unplannedCount: number;
  pendingCount: number;
  estimatedTss: number;
  totalGarminTrainingLoad: number;
  hasNativeGarminLoad: boolean;
}

/**
 * Extrait la clé de date locale YYYY-MM-DD d'une activité Garmin sans dérive de fuseau horaire.
 */
export function getGarminLocalDateKey(act: GarminActivity): string {
  if (act.startTimeLocal) {
    return act.startTimeLocal.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compare les séances prévues avec les activités Garmin réelles.
 */
export function compareWorkoutsWithGarmin(
  plannedEvents: CalendarEvent[],
  garminActivities: GarminActivity[],
  manualPairs: Record<string, string> = {},
  asOfDate: Date = new Date()
): ActivityComparison[] {
  const comparisons: ActivityComparison[] = [];
  const matchedGarminIds = new Set<string>();

  const sportPlans = plannedEvents.filter(e => e.category === 'sport');

  const asOfKey = formatDateKey(asOfDate);

  // Évaluation des séances prévues jusqu'à la date de référence
  for (const plan of sportPlans) {
    const planDate = new Date(plan.startDate);
    const dateKey = formatDateKey(planDate);

    // Ne pas évaluer les séances dans le futur
    if (dateKey > asOfKey) {
      continue;
    }

    let bestMatch: GarminActivity | undefined = undefined;

    // 1. Vérification d'un appairage manuel
    if (manualPairs[plan.id]) {
      const pairedActId = manualPairs[plan.id];
      bestMatch = garminActivities.find(a => a.activityId === pairedActId);
    }

    // 2. Recherche automatique de correspondance intelligente le même jour local
    if (!bestMatch) {
      const sameDayActivities = garminActivities.filter(act => {
        if (matchedGarminIds.has(act.activityId)) return false;
        return getGarminLocalDateKey(act) === dateKey;
      });

      if (sameDayActivities.length > 0) {
        // Classement de toutes les activités du jour selon leur score de compatibilité
        const MIN_MATCH_CONFIDENCE = 50;
        const scoredCandidates = sameDayActivities
          .map(act => ({ act, score: scoreActivityMatch(plan, act) }))
          .filter(candidate => candidate.score >= MIN_MATCH_CONFIDENCE)
          .sort((a, b) => b.score - a.score);

        if (scoredCandidates.length > 0) {
          bestMatch = scoredCandidates[0].act;
        }
      }
    }

    if (bestMatch) {
      matchedGarminIds.add(bestMatch.activityId);
      const comparison = evaluateSingleWorkout(plan, bestMatch, dateKey);
      comparisons.push(comparison);
    } else if (dateKey === asOfKey) {
      // Séance d'aujourd'hui pas encore téléversée
      comparisons.push({
        id: `comp-pending-${plan.id}`,
        date: dateKey,
        status: 'PENDING',
        plannedEvent: plan,
        durationDeltaMinutes: 0,
        complianceScore: 100,
        heartRateCompliance: 'N/A',
        feedbackNotes: [
          `Prévue aujourd'hui (${plan.durationMinutes} min prescrites). En attente de réalisation sur Garmin.`,
          "Enregistre ta séance sur ta montre pour afficher la télémétrie en direct."
        ]
      });
    } else {
      // Séance passée non réalisée
      comparisons.push({
        id: `comp-missed-${plan.id}`,
        date: dateKey,
        status: 'MISSED',
        plannedEvent: plan,
        durationDeltaMinutes: -plan.durationMinutes,
        complianceScore: 0,
        heartRateCompliance: 'N/A',
        feedbackNotes: [
          `Séance passée non enregistrée sur Garmin Connect (${plan.durationMinutes} min prescrites).`,
          "Si elle a été enregistrée sous le profil 'Autre' ou à une autre date, tu peux la lier manuellement."
        ]
      });
    }
  }

  // Identification des activités bonus / non planifiées (uniquement jusqu'à asOfDate)
  for (const act of garminActivities) {
    const dateKey = getGarminLocalDateKey(act);

    if (dateKey > asOfKey) {
      continue;
    }

    if (!matchedGarminIds.has(act.activityId)) {
      const inferred = act.activityType === 'OTHER' ? inferOtherProfileCategory(act) : undefined;

      const bonusNotes = [
        `Activité Garmin enregistrée : ${act.activityName} (${act.durationMinutes} min)${inferred ? ` [Profil inféré : ${inferred}]` : ''}.`
      ];
      if (act.avgPaceMinKm) bonusNotes.push(`Allure moyenne : ${act.avgPaceMinKm}`);
      if (act.elevationGainM || act.elevationLossM) {
        bonusNotes.push(`Dénivelé : +${act.elevationGainM || 0}m / -${act.elevationLossM || 0}m`);
      }
      if (act.trainingLoad) bonusNotes.push(`Charge EPOC : ${act.trainingLoad}`);
      bonusNotes.push("Séance bonus réalisée.");

      comparisons.push({
        id: `comp-unplanned-${act.activityId}`,
        date: dateKey,
        status: 'UNPLANNED',
        actualActivity: act,
        durationDeltaMinutes: act.durationMinutes,
        complianceScore: 100,
        heartRateCompliance: 'OPTIMAL',
        inferredType: inferred,
        feedbackNotes: bonusNotes
      });
    }
  }

  // Tri chronologique décroissant (du plus récent au plus ancien)
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
  let actualElevationLossM = 0;
  let totalGarminTrainingLoad = 0;
  let hasNativeGarminLoadCount = 0;
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
      continue;
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
      actualElevationLossM += c.actualActivity.elevationLossM || 0;
      if (c.actualActivity.trainingLoad) {
        totalGarminTrainingLoad += c.actualActivity.trainingLoad;
        hasNativeGarminLoadCount++;
      }
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
  const avgHeartRate = hrCount > 0 ? Math.round(hrSum / hrCount) : 0;

  // Calcul du score de charge :
  // 1. Si des séances contiennent la vraie charge Firstbeat EPOC de Garmin, on l'utilise directement !
  // 2. Sinon, calcul synthétique basé sur le cardio si présent, ou sur le volume d'effort.
  const hasNativeGarminLoad = hasNativeGarminLoadCount > 0;
  const estimatedTss = hasNativeGarminLoad
    ? Math.round(totalGarminTrainingLoad)
    : (avgHeartRate > 0
        ? Math.round((actualDurationMin / 60) * ((avgHeartRate / GLOBAL_APP_CONFIG.ATHLETE_FC_MAX) ** 2) * 100)
        : Math.round((actualDurationMin / 60) * 55));

  return {
    plannedDurationMin,
    actualDurationMin,
    durationCompliancePct,
    plannedElevationM,
    actualElevationM,
    actualElevationLossM,
    elevationCompliancePct,
    avgHeartRate,
    overallComplianceScore,
    compliantCount,
    partialCount,
    missedCount,
    unplannedCount,
    pendingCount,
    estimatedTss,
    totalGarminTrainingLoad,
    hasNativeGarminLoad
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

  const isOther = act.activityType === 'OTHER';
  let inferredType: string | undefined = undefined;

  if (isOther) {
    inferredType = inferOtherProfileCategory(act);
    if (inferredType) {
      feedbackNotes.push(
        `🏷️ Enregistrée sous le profil "Autre" sur la montre → Détectée comme : ${inferredType}.`
      );
    } else {
      feedbackNotes.push(
        `🏷️ Enregistrée sous le profil générique "Autre" sur la montre.`
      );
    }
  }

  // 1. Évaluation de la durée
  const durationDiffPercent = Math.abs(durationDelta) / plan.durationMinutes;
  if (durationDiffPercent > 0.35) {
    score -= 25;
    feedbackNotes.push(
      durationDelta > 0
        ? `Durée : +${durationDelta} min (${act.durationMinutes} min réelles vs ${plan.durationMinutes} min prévues).`
        : `Durée : -${Math.abs(durationDelta)} min (${act.durationMinutes} min réelles vs ${plan.durationMinutes} min prévues).`
    );
  } else if (durationDiffPercent > 0.12) {
    score -= 10;
    feedbackNotes.push(
      `Durée conforme (${act.durationMinutes} min réelles vs ${plan.durationMinutes} min prévues, écart ${durationDelta > 0 ? '+' : ''}${durationDelta} min).`
    );
  } else {
    feedbackNotes.push(`Durée prescrite strictement respectée (${act.durationMinutes} min).`);
  }

  // 2. Évaluation de la fréquence cardiaque (FCmax = 203 bpm)
  let hrCompliance: 'OPTIMAL' | 'TOO_HIGH' | 'TOO_LOW' | 'N/A' = 'OPTIMAL';
  const targetRange = plan.metadata?.targetHeartRateRange;

  if (act.avgHeartRate && targetRange) {
    const [minTarget, maxTarget] = targetRange;
    if (act.avgHeartRate > maxTarget + 5) {
      hrCompliance = 'TOO_HIGH';
      score -= 20;
      feedbackNotes.push(
        `⚠️ Fréquence cardiaque élevée : moy. ${act.avgHeartRate} bpm (plafond cible : ${maxTarget} bpm). Risque d'épuisement prématuré.`
      );
    } else if (act.avgHeartRate < minTarget - 12) {
      hrCompliance = 'TOO_LOW';
      score -= 10;
      feedbackNotes.push(
        `Fréquence cardiaque sous la zone cible (${act.avgHeartRate} bpm vs cible ${minTarget}-${maxTarget} bpm). Effort de récupération très doux.`
      );
    } else {
      hrCompliance = 'OPTIMAL';
      feedbackNotes.push(
        `🎯 Cardio optimal : FC moy. ${act.avgHeartRate} bpm parfaitement calée dans la zone cible (${minTarget}-${maxTarget} bpm).`
      );
    }
  }

  // 3. Évaluation du dénivelé D+ (séances trail)
  let elevationDeltaM: number | undefined = undefined;
  if (plan.metadata?.targetElevationM && act.elevationGainM !== undefined) {
    elevationDeltaM = act.elevationGainM - plan.metadata.targetElevationM;
    if (Math.abs(elevationDeltaM) > 70) {
      feedbackNotes.push(
        `Dénivelé D+ : +${act.elevationGainM} m réalisés (${elevationDeltaM > 0 ? '+' : ''}${elevationDeltaM} m vs cible +${plan.metadata.targetElevationM} m).`
      );
    } else {
      feedbackNotes.push(`Cible de dénivelé D+ atteinte : +${act.elevationGainM} m (cible ~${plan.metadata.targetElevationM} m).`);
    }
  }

  // 4. Métriques Firstbeat & Terrain supplémentaires
  if (act.trainingEffectLabel || act.aerobicTrainingEffect !== undefined) {
    const teParts = [
      act.trainingEffectLabel ? `Bénéfice : ${act.trainingEffectLabel}` : '',
      act.aerobicTrainingEffect !== undefined ? `Aérobie ${act.aerobicTrainingEffect}/5` : '',
      act.anaerobicTrainingEffect !== undefined ? `Anaérobie ${act.anaerobicTrainingEffect}/5` : ''
    ].filter(Boolean);
    feedbackNotes.push(`⚡ Firstbeat : ${teParts.join(' • ')}`);
  }
  if (act.trainingLoad) {
    feedbackNotes.push(`📊 Charge EPOC native : ${act.trainingLoad} pts`);
  }
  if (act.elevationLossM) {
    feedbackNotes.push(`⛰️ Dénivelé négatif D- : -${act.elevationLossM} m`);
  }
  if (act.avgPaceMinKm) {
    feedbackNotes.push(`⏱️ Allure moyenne : ${act.avgPaceMinKm}`);
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

/**
 * Calcule un score de pertinence pour associer une activité Garmin à une séance prescrite.
 * Un score < 50 élimine catégoriquement l'activité comme candidate automatique.
 */
function scoreActivityMatch(plan: CalendarEvent, act: GarminActivity): number {
  const planType = plan.sportType;
  const actType = act.activityType;
  const key = (act.garminTypeKey || '').toLowerCase();
  const actName = (act.activityName || '').toLowerCase();

  const isPlanRunning = planType === 'RUN_EASY' || planType === 'TRAIL_LONG' || planType === 'TRAIL_INTENSE';
  const isPlanStrength = planType === 'CALISTHENICS' || planType === 'GYM_FORCE';
  const isPlanMobility = planType === 'MOBILITY';

  // 1. Incompatibilités strictes de discipline
  const classifiedType = classifyGarminActivityType(act.garminTypeKey, act.activityName);
  const effectiveActType = (actType === 'OTHER' || !actType) ? classifiedType : actType;

  if (effectiveActType === 'CLIMBING') {
    return -1000;
  }
  if (effectiveActType === 'CYCLING' && (isPlanRunning || isPlanStrength)) {
    return -1000;
  }
  if (effectiveActType === 'WALKING' && isPlanRunning) {
    return -1000;
  }

  // 2. Évaluation pour un plan de Course à pied / Trail
  if (isPlanRunning) {
    const isActRunning =
      actType === 'RUNNING' ||
      actType === 'TRAIL_RUNNING' ||
      key.includes('run') ||
      key.includes('trail');

    // Si l'activité n'est pas enregistrée comme course, elle ne peut s'associer QUE si elle possède une télémétrie de course irréfutable
    if (!isActRunning) {
      const hasClearRunningTelemetry =
        actType === 'OTHER' &&
        (act.distanceKm || 0) >= 1.5 &&
        ((act.avgCadence || 0) >= 130 || act.avgPaceMinKm !== undefined);

      if (!hasClearRunningTelemetry) {
        // Activité non course (ex: Rave, profil Autre, soirée, etc.) -> disqualification stricte
        return -1000;
      }
    }

    let score = 0;
    if (planType === 'TRAIL_INTENSE' || planType === 'TRAIL_LONG') {
      if (actType === 'TRAIL_RUNNING' || key.includes('trail')) score += 100;
      else if (actType === 'RUNNING' || key.includes('run')) score += 75;
      else score += 50;
    } else if (planType === 'RUN_EASY') {
      if (actType === 'RUNNING' || key.includes('run')) score += 100;
      else if (actType === 'TRAIL_RUNNING' || key.includes('trail')) score += 80;
      else score += 50;
    }

    // Proximité de durée
    const planDuration = Math.max(1, plan.durationMinutes);
    const durationDiff = Math.abs(act.durationMinutes - planDuration);
    const durationRatio = durationDiff / planDuration;

    if (durationRatio <= 0.25) {
      score += 25;
    } else if (durationRatio <= 0.5) {
      score += 10;
    } else if (durationRatio > 0.8) {
      score -= 25;
    }

    if (act.distanceKm && act.distanceKm >= 1.0) score += 15;
    if (act.avgCadence && act.avgCadence >= 130) score += 10;

    return score;
  }

  // 3. Évaluation pour un plan de Musculation / Calisthénie
  if (isPlanStrength) {
    const isActStrength =
      actType === 'STRENGTH_TRAINING' ||
      actType === 'FITNESS_EQUIPMENT' ||
      key.includes('strength') ||
      key.includes('gym') ||
      key.includes('fitness') ||
      key.includes('cardio') ||
      key.includes('hiit') ||
      key.includes('crossfit') ||
      key.includes('calisthenics');

    // Si c'est une activité de course ou de vélo, exclusion
    if (actType === 'RUNNING' || actType === 'TRAIL_RUNNING' || actType === 'CYCLING') {
      return -1000;
    }

    if (!isActStrength) {
      // Pour une activité "OTHER", elle ne doit pas avoir de distance ni de cadence de course
      if ((act.distanceKm || 0) > 0.5 || (act.avgCadence || 0) > 120) {
        return -1000;
      }
      if (act.durationMinutes < 20) {
        return -1000;
      }
    }

    let score = isActStrength ? 100 : 50;

    const planDuration = Math.max(1, plan.durationMinutes);
    const durationDiff = Math.abs(act.durationMinutes - planDuration);
    const durationRatio = durationDiff / planDuration;

    if (durationRatio <= 0.25) score += 25;
    else if (durationRatio <= 0.5) score += 10;
    else if (durationRatio > 0.8) score -= 25;

    return score;
  }

  // 4. Évaluation pour un plan de Mobilité / Yoga / Étirements
  if (isPlanMobility) {
    const isActMobility =
      key.includes('yoga') ||
      key.includes('pilates') ||
      key.includes('stretch') ||
      key.includes('breathwork') ||
      key.includes('mobility') ||
      actName.includes('yoga') ||
      actName.includes('stretch') ||
      actName.includes('mobil');

    if (!isActMobility) {
      return -1000;
    }
    return 100;
  }

  return 0;
}
