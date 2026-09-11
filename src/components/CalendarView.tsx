import React, { useState, useEffect } from 'react';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { ActivityComparison } from '../types/garmin';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Clock,
  MapPin,
  ListFilter,
  LayoutGrid,
  Bus,
  CheckCircle2,
  ArrowRight,
  CalendarClock,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Watch,
  RefreshCw,
  Activity,
  Layers,
  Zap
} from 'lucide-react';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { WeatherWidget } from './WeatherWidget';
import { getWellnessForDate, calculateReadinessScore, getProactivePlanRecommendation } from '../services/readinessEngine';
import { triggerHapticFeedback } from '../services/hapticsService';
import { formatDateKey, formatTime, formatFriendlyDay, getGarminLocalDateKey, toLocalDateKey, parseLocalDate, addDays } from '../services/dateUtils';
import { computeTrainingLoadStats, calculateSessionTrimp } from '../services/statsEngine';
import { evaluateAdaptivePlanStatus, isAutoAdaptEnabled, setAutoAdaptEnabled } from '../services/adaptivePlanEngine';
import { AdaptiveWorkoutAction, AdaptiveWorkoutOverride } from '../types/calendar';
import { GarminActivity } from '../types/garmin';
import { formatGarminActivityName, getGarminExecutionBadge, isStrengthOrCalisthenics, isTrailOrRunning } from '../services/activityClassifier';
import { syncCurrentWeekWorkoutsToGarmin, isGarminAutoSyncEnabled } from '../services/garminAutoSyncService';
import { loadStoredGarminActivities } from '../services/garminService';
import { groupDaySportWorkouts, UnifiedDayWorkoutGroup, SportActivityItem } from '../services/workoutAggregator';

