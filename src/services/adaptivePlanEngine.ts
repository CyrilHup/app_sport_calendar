import {
  CalendarEvent,
  DailySchedule,
  AdaptiveWorkoutOverride,
  AdaptiveWorkoutAction,
  AdaptivePlanStatus
} from '../types/calendar';
import { TrainingLoadStats } from './statsEngine';
import { ReadinessEvaluation } from './readinessEngine';
import { storageGet, storageSet, storageRemove } from './storageService';
import { toLocalDateKey } from './dateUtils';

export const ADAPTIVE_PLAN_STORAGE_KEY = 'sport_calendar_adaptive_overrides';

/**
 * Charge les adaptations actives du plan depuis le localStorage.
 * Auto-assainit les corruptions éventuelles (ex: séances majeures écrasées à 0m).
 */
export function loadAdaptiveOverrides(): Record<string, AdaptiveWorkoutOverride> {
  const loaded = storageGet<Record<string, AdaptiveWorkoutOverride>>(ADAPTIVE_PLAN_STORAGE_KEY, {});
  const sanitized: Record<string, AdaptiveWorkoutOverride> = {};
  let hadCorrupted = false;

  for (const [id, ov] of Object.entries(loaded)) {
    const titleLower = (ov.originalTitle || ov.adaptedTitle || '').toLowerCase();
    const isMajorWorkout = (ov.originalDurationMinutes && ov.originalDurationMinutes >= 50) ||
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
    storageSet(ADAPTIVE_PLAN_STORAGE_KEY, sanitized);
  }

  return sanitized;
}

/**
 * Sauvegarde les adaptations actives du plan dans le localStorage.
 */
export function saveAdaptiveOverrides(overrides: Record<string, AdaptiveWorkoutOverride>): void {
  storageSet(ADAPTIVE_PLAN_STORAGE_KEY, overrides);
}

/**
 * Supprime toutes les adaptations actives du plan (rétablissement du plan nominal).
 */
export function clearAdaptiveOverrides(): void {
  storageRemove(ADAPTIVE_PLAN_STORAGE_KEY);
}

