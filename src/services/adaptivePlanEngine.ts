import {
  CalendarEvent,
  DailySchedule,
  AdaptiveWorkoutOverride,
  AdaptiveWorkoutAction,
  AdaptivePlanStatus
} from '../types/calendar';
import { TrainingLoadStats } from './statsEngine';
import { ReadinessEvaluation } from './readinessEngine';
import { STORAGE_KEYS, storageGet, storageSet } from './storageService';
import { toLocalDateKey } from './dateUtils';
import { ACWR_POLICY, ADAPTIVE_WORKOUT_POLICY } from './trainingModelConfig';
import { AdaptivePlanState, parseAdaptivePlanState, serializeAdaptivePlanState } from './adaptivePlanStore';

export const ADAPTIVE_PLAN_STORAGE_KEY = STORAGE_KEYS.ADAPTIVE_OVERRIDES;

function formatHeartRateRange(range: readonly [number, number]): string {
  return `${range[0]} - ${range[1]} bpm`;
}

/**
 * Charge les adaptations actives du plan depuis le localStorage.
 * Auto-assainit les corruptions éventuelles (ex: séances majeures écrasées à 0m).
 */
export function loadAdaptivePlanState(): AdaptivePlanState {
  const loaded = parseAdaptivePlanState(storageGet<unknown>(ADAPTIVE_PLAN_STORAGE_KEY, {}));
  const sanitized: Record<string, AdaptiveWorkoutOverride> = {};
  let hadCorrupted = false;

  for (const [id, ov] of Object.entries(loaded.overrides)) {
    const titleLower = (ov.originalTitle || ov.adaptedTitle || '').toLowerCase();
    const isMajorWorkout = (ov.originalDurationMinutes && ov.originalDurationMinutes >= ADAPTIVE_WORKOUT_POLICY.longWorkoutThresholdMinutes) ||
      titleLower.includes('côte') ||
      titleLower.includes('hill') ||
      titleLower.includes('long') ||
      titleLower.includes('rando-course');

    // Une séance majeure (côtes ou sortie longue) ne doit JAMAIS être à 0 min
    if (ov.adaptedDurationMinutes === 0 && isMajorWorkout) {
      hadCorrupted = true;
      continue;
    }
    sanitized[id] = ov;
  }

  if (hadCorrupted) {
    saveAdaptivePlanState({ ...loaded, overrides: sanitized });
  }

  return { ...loaded, overrides: sanitized };
}

export function saveAdaptivePlanState(state: AdaptivePlanState): void {
  storageSet(ADAPTIVE_PLAN_STORAGE_KEY, JSON.parse(serializeAdaptivePlanState(state)));
}

export const AUTO_ADAPT_STORAGE_KEY = STORAGE_KEYS.AUTO_ADAPT_ENABLED;

/**
 * Indique si le mode Auto-Pilot Adaptatif est activé.
 * Active les adaptations de précaution fondées sur la récupération, pas sur une zone ACWR prétendument sûre.
 */
export function isAutoAdaptEnabled(): boolean {
  return storageGet<boolean>(AUTO_ADAPT_STORAGE_KEY, true);
}

/**
 * Active ou désactive le mode Auto-Pilot Adaptatif.
 */
export function setAutoAdaptEnabled(enabled: boolean): void {
  storageSet(AUTO_ADAPT_STORAGE_KEY, enabled);
}

/**
 * Évalue l'état de charge spécifique Trail, la fatigue et la récupération pour déterminer
 * si des adaptations intelligentes sont nécessaires sur les séances de la semaine.
 * RÈGLE D'OR : Les séances passées (< asOfDate) ou déjà réalisées sont STRICTEMENT GELÉES
 * et ne peuvent jamais être ré-adaptées ni modifiées. Seules les séances futures non exécutées
 * sont modulées.
 */
