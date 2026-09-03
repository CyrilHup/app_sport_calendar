import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, ComparisonStatus, GarminActivity } from '../types/garmin';

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

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

    // 2. Recherche automatique de correspondance le même jour
    if (!bestMatch) {
      const sameDayActivities = garminActivities.filter(act => {
        if (matchedGarminIds.has(act.activityId)) return false;
        const actDate = new Date(act.startTimeLocal);
        return formatDateKey(actDate) === dateKey;
      });

      if (sameDayActivities.length > 0) {
        bestMatch = sameDayActivities.find(act =>
          isActivityTypeCompatible(plan.sportType, act.activityType)
        ) || sameDayActivities[0];
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
    const actDate = new Date(act.startTimeLocal);
    const dateKey = formatDateKey(actDate);

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
          `Activité Garmin enregistrée : ${act.activityName} (${act.durationMinutes} min)${act.activityType === 'OTHER' ? ` [Profil inféré : ${inferred}]` : ''}.`,
          "Séance bonus réalisée."
        ]
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

  // Calcul estimé du TSS basé sur la durée et le ratio d'intensité cardiaque
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

  const isOther = act.activityType === 'OTHER';
  let inferredType: string | undefined = undefined;

  if (isOther) {
    inferredType = inferOtherActivityCategory(act);
    feedbackNotes.push(
      `🏷️ Enregistrée sous le profil "Autre" sur la montre → Détectée comme : ${inferredType}.`
    );
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
    return 'Trail / Côtes (Mont-Royal)';
  }
  if (hr > 165 || name.includes('fractionné') || name.includes('interval') || name.includes('intense')) {
    return 'Cardio Haute Intensité (Zone 4/5)';
  }
  if (dist > 3 || (act.avgCadence && act.avgCadence > 150) || name.includes('course') || name.includes('footing') || name.includes('run')) {
    return 'Endurance Fondamentale (Zone 2)';
  }
  if (name.includes('gym') || name.includes('calisth') || name.includes('dips') || name.includes('pull') || dist === 0) {
    return 'Calisthénie / Musculation (Gym ÉTS)';
  }
  return 'Séance d\'Entraînement Générale';
}
