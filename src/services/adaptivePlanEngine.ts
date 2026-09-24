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
 * Activé en permanence par défaut pour maintenir automatiquement l'athlète dans le Sweet Spot sans réglage manuel.
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
  completedEventIds: Set<string> = new Set()
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
  const acwrHighRisk = !isAcwrCalibrating && trailAcwrRatio > ACWR_POLICY.highAbove;
  const acwrModerateRisk = !isAcwrCalibrating && trailAcwrRatio > ACWR_POLICY.moderateAbove;
  const acwrUnderload = !isAcwrCalibrating && trailAcwrRatio < ACWR_POLICY.underloadBelow;

  const hasActiveAdaptations = Object.keys(activeOverrides).length > 0;
  const recommendedActions: AdaptiveWorkoutAction[] = [];

  let injuryRiskLevel: 'SAFE' | 'MODERATE' | 'HIGH' = 'SAFE';
  let headline = isAcwrCalibrating
    ? 'Calibration mécanique : historique de course insuffisant'
    : `Progression Optimale (Sweet Spot ${ACWR_POLICY.underloadBelow} – ${ACWR_POLICY.moderateAbove})`;
  let explanation = isAcwrCalibrating
    ? `Le ratio ACWR mécanique (${trailAcwrRatio}) reste indicatif, car l'historique de course est encore en calibration. Il ne déclenche pas seul d'adaptation ; la fatigue systémique (TSB) et la récupération peuvent toujours en déclencher une.`
    : `Votre ratio ACWR mécanique est de ${trailAcwrRatio} (zone saine ${ACWR_POLICY.underloadBelow} – ${ACWR_POLICY.moderateAbove}). La charge d'impacts au sol (${trailAcute} Km-Effort) est parfaitement assimilée par vos tendons et genoux. La calisthénie (${calisSessions} séance(s), ${calisAcute} TRIMP) est isolée et ne génère aucun choc articulaire.`;

  // 1. DANGER ZONE : ACWR Trail élevé ou surmenage sévère
  if (acwrHighRisk || tsb < ACWR_POLICY.severeFatigueTsbBelow) {
    injuryRiskLevel = 'HIGH';
    const dangerContext = acwrHighRisk
      ? `ACWR ${trailAcwrRatio} > ${ACWR_POLICY.highAbove}`
      : `TSB ${tsb} < ${ACWR_POLICY.severeFatigueTsbBelow}`;
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
          adaptedTitle: '🛡️ Repos Récupération Anti-blessure (ACWR critique)',
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: 0,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'REST',
          reason: `Séance de fatigue cumulée annulée (repos complet) pour éviter des impacts supplémentaires dans le contexte ${dangerContext}.`,
          coachingCue: 'Repos passif complet, hydratation et étirements doux. Donnez à vos tendons le temps de surcompenser.',
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
          ? `Allégement de ${diffMin} min (${origDuration} ➔ ${adaptedDurationMinutes} min) et dénivelé aplati à 0m (terrain plat) pour désamorcer le stress excentrique des côtes et protéger les tendons.`
          : `Dénivelé aplati à 0m (terrain plat régénérant) pour désamorcer le stress excentrique des côtes et protéger les tendons.`;

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
          adaptedTitle: `🛡️ Sortie Longue Modulée Anti-blessure (${Math.floor(adaptedMins / 60)}h${(adaptedMins % 60).toString().padStart(2, '0')})`,
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: adaptedMins,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'LIGHTEN',
          reason,
          coachingCue: `Volume plafonné à ${adaptedMins} min et +${adaptedElevationM}m D+. Marche active (power hike) obligatoire dès ${adaptationPolicy.highRisk.walkingInclineThresholdPercent}% de pente pour protéger les tendons d'Achille.`,
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
          adaptedDescription: `• Footing raccourci à ${adaptedMins} min à plat pour protéger les tendons d'Achille.`,
          targetHeartRate: 'Zone 1/2 Récupération',
          targetHeartRateRange: [...recoveryHeartRateRange],
          adaptedLocation: 'Terrain plat / Parc (évite le D+)',
          adaptedElevationM: 0,
          adaptedSportType: 'RUN_EASY'
        });
      }
    }
  }
  // 2. MODERATE RISK : ACWR Trail au-dessus du seuil modéré ou récupération dégradée
  else if (acwrModerateRisk || readiness.status === 'LOW' || readiness.score < ACWR_POLICY.lowReadinessBelow) {
    injuryRiskLevel = 'MODERATE';
    const lowReadiness = readiness.status === 'LOW' || readiness.score < ACWR_POLICY.lowReadinessBelow;
    headline = acwrModerateRisk
      ? '⚡ Charge Mécanique Soutenue : Vigilance Recommandée'
      : '⚡ Récupération basse : vigilance recommandée';
    const vigilanceReasons = [
      acwrModerateRisk ? `l'ACWR (${trailAcwrRatio}; seuil ${ACWR_POLICY.moderateAbove} – ${ACWR_POLICY.highAbove})` : null,
      lowReadiness ? 'un score de récupération bas' : null
    ].filter((reason): reason is string => reason !== null);
    explanation = `Le plan signale une vigilance liée à ${vigilanceReasons.join(' et ')}. Les séances futures peuvent être modérées sans changer rétroactivement la charge mesurée.`;

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
          ? `Réduction de ${diffMin} min (${origDuration} ➔ ${adaptedMins} min) et D+ limité à +${adaptedElevationM}m (${hillSetCount} série au lieu de ${originalHillSetCount}) pour stabiliser l'ACWR mécanique dans le Sweet Spot.`
          : `D+ limité à +${adaptedElevationM}m (${hillSetCount} série de côtes au lieu de ${originalHillSetCount}) pour stabiliser l'ACWR mécanique dans le Sweet Spot.`;

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
          adaptedDescription: `• Adaptation modérée (ACWR Mécanique ${trailAcwrRatio}) :\n• Échauffement ${hillPolicy.hillWarmupMinutes} min + ${hillSetCount} série unique de côtes (${hillPolicy.hillRepetitionCount}x ${hillPolicy.hillRepetitionDurationMinutes} min) + retour au calme.\n• D+ limité à +${adaptedElevationM} m.\n• Allure montée contrôlée : FC max ${heartRateRange[1]} bpm.\n• Descente en marchant pour amortir les chocs excentriques.`,
          targetHeartRate: formatHeartRateRange(heartRateRange),
          adaptedLocation: 'Mont-Royal (pentes douces)',
          adaptedElevationM,
          adaptedSportType: 'TRAIL_INTENSE'
        });
      }
    }
  }
  // 3. UNDERLOAD : ACWR Trail sous le seuil de sous-charge
  else if (acwrUnderload) {
    injuryRiskLevel = 'SAFE';
    headline = `🔵 Sous-charge Mécanique (< ${ACWR_POLICY.underloadBelow}) : Consolidation Progressive`;
    explanation = `Votre ratio ACWR mécanique est de ${trailAcwrRatio} (< ${ACWR_POLICY.underloadBelow}, zone de sous-charge). Vos tendons et articulations sont reposés mais sous-stimulés par rapport au volume cible. Selon le modèle de Tim Gabbett, consolidez progressivement vos Km-Effort en endurance fondamentale (Zone 2) sans hausses brutales de volume.`;

    // Si sous-charge marquée et côtes intenses au programme, modérer les côtes pour éviter un saut brutal
    if (trailAcwrRatio < ACWR_POLICY.severeUnderloadBelow) {
      for (const ev of upcomingSportEvents) {
        if (!isEligibleForAdaptation(ev)) continue;
        if (ev.sportType === 'TRAIL_INTENSE') {
          const dateStr = toLocalDateKey(ev.startDate);
          const origElevation = ev.metadata?.targetElevationM ?? adaptationPolicy.defaultTrailElevationMeters;
          const origSportType = ev.sportType;
          const hillPolicy = adaptationPolicy.underload;
          const heartRateRange = hillPolicy.hillTargetHeartRateRangeBpm;
          const hillSetCount = hillPolicy.hillSetCount;
          const [minimumRepetitions, maximumRepetitions] = hillPolicy.hillRepetitionRange;
          recommendedActions.push({
            eventId: ev.id,
            date: dateStr,
            originalTitle: ev.title,
            adaptedTitle: `🔵 Côtes Progressives Anti-pic (${hillSetCount} série douce - ${hillPolicy.hillDurationMinutes} min)`,
            originalDurationMinutes: ev.durationMinutes,
            adaptedDurationMinutes: hillPolicy.hillDurationMinutes,
            originalElevationM: origElevation,
            originalSportType: origSportType,
            originalTargetHeartRate: ev.metadata?.targetHeartRate,
            originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
            actionType: 'LIGHTEN',
            reason: `Réintroduction progressive des contraintes de côtes post-sous-charge (Gabbett ${hillPolicy.maximumProgressionPercent}%).`,
            coachingCue: `${hillSetCount} seule série de ${minimumRepetitions}-${maximumRepetitions} répétitions en aisance avec récupération marchée complète.`,
            adaptedDescription: `• Adaptation Anti-pic post sous-charge (ACWR ${trailAcwrRatio}) :\n• ${hillSetCount} série de côtes contrôlées pour remonter graduellement dans le Sweet Spot sans agresser les tendons.\n• Cardio : FC max ${heartRateRange[1]} bpm.`,
            targetHeartRate: formatHeartRateRange(heartRateRange),
            adaptedLocation: 'Mont-Royal (pente douce)',
            adaptedElevationM: hillPolicy.hillElevationMeters,
            adaptedSportType: 'TRAIL_INTENSE'
          });
        }
      }
    }
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
  protectedEventIds: Set<string> = new Set()
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
        description: override.adaptedDescription || `${ev.description}\n\n🛡️ Adaptation Anti-blessure :\n${override.adaptationReason}\nConsigne : ${override.coachingCue}`,
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
      description: override.adaptedDescription || `${ev.description}\n\n🛡️ Adaptation Anti-blessure :\n${override.adaptationReason}\nConsigne : ${override.coachingCue}`,
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