export function evaluateAdaptivePlanStatus(
  trainingLoad: TrainingLoadStats,
  readiness: ReadinessEvaluation,
  upcomingSportEvents: CalendarEvent[],
  activeOverrides: Record<string, AdaptiveWorkoutOverride> = {},
  asOfDate?: Date,
  completedEventIds: Set<string> = new Set(),
  repeatedLowFeeling = false
): AdaptivePlanStatus {
  const asOfInstant = asOfDate?.getTime();

  const isEligibleForAdaptation = (ev: CalendarEvent) => {
    if (ev.metadata?.isPostponedPlaceholder) return false;
    if (ev.metadata?.isCompleted) return false;
    if (completedEventIds.has(ev.id)) return false;
    // A session started earlier today is already fixed, even if its date key
    // still equals today's date and Garmin completion has not arrived yet.
    if (asOfInstant !== undefined && new Date(ev.startDate).getTime() <= asOfInstant) return false;
    return true;
  };

  const trailAcwrRatio = trainingLoad.trailAcwrRatio;
  const trailAcwrStatus = trainingLoad.trailAcwrStatus;
  const trailAcute = trainingLoad.trailAcuteLoad7d;
  const trailChronic = trainingLoad.trailChronicLoad28dWeeklyAvg;
  const calisAcute = trainingLoad.calisthenicsAcuteLoad7d;
  const calisSessions = trainingLoad.calisthenicsSessionsCount7d;
  const tsb = trainingLoad.currentTsb;
  const adaptationPolicy = ADAPTIVE_WORKOUT_POLICY;
  const isAcwrCalibrating = trailAcwrStatus === 'CALIBRATING';
  const acwrElevated = !isAcwrCalibrating && trailAcwrRatio > ACWR_POLICY.moderateAbove;
  const acwrUnderload = !isAcwrCalibrating && trailAcwrRatio < ACWR_POLICY.underloadBelow;

  const hasActiveAdaptations = Object.keys(activeOverrides).length > 0;
  const recommendedActions: AdaptiveWorkoutAction[] = [];

  let injuryRiskLevel: 'SAFE' | 'MODERATE' | 'HIGH' = 'SAFE';
  let headline = isAcwrCalibrating
    ? 'Historique de course insuffisant pour interpréter le ratio'
    : 'Charge de course suivie';
  let explanation = isAcwrCalibrating
    ? `Le ratio ACWR mécanique (${trailAcwrRatio}) reste indicatif, car l'historique de course est encore en calibration. Il ne déclenche pas seul d'adaptation ; la fatigue systémique (TSB) et la récupération peuvent toujours en déclencher une.`
    : `Le ratio de charge de course est de ${trailAcwrRatio} (${trailAcute} Km-Effort sur 7 jours, contre ${trailChronic} par semaine en moyenne sur 28 jours). Il décrit une variation de charge, sans prédire votre risque individuel de blessure. Renforcement : ${calisSessions} séance(s) sur 7 jours, ${calisAcute} unités de charge estimées ; les jambes peuvent aussi être fatiguées par ces séances.`;

  // A ratio alone has no validated causal injury threshold. Automatic changes
  // require an independent recovery signal; ACWR remains descriptive.
  if (tsb < ACWR_POLICY.severeFatigueTsbBelow) {
    injuryRiskLevel = 'HIGH';
    const dangerContext = `TSB estimé ${tsb} < ${ACWR_POLICY.severeFatigueTsbBelow}`;
    headline = '⚠️ Alerte Charge ou Fatigue : Plan Allégé';
    explanation = `Alerte de charge ou de fatigue (${dangerContext}). Le plan limite les Km-Effort et le D+ futurs pour réduire les impacts prévus, sans modifier rétroactivement la charge déjà mesurée.`;

    // Générer les actions ciblées sur les séances de la semaine
    for (const ev of upcomingSportEvents) {
      if (!isEligibleForAdaptation(ev)) continue;

      const dateStr = toLocalDateKey(ev.startDate);
      // Toujours évaluer sur la base des métriques NOMINALES d'origine pour éviter tout effet d'escalier ou cascade à 0
      const origDuration = ev.metadata?.originalDurationMinutes ?? ev.durationMinutes;
      const origSportType = ev.metadata?.originalSportType ?? ev.sportType;
      const origTitle = ev.metadata?.originalTitle ?? ev.title;
      const titleLower = origTitle.toLowerCase();
      const origElevation = ev.metadata?.originalElevationM ?? ev.metadata?.targetElevationM ??
        (origSportType === 'RUN_EASY' ? 0 : Math.round(origDuration * adaptationPolicy.assumedTrailElevationPerMinuteMeters));

      const isSecondaryFatigued = origDuration < adaptationPolicy.longWorkoutThresholdMinutes && (
        titleLower.includes('fatigued') ||
        titleLower.includes('rolling') ||
        (titleLower.includes('récupération') && !titleLower.includes('côte') && !titleLower.includes('hill'))
      );

      const isHillRepeats = origSportType === 'TRAIL_INTENSE' || titleLower.includes('côte') || titleLower.includes('hill');
      const isLongTrail = (origSportType === 'TRAIL_LONG' || titleLower.includes('long') || titleLower.includes('rando-course')) &&
        origDuration >= adaptationPolicy.longWorkoutThresholdMinutes;

      // a. Séances secondaires de fatigue cumulée (sous le seuil de séance majeure) : repos complet
      if (isSecondaryFatigued) {
        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: origTitle,
          adaptedTitle: '🛡️ Repos de récupération (fatigue élevée)',
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: 0,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'REST',
          reason: `Séance de fatigue cumulée annulée (repos complet) pour éviter des impacts supplémentaires dans le contexte ${dangerContext}.`,
          coachingCue: 'Repos ou mobilité douce selon les sensations ; réévaluer les symptômes avant la reprise.',
          adaptedDescription: `• Adaptation de précaution (${dangerContext}) :\n• Séance remplacée par un repos complet pour éviter une charge supplémentaire.\n• Zéro impact au sol prévu.`,
          targetHeartRate: 'Repos',
          adaptedLocation: 'Domicile / Repos',
          adaptedElevationM: 0,
          adaptedSportType: 'MOBILITY'
        });
        continue;
      }

      // b. Traiter les séances dures de côtes (TRAIL_INTENSE) -> footing doux, jamais 0 min
      if (isHillRepeats) {
        const adaptedDurationMinutes = Math.min(adaptationPolicy.highRisk.hillRecoveryCapMinutes, origDuration);
        const recoveryHeartRateRange = adaptationPolicy.highRisk.recoveryHeartRateRangeBpm;
        const diffMin = origDuration - adaptedDurationMinutes;
        const reason = diffMin > 0
          ? `Allégement de ${diffMin} min (${origDuration} ➔ ${adaptedDurationMinutes} min) et terrain plat pour réduire la sollicitation des côtes et des descentes.`
          : 'Terrain plat pour réduire la sollicitation des côtes et des descentes.';

        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: origTitle,
          adaptedTitle: `🛡️ Footing Aérobie Doux & Récupération Z1/Z2 (${adaptedDurationMinutes} min)`,
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'LIGHTEN',
          reason,
          coachingCue: `${adaptedDurationMinutes} min de trot très souple en Zone 1/2 (aisance respiratoire totale), 100% sur terrain plat. Zéro répétition de côte.`,
          adaptedDescription: `• Adaptation de précaution (${dangerContext}) :\n• ${adaptedDurationMinutes} min de footing régénérant sur terrain plat (zéro dénivelé).\n• Pulsations strictement contrôlées : FC en Zone 1/2 légère (aisance respiratoire).\n• Zéro intensité en côte, zéro impact de descente rapide pour reposer les quadriceps et le tendon d'Achille.`,
          targetHeartRate: 'Zone 1/2 Récupération',
          targetHeartRateRange: [...recoveryHeartRateRange],
          adaptedLocation: 'Terrain plat / Parc (évite le D+)',
          adaptedElevationM: 0,
          adaptedSportType: 'RUN_EASY'
        });
        continue;
      }

      // c. Traiter la sortie longue avec les facteurs de réduction centralisés, jamais à 0 min
      if (isLongTrail) {
        const adaptedMins = Math.min(
          origDuration,
          Math.max(adaptationPolicy.highRisk.longTrailMinimumMinutes, Math.round(origDuration * adaptationPolicy.highRisk.longTrailDurationFactor))
        );
        const adaptedElevationM = Math.min(
          origElevation,
          Math.max(0, Math.round(origElevation * adaptationPolicy.highRisk.longTrailElevationFactor))
        );
        const longTrailHeartRateRange = adaptationPolicy.highRisk.longTrailHeartRateRangeBpm;
        const diffMin = origDuration - adaptedMins;
        const reason = diffMin > 0
          ? `Réduction de ${diffMin} min (${origDuration} ➔ ${adaptedMins} min) et D+ allégé à +${adaptedElevationM}m (au lieu de +${origElevation}m) pour limiter la charge mécanique future.`
          : `D+ allégé à +${adaptedElevationM}m (au lieu de +${origElevation}m) pour limiter la charge mécanique future.`;

        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: origTitle,
          adaptedTitle: `🛡️ Sortie longue allégée (${Math.floor(adaptedMins / 60)}h${(adaptedMins % 60).toString().padStart(2, '0')})`,
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: adaptedMins,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'LIGHTEN',
          reason,
          coachingCue: `Volume plafonné à ${adaptedMins} min et +${adaptedElevationM}m D+. Passer en marche active quand la pente ou la fatigue rend la course moins contrôlée.`,
          adaptedDescription: `• Adaptation de précaution (${dangerContext}) :\n• Durée ramenée à ${adaptedMins} min et D+ modulé à +${adaptedElevationM} m (au lieu de +${origElevation} m) pour limiter les impacts prévus.\n• Cardio : Zone 2 stricte.\n• Règle d'or : marcher activement en montée (power hike) dès que la pente dépasse ${adaptationPolicy.highRisk.walkingInclineThresholdPercent}%.\n• Éviter les descentes trop raides et techniques.`,
          targetHeartRate: 'Zone 2 Endurance douce',
          targetHeartRateRange: [...longTrailHeartRateRange],
          adaptedLocation: 'Mont-Royal (boucles douces / D+ allégé)',
          adaptedElevationM,
          adaptedSportType: 'TRAIL_LONG'
        });
        continue;
      }

      // d. Autres footings aérobie simples (RUN_EASY, ex: jeudi)
      if (origSportType === 'RUN_EASY') {
        const adaptedMins = Math.min(origDuration, adaptationPolicy.highRisk.easyRunCapMinutes);
        const recoveryHeartRateRange = adaptationPolicy.highRisk.recoveryHeartRateRangeBpm;
        const diffMin = origDuration - adaptedMins;
        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: origTitle,
          adaptedTitle: `🛡️ Footing Réduit Récupération (${adaptedMins} min)`,
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: adaptedMins,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'LIGHTEN',
          reason: diffMin > 0 ? `Durée ramenée à ${adaptedMins} min sur terrain plat pour limiter les impacts sans couper l'aérobie.` : 'Course sur terrain plat pour soulager les tendons.',
          coachingCue: `${adaptedMins} min de trot très souple en Zone 1/2.`,
          adaptedDescription: `• Footing raccourci à ${adaptedMins} min à plat pour réduire la contrainte prévue.`,
          targetHeartRate: 'Zone 1/2 Récupération',
          targetHeartRateRange: [...recoveryHeartRateRange],
          adaptedLocation: 'Terrain plat / Parc (évite le D+)',
          adaptedElevationM: 0,
          adaptedSportType: 'RUN_EASY'
        });
      }
    }
  }
  // 2. Recovery alert: the score is a heuristic, not a medical diagnosis.
  else if (repeatedLowFeeling || (!readiness.isDefaultBaseline && (readiness.status === 'LOW' || readiness.score < ACWR_POLICY.lowReadinessBelow))) {
    injuryRiskLevel = 'MODERATE';
    headline = '⚡ Récupération basse : vigilance recommandée';
    explanation = repeatedLowFeeling
      ? 'Deux séances ou plus ont été notées « faible » cette semaine. La prochaine séance intense peut être allégée par précaution ; ce signal subjectif ne diagnostique aucune blessure.'
      : 'Le score de récupération est bas. Une réduction de la prochaine séance intense est proposée comme précaution ; elle ne constitue pas un diagnostic de blessure.';

    for (const ev of upcomingSportEvents) {
      if (!isEligibleForAdaptation(ev)) continue;

      const dateStr = toLocalDateKey(ev.startDate);
      const origDuration = ev.metadata?.originalDurationMinutes ?? ev.durationMinutes;
      const origSportType = ev.metadata?.originalSportType ?? ev.sportType;
      const origTitle = ev.metadata?.originalTitle ?? ev.title;
      const titleLower = origTitle.toLowerCase();
      const origElevation = ev.metadata?.originalElevationM ?? ev.metadata?.targetElevationM ??
        (origSportType === 'RUN_EASY' ? 0 : adaptationPolicy.defaultTrailElevationMeters);

      const isHillRepeats = origSportType === 'TRAIL_INTENSE' || titleLower.includes('côte') || titleLower.includes('hill');

      if (isHillRepeats) {
        const hillPolicy = adaptationPolicy.moderateRisk;
        const adaptedMins = Math.min(origDuration, Math.max(hillPolicy.hillMinimumMinutes, Math.round(origDuration * hillPolicy.hillDurationFactor)));
        const adaptedElevationM = Math.min(origElevation, Math.round(origElevation * hillPolicy.hillElevationFactor));
        const heartRateRange = hillPolicy.hillTargetHeartRateRangeBpm;
        const hillSetCount = hillPolicy.hillSetCount;
        const originalHillSetCount = hillPolicy.originalHillSetCount;
        const diffMin = origDuration - adaptedMins;
        const reason = diffMin > 0
          ? `Réduction de ${diffMin} min (${origDuration} ➔ ${adaptedMins} min) et D+ limité à +${adaptedElevationM}m (${hillSetCount} série au lieu de ${originalHillSetCount}) pour tenir compte de la récupération basse.`
          : `D+ limité à +${adaptedElevationM}m (${hillSetCount} série de côtes au lieu de ${originalHillSetCount}) pour tenir compte de la récupération basse.`;

        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: origTitle,
          adaptedTitle: `⚡ Côtes Modérées : ${hillSetCount} série au lieu de ${originalHillSetCount} (${adaptedMins} min)`,
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: adaptedMins,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'LIGHTEN',
          reason,
          coachingCue: `Réaliser ${hillSetCount} seule série de répétitions de côtes au lieu de ${originalHillSetCount}. Descentes marchées très souples.`,
          adaptedDescription: `• Adaptation de précaution (récupération basse) :\n• Échauffement ${hillPolicy.hillWarmupMinutes} min + ${hillSetCount} série de côtes (${hillPolicy.hillRepetitionCount}x ${hillPolicy.hillRepetitionDurationMinutes} min) + retour au calme.\n• D+ limité à +${adaptedElevationM} m.\n• Effort confortable et descente maîtrisée.`,
          targetHeartRate: formatHeartRateRange(heartRateRange),
          adaptedLocation: 'Mont-Royal (pentes douces)',
          adaptedElevationM,
          adaptedSportType: 'TRAIL_INTENSE'
        });
      }
    }
  }
  // 3. A low ratio can reflect intentional rest; it must not force progression.
  else if (acwrUnderload) {
    injuryRiskLevel = 'SAFE';
    headline = 'Charge récente sous la moyenne';
    explanation = `Le ratio de charge de course (${trailAcwrRatio}) est sous la moyenne récente. Cela peut correspondre à une récupération voulue, une reprise ou des données incomplètes. La progression se décide avec les séances réalisées et les sensations.`;
  } else if (acwrElevated) {
    headline = 'Charge récente au-dessus de la moyenne';
    explanation += ' Vérifiez aussi les symptômes, le sommeil et les longues séances isolées avant de modifier le plan.';
  }

  return {
    injuryRiskLevel,
    trailAcwrRatio,
    trailAcwrStatus,
    headline,
    explanation,
    recommendedActions,
    hasActiveAdaptations,
    trailAcuteLoad7d: trailAcute,
    trailChronicWeeklyAvg: trailChronic,
    calisthenicsAcuteLoad7d: calisAcute,
    calisthenicsSessionsCount7d: calisSessions,
  };
}

