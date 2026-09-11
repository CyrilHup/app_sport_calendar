import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import {
  isStrengthOrCalisthenics,
  isTrailOrRunning,
  isCycling,
  isWalking,
  isClimbing,
  classifyGarminActivityType,
  formatGarminActivityName
} from './activityClassifier';
import { calculateSessionTrimp } from './statsEngine';

export type SportDiscipline = 'RUNNING' | 'STRENGTH_TRAINING' | 'CYCLING' | 'WALKING' | 'CLIMBING' | 'OTHER';

export type SportItemType =
  | 'PLANNED_COMPLETED'
  | 'PLANNED_PENDING'
  | 'PLANNED_MISSED'
  | 'CATCHUP_COMPLETED'
  | 'UNPLANNED_BONUS';

export interface SportActivityItem {
  id: string;
  itemType: SportItemType;
  title: string;
  discipline: SportDiscipline;
  emoji: string;
  plannedEvent?: CalendarEvent;
  comparison?: ActivityComparison;
  actualActivity?: GarminActivity;
  durationMinutes: number;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  startTime?: Date;
  endTime?: Date;
  trimp: number;
  isPostponed?: boolean;
  originalScheduledDate?: string;
}

export interface UnifiedDayWorkoutGroup {
  id: string;
  date: string;
  discipline: SportDiscipline;
  title: string;
  emoji: string;
  isMerged: boolean; // vrai si >= 2 activités exécutées/prévues
  items: SportActivityItem[];

  // Métriques cumulées / globales
  totalDurationMinutes: number;
  plannedDurationMinutes: number;
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  weightedAvgHeartRate: number | null;
  maxHeartRate: number | null;
  totalTrimp: number;

  earliestStartTime: Date | null;
  latestEndTime: Date | null;

  // Drapeaux d'état
  hasPlanned: boolean;
  hasValidated: boolean;
  hasUnplannedBonus: boolean;
  hasPostponedCatchup: boolean;
  mainComparison: ActivityComparison | null;
  mainPlannedEvent: CalendarEvent | null;
}

/**
 * Normalise la discipline sportive à partir d'un événement ou d'une activité.
 */
export function normalizeDiscipline(
  event?: CalendarEvent | null,
  activity?: GarminActivity | null
): SportDiscipline {
  if (activity) {
    const garminType = classifyGarminActivityType(activity.activityType, activity.activityName);
    if (garminType === 'TRAIL_RUNNING' || garminType === 'RUNNING') return 'RUNNING';
    if (garminType === 'STRENGTH_TRAINING') return 'STRENGTH_TRAINING';
    if (garminType === 'CYCLING') return 'CYCLING';
    if (garminType === 'WALKING') return 'WALKING';
    if (garminType === 'CLIMBING') return 'CLIMBING';
  }

  if (event) {
    if (isStrengthOrCalisthenics(event)) return 'STRENGTH_TRAINING';
    if (isTrailOrRunning(event)) return 'RUNNING';
    if (isCycling(event)) return 'CYCLING';
    if (isWalking(event)) return 'WALKING';
    if (isClimbing(event)) return 'CLIMBING';
  }

  if (activity) {
    if (isStrengthOrCalisthenics(activity)) return 'STRENGTH_TRAINING';
    if (isTrailOrRunning(activity)) return 'RUNNING';
    if (isCycling(activity)) return 'CYCLING';
    if (isWalking(activity)) return 'WALKING';
  }

  return 'OTHER';
}

/**
 * Retourne le libellé standard et l'émoji par discipline.
 */
export function getDisciplineMetadata(discipline: SportDiscipline): { label: string; emoji: string } {
  switch (discipline) {
    case 'RUNNING':
      return { label: 'Course à pied', emoji: '🏃' };
    case 'STRENGTH_TRAINING':
      return { label: 'Calisthénie / Renfo', emoji: '💪' };
    case 'CYCLING':
      return { label: 'Cyclisme', emoji: '🚴' };
    case 'WALKING':
      return { label: 'Marche / Randonnée', emoji: '🥾' };
    case 'CLIMBING':
      return { label: 'Escalade / Bloc', emoji: '🧗' };
    case 'OTHER':
    default:
      return { label: 'Sport', emoji: '⚡' };
  }
}

