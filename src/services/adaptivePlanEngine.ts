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

export const ADAPTIVE_PLAN_STORAGE_KEY = 'sport_calendar_adaptive_overrides';

/**
 * Charge les adaptations actives du plan depuis le localStorage.
 */
export function loadAdaptiveOverrides(): Record<string, AdaptiveWorkoutOverride> {
  return storageGet<Record<string, AdaptiveWorkoutOverride>>(ADAPTIVE_PLAN_STORAGE_KEY, {});
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
 * Activé par défaut pour maintenir automatiquement l'athlète dans le Sweet Spot.
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
 * Couvre l'intégralité du modèle de Tim Gabbett :
 * - Surcharge (> 1.5) : allègement d'urgence
 * - Vigilance (1.3 - 1.5) ou Readiness bas : modération préventive
 * - Sweet Spot (0.8 - 1.3) : maintien nominal optimal
 * - Sous-charge (< 0.8) : consolidation progressive Z2 anti-pic
 */
export function evaluateAdaptivePlanStatus(
  trainingLoad: TrainingLoadStats,
  readiness: ReadinessEvaluation,
  upcomingSportEvents: CalendarEvent[],
  activeOverrides: Record<string, AdaptiveWorkoutOverride> = {}
): AdaptivePlanStatus {
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
  let explanation = `Votre ratio ACWR Trail est de ${trailAcwrRatio} (zone saine 0.8 – 1.3). La charge mécanique de course est parfaitement assimilée. La calisthénie (${calisSessions} séance(s), ${calisAcute} TRIMP) est isolée et ne génère aucun impact articulaire négatif.`;

  // 1. DANGER ZONE : ACWR Trail > 1.5 ou surmenage sévère (TSB < -25)
  if (trailAcwrRatio > 1.5 || tsb < -25) {
    injuryRiskLevel = 'HIGH';
    headline = '⚠️ Alerte Surcharge Mécanique Trail (Risque Blessure Élevé)';
    explanation = `Pic de charge aiguë Trail détecté (ACWR ${trailAcwrRatio} > 1.5${tsb < -25 ? `, TSB ${tsb}` : ''}). Vos structures tendineuses et articulaires (Achille, rotule, périoste) sont sous haute tension. Le coach adaptatif recommande d'alléger temporairement les séances d'impact de la semaine pour désamorcer le risque sans perdre le socle aérobie pour le QMT-80.`;

    // Générer les actions ciblées sur les séances de la semaine
    for (const ev of upcomingSportEvents) {
      const isPostponed = Boolean(ev.metadata?.isPostponedPlaceholder);
      if (isPostponed) continue;

      const dateStr = ev.startDate.slice(0, 10);

      // Traiter les séances dures de côtes (TRAIL_INTENSE)
      if (ev.sportType === 'TRAIL_INTENSE') {
        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: ev.title,
          adaptedTitle: '🛡️ Footing Aérobie Doux & Récupération Z1/Z2 (35 min)',
          originalDurationMinutes: ev.durationMinutes,
          adaptedDurationMinutes: 35,
          actionType: 'LIGHTEN',
          reason: 'Désamorcer le stress excentrique des descentes et préserver les tendons.',
          coachingCue: '35 min de trot souple en Zone 1/2 (FC < 142 bpm), 100% sur terrain plat ou herbeux. Zéro répétition de côte.',
          adaptedDescription: `• Adaptation Anti-blessure (ACWR Trail > 1.5) :\n• 35 min de footing régénérant sur terrain plat ou herbeux (zéro dénivelé).\n• Pulsations strictement contrôlées : FC < 142 bpm (Zone 1/2 légère).\n• Zéro intensité en côte, zéro impact de descente rapide pour reposer les quadriceps et le tendon d'Achille.`,
          targetHeartRate: '< 142 bpm (Zone 1/2 Récupération)',
          targetHeartRateRange: [115, 142],
          adaptedLocation: 'Terrain plat / Parc (évite le D+)',
          adaptedElevationM: 0,
          adaptedSportType: 'RUN_EASY'
        });
      }

      // Traiter la Sortie Longue (TRAIL_LONG)
      if (ev.sportType === 'TRAIL_LONG') {
        const adaptedMins = Math.max(60, Math.round(ev.durationMinutes * 0.72));
        const origElevation = ev.metadata?.targetElevationM || 523;
        const adaptedElevationM = Math.round(origElevation * (adaptedMins / ev.durationMinutes));

        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: ev.title,
          adaptedTitle: `🛡️ Sortie Longue Modulée Anti-blessure (${Math.floor(adaptedMins / 60)}h${(adaptedMins % 60).toString().padStart(2, '0')})`,
          originalDurationMinutes: ev.durationMinutes,
          adaptedDurationMinutes: adaptedMins,
          actionType: 'LIGHTEN',
          reason: `Réduction de ${ev.durationMinutes - adaptedMins} min et D+ plafonné à +${adaptedElevationM}m pour ramener la charge aiguë sous le seuil critique (ACWR < 1.3).`,
          coachingCue: `Volume plafonné à ${adaptedMins} min et +${adaptedElevationM}m D+. Marche rapide obligatoire dès 8% de pente pour protéger les tendons d'Achille et les genoux.`,
          adaptedDescription: `• Adaptation Anti-blessure (ACWR Trail > 1.5) :\n• Durée ramenée à ${adaptedMins} min et D+ modulé à +${adaptedElevationM} m (au lieu de +${origElevation} m) pour protéger les tendons d'Achille.\n• Cardio : Zone 2 stricte (FC < 150 bpm).\n• Règle d'or : marcher activement en montée (power hike) dès que la pente dépasse 8%.\n• Éviter les descentes trop raides et techniques.`,
          targetHeartRate: '< 150 bpm (Zone 2 Endurance douce)',
          targetHeartRateRange: [120, 150],
          adaptedLocation: 'Mont-Royal (boucles douces / D+ allégé)',
          adaptedElevationM,
          adaptedSportType: 'TRAIL_LONG'
        });
      }
    }
  }
  // 2. MODERATE RISK : ACWR Trail 1.3 - 1.5 ou Récupération Garmin dégradée
  else if (trailAcwrRatio > 1.3 || readiness.status === 'LOW' || readiness.score < 50) {
    injuryRiskLevel = 'MODERATE';
    headline = '⚡ Charge Trail Soutenue : Vigilance Recommandée';
    explanation = `Votre ratio ACWR Trail (${trailAcwrRatio}) est dans la zone d'attention (1.3 – 1.5)${readiness.status === 'LOW' || readiness.score < 50 ? ' et votre score de récupération Garmin est bas' : ''}. Vous pouvez maintenir l'entraînement en réduisant légèrement l'intensité des répétitions de côtes pour éviter d'entrer en zone rouge.`;

    for (const ev of upcomingSportEvents) {
      const isPostponed = Boolean(ev.metadata?.isPostponedPlaceholder);
      if (isPostponed) continue;

      const dateStr = ev.startDate.slice(0, 10);

      if (ev.sportType === 'TRAIL_INTENSE') {
        const adaptedMins = Math.max(40, Math.round(ev.durationMinutes * 0.85));
        const origElevation = ev.metadata?.targetElevationM || 450;
        const adaptedElevationM = Math.round(origElevation * 0.6);

        recommendedActions.push({
          eventId: ev.id,
          date: dateStr,
          originalTitle: ev.title,
          adaptedTitle: `⚡ Côtes Modérées : 1 série au lieu de 2 (${adaptedMins} min)`,
          originalDurationMinutes: ev.durationMinutes,
          adaptedDurationMinutes: adaptedMins,
          actionType: 'LIGHTEN',
          reason: 'Réduire le volume d\'intervalles anaérobies pour stabiliser l\'ACWR dans le sweet spot.',
          coachingCue: 'Réaliser 1 seule série de répétitions de côtes au lieu de 2. Descentes marchées très souples.',
          adaptedDescription: `• Adaptation modérée (ACWR Trail ${trailAcwrRatio}) :\n• Échauffement 15 min + 1 série unique de côtes (5x 1 min) + retour au calme.\n• D+ limité à +${adaptedElevationM} m.\n• Allure montée contrôlée : FC max 175 bpm.\n• Descente en marchant pour amortir les chocs excentriques.`,
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
    headline = '🔵 Sous-charge Trail (< 0.8) : Consolidation Progressive';
    explanation = `Votre ratio ACWR Trail est de ${trailAcwrRatio} (< 0.8, zone de sous-charge). Vos tendons et articulations sont reposés mais sous-stimulés par rapport au volume cible. Selon le modèle de Tim Gabbett, pour réintégrer le Sweet Spot (0.8 – 1.3) sans risquer de blessure par pic de charge ultérieur, consolidez votre volume en endurance fondamentale (Zone 2) et évitez les hausses brutales d'intensité.`;

    // Si sous-charge marquée (< 0.6) et côtes intenses au programme, modérer les côtes pour éviter un saut brutal
    if (trailAcwrRatio < 0.6) {
      for (const ev of upcomingSportEvents) {
        if (ev.sportType === 'TRAIL_INTENSE') {
          const dateStr = ev.startDate.slice(0, 10);
          recommendedActions.push({
            eventId: ev.id,
            date: dateStr,
            originalTitle: ev.title,
            adaptedTitle: `🔵 Côtes Progressives Anti-pic (1 série douce - 40 min)`,
            originalDurationMinutes: ev.durationMinutes,
            adaptedDurationMinutes: 40,
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
 */
export function buildOverridesFromActions(
  actions: AdaptiveWorkoutAction[]
): Record<string, AdaptiveWorkoutOverride> {
  const overrides: Record<string, AdaptiveWorkoutOverride> = {};
  const nowIso = new Date().toISOString();

  for (const act of actions) {
    overrides[act.eventId] = {
      eventId: act.eventId,
      date: act.date,
      originalTitle: act.originalTitle,
      adaptedTitle: act.adaptedTitle,
      originalDurationMinutes: act.originalDurationMinutes,
      adaptedDurationMinutes: act.adaptedDurationMinutes,
      adaptationReason: act.reason,
      coachingCue: act.coachingCue,
      adaptedDescription: act.adaptedDescription,
      targetHeartRate: act.targetHeartRate,
      adaptedLocation: act.adaptedLocation,
      adaptedElevationM: act.adaptedElevationM,
      adaptedSportType: act.adaptedSportType,
      createdAt: nowIso
    };
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

      const startDate = new Date(ev.startDate);
      const newEndDate = new Date(startDate.getTime() + override.adaptedDurationMinutes * 60000);

      const adaptedEvent: CalendarEvent = {
        ...ev,
        title: override.adaptedTitle,
        durationMinutes: override.adaptedDurationMinutes,
        endDate: newEndDate.toISOString(),
        location: override.adaptedLocation || ev.location,
        sportType: override.adaptedSportType || ev.sportType,
        description: override.adaptedDescription || `${ev.description}\n\n🛡️ Adaptation Anti-blessure :\n${override.adaptationReason}\nConsigne : ${override.coachingCue}`,
        metadata: {
          ...ev.metadata,
          isAdapted: true,
          adaptationReason: override.adaptationReason,
          originalTitle: override.originalTitle,
          originalDurationMinutes: override.originalDurationMinutes,
          targetHeartRate: override.targetHeartRate || ev.metadata?.targetHeartRate,
          targetHeartRateRange: override.targetHeartRateRange || (override.adaptedSportType === 'RUN_EASY' ? [115, 142] : ev.metadata?.targetHeartRateRange),
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

    const startDate = new Date(ev.startDate);
    const newEndDate = new Date(startDate.getTime() + override.adaptedDurationMinutes * 60000);

    return {
      ...ev,
      title: override.adaptedTitle,
      durationMinutes: override.adaptedDurationMinutes,
      endDate: newEndDate.toISOString(),
      location: override.adaptedLocation || ev.location,
      sportType: override.adaptedSportType || ev.sportType,
      description: override.adaptedDescription || `${ev.description}\n\n🛡️ Adaptation Anti-blessure :\n${override.adaptationReason}\nConsigne : ${override.coachingCue}`,
      metadata: {
        ...ev.metadata,
        isAdapted: true,
        adaptationReason: override.adaptationReason,
        originalTitle: override.originalTitle,
        originalDurationMinutes: override.originalDurationMinutes,
        targetHeartRate: override.targetHeartRate || ev.metadata?.targetHeartRate,
        targetHeartRateRange: override.targetHeartRateRange || (override.adaptedSportType === 'RUN_EASY' ? [115, 142] : ev.metadata?.targetHeartRateRange),
        targetElevationM: override.adaptedElevationM !== undefined ? override.adaptedElevationM : ev.metadata?.targetElevationM
      }
    };
  });

  return {
    schedules: updatedSchedules,
    allEvents: updatedAllEvents
  };
}