/**
 * Construit les overrides à partir d'une liste d'actions recommandées.
 * Préserve les adaptations des séances passées afin qu'elles restent figées.
 */
export function buildOverridesFromActions(
  actions: AdaptiveWorkoutAction[],
  existingOverrides: Record<string, AdaptiveWorkoutOverride> = {},
  todayKey?: string,
  activeMicrocycleDates?: string[],
  protectedEventIds: Set<string> = new Set(),
  crossWeekPostponedEventIds: Set<string> = new Set()
): Record<string, AdaptiveWorkoutOverride> {
  const overrides: Record<string, AdaptiveWorkoutOverride> = { ...existingOverrides };

  // 1. Si les dates du microcycle actif sont fournies, assainir uniquement les dates de ce microcycle
  // pour permettre aux séances redevenues saines de revenir à la normale sans effacer les autres semaines.
  if (activeMicrocycleDates && activeMicrocycleDates.length > 0) {
    const activeDateSet = new Set(activeMicrocycleDates);
    for (const [id, ov] of Object.entries(overrides)) {
      if (activeDateSet.has(ov.date) && (!todayKey || ov.date >= todayKey) && !protectedEventIds.has(id)) {
        delete overrides[id];
      }
    }
  } else if (todayKey) {
    // Fallback : préserver les adaptations passées
    for (const [id, ov] of Object.entries(overrides)) {
      if (ov.date >= todayKey && !protectedEventIds.has(id)) {
        delete overrides[id];
      }
    }
  }

  // A weekly decision belongs to its source week. When a future workout is
  // postponed into a later week, do not carry the source week's adaptation
  // forward if the destination week's frozen plan recommends no adaptation.
  for (const eventId of crossWeekPostponedEventIds) {
    const previousOverride = overrides[eventId];
    if (
      previousOverride &&
      activeMicrocycleDates &&
      !activeMicrocycleDates.includes(previousOverride.date) &&
      !protectedEventIds.has(eventId)
    ) {
      delete overrides[eventId];
    }
  }

  // 2. Ajouter ou rafraîchir les adaptations recommandées
  const nowIso = new Date().toISOString();
  for (const act of actions) {
    if ((!todayKey || act.date >= todayKey) && !protectedEventIds.has(act.eventId)) {
      overrides[act.eventId] = {
        eventId: act.eventId,
        date: act.date,
        originalTitle: act.originalTitle,
        adaptedTitle: act.adaptedTitle,
        originalDurationMinutes: act.originalDurationMinutes,
        adaptedDurationMinutes: act.adaptedDurationMinutes,
        originalElevationM: act.originalElevationM,
        originalSportType: act.originalSportType,
        originalTargetHeartRate: act.originalTargetHeartRate,
        originalTargetHeartRateRange: act.originalTargetHeartRateRange,
        adaptationReason: act.reason,
        coachingCue: act.coachingCue,
        adaptedDescription: act.adaptedDescription,
        targetHeartRate: act.targetHeartRate,
        targetHeartRateRange: act.targetHeartRateRange,
        adaptedLocation: act.adaptedLocation,
        adaptedElevationM: act.adaptedElevationM,
        adaptedSportType: act.adaptedSportType,
        createdAt: nowIso
      };
    }
  }

  return overrides;
}