/**
 * Construit un item standardisé à partir d'une séance planifiée et de sa comparaison éventuelle.
 */
export function buildPlannedSportItem(
  event: CalendarEvent,
  comparison?: ActivityComparison | null
): SportActivityItem {
  const isDone = Boolean(comparison?.actualActivity && (comparison.status === 'COMPLIANT' || comparison.status === 'PARTIAL'));
  const act = isDone ? comparison?.actualActivity : undefined;
  const discipline = normalizeDiscipline(event, act);
  const meta = getDisciplineMetadata(discipline);

  const actStart = act?.startTimeLocal ? new Date(act.startTimeLocal) : (event.startDate ? new Date(event.startDate) : undefined);
  const dur = act?.durationMinutes || event.durationMinutes;
  const actEnd = actStart ? new Date(actStart.getTime() + dur * 60000) : undefined;

  let itemType: SportItemType = 'PLANNED_PENDING';
  if (isDone) itemType = 'PLANNED_COMPLETED';
  else if (comparison?.status === 'MISSED') itemType = 'PLANNED_MISSED';

  const trimpInfo = act
    ? calculateSessionTrimp(act.durationMinutes, act.activityType, act.activityName, act.trainingLoad, {
        avgHeartRate: act.avgHeartRate,
        maxHeartRate: act.maxHeartRate,
        elevationGainM: act.elevationGainM,
        distanceKm: act.distanceKm
      })
    : calculateSessionTrimp(event.durationMinutes, event.sportType, event.title, null);

  const cleanTitle = discipline === 'STRENGTH_TRAINING'
    ? 'Entraînement Calisthénie'
    : event.title.replace(/^[^a-zA-Z0-9\[]*/, '').trim();

  return {
    id: event.id,
    itemType,
    title: cleanTitle || meta.label,
    discipline,
    emoji: event.emoji || meta.emoji,
    plannedEvent: event,
    comparison: comparison || undefined,
    actualActivity: act,
    durationMinutes: dur,
    distanceKm: act?.distanceKm,
    elevationGainM: act?.elevationGainM || (event.metadata?.targetElevationM ?? undefined),
    elevationLossM: act?.elevationLossM,
    avgHeartRate: act?.avgHeartRate,
    maxHeartRate: act?.maxHeartRate,
    startTime: actStart,
    endTime: actEnd,
    trimp: trimpInfo.trimp,
    isPostponed: Boolean(event.metadata?.isPostponed),
    originalScheduledDate: event.metadata?.originalDate
  };
}

/**
 * Construit un item standardisé pour une séance reportée et réalisée (catchup).
 */
export function buildCatchupSportItem(comp: ActivityComparison): SportActivityItem | null {
  const ev = comp.plannedEvent;
  const act = comp.actualActivity;
  if (!ev) return null;

  const discipline = normalizeDiscipline(ev, act);
  const meta = getDisciplineMetadata(discipline);

  const actStart = act?.startTimeLocal ? new Date(act.startTimeLocal) : (ev.startDate ? new Date(ev.startDate) : undefined);
  const dur = act?.durationMinutes || ev.durationMinutes;
  const actEnd = actStart ? new Date(actStart.getTime() + dur * 60000) : undefined;

  const trimpInfo = act
    ? calculateSessionTrimp(act.durationMinutes, act.activityType, act.activityName, act.trainingLoad, {
        avgHeartRate: act.avgHeartRate,
        maxHeartRate: act.maxHeartRate,
        elevationGainM: act.elevationGainM,
        distanceKm: act.distanceKm
      })
    : calculateSessionTrimp(ev.durationMinutes, ev.sportType, ev.title, null);

  const cleanTitle = discipline === 'STRENGTH_TRAINING'
    ? 'Entraînement Calisthénie'
    : ev.title.replace(/^[^a-zA-Z0-9\[]*/, '').trim();

  return {
    id: `catchup-${comp.id}`,
    itemType: 'CATCHUP_COMPLETED',
    title: cleanTitle || meta.label,
    discipline,
    emoji: ev.emoji || meta.emoji,
    plannedEvent: ev,
    comparison: comp,
    actualActivity: act,
    durationMinutes: dur,
    distanceKm: act?.distanceKm,
    elevationGainM: act?.elevationGainM || ev.metadata?.targetElevationM,
    elevationLossM: act?.elevationLossM,
    avgHeartRate: act?.avgHeartRate,
    maxHeartRate: act?.maxHeartRate,
    startTime: actStart,
    endTime: actEnd,
    trimp: trimpInfo.trimp,
    isPostponed: true,
    originalScheduledDate: comp.scheduledDate
  };
}

/**
 * Construit un item standardisé pour une activité Garmin non planifiée (Bonus).
 */
export function buildUnplannedSportItem(comp: ActivityComparison): SportActivityItem | null {
  const act = comp.actualActivity;
  if (!act) return null;

  const discipline = normalizeDiscipline(null, act);
  const meta = getDisciplineMetadata(discipline);

  const actStart = act.startTimeLocal ? new Date(act.startTimeLocal) : undefined;
  const actEnd = actStart ? new Date(actStart.getTime() + act.durationMinutes * 60000) : undefined;

  const trimpInfo = calculateSessionTrimp(
    act.durationMinutes,
    act.activityType,
    act.activityName,
    act.trainingLoad,
    {
      avgHeartRate: act.avgHeartRate,
      maxHeartRate: act.maxHeartRate,
      elevationGainM: act.elevationGainM,
      distanceKm: act.distanceKm
    }
  );

  const displayName = formatGarminActivityName(act.activityName, undefined, act.activityType);

  return {
    id: `unplanned-${comp.id}`,
    itemType: 'UNPLANNED_BONUS',
    title: displayName || act.activityName || meta.label,
    discipline,
    emoji: meta.emoji,
    comparison: comp,
    actualActivity: act,
    durationMinutes: act.durationMinutes,
    distanceKm: act.distanceKm,
    elevationGainM: act.elevationGainM,
    elevationLossM: act.elevationLossM,
    avgHeartRate: act.avgHeartRate,
    maxHeartRate: act.maxHeartRate,
    startTime: actStart,
    endTime: actEnd,
    trimp: trimpInfo.trimp
  };
}

/**
 * Regroupe et fusionne les séances sportives d'une même journée par discipline.
 */
export function groupDaySportWorkouts(
  daySportEvents: CalendarEvent[],
  comparisons: ActivityComparison[],
  dayDate: string
): UnifiedDayWorkoutGroup[] {
  const rawItems: SportActivityItem[] = [];

  // 1. Événements planifiés du jour
  for (const ev of daySportEvents) {
    // Ignorer les fantômes de report (ils sont rendus à part comme indicateurs)
    if (ev.metadata?.isPostponedPlaceholder) continue;

    const comp = comparisons.find(c => c.plannedEvent?.id === ev.id);

    // Si la séance a été rattrapée un AUTRE jour, ne pas l'inclure dans les activités du jour
    if (comp?.isPostponedCatchup && comp.executedDate && comp.executedDate !== dayDate) {
      continue;
    }

    rawItems.push(buildPlannedSportItem(ev, comp));
  }

  // 2. Séances de rattrapage exécutées ce jour
  const catchupComps = comparisons.filter(c => c.isPostponedCatchup && c.executedDate === dayDate);
  for (const comp of catchupComps) {
    const item = buildCatchupSportItem(comp);
    if (item) rawItems.push(item);
  }

  // 3. Activités bonus non planifiées ce jour
  const unplannedComps = comparisons.filter(c => c.status === 'UNPLANNED' && c.date === dayDate);
  for (const comp of unplannedComps) {
    const item = buildUnplannedSportItem(comp);
    if (item) rawItems.push(item);
  }

  // Regroupement par discipline
  const mapByDiscipline = new Map<SportDiscipline, SportActivityItem[]>();
  for (const item of rawItems) {
    const existing = mapByDiscipline.get(item.discipline) || [];
    existing.push(item);
    mapByDiscipline.set(item.discipline, existing);
  }

  const groups: UnifiedDayWorkoutGroup[] = [];

  for (const [discipline, items] of mapByDiscipline.entries()) {
    // Trier chronologiquement les items du groupe si horaires disponibles
    items.sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.getTime() - b.startTime.getTime();
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });

    const isMerged = items.length > 1;
    const meta = getDisciplineMetadata(discipline);

    let totalDuration = 0;
    let plannedDuration = 0;
    let totalDist = 0;
    let totalElevGain = 0;
    let totalElevLoss = 0;
    let weightedHrSum = 0;
    let hrDurationSum = 0;
    let maxHr: number | null = null;
    let totalTrimp = 0;

    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;

    let hasPlanned = false;
    let hasValidated = false;
    let hasUnplanned = false;
    let hasCatchup = false;

    let mainComparison: ActivityComparison | null = null;
    let mainPlannedEvent: CalendarEvent | null = null;

    for (const item of items) {
      totalDuration += item.durationMinutes;
      if (item.plannedEvent) plannedDuration += item.plannedEvent.durationMinutes;

      if (item.distanceKm) totalDist += item.distanceKm;
      if (item.elevationGainM) totalElevGain += item.elevationGainM;
      if (item.elevationLossM) totalElevLoss += item.elevationLossM;

      if (item.avgHeartRate && item.durationMinutes > 0) {
        weightedHrSum += item.avgHeartRate * item.durationMinutes;
        hrDurationSum += item.durationMinutes;
      }

      if (item.maxHeartRate) {
        maxHr = maxHr === null ? item.maxHeartRate : Math.max(maxHr, item.maxHeartRate);
      } else if (item.avgHeartRate) {
        maxHr = maxHr === null ? item.avgHeartRate : Math.max(maxHr, item.avgHeartRate);
      }

      totalTrimp += item.trimp;

      if (item.startTime) {
        if (!earliestStart || item.startTime < earliestStart) earliestStart = item.startTime;
      }
      if (item.endTime) {
        if (!latestEnd || item.endTime > latestEnd) latestEnd = item.endTime;
      }

      if (item.plannedEvent) {
        hasPlanned = true;
        if (!mainPlannedEvent) mainPlannedEvent = item.plannedEvent;
      }
      if (item.itemType === 'PLANNED_COMPLETED' || item.itemType === 'CATCHUP_COMPLETED') {
        hasValidated = true;
      }
      if (item.itemType === 'UNPLANNED_BONUS') {
        hasUnplanned = true;
      }
      if (item.itemType === 'CATCHUP_COMPLETED') {
        hasCatchup = true;
      }
      if (!mainComparison && item.comparison) {
        mainComparison = item.comparison;
      }
    }

    const weightedAvgHr = hrDurationSum > 0 ? Math.round(weightedHrSum / hrDurationSum) : null;

    // Titre consolidé
    let groupTitle = '';
    if (isMerged) {
      if (mainPlannedEvent) {
        const cleanMain = mainPlannedEvent.title.replace(/^[^a-zA-Z0-9\[]*/, '').trim();
        groupTitle = `${cleanMain} (${items.length} sorties)`;
      } else {
        groupTitle = `${meta.label} (${items.length} séances)`;
      }
    } else {
      groupTitle = items[0].title;
    }

    groups.push({
      id: `group-${dayDate}-${discipline.toLowerCase()}`,
      date: dayDate,
      discipline,
      title: groupTitle,
      emoji: meta.emoji,
      isMerged,
      items,
      totalDurationMinutes: totalDuration,
      plannedDurationMinutes: plannedDuration,
      totalDistanceKm: Number(totalDist.toFixed(2)),
      totalElevationGainM: Math.round(totalElevGain),
      totalElevationLossM: Math.round(totalElevLoss),
      weightedAvgHeartRate: weightedAvgHr,
      maxHeartRate: maxHr,
      totalTrimp: Math.round(totalTrimp),
      earliestStartTime: earliestStart,
      latestEndTime: latestEnd,
      hasPlanned,
      hasValidated,
      hasUnplannedBonus: hasUnplanned,
      hasPostponedCatchup: hasCatchup,
      mainComparison,
      mainPlannedEvent
    });
  }

  return groups;
}