interface CalendarViewProps {
  schedules: DailySchedule[];
  allEvents?: CalendarEvent[];
  referenceDateStr?: string;
  referenceDate?: Date;
  onPostponeWorkout?: (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => void;
  onCancelPostponeWorkout?: (eventId: string) => void;
  comparisons?: ActivityComparison[];
  garminActivities?: GarminActivity[];
  adaptiveOverrides?: Record<string, AdaptiveWorkoutOverride>;
  onApplyAdaptivePlan?: (actions: AdaptiveWorkoutAction[]) => void;
  onRevertAdaptivePlan?: () => void;
  onOpenGarminSync?: () => void;
}

type FilterCategory = 'all' | 'sport' | 'course' | 'mobility';
type ViewMode = 'day' | 'grid' | 'list';



interface UnifiedWorkoutGroupCardProps {
  group: UnifiedDayWorkoutGroup;
  isList?: boolean;
  isSingleDayView?: boolean;
  onSelect: (group: UnifiedDayWorkoutGroup, specificItem?: SportActivityItem) => void;
  onPostponeWorkout?: (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, event: CalendarEvent) => void;
  onDragEnd?: () => void;
}

const UnifiedWorkoutGroupCard: React.FC<UnifiedWorkoutGroupCardProps> = ({
  group,
  isList,
  isSingleDayView,
  onSelect,
  onPostponeWorkout,
  isDraggable,
  onDragStart,
  onDragEnd
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isMerged, discipline, items } = group;
  const isRunning = discipline === 'RUNNING';
  const isStrength = discipline === 'STRENGTH_TRAINING';

  // Thème de bordure et de fond
  let borderColor = '#f97316';
  let bgGradient = 'var(--bg-card)';
  if (group.hasValidated) {
    borderColor = '#10b981';
    bgGradient = isMerged
      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.06) 100%)'
      : 'rgba(16, 185, 129, 0.04)';
  } else if (group.hasUnplannedBonus && !group.hasPlanned) {
    borderColor = '#f59e0b';
    bgGradient = 'rgba(245, 158, 11, 0.07)';
  }

  // Horaires
  const startTimeFormatted = group.earliestStartTime ? formatTime(group.earliestStartTime) : null;
  const endTimeFormatted = group.latestEndTime ? formatTime(group.latestEndTime) : null;
  const timeDisplay = (startTimeFormatted && endTimeFormatted)
    ? `${startTimeFormatted} – ${endTimeFormatted}`
    : (group.mainPlannedEvent?.startDate && group.mainPlannedEvent?.endDate)
    ? `${formatTime(group.mainPlannedEvent.startDate)} – ${formatTime(group.mainPlannedEvent.endDate)}`
    : null;

  const mainEv = group.mainPlannedEvent || items[0]?.plannedEvent;
  const canDrag = Boolean(isDraggable && mainEv && !group.hasValidated);

  return (
    <div
      className={`event-card sport ${canDrag ? 'draggable-sport' : ''}`}
      onClick={() => onSelect(group)}
      draggable={canDrag}
      onDragStart={(e) => {
        if (canDrag && mainEv && onDragStart) onDragStart(e, mainEv);
      }}
      onDragEnd={onDragEnd}
      title={isMerged
        ? `${group.title} (${items.length} activités unifiées)\nCliquer pour voir les statistiques globales et séparées.`
        : `${group.title}\nCliquer pour voir les détails.`}
      style={{
        borderLeftColor: borderColor,
        background: bgGradient,
        cursor: canDrag ? 'grab' : 'pointer',
        padding: isList ? '10px 12px' : isSingleDayView ? '10px 14px' : '8px 10px',
        position: 'relative'
      }}
    >
      {/* En-tête : Titre & Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
          <span style={{ fontSize: isSingleDayView ? '1.05rem' : '0.9rem' }}>{group.emoji}</span>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: isList ? 'normal' : 'nowrap',
            fontSize: isSingleDayView ? '0.88rem' : '0.8rem',
            fontWeight: 700,
            color: '#ffffff'
          }}>
            {group.title}
          </span>

          {/* Badge Unifiée */}
          {isMerged && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                background: 'rgba(56, 189, 248, 0.16)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '4px',
                padding: '1px 5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0
              }}
              title={`${items.length} activités unifiées pour cette discipline`}
            >
              <Layers size={10} />
              <span>{items.length} {isRunning ? 'sorties' : 'séances'}</span>
            </span>
          )}

          {/* Badge Validée Garmin */}
          {group.hasValidated && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                padding: '1px 5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={10} />
              <span>Validée Garmin</span>
            </span>
          )}

          {/* Badge Bonus Garmin */}
          {!group.hasValidated && group.hasUnplannedBonus && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '4px',
                padding: '1px 5px',
                flexShrink: 0
              }}
            >
              ⚡ Bonus Garmin
            </span>
          )}

          {/* Badge Reportée */}
          {group.hasPostponedCatchup && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '4px',
                padding: '1px 5px',
                flexShrink: 0
              }}
            >
              🔄 Reportée
            </span>
          )}

          {/* Badge Adapté */}
          {mainEv?.metadata?.isAdapted && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                background: 'rgba(56, 189, 248, 0.18)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '4px',
                padding: '1px 5px',
                flexShrink: 0
              }}
              title={`Séance adaptée : ${mainEv.metadata.adaptationReason || ''}`}
            >
              🛡️ Adapté
            </span>
          )}
        </div>

        {/* Boutons d'action à droite (+1j ou Accordéon) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {mainEv && onPostponeWorkout && !group.hasValidated && !group.hasPostponedCatchup && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currD = mainEv.startDate.slice(0, 10);
                const nextD = new Date(currD + 'T12:00:00');
                nextD.setDate(nextD.getDate() + 1);
                const targetD = nextD.toISOString().slice(0, 10);
                const origD = mainEv.metadata?.originalDate || currD;
                onPostponeWorkout(mainEv.id, origD, targetD);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                padding: isSingleDayView ? '3px 6px' : '2px 5px',
                color: 'var(--text-secondary)',
                fontSize: '0.66rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer'
              }}
              title="Reporter la séance au lendemain (+1 jour)"
            >
              <CalendarClock size={11} />
              <span>+1j</span>
            </button>
          )}

          {isMerged && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              style={{
                background: isExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 4,
                padding: '2px 5px',
                color: isExpanded ? '#38bdf8' : 'var(--text-secondary)',
                fontSize: '0.66rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer'
              }}
              title={isExpanded ? 'Masquer les sorties individuelles' : 'Afficher chaque sortie individuellement'}
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{isExpanded ? 'Moins' : `${items.length}`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Ligne Horaires & Durée (Format unifié pour toutes les séances) */}
      <div className="event-meta" style={{ fontSize: isSingleDayView ? '0.76rem' : '0.7rem', marginTop: 4 }}>
        {timeDisplay && (
          <>
            <span style={{ color: group.hasValidated ? '#10b981' : undefined, fontWeight: group.hasValidated ? 600 : undefined }}>
              <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
              {timeDisplay}
            </span>
            <span>•</span>
          </>
        )}
        <span style={{ fontWeight: 700, color: group.hasValidated ? '#10b981' : undefined }}>
          {group.totalDurationMinutes}m {group.hasValidated || group.hasUnplannedBonus ? 'réelles' : ''}
        </span>
        {mainEv?.location && (
          <span style={{ color: 'var(--text-secondary)' }}>
            <MapPin size={10} style={{ display: 'inline', marginRight: 2 }} />
            {mainEv.location}
          </span>
        )}
      </div>

      {/* Chips télémétriques harmonisées pour TOUTES les séances (single ou fusionnées) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isSingleDayView ? '0.74rem' : '0.68rem', color: 'var(--text-secondary)', marginTop: 4, flexWrap: 'wrap' }}>
        {isRunning && group.totalDistanceKm > 0 && (
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 5px', borderRadius: 3 }}>
            📏 {group.totalDistanceKm.toFixed(1)} km
          </span>
        )}
        {isRunning && group.totalElevationGainM > 0 && (
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 5px', borderRadius: 3 }}>
            ⛰️ +{group.totalElevationGainM}m
          </span>
        )}
        {group.weightedAvgHeartRate && (
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 5px', borderRadius: 3 }}>
            ❤️ {group.weightedAvgHeartRate} bpm{isMerged ? ' moy.' : ''}
          </span>
        )}
        {group.totalTrimp > 0 && (
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 5px', borderRadius: 3, color: '#f59e0b', fontWeight: 600 }}>
            ⚡ {group.totalTrimp} TRIMP
          </span>
        )}

        {/* Cibles planifiées si séance non encore validée */}
        {!group.hasValidated && !group.hasUnplannedBonus && !isStrength && mainEv?.metadata?.targetHeartRate && (
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
            🎯 Cible : {mainEv.metadata.targetHeartRate}
          </span>
        )}
        {!group.hasValidated && !group.hasUnplannedBonus && !isStrength && mainEv?.metadata?.targetElevationM && (
          <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>
            ⛰️ +{mainEv.metadata.targetElevationM}m D+
          </span>
        )}
      </div>

      {/* Trajet bus si configuré */}
      {(mainEv?.metadata?.commuteAller || mainEv?.metadata?.commuteRetour) && (
        <div className="journey-strip" style={{ fontSize: isSingleDayView ? '0.72rem' : '0.68rem', padding: '5px 8px', marginTop: 4 }}>
          <Bus size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span>
            {mainEv.metadata.commuteAller && `Départ : ${formatTime(mainEv.metadata.commuteAller.departureTime)} (${mainEv.metadata.commuteAller.durationMinutes}m)`}
            {mainEv.metadata.commuteAller && mainEv.metadata.commuteRetour && ' • '}
            {mainEv.metadata.commuteRetour && `Retour ~${formatTime(mainEv.metadata.commuteRetour.arrivalTime)}`}
          </span>
        </div>
      )}

      {/* Accordéon inline des sous-sorties si déplié */}
      {isMerged && isExpanded && (
        <div style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: '1px dashed rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 5
        }}>
          {items.map((sub, idx) => (
            <div
              key={sub.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(group, sub);
              }}
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: '0.68rem',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.25)')}
              title="Cliquer pour voir cette séance individuellement"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: '#e2e8f0' }}>
                  {isRunning ? `Sortie ${idx + 1}` : `Séance ${idx + 1}`}
                  {sub.startTime && ` • ${formatTime(sub.startTime)}`}
                </span>
                <span style={{
                  color: sub.itemType === 'UNPLANNED_BONUS' ? '#f59e0b' : '#34d399',
                  fontWeight: 600,
                  fontSize: '0.66rem'
                }}>
                  {sub.durationMinutes}m {sub.itemType === 'UNPLANNED_BONUS' ? '⚡ Bonus' : '✅ Validée'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginTop: 3 }}>
                {sub.distanceKm && <span>📏 {sub.distanceKm.toFixed(2)} km</span>}
                {sub.elevationGainM && <span>⛰️ +{Math.round(sub.elevationGainM)}m</span>}
                {sub.avgHeartRate && <span>❤️ {sub.avgHeartRate} bpm</span>}
                {sub.trimp > 0 && <span>⚡ {sub.trimp} TRIMP</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Rétrocompatibilité : UnplannedGarminCard conserve son interface et délègue au groupe
interface UnplannedGarminCardProps {
  comp: ActivityComparison;
  isList?: boolean;
  isSingleDayView?: boolean;
  onSelect: (event: CalendarEvent, comp: ActivityComparison) => void;
}

const UnplannedGarminCard: React.FC<UnplannedGarminCardProps> = ({
  comp,
  isList,
  isSingleDayView,
  onSelect
}) => {
  const act = comp.actualActivity;
  if (!act) return null;
  const badge = getGarminExecutionBadge(act);
  const displayName = formatGarminActivityName(act.activityName, undefined, act.activityType);
  const isActTrailOrRun = isTrailOrRunning(act) || Boolean(act.distanceKm && act.distanceKm >= 0.5) || Boolean(act.elevationGainM && act.elevationGainM > 30);
  const isStrength = !isActTrailOrRun && isStrengthOrCalisthenics(act);

  const syntheticEvent: CalendarEvent = {
    id: `unplanned-${isList ? 'list-' : ''}${act.activityId}`,
    title: displayName || 'Séance Garmin Hors-Plan',
    description: `Activité non planifiée enregistrée sur Garmin Connect.\nType: ${badge.label}${!isStrength && act.distanceKm ? `\nDistance: ${act.distanceKm.toFixed(2)} km` : ''}${!isStrength && act.elevationGainM ? `\nD+: ${act.elevationGainM}m` : ''}`,
    startDate: act.startTimeLocal,
    endDate: new Date(new Date(act.startTimeLocal).getTime() + act.durationMinutes * 60000).toISOString(),
    category: 'sport',
    colorId: 'unplanned',
    colorHex: '#f59e0b',
    durationMinutes: act.durationMinutes,
    emoji: badge.icon,
    location: 'Garmin Connect',
    metadata: {
      targetElevationM: isStrength ? undefined : act.elevationGainM,
      targetHeartRate: act.avgHeartRate ? `${act.avgHeartRate} bpm` : undefined
    }
  };

  return (
    <div
      key={`unplanned-${isList ? 'list-' : ''}${comp.id}`}
      className="event-card sport"
      onClick={() => onSelect(syntheticEvent, comp)}
      title="Activité non planifiée enregistrée sur Garmin. Cliquer pour voir les détails télémétriques."
      style={{
        borderLeftColor: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        padding: isList ? '10px 12px' : isSingleDayView ? '10px 14px' : '8px 10px',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: isList ? '0.76rem' : '0.74rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{badge.icon}</span> Bonus Garmin
        </span>
        <span style={{ fontSize: isList ? '0.7rem' : '0.68rem', color: '#f59e0b', fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: isList ? 4 : 3 }}>
          {act.durationMinutes}m{isList ? ' réalisés' : ''}
        </span>
      </div>
      <div style={{ fontSize: isList ? '0.84rem' : isSingleDayView ? '0.84rem' : '0.76rem', color: '#ffffff', fontWeight: 700, marginTop: isList ? 4 : 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isList ? 'normal' : 'nowrap' }}>
        {act.activityName}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isList ? '0.72rem' : '0.7rem', color: 'var(--text-secondary)', marginTop: 4, flexWrap: 'wrap' }}>
        {!isStrength && Boolean(act.distanceKm && act.distanceKm > 0) && (
          <span>📏 {act.distanceKm!.toFixed(1)} km</span>
        )}
        {!isStrength && Boolean(act.elevationGainM && act.elevationGainM > 0) && (
          <span>⛰️ +{Math.round(act.elevationGainM!)}m</span>
        )}
        {Boolean(act.avgHeartRate) && (
          <span>❤️ {act.avgHeartRate} bpm</span>
        )}
      </div>
    </div>
  );
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  schedules,
  allEvents = [],
  referenceDateStr,
  referenceDate,
  onPostponeWorkout,
  onCancelPostponeWorkout,
  comparisons = [],
  garminActivities = [],
  adaptiveOverrides = {},
  onApplyAdaptivePlan,
  onRevertAdaptivePlan,
  onOpenGarminSync
}) => {
  const isMobileInitial = typeof window !== 'undefined' && window.innerWidth < 768;
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(isMobileInitial ? 'day' : 'grid');
  const effectiveRefDate = referenceDate || (referenceDateStr ? parseLocalDate(referenceDateStr) : new Date());
  const todayKey = referenceDateStr || formatDateKey(effectiveRefDate);
  const currentTodayIndex = schedules.findIndex(s => s.date === todayKey);
  const currentWeekOffset = currentTodayIndex >= 0 ? Math.floor(currentTodayIndex / 7) : 0;

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedComparison, setSelectedComparison] = useState<ActivityComparison | null>(null);
  const [selectedUnifiedGroup, setSelectedUnifiedGroup] = useState<UnifiedDayWorkoutGroup | null>(null);

  const handleSelectGroup = (group: UnifiedDayWorkoutGroup, specificItem?: SportActivityItem) => {
    setSelectedUnifiedGroup(group);
    const targetItem = specificItem || group.items[0];
    setSelectedEvent(targetItem?.plannedEvent || group.mainPlannedEvent || null);
    setSelectedComparison(targetItem?.comparison || group.mainComparison || null);
  };
  const [weekOffset, setWeekOffset] = useState<number>(() => currentWeekOffset);
  const [hasInitializedOffset, setHasInitializedOffset] = useState<boolean>(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    return currentTodayIndex >= 0 ? currentTodayIndex % 7 : 0;
  });

  const [isSyncingWeekGarmin, setIsSyncingWeekGarmin] = useState<boolean>(false);
  const [garminSyncFeedback, setGarminSyncFeedback] = useState<string | null>(null);

  const handleManualSyncCurrentWeek = async () => {
    setIsSyncingWeekGarmin(true);
    setGarminSyncFeedback(null);
    triggerHapticFeedback('light');

    try {
      const res = await syncCurrentWeekWorkoutsToGarmin(allEvents, effectiveRefDate, { force: true });
      if (res.success) {
        triggerHapticFeedback('success');
        if (res.pushedCount > 0) {
          setGarminSyncFeedback(`${res.pushedCount} séance${res.pushedCount > 1 ? 's' : ''} envoyée${res.pushedCount > 1 ? 's' : ''} sur Garmin !`);
        } else {
          setGarminSyncFeedback('Séances de la semaine déjà synchronisées !');
        }
      } else if (res.reason === 'NO_CREDENTIALS') {
        triggerHapticFeedback('warning');
        setGarminSyncFeedback('Identifiants Garmin non configurés');
        if (onOpenGarminSync) onOpenGarminSync();
      } else {
        triggerHapticFeedback('warning');
        setGarminSyncFeedback(res.error || 'Erreur lors de la synchronisation Garmin');
      }
    } catch {
      triggerHapticFeedback('warning');
      setGarminSyncFeedback('Erreur réseau ou proxy');
    } finally {
      setIsSyncingWeekGarmin(false);
      setTimeout(() => setGarminSyncFeedback(null), 4500);
    }
  };

  useEffect(() => {
    if (!hasInitializedOffset && schedules.length > 0) {
      const idx = schedules.findIndex(s => s.date === todayKey);
      if (idx >= 0) {
        setWeekOffset(Math.floor(idx / 7));
        setActiveDayIndex(idx % 7);
        setHasInitializedOffset(true);
      }
    }
  }, [schedules, todayKey, hasInitializedOffset]);

  const todayWellness = getWellnessForDate(todayKey);
  const todayComparisons = comparisons.filter(c => c.date === todayKey);
  const isTodaySessionCompleted = todayComparisons.some(
    c => (c.status === 'COMPLIANT' || c.status === 'PARTIAL') && c.plannedEvent?.category === 'sport'
  );
  const allStoredActs = (garminActivities && garminActivities.length > 0)
    ? garminActivities
    : loadStoredGarminActivities();
  const todayGarminActs = allStoredActs.filter(a => getGarminLocalDateKey(a) === todayKey);
  const todayActs = todayGarminActs.length > 0
    ? todayGarminActs
    : todayComparisons.filter(c => Boolean(c.actualActivity)).map(c => c.actualActivity!);
  const readiness = calculateReadinessScore(todayWellness, undefined, todayActs, isTodaySessionCompleted);
  const todaySchedule = schedules.find(s => s.date === todayKey);
  const proactiveRec = getProactivePlanRecommendation(readiness, todaySchedule?.sportSession, isTodaySessionCompleted);

  // Découpage en blocs de 7 jours
  const currentWeekStartIdx = weekOffset * 7;
  const displayedDays = schedules.slice(
    Math.max(0, currentWeekStartIdx),
    Math.max(7, currentWeekStartIdx + 7)
  );

  const displayedSportSessions = displayedDays
    .map(d => d.sportSession)
    .filter((e): e is CalendarEvent => Boolean(e));

  const trainingLoad = computeTrainingLoadStats(garminActivities || [], effectiveRefDate);
  const adaptiveStatus = evaluateAdaptivePlanStatus(
    trainingLoad,
    readiness,
    displayedSportSessions,
    adaptiveOverrides
  );

  const totalTrimpSavedByAdaptation = adaptiveStatus.recommendedActions.reduce((sum, act) => {
    const orig = calculateSessionTrimp(act.originalDurationMinutes, act.originalTitle, act.originalTitle).trimp;
    const adapt = calculateSessionTrimp(act.adaptedDurationMinutes, act.adaptedSportType || act.adaptedTitle, act.adaptedTitle).trimp;
    return sum + Math.max(0, orig - adapt);
  }, 0);

  const formatFriendlyDateStr = formatFriendlyDay;

  const [autoAdapt, setAutoAdapt] = useState<boolean>(() => isAutoAdaptEnabled());

  const handleToggleAutoAdapt = () => {
    const next = !autoAdapt;
    setAutoAdapt(next);
    setAutoAdaptEnabled(next);
    if (next && adaptiveStatus.recommendedActions.length > 0 && onApplyAdaptivePlan) {
      onApplyAdaptivePlan(adaptiveStatus.recommendedActions);
    }
  };

  // Auto-Pilot : application automatique continue pour maintenir le Sweet Spot
  useEffect(() => {
    if (
      autoAdapt &&
      !adaptiveStatus.hasActiveAdaptations &&
      (adaptiveStatus.injuryRiskLevel === 'HIGH' || adaptiveStatus.injuryRiskLevel === 'MODERATE') &&
      adaptiveStatus.recommendedActions.length > 0 &&
      onApplyAdaptivePlan
    ) {
      onApplyAdaptivePlan(adaptiveStatus.recommendedActions);
    }
  }, [autoAdapt, adaptiveStatus.hasActiveAdaptations, adaptiveStatus.injuryRiskLevel, adaptiveStatus.recommendedActions.length, onApplyAdaptivePlan]);

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Format compact et lisible de la semaine (ex: 7 — 13 sept.)
  const formatWeekRange = () => {
    if (displayedDays.length === 0) return '';
    try {
      const start = parseLocalDate(displayedDays[0].date);
      const end = parseLocalDate(displayedDays[displayedDays.length - 1].date);
      const startDay = start.getDate();
      const endDay = end.getDate();
      const endMonth = end.toLocaleDateString('fr-CA', { month: 'short' });
      return `${startDay} — ${endDay} ${endMonth}`;
    } catch {
      return `${displayedDays[0].date.slice(5)} — ${displayedDays[displayedDays.length - 1].date.slice(5)}`;
    }
  };

  const handleResetToToday = () => {
    const todayIndex = schedules.findIndex(s => s.date === todayKey);
    const targetOffset = todayIndex >= 0 ? Math.floor(todayIndex / 7) : 0;
    setWeekOffset(targetOffset);
    if (todayIndex >= 0) {
      setActiveDayIndex(todayIndex % 7);
    }
  };

  // Compteurs pour la semaine affichée
  const currentWeekEvents = displayedDays.flatMap(d => d.events);
  const countSport = currentWeekEvents.filter(e => e.category === 'sport').length;
  const countCourse = currentWeekEvents.filter(e => e.category === 'course').length;
  const countMobility = currentWeekEvents.filter(e => e.category === 'mobility').length;
  const countAll = countSport + countCourse + countMobility;

  return (
    <div className="calendar-layout">
      {/* Contrôles de Vue & Navigation Unifiés (Ligne Unique Compacte) */}
      <div className="calendar-toolbar-card">
        <div className="calendar-toolbar-row">
          {/* Week Navigation */}
          <div className="calendar-nav-group">
            <button
              className="btn-secondary nav-arrow-btn"
              onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              title="Semaine précédente"
              aria-label="Semaine précédente"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="calendar-date-range">
              {formatWeekRange()}
            </span>

            <button
              className="btn-secondary nav-arrow-btn"
              onClick={() => setWeekOffset(prev => prev + 1)}
              disabled={currentWeekStartIdx + 7 >= schedules.length}
              title="Semaine suivante"
              aria-label="Semaine suivante"
            >
              <ChevronRight size={15} />
            </button>

            {weekOffset !== currentWeekOffset ? (
              <button
                type="button"
                className="btn-secondary nav-today-quick-btn"
                onClick={handleResetToToday}
                title="Revenir à la semaine actuelle"
              >
                Aujourd'hui
              </button>
            ) : (
              <span className="calendar-current-week-tag desktop-only">
                Actuelle
              </span>
            )}
          </div>

          {/* View Mode & Quick Actions */}
          <div className="calendar-actions-group">
            {/* View Mode Pills (Jour / Grille / Liste) */}
            <div className="view-mode-segmented">
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
                title="Affichage par Jour (Mobile)"
                aria-label="Affichage par Jour"
              >
                <Calendar size={13} />
                <span className="desktop-only">Jour</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                title="Grille Hebdomadaire"
                aria-label="Grille Hebdomadaire"
              >
                <LayoutGrid size={13} />
                <span className="desktop-only">Grille</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                title="Vue Liste"
                aria-label="Vue Liste"
              >
                <ListFilter size={13} />
                <span className="desktop-only">Liste</span>
              </button>
            </div>
          </div>
        </div>

        {/* Integrated Filter Chips & Weather Strip */}
        <div className="calendar-subbar-strip">
          {/* Compact Mont-Royal Weather */}
          <WeatherWidget compact />

          <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 4px', flexShrink: 0 }} />

          {/* Category Filters */}
          <button
            className={`chip-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tous ({countAll})
          </button>

          <button
            className={`chip-btn ${filter === 'sport' ? 'active' : ''}`}
            onClick={() => setFilter('sport')}
            style={filter === 'sport' ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
          >
            🏔️ Séances ({countSport})
          </button>

          <button
            className={`chip-btn ${filter === 'course' ? 'active' : ''}`}
            onClick={() => setFilter('course')}
            style={filter === 'course' ? { borderColor: '#3b82f6', color: '#60a5fa' } : undefined}
          >
            🏛️ Cours ({countCourse})
          </button>

          <button
            className={`chip-btn ${filter === 'mobility' ? 'active' : ''}`}
            onClick={() => setFilter('mobility')}
            style={filter === 'mobility' ? { borderColor: '#10b981', color: '#34d399' } : undefined}
          >
            🧘 Mobilité ({countMobility})
          </button>

          {/* Bouton Toggle Auto-Pilot Adaptatif Sweet Spot */}
          <button
            type="button"
            className="chip-btn"
            onClick={handleToggleAutoAdapt}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: autoAdapt ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: autoAdapt ? '#10b981' : 'var(--border-color)',
              color: autoAdapt ? '#34d399' : 'var(--text-muted)',
              fontWeight: 600,
              padding: '4px 10px',
              fontSize: '0.74rem'
            }}
            title={autoAdapt ? "Auto-Pilot actif : le calendrier s'adapte automatiquement pour rester dans le Sweet Spot" : "Auto-Pilot désactivé : vous appliquez manuellement les adaptations recommandées"}
          >
            <Sparkles size={12} color={autoAdapt ? '#10b981' : 'var(--text-muted)'} />
            <span>{autoAdapt ? 'Auto-Pilot : ON' : 'Auto-Pilot : OFF'}</span>
          </button>

          {/* Bouton Synchro Semaine Garmin */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {garminSyncFeedback && (
              <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                {garminSyncFeedback}
              </span>
            )}
            <button
              type="button"
              className="chip-btn"
              onClick={handleManualSyncCurrentWeek}
              disabled={isSyncingWeekGarmin}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(37, 99, 235, 0.12)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontWeight: 600,
                padding: '4px 10px',
                fontSize: '0.74rem'
              }}
              title="Synchroniser ou actualiser toutes les séances de la semaine courante sur votre montre Garmin Forerunner 55"
            >
              {isSyncingWeekGarmin ? (
                <RefreshCw size={12} className="spin-animation" />
              ) : (
                <Watch size={13} />
              )}
              <span>{isSyncingWeekGarmin ? 'Envoi Garmin...' : 'Sync Semaine Garmin'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🛡️ Coach Adaptatif QMT : Anti-blessure & Progression */}
      {adaptiveStatus.hasActiveAdaptations ? (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#34d399' }}>
            <ShieldCheck size={16} color="#10b981" />
            <div>
              <strong>Plan Adaptatif Actif {autoAdapt ? '(Auto-Pilot)' : ''} :</strong> Vos sorties de trail sont modulées pour respecter votre tolérance mécanique (ACWR actuel : {adaptiveStatus.trailAcwrRatio} en Sweet Spot). Calisthénie maintenue intacte.
            </div>
          </div>
          {onRevertAdaptivePlan && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRevertAdaptivePlan}
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)'
              }}
              title="Rétablir le plan d'entraînement nominal"
            >
              <RotateCcw size={12} /> Rétablir le plan standard
            </button>
          )}
        </div>
      ) : adaptiveStatus.injuryRiskLevel === 'HIGH' && adaptiveStatus.recommendedActions.length > 0 ? (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#f87171', fontWeight: 700 }}>
              <ShieldAlert size={17} color="#ef4444" />
              <span>{adaptiveStatus.headline}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {totalTrimpSavedByAdaptation > 0 && (
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid #10b981',
                    color: '#34d399',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}
                >
                  -{totalTrimpSavedByAdaptation} TRIMP économisés
                </span>
              )}
              {onApplyAdaptivePlan && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onApplyAdaptivePlan(adaptiveStatus.recommendedActions)}
                  style={{
                    fontSize: '0.74rem',
                    padding: '5px 12px',
                    background: 'var(--primary)',
                    color: 'white',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Sparkles size={13} /> Appliquer l'adaptation anti-blessure
                </button>
              )}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {adaptiveStatus.explanation}
          </p>
          <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '6px 10px', borderRadius: 4, fontSize: '0.73rem', color: '#93c5fd', lineHeight: 1.4 }}>
            💡 <strong>Pourquoi cliquer ici réduit la charge ?</strong> La charge aiguë (7j) additionne directement les TRIMPs des séances de course. En allégeant la durée et le D+, vous retirez {totalTrimpSavedByAdaptation > 0 ? `${totalTrimpSavedByAdaptation} TRIMP` : 'de la charge'} directement du numérateur ACWR sans impacter significativement votre socle chronique (28j), ce qui fait replonger le ratio dans le Sweet Spot (&lt; 1.3).
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
            {adaptiveStatus.recommendedActions.map((act, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.72rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  color: 'var(--text-primary)'
                }}
              >
                • {act.adaptedTitle} ({act.reason})
              </span>
            ))}
            <span
              style={{
                fontSize: '0.72rem',
                background: 'rgba(167, 139, 250, 0.1)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                borderRadius: 4,
                padding: '2px 8px',
                color: '#c4b5fd'
              }}
            >
              🤸 Calisthénie maintenue (zéro impact articulaire)
            </span>
          </div>
        </div>
      ) : adaptiveStatus.injuryRiskLevel === 'MODERATE' && adaptiveStatus.recommendedActions.length > 0 ? (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#fbbf24' }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <span>
              <strong>{adaptiveStatus.headline} :</strong> ACWR Trail à {adaptiveStatus.trailAcwrRatio}. Calisthénie isolée ({adaptiveStatus.calisthenicsSessionsCount7d} séance(s)).
              {totalTrimpSavedByAdaptation > 0 && ` (-${totalTrimpSavedByAdaptation} TRIMP si adapté)`}
            </span>
          </div>
          {onApplyAdaptivePlan && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onApplyAdaptivePlan(adaptiveStatus.recommendedActions)}
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                color: '#fbbf24',
                borderColor: 'rgba(245, 158, 11, 0.4)'
              }}
            >
              <Sparkles size={12} /> Moduler les côtes (-{totalTrimpSavedByAdaptation} TRIMP)
            </button>
          )}
        </div>
      ) : proactiveRec.shouldAdapt && todaySchedule?.sportSession && !isTodaySessionCompleted ? (
        <div className="proactive-coach-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#fca5a5' }}>
            <AlertTriangle size={15} color="#ef4444" />
            <span>{proactiveRec.recommendationText}</span>
          </div>

          {proactiveRec.actionType === 'POSTPONE' && onPostponeWorkout ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const tmrwStr = toLocalDateKey(addDays(parseLocalDate(todayKey), 1));
                onPostponeWorkout(
                  todaySchedule.sportSession!.id,
                  todayKey,
                  tmrwStr,
                  'Adaptation VFC Garmin basse'
                );
              }}
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                color: '#fbbf24',
                borderColor: 'rgba(245, 158, 11, 0.4)'
              }}
            >
              <CalendarClock size={12} /> Décaler à demain (+1 j)
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (onPostponeWorkout && todaySchedule.sportSession) {
                  onPostponeWorkout(
                    todaySchedule.sportSession.id,
                    todayKey,
                    todayKey,
                    'Séance allégée Z1 automatique'
                  );
                }
              }}
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                color: '#60a5fa',
                borderColor: 'rgba(59, 130, 246, 0.4)'
              }}
            >
              <Sparkles size={12} /> {proactiveRec.actionButtonText || 'Adapter la séance'}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            background: adaptiveStatus.trailAcwrRatio < 0.8 ? 'rgba(56, 189, 248, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            border: `1px solid ${adaptiveStatus.trailAcwrRatio < 0.8 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(16, 185, 129, 0.22)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 6,
            fontSize: '0.76rem',
            color: adaptiveStatus.trailAcwrRatio < 0.8 ? '#7dd3fc' : '#6ee7b7'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={14} color={adaptiveStatus.trailAcwrRatio < 0.8 ? '#38bdf8' : '#10b981'} />
            <span>
              <strong>{adaptiveStatus.trailAcwrRatio < 0.8 ? '🔵 Sous-charge Trail (< 0.8) :' : '🟢 Sweet Spot Tim Gabbett (0.8 – 1.3) :'}</strong> ACWR mécanique à <strong>{adaptiveStatus.trailAcwrRatio}</strong>. {adaptiveStatus.trailAcwrRatio < 0.8 ? 'Consolidez votre base en Zone 2.' : 'Charge d\'impact parfaitement assimilée.'}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {autoAdapt ? '🤖 Auto-Pilot Sweet Spot Actif' : 'Mode manuel'}
          </span>
        </div>
      )}

      {/* Fonction commune de rendu des séances et événements d'un jour */}

      {(() => {
        const renderDayEventsContent = (day: DailySchedule, isSingleDayView: boolean = false) => {
          const courseEvents = day.events.filter(e => e.category === 'course');
          const mobilityEvent = day.events.find(e => e.category === 'mobility');
          const ghostEvents = day.events.filter(e => e.category === 'sport' && Boolean(e.metadata?.isPostponedPlaceholder));
          const catchupExecutedElsewhere = day.events.filter(e => {
            if (e.category !== 'sport') return false;
            const comp = comparisons.find(c => c.plannedEvent?.id === e.id);
            return Boolean(comp?.isPostponedCatchup && comp.executedDate && comp.executedDate !== day.date);
          });

          const daySportEvents = day.events.filter(e => e.category === 'sport');
          const unifiedSportGroups = groupDaySportWorkouts(daySportEvents, comparisons, day.date);

          const hasAnyDisplayableItem = filter === 'all'
            ? (courseEvents.length > 0 || unifiedSportGroups.length > 0 || ghostEvents.length > 0 || catchupExecutedElsewhere.length > 0 || Boolean(mobilityEvent))
            : filter === 'sport'
            ? (unifiedSportGroups.length > 0 || ghostEvents.length > 0 || catchupExecutedElsewhere.length > 0)
            : filter === 'course'
            ? courseEvents.length > 0
            : Boolean(mobilityEvent);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {!hasAnyDisplayableItem ? (
                <div style={{ textAlign: 'center', padding: isSingleDayView ? '40px 16px' : '24px 8px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <span>😴 Repos complet / Aucun événement prévu ce jour</span>
                </div>
              ) : (
                <>
                  {/* Événements de cours */}
                  {(filter === 'all' || filter === 'course') && courseEvents.map(ev => {
                    const hasAller = ev.metadata?.commuteAller;
                    const hasRetour = ev.metadata?.commuteRetour;

                    return (
                      <div
                        key={ev.id}
                        className="event-card course"
                        onClick={() => {
                          setSelectedEvent(ev);
                          setSelectedComparison(null);
                          setSelectedUnifiedGroup(null);
                        }}
                        style={{ padding: isSingleDayView ? '10px 14px' : undefined }}
                      >
                        <div className="event-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <span style={{ fontSize: isSingleDayView ? '1.05rem' : '0.9rem' }}>{ev.emoji}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: isSingleDayView ? '0.88rem' : '0.8rem' }}>
                              {ev.title}
                            </span>
                          </div>
                        </div>

                        <div className="event-meta" style={{ fontSize: isSingleDayView ? '0.76rem' : '0.7rem' }}>
                          <span>
                            <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {formatTime(ev.startDate)} – {formatTime(ev.endDate)}
                          </span>
                          <span>•</span>
                          <span>{ev.durationMinutes}m</span>
                          {ev.metadata?.room && (
                            <span style={{ color: ev.metadata?.isDistanciel ? 'var(--accent-purple)' : 'var(--accent-blue)', fontWeight: 600 }}>
                              <MapPin size={10} style={{ display: 'inline', marginRight: 2 }} />
                              {ev.metadata.room}
                            </span>
                          )}
                        </div>

                        {(hasAller || hasRetour) && (
                          <div className="journey-strip" style={{ fontSize: isSingleDayView ? '0.72rem' : '0.68rem', padding: '5px 8px' }}>
                            <Bus size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            <span>
                              {hasAller && `Départ : ${formatTime(hasAller.departureTime)} (${hasAller.durationMinutes}m)`}
                              {hasAller && hasRetour && ' • '}
                              {hasRetour && `Retour ~${formatTime(hasRetour.arrivalTime)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Groupes sportifs unifiés */}
                  {(filter === 'all' || filter === 'sport') && (
                    <>
                      {unifiedSportGroups.map(group => (
                        <UnifiedWorkoutGroupCard
                          key={group.id}
                          group={group}
                          isSingleDayView={isSingleDayView}
                          onSelect={(grp, specificItem) => handleSelectGroup(grp, specificItem)}
                          onPostponeWorkout={onPostponeWorkout}
                          isDraggable={true}
                          onDragStart={(e, ev) => {
                            setDraggedEvent(ev);
                            e.dataTransfer.setData('text/plain', ev.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedEvent(null);
                            setDragOverDate(null);
                          }}
                        />
                      ))}

                      {/* Indicateurs fantômes pour séances reportées */}
                      {ghostEvents.map(ev => {
                        const isCalisthenics = isStrengthOrCalisthenics(ev);
                        return (
                          <div
                            key={ev.id}
                            className="event-card ghost-postponed"
                            onClick={() => {
                              setSelectedEvent(ev);
                              setSelectedComparison(null);
                              setSelectedUnifiedGroup(null);
                            }}
                            title="Séance reportée. Cliquer pour voir les détails ou rétablir."
                            style={{
                              borderLeftColor: '#64748b',
                              borderLeftStyle: 'dashed',
                              background: 'rgba(100, 116, 139, 0.08)',
                              border: '1px dashed rgba(148, 163, 184, 0.3)',
                              padding: isSingleDayView ? '10px 12px' : '7px 9px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>➡️</span> Reportée au {ev.metadata?.postponedToDate}
                              </span>
                              {onCancelPostponeWorkout && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelPostponeWorkout(ev.id);
                                  }}
                                  style={{
                                    background: 'rgba(255, 87, 34, 0.12)',
                                    border: '1px solid var(--primary-border)',
                                    color: 'var(--primary)',
                                    borderRadius: 4,
                                    padding: '3px 8px',
                                    minHeight: '26px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                  title="Rétablir la séance à cette date"
                                >
                                  Rétablir
                                </button>
                              )}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                              {isCalisthenics ? 'Entraînement Calisthénie' : ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                            </div>
                          </div>
                        );
                      })}

                      {/* Indicateurs pour séances réalisées un autre jour */}
                      {catchupExecutedElsewhere.map(ev => {
                        const evComp = comparisons.find(c => c.plannedEvent?.id === ev.id);
                        const isCalisthenics = isStrengthOrCalisthenics(ev);
                        return (
                          <div
                            key={`moved-${ev.id}`}
                            className="event-card ghost-postponed"
                            onClick={() => {
                              setSelectedEvent(ev);
                              setSelectedComparison(evComp || null);
                              setSelectedUnifiedGroup(null);
                            }}
                            title={`Séance reportée et réalisée sur Garmin le ${formatFriendlyDateStr(evComp?.executedDate || '')}`}
                            style={{
                              borderLeftColor: '#10b981',
                              borderLeftStyle: 'dashed',
                              background: 'rgba(16, 185, 129, 0.04)',
                              border: '1px dashed rgba(16, 185, 129, 0.25)',
                              padding: isSingleDayView ? '8px 12px' : '6px 8px',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={11} color="#10b981" /> Réalisée le {formatFriendlyDateStr(evComp?.executedDate || '')} ({evComp?.actualActivity?.durationMinutes}m)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                              {isCalisthenics ? 'Entraînement Calisthénie' : ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Mobilité du soir */}
                  {mobilityEvent && (filter === 'all' || filter === 'mobility') && (
                    <div
                      className="mobility-daily-chip"
                      onClick={() => {
                        setSelectedEvent(mobilityEvent);
                        setSelectedComparison(null);
                        setSelectedUnifiedGroup(null);
                      }}
                      title="20 min d'étirements et de mobilité du soir"
                      style={isSingleDayView ? { padding: '8px 12px', fontSize: '0.75rem' } : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🧘</span>
                        <span style={{ fontWeight: 600 }}>Mobilité 22h00 (20m)</span>
                      </div>
                      <CheckCircle2 size={13} color="#10b981" />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        };

        if (viewMode === 'day') {
          const currentDay = displayedDays[activeDayIndex] || displayedDays[0];
          const dObj = currentDay ? parseLocalDate(currentDay.date) : new Date();
          const isToday = currentDay ? currentDay.date === todayKey : false;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Ruban Hebdomadaire Mobile (Lundi -> Dimanche) */}
              <div className="mobile-week-ribbon">
                {displayedDays.map((day, idx) => {
                  const dayObj = parseLocalDate(day.date);
                  const isDayToday = day.date === todayKey;
                  const isSelected = idx === activeDayIndex;
                  const shortNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
                  const hasSport = day.events.some(e => e.category === 'sport');
                  const hasCourse = day.events.some(e => e.category === 'course');
                  const hasMobility = day.events.some(e => e.category === 'mobility');

                  return (
                    <button
                      key={day.date}
                      type="button"
                      className={`mobile-day-btn ${isSelected ? 'active' : ''} ${isDayToday ? 'is-today' : ''}`}
                      onClick={() => setActiveDayIndex(idx)}
                      title={`${dayNames[day.dayOfWeek]} ${dayObj.getDate()}`}
                    >
                      <span className="mobile-day-name">{shortNames[day.dayOfWeek]}</span>
                      <span className="mobile-day-num">{dayObj.getDate()}</span>
                      <div className="mobile-day-dots">
                        {hasSport && <span className="mobile-dot sport" />}
                        {hasCourse && <span className="mobile-dot course" />}
                        {hasMobility && <span className="mobile-dot mobility" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* En-tête de Jour Épuré (Titre de section sans flèches redondantes) */}
              {currentDay && (
                <>
                  <div className="day-view-date-header">
                    <div className="day-nav-title">
                      <span>
                        {dayNames[currentDay.dayOfWeek]}, {dObj.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}
                      </span>
                      {isToday && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="today-badge">
                            Aujourd'hui
                          </span>
                          <span
                            className="today-readiness-chip"
                            style={{
                              background: `${readiness.badgeColorHex}18`,
                              color: readiness.badgeColorHex,
                              border: `1px solid ${readiness.badgeColorHex}40`
                            }}
                            title={`Score Garmin Readiness : ${readiness.score}/100 • ${readiness.statusLabel}`}
                          >
                            {readiness.badgeEmoji} {readiness.score}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`day-column ${isToday ? 'today' : ''}`}
                    style={{ minHeight: 320, padding: '14px', width: '100%' }}
                  >
                    {renderDayEventsContent(currentDay, true)}
                  </div>
                </>
              )}
            </div>
          );
        }

        if (viewMode === 'grid') {
          return (
            <div className="calendar-scroll-wrapper">
              <div className="week-grid">
                {displayedDays.map(day => {
                  const dateObj = parseLocalDate(day.date);
                  const isToday = day.date === todayKey;
                  const isDragTarget = dragOverDate === day.date;

                  return (
                    <div
                      key={day.date}
                      className={`day-column ${isToday ? 'today' : ''} ${isDragTarget ? 'drag-over' : ''}`}
                      onDragOver={(e) => {
                        if (draggedEvent) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverDate !== day.date) setDragOverDate(day.date);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverDate === day.date) setDragOverDate(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDate(null);
                        if (draggedEvent && onPostponeWorkout && toLocalDateKey(draggedEvent.startDate) !== day.date) {
                          const origDate = draggedEvent.metadata?.originalDate || toLocalDateKey(draggedEvent.startDate);
                          onPostponeWorkout(draggedEvent.id, origDate, day.date);
                          setDraggedEvent(null);
                        }
                      }}
                      style={isDragTarget ? { outline: '2px dashed var(--primary)', background: 'rgba(255, 87, 34, 0.08)' } : undefined}
                    >
                      <div className="day-header">
                        <div>
                          <div className="day-name">{dayNames[day.dayOfWeek]}</div>
                          <div className="day-number">
                            {dateObj.getDate()}{' '}
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                              {dateObj.toLocaleDateString('fr-CA', { month: 'short' })}
                            </span>
                          </div>
                        </div>
                        {isToday && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span className="today-indicator">Aujourd'hui</span>
                            <span
                              className="today-readiness-chip"
                              style={{
                                background: `${readiness.badgeColorHex}18`,
                                color: readiness.badgeColorHex,
                                border: `1px solid ${readiness.badgeColorHex}40`
                              }}
                              title={`Score Garmin Readiness : ${readiness.score}/100 • ${readiness.statusLabel}`}
                            >
                              {readiness.badgeEmoji} {readiness.score}
                            </span>
                          </div>
                        )}
                      </div>

                      {renderDayEventsContent(day, false)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        /* Vue Liste Détaillée */
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedDays.map(day => {
            const dateObj = parseLocalDate(day.date);
            const isToday = day.date === todayKey;

            const courseEvents = day.events.filter(e => e.category === 'course');
            const mobilityEvent = day.events.find(e => e.category === 'mobility');
            const ghostEvents = day.events.filter(e => e.category === 'sport' && Boolean(e.metadata?.isPostponedPlaceholder));
            const catchupExecutedElsewhere = day.events.filter(e => {
              if (e.category !== 'sport') return false;
              const comp = comparisons.find(c => c.plannedEvent?.id === e.id);
              return Boolean(comp?.isPostponedCatchup && comp.executedDate && comp.executedDate !== day.date);
            });

            const daySportEvents = day.events.filter(e => e.category === 'sport');
            const unifiedSportGroups = groupDaySportWorkouts(daySportEvents, comparisons, day.date);

            const hasAnyDisplayableItem = filter === 'all'
              ? (courseEvents.length > 0 || unifiedSportGroups.length > 0 || ghostEvents.length > 0 || catchupExecutedElsewhere.length > 0 || Boolean(mobilityEvent))
              : filter === 'sport'
              ? (unifiedSportGroups.length > 0 || ghostEvents.length > 0 || catchupExecutedElsewhere.length > 0)
              : filter === 'course'
              ? courseEvents.length > 0
              : Boolean(mobilityEvent);

            const displayCount = (filter === 'all' || filter === 'sport' ? unifiedSportGroups.length + ghostEvents.length + catchupExecutedElsewhere.length : 0)
              + (filter === 'all' || filter === 'course' ? courseEvents.length : 0)
              + ((filter === 'all' || filter === 'mobility') && mobilityEvent ? 1 : 0);

            return (
              <div
                key={day.date}
                className="glass-panel"
                style={{
                  padding: '14px 18px',
                  borderLeft: isToday ? '4px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isToday ? 'rgba(255, 87, 34, 0.04)' : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1rem' }}>
                      {dayNames[day.dayOfWeek]}, {dateObj.toLocaleDateString('fr-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    {isToday && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="today-indicator">Aujourd'hui</span>
                        <span
                          className="today-readiness-chip"
                          style={{
                            background: `${readiness.badgeColorHex}18`,
                            color: readiness.badgeColorHex,
                            border: `1px solid ${readiness.badgeColorHex}40`
                          }}
                          title={`Score Garmin Readiness : ${readiness.score}/100 • ${readiness.statusLabel}`}
                        >
                          {readiness.badgeEmoji} {readiness.score}
                        </span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {displayCount} événement(s)
                  </span>
                </div>

                {!hasAnyDisplayableItem ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Repos / Aucun événement prévu.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                    {/* Cours */}
                    {(filter === 'all' || filter === 'course') && courseEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="event-card course"
                        onClick={() => {
                          setSelectedEvent(ev);
                          setSelectedComparison(null);
                          setSelectedUnifiedGroup(null);
                        }}
                        style={{ padding: '10px 12px' }}
                      >
                        <div className="event-title" style={{ fontSize: '0.84rem' }}>
                          <span>{ev.emoji}</span>
                          <span>{ev.title}</span>
                        </div>
                        <div className="event-meta" style={{ fontSize: '0.74rem' }}>
                          <span>
                            <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {formatTime(ev.startDate)} – {formatTime(ev.endDate)} ({ev.durationMinutes}m)
                          </span>
                        </div>
                        {ev.metadata?.room && (
                          <div style={{ fontSize: '0.72rem', color: ev.metadata?.isDistanciel ? 'var(--accent-purple)' : 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <MapPin size={11} /> {ev.metadata.room}
                          </div>
                        )}
                        {ev.metadata?.commuteAller && (
                          <div className="journey-strip">
                            <Bus size={11} />
                            <span>Trajet : {formatTime(ev.metadata.commuteAller.departureTime)} ➔ {formatTime(ev.metadata.commuteAller.arrivalTime)} ({ev.metadata.commuteAller.durationMinutes}m)</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Séances sportives unifiées */}
                    {(filter === 'all' || filter === 'sport') && (
                      <>
                        {unifiedSportGroups.map(group => (
                          <UnifiedWorkoutGroupCard
                            key={`list-${group.id}`}
                            group={group}
                            isList={true}
                            onSelect={(grp, specificItem) => handleSelectGroup(grp, specificItem)}
                            onPostponeWorkout={onPostponeWorkout}
                          />
                        ))}

                        {/* Fantômes de report */}
                        {ghostEvents.map(ev => {
                          const isCalisthenics = isStrengthOrCalisthenics(ev);
                          return (
                            <div
                              key={`ghost-list-${ev.id}`}
                              className="event-card ghost-postponed"
                              onClick={() => {
                                setSelectedEvent(ev);
                                setSelectedComparison(null);
                                setSelectedUnifiedGroup(null);
                              }}
                              style={{
                                borderLeftColor: '#64748b',
                                borderLeftStyle: 'dashed',
                                background: 'rgba(100, 116, 139, 0.08)',
                                border: '1px dashed rgba(148, 163, 184, 0.3)',
                                padding: '10px 12px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span>➡️</span> Reportée au {ev.metadata?.postponedToDate}
                                </span>
                                {onCancelPostponeWorkout && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelPostponeWorkout(ev.id);
                                    }}
                                    style={{
                                      background: 'rgba(255, 87, 34, 0.12)',
                                      border: '1px solid var(--primary-border)',
                                      color: 'var(--primary)',
                                      borderRadius: 3,
                                      padding: '2px 6px',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                    title="Rétablir la séance à cette date"
                                  >
                                    Rétablir
                                  </button>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                {isCalisthenics ? 'Entraînement Calisthénie' : ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                              </div>
                            </div>
                          );
                        })}

                        {/* Réalisée un autre jour */}
                        {catchupExecutedElsewhere.map(ev => {
                          const evComp = comparisons.find(c => c.plannedEvent?.id === ev.id);
                          const isCalisthenics = isStrengthOrCalisthenics(ev);
                          return (
                            <div
                              key={`moved-list-${ev.id}`}
                              className="event-card ghost-postponed"
                              onClick={() => {
                                setSelectedEvent(ev);
                                setSelectedComparison(evComp || null);
                                setSelectedUnifiedGroup(null);
                              }}
                              style={{
                                borderLeftColor: '#10b981',
                                borderLeftStyle: 'dashed',
                                background: 'rgba(16, 185, 129, 0.04)',
                                border: '1px dashed rgba(16, 185, 129, 0.25)',
                                padding: '10px 12px',
                                cursor: 'pointer'
                              }}
                              title={`Séance reportée et réalisée sur Garmin le ${formatFriendlyDateStr(evComp?.executedDate || '')}`}
                            >
                              <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={11} color="#10b981" /> Réalisée le {formatFriendlyDateStr(evComp?.executedDate || '')} ({evComp?.actualActivity?.durationMinutes}m)
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                {isCalisthenics ? 'Entraînement Calisthénie' : ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Mobilité */}
                    {mobilityEvent && (filter === 'all' || filter === 'mobility') && (
                      <div
                        className="mobility-daily-chip"
                        onClick={() => {
                          setSelectedEvent(mobilityEvent);
                          setSelectedComparison(null);
                          setSelectedUnifiedGroup(null);
                        }}
                        style={{ padding: '10px 12px', fontSize: '0.78rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🧘</span>
                          <span style={{ fontWeight: 600 }}>Mobilité 22h00 (20m)</span>
                        </div>
                        <CheckCircle2 size={13} color="#10b981" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    })()}

      {/* Modale de Détail de Séance */}
      <WorkoutDetailModal
        event={selectedEvent}
        comparison={selectedComparison}
        unifiedGroup={selectedUnifiedGroup}
        onClose={() => {
          setSelectedEvent(null);
          setSelectedComparison(null);
          setSelectedUnifiedGroup(null);
        }}
        onPostpone={onPostponeWorkout}
        onCancelPostpone={onCancelPostponeWorkout}
        onOpenGarminSync={onOpenGarminSync}
      />
    </div>
  );
};