/**
 * Identifies workouts moved from an earlier week into the active week. Their
 * old weekly adaptation must be replaced by this week's decision, if any.
 */
export function getPriorWeekPostponedEventIds(
  events: CalendarEvent[],
  activeMicrocycleDates: string[]
): Set<string> {
  const activeDates = new Set(activeMicrocycleDates);
  return new Set(events
    .filter(event => event.category === 'sport' && event.metadata?.isPostponed && !event.metadata?.isPostponedPlaceholder)
    .filter(event => {
      const currentDate = toLocalDateKey(event.startDate);
      const originalDate = event.metadata?.originalDate;
      if (!originalDate) return false;
      return activeDates.has(currentDate) && !activeDates.has(originalDate);
    })
    .map(event => event.id));
}

/** A date-only generated ID is not enough to identify the same workout after a rebuild. */
function matchesAdaptiveOverride(event: CalendarEvent, override?: AdaptiveWorkoutOverride): override is AdaptiveWorkoutOverride {
  if (!override || event.category !== 'sport' || event.metadata?.isPostponedPlaceholder) return false;
  const eventDate = toLocalDateKey(event.startDate);
  if (eventDate !== override.date && event.metadata?.originalDate !== override.date) return false;
  if (event.metadata?.isCompleted && new Date(override.createdAt).getTime() >= new Date(event.startDate).getTime()) return false;
  if (event.title !== override.originalTitle || event.durationMinutes !== override.originalDurationMinutes) return false;
  if (override.originalSportType && event.sportType !== override.originalSportType) return false;
  if (override.originalElevationM !== undefined && event.metadata?.targetElevationM !== undefined &&
      event.metadata.targetElevationM !== override.originalElevationM) return false;
  return true;
}