export const AUTO_ADAPT_STORAGE_KEY = 'sport_calendar_auto_adapt_enabled';

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
  const asOfKey = asOfDate ? toLocalDateKey(asOfDate instanceof Date ? asOfDate.toISOString() : String(asOfDate)) : null;

  const isEligibleForAdaptation = (ev: CalendarEvent) => {
    if (ev.metadata?.isPostponedPlaceholder) return false;
    if (ev.metadata?.isCompleted) return false;
    if (completedEventIds.has(ev.id)) return false;
    const dateStr = toLocalDateKey(ev.startDate);
    // Les séances passées sont STRICTEMENT GELÉES
    if (asOfKey && dateStr < asOfKey) return false;
    return true;
  };

  const trailAcwrRatio = trainingLoad.trailAcwrRatio;
  const trailAcwrStatus = trainingLoad.trailAcwrStatus;
  const trailAcute = trainingLoad.trailAcuteLoad7d;
  const trailChronic = trainingLoad.trailChronicLoad28dWeeklyAvg;
  const calisAcute = trainingLoad.calisthenicsAcuteLoad7d;
  const calisSessions = trainingLoad.calisthenicsSessionsCount7d;
  const tsb = trainingLoad.currentTsb;

  const hasActiveAdaptations = Object.keys(activeOverrides).length > 0;
  const recommendedActions: AdaptiveWorkoutAction[] = [];

  let injuryRiskLevel: 'SAFE' | 'MODERATE' | 'HIGH' = 'SAFE';
  let headline = 'Progression Optimale (Sweet Spot 0.8 – 1.3)';
  let explanation = `Votre ratio ACWR mécanique est de ${trailAcwrRatio} (zone saine 0.8 – 1.3). La charge d'impacts au sol (${trailAcute} Km-Effort) est parfaitement assimilée par vos tendons et genoux. La calisthénie (${calisSessions} séance(s), ${calisAcute} TRIMP) est isolée et ne génère aucun choc articulaire.`;

  // 1. DANGER ZONE : ACWR Trail > 1.5 ou surmenage sévère (TSB < -25)
  if (trailAcwrRatio > 1.5 || tsb < -25) {
    injuryRiskLevel = 'HIGH';
    headline = '⚠️ Alerte Surcharge Mécanique (Risque Blessure Articulaire Élevé)';
    explanation = `Pic de charge aiguë mécanique détecté (ACWR ${trailAcwrRatio} > 1.5 en Km-Effort${tsb < -25 ? `, TSB ${tsb}` : ''}). Vos structures tendineuses et articulaires (Achille, rotule, périoste) sont sous haute tension. Le coach adaptatif allège drastiquement les Km-Effort et le D+ de la semaine pour désamorcer le risque sans perdre le socle aérobie pour le QMT-80.`;

    // Générer les actions ciblées sur les séances de la semaine
    for (const ev of upcomingSportEvents) {
      if (!isEligibleForAdaptation(ev)) continue;

      const dateStr = toLocalDateKey(ev.startDate);
      // Toujours évaluer sur la base des métriques NOMINALES d'origine pour éviter tout effet d'escalier ou cascade à 0
      const origDuration = ev.metadata?.originalDurationMinutes ?? ev.durationMinutes;
      const origSportType = ev.metadata?.originalSportType ?? ev.sportType;
      const origTitle = ev.metadata?.originalTitle ?? ev.title;
      const titleLower = origTitle.toLowerCase();
      const origElevation = ev.metadata?.originalElevationM ?? ev.metadata?.targetElevationM ?? (origSportType === 'RUN_EASY' ? 0 : Math.round(origDuration * 3.5));

      const isSecondaryFatigued = origDuration < 50 && (
        titleLower.includes('fatigued') ||
        titleLower.includes('rolling') ||
        (titleLower.includes('récupération') && !titleLower.includes('côte') && !titleLower.includes('hill'))
      );

      const isHillRepeats = origSportType === 'TRAIL_INTENSE' || titleLower.includes('côte') || titleLower.includes('hill');
      const isLongTrail = (origSportType === 'TRAIL_LONG' || titleLower.includes('long') || titleLower.includes('rando-course')) && origDuration >= 50;

      // a. Séances secondaires de fatigue cumulée (< 50 min, ex: dimanche back-to-back) : Repos complet
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
          reason: `Séance de fatigue cumulée annulée (repos complet) pour stopper les chocs et ramener rapidement l'ACWR mécanique (${trailAcwrRatio} > 1.5) sous 1.3.`,
          coachingCue: 'Repos passif complet, hydratation et étirements doux. Donnez à vos tendons le temps de surcompenser.',
          adaptedDescription: `• Adaptation Anti-blessure (ACWR Mécanique > 1.5) :\n• Séance supprimée au profit d'un repos complet pour faire chuter immédiatement la charge aiguë.\n• Zéro impact au sol pour protéger les tendons d'Achille et les genoux.`,
          targetHeartRate: 'Repos',
          adaptedLocation: 'Domicile / Repos',
          adaptedElevationM: 0,
          adaptedSportType: 'MOBILITY'
        });
        continue;
      }

      // b. Traiter les séances dures de côtes (TRAIL_INTENSE) -> Footing doux 35 min, JAMAIS 0m
      if (isHillRepeats) {
        const adaptedDurationMinutes = Math.min(35, origDuration);
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
          adaptedDescription: `• Adaptation Anti-blessure (ACWR Mécanique > 1.5) :\n• ${adaptedDurationMinutes} min de footing régénérant sur terrain plat (zéro dénivelé).\n• Pulsations strictement contrôlées : FC en Zone 1/2 légère (aisance respiratoire).\n• Zéro intensité en côte, zéro impact de descente rapide pour reposer les quadriceps et le tendon d'Achille.`,
          targetHeartRate: 'Zone 1/2 Récupération',
          targetHeartRateRange: [130, 150],
          adaptedLocation: 'Terrain plat / Parc (évite le D+)',
          adaptedElevationM: 0,
          adaptedSportType: 'RUN_EASY'
        });
        continue;
      }

      // c. Traiter la Sortie Longue (TRAIL_LONG >= 50 min) -> Réduction ~28%, D+ modulé à 55%, JAMAIS 0m
      if (isLongTrail) {
        const adaptedMins = Math.min(origDuration, Math.max(45, Math.round(origDuration * 0.72)));
        const adaptedElevationM = Math.min(origElevation, Math.max(0, Math.round(origElevation * 0.55)));
        const diffMin = origDuration - adaptedMins;
        const reason = diffMin > 0
          ? `Réduction de ${diffMin} min (${origDuration} ➔ ${adaptedMins} min) et D+ allégé à +${adaptedElevationM}m (au lieu de +${origElevation}m) pour ramener la charge mécanique aiguë (Km-Effort) sous le seuil critique (ACWR < 1.3).`
          : `D+ allégé à +${adaptedElevationM}m (au lieu de +${origElevation}m) pour ramener la charge mécanique aiguë (Km-Effort) sous le seuil critique (ACWR < 1.3).`;

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
          coachingCue: `Volume plafonné à ${adaptedMins} min et +${adaptedElevationM}m D+. Marche active (power hike) obligatoire dès 8% de pente pour protéger les tendons d'Achille.`,
          adaptedDescription: `• Adaptation Anti-blessure (ACWR Mécanique > 1.5) :\n• Durée ramenée à ${adaptedMins} min et D+ modulé à +${adaptedElevationM} m (au lieu de +${origElevation} m) pour protéger les tendons d'Achille.\n• Cardio : Zone 2 stricte.\n• Règle d'or : marcher activement en montée (power hike) dès que la pente dépasse 8%.\n• Éviter les descentes trop raides et techniques.`,
          targetHeartRate: 'Zone 2 Endurance douce',
          targetHeartRateRange: [135, 158],
          adaptedLocation: 'Mont-Royal (boucles douces / D+ allégé)',
          adaptedElevationM,
          adaptedSportType: 'TRAIL_LONG'
        });
        continue;
      }

      // d. Autres footings aérobie simples (RUN_EASY, ex: jeudi)
      if (origSportType === 'RUN_EASY') {
        const adaptedMins = Math.min(origDuration, 30);
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
          targetHeartRateRange: [130, 150],
          adaptedLocation: 'Terrain plat / Parc (évite le D+)',
          adaptedElevationM: 0,
          adaptedSportType: 'RUN_EASY'
        });
      }
    }
  }
  // 2. MODERATE RISK : ACWR Trail 1.3 - 1.5 ou Récupération Garmin dégradée
  else if (trailAcwrRatio > 1.3 || readiness.status === 'LOW' || readiness.score < 50) {
    injuryRiskLevel = 'MODERATE';
    headline = '⚡ Charge Mécanique Soutenue : Vigilance Recommandée';
    explanation = `Votre ratio ACWR mécanique (${trailAcwrRatio}) est dans la zone d'attention (1.3 – 1.5)${readiness.status === 'LOW' || readiness.score < 50 ? ' et votre score de récupération Garmin est bas' : ''}. Vos articulations absorbent une hausse rapide de Km-Effort. Vous pouvez maintenir l'entraînement en modérant le dénivelé en côte pour éviter d'entrer en zone rouge.`;

    for (const ev of upcomingSportEvents) {
      if (!isEligibleForAdaptation(ev)) continue;

      const dateStr = toLocalDateKey(ev.startDate);
      const origDuration = ev.metadata?.originalDurationMinutes ?? ev.durationMinutes;
      const origSportType = ev.metadata?.originalSportType ?? ev.sportType;
      const origTitle = ev.metadata?.originalTitle ?? ev.title;
      const titleLower = origTitle.toLowerCase();
      const origElevation = ev.metadata?.originalElevationM ?? ev.metadata?.targetElevationM ?? (origSportType === 'RUN_EASY' ? 0 : 380);

      const isHillRepeats = origSportType === 'TRAIL_INTENSE' || titleLower.includes('côte') || titleLower.includes('hill');

      if (isHillRepeats) {
        const adaptedMins = Math.min(origDuration, Math.max(40, Math.round(origDuration * 0.85)));
        const adaptedElevationM = Math.min(origElevation, Math.round(origElevation * 0.6));
        const diffMin = origDuration - adaptedMins;
        const reason = diffMin > 0
          ? `Réduction de ${diffMin} min (${origDuration} ➔ ${adaptedMins} min) et D+ limité à +${adaptedElevationM}m (1 série au lieu de 2) pour stabiliser l'ACWR mécanique dans le Sweet Spot.`
          : `D+ limité à +${adaptedElevationM}m (1 série de côtes au lieu de 2) pour stabiliser l'ACWR mécanique dans le Sweet Spot.`;

        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: origTitle,
          adaptedTitle: `⚡ Côtes Modérées : 1 série au lieu de 2 (${adaptedMins} min)`,
          originalDurationMinutes: origDuration,
          adaptedDurationMinutes: adaptedMins,
          originalElevationM: origElevation,
          originalSportType: origSportType,
          originalTargetHeartRate: ev.metadata?.targetHeartRate,
          originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
          actionType: 'LIGHTEN',
          reason,
          coachingCue: 'Réaliser 1 seule série de répétitions de côtes au lieu de 2. Descentes marchées très souples.',
          adaptedDescription: `• Adaptation modérée (ACWR Mécanique ${trailAcwrRatio}) :\n• Échauffement 15 min + 1 série unique de côtes (5x 1 min) + retour au calme.\n• D+ limité à +${adaptedElevationM} m.\n• Allure montée contrôlée : FC max 175 bpm.\n• Descente en marchant pour amortir les chocs excentriques.`,
          targetHeartRate: '160 - 175 bpm',
          adaptedLocation: 'Mont-Royal (pentes douces)',
          adaptedElevationM,
          adaptedSportType: 'TRAIL_INTENSE'
        });
      }
    }
  }
  // 3. UNDERLOAD : ACWR Trail < 0.8 (Sous-charge relative)
  else if (trailAcwrRatio < 0.8) {
    injuryRiskLevel = 'SAFE';
    headline = '🔵 Sous-charge Mécanique (< 0.8) : Consolidation Progressive';
    explanation = `Votre ratio ACWR mécanique est de ${trailAcwrRatio} (< 0.8, zone de sous-charge). Vos tendons et articulations sont reposés mais sous-stimulés par rapport au volume cible. Selon le modèle de Tim Gabbett, consolidez progressivement vos Km-Effort en endurance fondamentale (Zone 2) sans hausses brutales de volume.`;

    // Si sous-charge marquée (< 0.6) et côtes intenses au programme, modérer les côtes pour éviter un saut brutal
    if (trailAcwrRatio < 0.6) {
      for (const ev of upcomingSportEvents) {
        if (!isEligibleForAdaptation(ev)) continue;
        if (ev.sportType === 'TRAIL_INTENSE') {
          const dateStr = toLocalDateKey(ev.startDate);
          const origElevation = ev.metadata?.targetElevationM ?? 380;
          const origSportType = ev.sportType;
          recommendedActions.push({
            eventId: ev.id,
            date: dateStr,
            originalTitle: ev.title,
            adaptedTitle: `🔵 Côtes Progressives Anti-pic (1 série douce - 40 min)`,
            originalDurationMinutes: ev.durationMinutes,
            adaptedDurationMinutes: 40,
            originalElevationM: origElevation,
            originalSportType: origSportType,
            originalTargetHeartRate: ev.metadata?.targetHeartRate,
            originalTargetHeartRateRange: ev.metadata?.targetHeartRateRange,
            actionType: 'LIGHTEN',
            reason: 'Réintroduction progressive des contraintes de côtes post-sous-charge (Gabbett 10%).',
            coachingCue: '1 seule série de 4-5 répétitions en aisance avec récupération marchée complète.',
            adaptedDescription: `• Adaptation Anti-pic post sous-charge (ACWR ${trailAcwrRatio}) :\n• 1 série de côtes contrôlées pour remonter graduellement dans le Sweet Spot sans agresser les tendons.\n• Cardio : FC max 172 bpm.`,
            targetHeartRate: '160 - 172 bpm',
            adaptedLocation: 'Mont-Royal (pente douce)',
            adaptedElevationM: 200,
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
  activeMicrocycleDates?: string[]
): Record<string, AdaptiveWorkoutOverride> {
  const overrides: Record<string, AdaptiveWorkoutOverride> = { ...existingOverrides };

  // 1. Si les dates du microcycle actif sont fournies, assainir uniquement les dates de ce microcycle
  // pour permettre aux séances redevenues saines de revenir à la normale sans effacer les autres semaines.
  if (activeMicrocycleDates && activeMicrocycleDates.length > 0) {
    const activeDateSet = new Set(activeMicrocycleDates);
    for (const [id, ov] of Object.entries(overrides)) {
      if (activeDateSet.has(ov.date) && (!todayKey || ov.date >= todayKey)) {
        delete overrides[id];
      }
    }
  } else if (todayKey) {
    // Fallback : préserver les adaptations passées
    for (const [id, ov] of Object.entries(overrides)) {
      if (ov.date >= todayKey) {
        delete overrides[id];
      }
    }
  }

  // 2. Ajouter ou rafraîchir les adaptations recommandées
  const nowIso = new Date().toISOString();
  for (const act of actions) {
    if (!todayKey || act.date >= todayKey) {
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
      if (!override) return ev;

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
          targetHeartRateRange: override.targetHeartRateRange || (override.adaptedSportType === 'RUN_EASY' ? [130, 150] : ev.metadata?.targetHeartRateRange),
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
    if (!override) return ev;

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
        targetHeartRateRange: override.targetHeartRateRange || (override.adaptedSportType === 'RUN_EASY' ? [130, 150] : ev.metadata?.targetHeartRateRange),
        targetElevationM: override.adaptedElevationM !== undefined ? override.adaptedElevationM : ev.metadata?.targetElevationM
      }
    };
  });

  return {
    schedules: updatedSchedules,
    allEvents: updatedAllEvents
  };
}
