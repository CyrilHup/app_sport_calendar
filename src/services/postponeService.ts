import { CalendarEvent, DailySchedule, WorkoutPostponeOverride } from '../types/calendar';
import { COLOR_MAP } from './periodizationEngine';

export const POSTPONE_STORAGE_KEY = 'sport_calendar_postponed_workouts';

/**
 * Charge les reports de séances enregistrés dans le localStorage.
 */
export function loadPostponeOverrides(): Record<string, WorkoutPostponeOverride> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(POSTPONE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Impossible de charger les reports de séance du localStorage:', err);
  }
  return {};
}

/**
 * Sauvegarde les reports de séances dans le localStorage.
 */
export function savePostponeOverrides(overrides: Record<string, WorkoutPostponeOverride>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(POSTPONE_STORAGE_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.warn('Impossible de sauvegarder les reports de séance dans le localStorage:', err);
  }
}

/**
 * Formate une date YYYY-MM-DD en texte lisible (ex: "dimanche 6 sept.").
 */
function formatFriendlyDate(dateKey: string): string {
  try {
    const d = new Date(dateKey + 'T12:00:00');
    return d.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateKey;
  }
}

/**
 * Construit un nouvel objet Date en appliquant les heures et minutes d'origine (ou spécifiées)
 * sur la date cible YYYY-MM-DD.
 */
function buildTargetDate(targetDateKey: string, sourceDate: Date, specifiedTime?: string): Date {
  const parts = targetDateKey.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  let hours = sourceDate.getHours();
  let minutes = sourceDate.getMinutes();

  if (specifiedTime) {
    if (specifiedTime.includes(':')) {
      const tParts = specifiedTime.split(':');
      hours = parseInt(tParts[0], 10) || 0;
      minutes = parseInt(tParts[1], 10) || 0;
    } else if (specifiedTime.includes('T')) {
      const parsed = new Date(specifiedTime);
      if (!isNaN(parsed.getTime())) {
        hours = parsed.getHours();
        minutes = parsed.getMinutes();
      }
    }
  }

  return new Date(y, m, d, hours, minutes, 0, 0);
}

/**
 * Applique l'ensemble des reports configurés sur les plannings quotidiens et la liste complète des événements.
 */