/**
 * Applique les modifications adaptatives sur les plannings quotidiens et les événements du calendrier.
 */
export function applyAdaptiveModifications(
  baseSchedules: DailySchedule[],
  baseAllEvents: CalendarEvent[],
  overrides: Record<string, AdaptiveWorkoutOverride>
): { schedules: DailySchedule[]; allEvents: CalendarEvent[] } {
  const overrideEntries = Object.entries(overrides);
  if (overrideEntries.length === 0) {
    return { schedules: baseSchedules, allEvents: baseAllEvents };
  }

  const overridesMap = new Map<string, AdaptiveWorkoutOverride>();
  for (const [id, ov] of overrideEntries) {
    overridesMap.set(id, ov);
  }

  // Cloner les schedules
  const updatedSchedules: DailySchedule[] = baseSchedules.map(sched => {
    let sportSessionUpdated = sched.sportSession;

    const updatedEvents = sched.events.map(ev => {
      const override = overridesMap.get(ev.id);
      if (!matchesAdaptiveOverride(ev, override)) return ev;

      const isRest = override.adaptedDurationMinutes === 0;
      const startDate = new Date(ev.startDate);
      const newEndDate = isRest
        ? startDate
        : new Date(startDate.getTime() + override.adaptedDurationMinutes * 60000);

      const adaptedEvent: CalendarEvent = {
        ...ev,
        title: override.adaptedTitle,
        durationMinutes: override.adaptedDurationMinutes,
        endDate: newEndDate.toISOString(),
        location: override.adaptedLocation || ev.location,
        sportType: override.adaptedSportType || ev.sportType,
        emoji: isRest ? '🛌' : ev.emoji,
        colorHex: isRest ? '#64748b' : ev.colorHex,
        description: override.adaptedDescription || `${ev.description}\n\n🛡️ Adaptation de précaution :\n${override.adaptationReason}\nConsigne : ${override.coachingCue}`,
        metadata: {
          ...ev.metadata,
          isAdapted: true,
          adaptationReason: override.adaptationReason,
          originalTitle: override.originalTitle,
          originalDurationMinutes: override.originalDurationMinutes,
          originalElevationM: override.originalElevationM ?? ev.metadata?.targetElevationM,
          originalSportType: override.originalSportType ?? ev.sportType,
          originalTargetHeartRate: override.originalTargetHeartRate ?? ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: override.originalTargetHeartRateRange ?? ev.metadata?.targetHeartRateRange,
          targetHeartRate: override.targetHeartRate || ev.metadata?.targetHeartRate,
          targetHeartRateRange: override.targetHeartRateRange || (override.adaptedSportType === 'RUN_EASY'
            ? [...ADAPTIVE_WORKOUT_POLICY.highRisk.recoveryHeartRateRangeBpm]
            : ev.metadata?.targetHeartRateRange),
          targetElevationM: override.adaptedElevationM !== undefined ? override.adaptedElevationM : ev.metadata?.targetElevationM
        }
      };

      if (sportSessionUpdated?.id === ev.id) {
        sportSessionUpdated = adaptedEvent;
      }

      return adaptedEvent;
    });

    return {
      ...sched,
      events: updatedEvents,
      sportSession: sportSessionUpdated
    };
  });

  // Cloner et mettre à jour allEvents
  const updatedAllEvents: CalendarEvent[] = baseAllEvents.map(ev => {
    const override = overridesMap.get(ev.id);
    if (!matchesAdaptiveOverride(ev, override)) return ev;

    const isRest = override.adaptedDurationMinutes === 0;
    const startDate = new Date(ev.startDate);
    const newEndDate = isRest
      ? startDate
      : new Date(startDate.getTime() + override.adaptedDurationMinutes * 60000);

    return {
      ...ev,
      title: override.adaptedTitle,
      durationMinutes: override.adaptedDurationMinutes,
      endDate: newEndDate.toISOString(),
      location: override.adaptedLocation || ev.location,
      sportType: override.adaptedSportType || ev.sportType,
      emoji: isRest ? '🛌' : ev.emoji,
      colorHex: isRest ? '#64748b' : ev.colorHex,
      description: override.adaptedDescription || `${ev.description}\n\n🛡️ Adaptation de précaution :\n${override.adaptationReason}\nConsigne : ${override.coachingCue}`,
      metadata: {
        ...ev.metadata,
        isAdapted: true,
        adaptationReason: override.adaptationReason,
        originalTitle: override.originalTitle,
        originalDurationMinutes: override.originalDurationMinutes,
        originalElevationM: override.originalElevationM ?? ev.metadata?.targetElevationM,
        originalSportType: override.originalSportType ?? ev.sportType,
        originalTargetHeartRate: override.originalTargetHeartRate ?? ev.metadata?.targetHeartRate,
        originalTargetHeartRateRange: override.originalTargetHeartRateRange ?? ev.metadata?.targetHeartRateRange,
        targetHeartRate: override.targetHeartRate || ev.metadata?.targetHeartRate,
        targetHeartRateRange: override.targetHeartRateRange || (override.adaptedSportType === 'RUN_EASY'
          ? [...ADAPTIVE_WORKOUT_POLICY.highRisk.recoveryHeartRateRangeBpm]
          : ev.metadata?.targetHeartRateRange),
        targetElevationM: override.adaptedElevationM !== undefined ? override.adaptedElevationM : ev.metadata?.targetElevationM
      }
    };
  });

  return {
    schedules: updatedSchedules,
    allEvents: updatedAllEvents
  };
}