export function applyPostponements(
  baseSchedules: DailySchedule[],
  baseAllEvents: CalendarEvent[],
  overrides: Record<string, WorkoutPostponeOverride>
): { schedules: DailySchedule[]; allEvents: CalendarEvent[] } {
  const overrideList = Object.values(overrides);
  if (overrideList.length === 0) {
    return {
      schedules: baseSchedules,
      allEvents: baseAllEvents
    };
  }

  // Clone profond des schedules pour immutabilité
  const schedulesMap = new Map<string, DailySchedule>();
  for (const s of baseSchedules) {
    schedulesMap.set(s.date, {
      ...s,
      events: [...s.events]
    });
  }

  let currentAllEvents = [...baseAllEvents];

  for (const override of overrideList) {
    const sourceDay = schedulesMap.get(override.originalDate);
    const targetDay = schedulesMap.get(override.targetDate);

    if (!sourceDay || !targetDay) {
      continue;
    }

    // Trouver la séance de sport d'origine
    const originalSportIndex = sourceDay.events.findIndex(
      e => e.id === override.originalEventId || (e.category === 'sport' && !e.metadata?.isPostponedPlaceholder)
    );

    if (originalSportIndex === -1) {
      continue;
    }

    const originalSportEvent = sourceDay.events[originalSportIndex];
    const originalStartDate = new Date(originalSportEvent.startDate);
    const durationMinutes = originalSportEvent.durationMinutes;

    // Retirer l'événement de sport d'origine du jour source
    sourceDay.events.splice(originalSportIndex, 1);

    // Retirer également les trajets sport associés du jour source
    const oldTravelIds: string[] = [];
    sourceDay.events = sourceDay.events.filter(e => {
      if (e.id.startsWith(`SPORT_TRAVEL_ALLER_${override.originalDate}`) || e.id.startsWith(`SPORT_TRAVEL_RETOUR_${override.originalDate}`)) {
        oldTravelIds.push(e.id);
        return false;
      }
      return true;
    });

    // Mettre à jour sportSession du jour source si elle pointait vers cet événement
    if (sourceDay.sportSession?.id === originalSportEvent.id) {
      const remainingSport = sourceDay.events.find(e => e.category === 'sport' && !e.metadata?.isPostponedPlaceholder);
      sourceDay.sportSession = remainingSport || undefined;
    }

    // Ajouter une carte fantôme (placeholder) indiquant le report dans le jour source
    const ghostPlaceholder: CalendarEvent = {
      id: `POSTPONED_GHOST_${originalSportEvent.id}`,
      category: 'sport',
      sportType: originalSportEvent.sportType,
      title: `➡️ Reportée au ${formatFriendlyDate(override.targetDate)}: ${originalSportEvent.title.replace(/^[^a-zA-Z0-9\[]*/, '')}`,
      startDate: originalSportEvent.startDate,
      endDate: originalSportEvent.endDate,
      location: originalSportEvent.location,
      description: `Séance initialement prévue le ${override.originalDate}, reportée au ${override.targetDate}.${override.reason ? `\nMotif : ${override.reason}` : ''}`,
      emoji: "➡️",
      colorId: "8",
      colorHex: "#64748b",
      durationMinutes: originalSportEvent.durationMinutes,
      metadata: {
        ...originalSportEvent.metadata,
        isPostponedPlaceholder: true,
        originalDate: override.originalDate,
        postponedToDate: override.targetDate,
        postponedReason: override.reason
      }
    };
    sourceDay.events.push(ghostPlaceholder);
    sourceDay.events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    // Calculer les nouveaux horaires pour le jour cible
    const newStartDate = buildTargetDate(override.targetDate, originalStartDate, override.targetStartTime);
    const newEndDate = new Date(newStartDate.getTime() + durationMinutes * 60000);

    // Métadonnées de trajet recalculées si applicable
    const transitAllerMin = originalSportEvent.metadata?.commuteAller?.durationMinutes;
    const transitRetourMin = originalSportEvent.metadata?.commuteRetour?.durationMinutes;

    const newCommuteAller = transitAllerMin ? {
      departureTime: new Date(newStartDate.getTime() - transitAllerMin * 60000).toISOString(),
      arrivalTime: newStartDate.toISOString(),
      durationMinutes: transitAllerMin
    } : undefined;

    const newCommuteRetour = transitRetourMin ? {
      departureTime: newEndDate.toISOString(),
      arrivalTime: new Date(newEndDate.getTime() + transitRetourMin * 60000).toISOString(),
      durationMinutes: transitRetourMin
    } : undefined;

    // Créer la séance déplacée
    const movedSportEvent: CalendarEvent = {
      ...originalSportEvent,
      startDate: newStartDate.toISOString(),
      endDate: newEndDate.toISOString(),
      metadata: {
        ...originalSportEvent.metadata,
        isPostponed: true,
        originalDate: override.originalDate,
        postponedReason: override.reason,
        isPostponedPlaceholder: false,
        commuteAller: newCommuteAller,
        commuteRetour: newCommuteRetour
      }
    };

    // Ajouter les trajets au jour cible si nécessaire
    const newTravelEvents: CalendarEvent[] = [];
    if (newCommuteAller) {
      newTravelEvents.push({
        id: `SPORT_TRAVEL_ALLER_${override.targetDate}_MOVED`,
        category: 'trajet',
        sportType: 'TRAVEL',
        title: `🚶‍♂️ Trajet vers ${originalSportEvent.location}`,
        startDate: newCommuteAller.departureTime,
        endDate: newCommuteAller.arrivalTime,
        location: `Domicile ➔ ${originalSportEvent.location}`,
        description: `Trajet estimé : ~${newCommuteAller.durationMinutes} min`,
        emoji: "🚶‍♂️",
        colorId: COLOR_MAP.TRAVEL.colorId,
        colorHex: COLOR_MAP.TRAVEL.colorHex,
        durationMinutes: newCommuteAller.durationMinutes
      });
    }

    if (newCommuteRetour) {
      newTravelEvents.push({
        id: `SPORT_TRAVEL_RETOUR_${override.targetDate}_MOVED`,
        category: 'trajet',
        sportType: 'TRAVEL',
        title: `🚶‍♂️ Trajet retour (${originalSportEvent.location})`,
        startDate: newCommuteRetour.departureTime,
        endDate: newCommuteRetour.arrivalTime,
        location: `${originalSportEvent.location} ➔ Domicile`,
        description: `Trajet retour estimé : ~${newCommuteRetour.durationMinutes} min`,
        emoji: "🚶‍♂️",
        colorId: COLOR_MAP.TRAVEL.colorId,
        colorHex: COLOR_MAP.TRAVEL.colorHex,
        durationMinutes: newCommuteRetour.durationMinutes
      });
    }

    // Ajouter la séance et les trajets dans le jour cible
    targetDay.events.push(movedSportEvent, ...newTravelEvents);
    targetDay.events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    targetDay.sportSession = movedSportEvent;

    // Mettre à jour allEvents
    currentAllEvents = currentAllEvents.filter(e => {
      if (e.id === originalSportEvent.id) return false;
      if (oldTravelIds.includes(e.id)) return false;
      if (e.id === ghostPlaceholder.id) return false;
      return true;
    });

    currentAllEvents.push(movedSportEvent, ...newTravelEvents);
  }

  currentAllEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const newSchedules = baseSchedules.map(s => schedulesMap.get(s.date) || s);

  return {
    schedules: newSchedules,
    allEvents: currentAllEvents
  };
}

/**
 * Crée ou met à jour un report de séance dans les overrides.
 */
export function postponeWorkout(
  currentOverrides: Record<string, WorkoutPostponeOverride>,
  originalEventId: string,
  originalDate: string,
  targetDate: string,
  reason?: string,
  targetStartTime?: string
): Record<string, WorkoutPostponeOverride> {
  const updated: Record<string, WorkoutPostponeOverride> = { ...currentOverrides };
  updated[originalEventId] = {
    originalEventId,
    originalDate,
    targetDate,
    targetStartTime,
    reason: reason || 'Déplacée / Reportée par l\'athlète',
    createdAt: new Date().toISOString()
  };
  savePostponeOverrides(updated);
  return updated;
}

/**
 * Annule le report d'une séance et rétablit sa position d'origine.
 */
export function cancelPostponeWorkout(
  currentOverrides: Record<string, WorkoutPostponeOverride>,
  originalEventId: string
): Record<string, WorkoutPostponeOverride> {
  const updated: Record<string, WorkoutPostponeOverride> = { ...currentOverrides };

  // Chercher par clé directe ou par originalEventId
  if (updated[originalEventId]) {
    delete updated[originalEventId];
  } else {
    // Parfois l'id transmis est celui du ghost placeholder
    const cleanId = originalEventId.replace('POSTPONED_GHOST_', '');
    for (const key of Object.keys(updated)) {
      if (key === cleanId || updated[key].originalEventId === originalEventId || updated[key].originalEventId === cleanId) {
        delete updated[key];
      }
    }
  }

  savePostponeOverrides(updated);
  return updated;
}
