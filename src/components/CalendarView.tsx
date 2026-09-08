import React, { useState, useEffect } from 'react';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { ActivityComparison } from '../types/garmin';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  MapPin,
  ListFilter,
  LayoutGrid,
  Layers,
  Bus,
  CheckCircle2,
  ArrowRight,
  CalendarClock,
  RotateCcw,
  Calendar,
  Watch,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { WeatherWidget } from './WeatherWidget';
import { getWellnessForDate, calculateReadinessScore, getProactivePlanRecommendation } from '../services/readinessEngine';
import { pushWeekWorkoutsToGarmin } from '../services/garminService';
import { triggerHapticFeedback } from '../services/hapticsService';
import { formatDateKey } from '../services/icsParser';
import { computeTrainingLoadStats } from '../services/statsEngine';
import { evaluateAdaptivePlanStatus } from '../services/adaptivePlanEngine';
import { AdaptiveWorkoutAction, AdaptiveWorkoutOverride } from '../types/calendar';
import { GarminActivity } from '../types/garmin';

interface CalendarViewProps {
  schedules: DailySchedule[];
  onOpenGoogleCalendar?: () => void;
  referenceDateStr?: string;
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
}

type FilterCategory = 'all' | 'sport' | 'course' | 'trajet' | 'mobility';
type ViewMode = 'day' | 'grid' | 'list';

export const CalendarView: React.FC<CalendarViewProps> = ({
  schedules,
  onOpenGoogleCalendar,
  referenceDateStr,
  onPostponeWorkout,
  onCancelPostponeWorkout,
  comparisons = [],
  garminActivities = [],
  adaptiveOverrides = {},
  onApplyAdaptivePlan,
  onRevertAdaptivePlan
}) => {
  const isMobileInitial = typeof window !== 'undefined' && window.innerWidth < 768;
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(isMobileInitial ? 'day' : 'grid');
  const [isFusedMode, setIsFusedMode] = useState<boolean>(true);
  const todayKey = referenceDateStr || formatDateKey(new Date());
  const currentTodayIndex = schedules.findIndex(s => s.date === todayKey);
  const currentWeekOffset = currentTodayIndex >= 0 ? Math.floor(currentTodayIndex / 7) : 0;

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedComparison, setSelectedComparison] = useState<ActivityComparison | null>(null);
  const [weekOffset, setWeekOffset] = useState<number>(() => currentWeekOffset);
  const [hasInitializedOffset, setHasInitializedOffset] = useState<boolean>(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isPushingWeek, setIsPushingWeek] = useState<boolean>(false);
  const [weekPushStatus, setWeekPushStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    return currentTodayIndex >= 0 ? currentTodayIndex % 7 : 0;
  });

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
  const todayActs = todayComparisons
    .filter(c => Boolean(c.actualActivity))
    .map(c => c.actualActivity!);
  const readiness = calculateReadinessScore(todayWellness, undefined, todayActs, isTodaySessionCompleted);
  const todaySchedule = schedules.find(s => s.date === todayKey);
  const proactiveRec = getProactivePlanRecommendation(readiness, todaySchedule?.sportSession, isTodaySessionCompleted);

  const handlePushWeekToGarmin = async () => {
    setIsPushingWeek(true);
    setWeekPushStatus(null);
    triggerHapticFeedback('light');

    const weekSportEvents = displayedDays
      .map(d => d.sportSession)
      .filter((e): e is CalendarEvent => Boolean(e));

    const result = await pushWeekWorkoutsToGarmin(weekSportEvents, 'FORERUNNER_55');
    setIsPushingWeek(false);

    if (result.success) {
      triggerHapticFeedback('success');
      setWeekPushStatus({
        text: `✓ ${result.pushedCount} séances de la semaine programmées avec succès sur Garmin Connect (Forerunner 55) !`,
        isError: false
      });
    } else {
      triggerHapticFeedback('warning');
      setWeekPushStatus({
        text: result.error || 'Erreur lors de l\'envoi de la semaine vers Garmin Connect.',
        isError: true
      });
    }
  };

  // Découpage en blocs de 7 jours
  const currentWeekStartIdx = weekOffset * 7;
  const displayedDays = schedules.slice(
    Math.max(0, currentWeekStartIdx),
    Math.max(7, currentWeekStartIdx + 7)
  );

  const displayedSportSessions = displayedDays
    .map(d => d.sportSession)
    .filter((e): e is CalendarEvent => Boolean(e));

  const trainingLoad = computeTrainingLoadStats(garminActivities || [], new Date(todayKey));
  const adaptiveStatus = evaluateAdaptivePlanStatus(
    trainingLoad,
    readiness,
    displayedSportSessions,
    adaptiveOverrides
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatFriendlyDateStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Format compact et lisible de la semaine (ex: 7 — 13 sept.)
  const formatWeekRange = () => {
    if (displayedDays.length === 0) return '';
    try {
      const start = new Date(displayedDays[0].date + 'T12:00:00');
      const end = new Date(displayedDays[displayedDays.length - 1].date + 'T12:00:00');
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
  const countAll = currentWeekEvents.length;
  const countSport = currentWeekEvents.filter(e => e.category === 'sport').length;
  const countCourse = currentWeekEvents.filter(e => e.category === 'course').length;
  const countTrajet = currentWeekEvents.filter(e => e.category === 'trajet').length;
  const countMobility = currentWeekEvents.filter(e => e.category === 'mobility').length;

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

            {/* Fused Cards Toggle */}
            <button
              type="button"
              onClick={() => setIsFusedMode(!isFusedMode)}
              className={`action-icon-pill ${isFusedMode ? 'active' : ''}`}
              title={isFusedMode ? 'Mode cartes fusionnées actif (cours + trajets intégrés)' : 'Mode cartes séparées'}
              aria-label="Mode cartes fusionnées"
            >
              <Layers size={13} />
              <span className="desktop-only">{isFusedMode ? 'Fusion : OUI' : 'Séparé'}</span>
            </button>

            {/* Google Calendar Action */}
            {/* Garmin Week Sync Button */}
            <button
              type="button"
              className="action-icon-pill"
              onClick={handlePushWeekToGarmin}
              disabled={isPushingWeek}
              style={{ color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.4)' }}
              title="Envoyer toutes les séances de cette semaine vers Garmin Connect (Forerunner 55)"
              aria-label="Envoyer semaine vers Garmin"
            >
              {isPushingWeek ? <Loader2 size={13} className="spin-animation" /> : <Watch size={13} />}
              <span className="desktop-only">Sync Garmin</span>
            </button>

            {onOpenGoogleCalendar && (
              <button
                type="button"
                className="action-icon-pill"
                onClick={onOpenGoogleCalendar}
                style={{ color: 'var(--accent-blue)' }}
                title="Synchroniser avec Google Agenda"
                aria-label="Google Agenda"
              >
                <Calendar size={13} />
                <span className="desktop-only">Agenda</span>
              </button>
            )}
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
        </div>
      </div>

      {/* Week Push Feedback Banner */}
      {weekPushStatus && (
        <div
          style={{
            background: weekPushStatus.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            border: `1px solid ${weekPushStatus.isError ? '#ef4444' : '#10b981'}`,
            padding: '8px 14px',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            color: weekPushStatus.isError ? '#f87171' : '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          <span>{weekPushStatus.text}</span>
          <button
            onClick={() => setWeekPushStatus(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

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
              <strong>Plan Adaptatif Anti-blessure Actif :</strong> Vos sorties de trail sont modulées pour respecter votre tolérance mécanique (ACWR Trail = {adaptiveStatus.trailAcwrRatio}). Calisthénie maintenue intacte.
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
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {adaptiveStatus.explanation}
          </p>
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
              <Sparkles size={12} /> Moduler les côtes
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
                const tmrw = new Date();
                tmrw.setDate(tmrw.getDate() + 1);
                onPostponeWorkout(
                  todaySchedule.sportSession!.id,
                  todayKey,
                  tmrw.toISOString().slice(0, 10),
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
      ) : null}

      {/* Fonction commune de rendu des séances et événements d'un jour */}

      {(() => {
        const renderDayEventsContent = (day: DailySchedule, isSingleDayView: boolean = false) => {
          const eventsToDisplay = day.events.filter(e => {
            if (filter !== 'all') return e.category === filter;
            return e.category === 'sport' || e.category === 'course';
          });

          const mobilityEvent = day.events.find(e => e.category === 'mobility');
          const catchupForThisDay = comparisons.filter(c => c.isPostponedCatchup && c.executedDate === day.date);
          const unplannedForThisDay = comparisons.filter(c => c.status === 'UNPLANNED' && c.date === day.date);

          const hasAnyDisplayableItem = filter === 'all'
            ? (eventsToDisplay.length > 0 || catchupForThisDay.length > 0 || unplannedForThisDay.length > 0 || Boolean(mobilityEvent))
            : eventsToDisplay.length > 0;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {!hasAnyDisplayableItem ? (
                <div style={{ textAlign: 'center', padding: isSingleDayView ? '40px 16px' : '24px 8px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <span>😴 Repos complet / Aucun événement prévu ce jour</span>
                </div>
              ) : (
                <>
                  {eventsToDisplay.map(ev => {
                    const isSportCard = ev.category === 'sport';
                    const isGhost = Boolean(ev.metadata?.isPostponedPlaceholder);
                    const evComp = comparisons.find(c => c.plannedEvent?.id === ev.id);

                    if (isGhost) {
                      return (
                        <div
                          key={ev.id}
                          className="event-card ghost-postponed"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setSelectedComparison(null);
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
                            {ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                          </div>
                        </div>
                      );
                    }

                    const hasAller = ev.metadata?.commuteAller;
                    const hasRetour = ev.metadata?.commuteRetour;

                    return (
                      <div
                        key={ev.id}
                        className={`event-card ${ev.category} ${isSportCard ? 'draggable-sport' : ''}`}
                        onClick={() => {
                          setSelectedEvent(ev);
                          setSelectedComparison(evComp || null);
                        }}
                        draggable={isSportCard}
                        onDragStart={(e) => {
                          if (isSportCard) {
                            setDraggedEvent(ev);
                            e.dataTransfer.setData('text/plain', ev.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedEvent(null);
                          setDragOverDate(null);
                        }}
                        title={`${ev.title}\n${ev.location}\n${ev.durationMinutes} min${isSportCard ? '\n(Glisser-déposer sur un autre jour pour reporter)' : ''}`}
                        style={{
                          ...(isSportCard ? { cursor: 'grab' } : {}),
                          ...(isSingleDayView ? { padding: '10px 14px' } : {})
                        }}
                      >
                        <div className="event-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <span style={{ fontSize: isSingleDayView ? '1.05rem' : '0.9rem' }}>{ev.emoji}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: isSingleDayView ? '0.88rem' : '0.8rem' }}>
                              {ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                            </span>
                            {ev.metadata?.isAdapted && (
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
                                title={`Séance adaptée anti-blessure : ${ev.metadata.adaptationReason || ''}`}
                              >
                                🛡️ Adapté
                              </span>
                            )}
                          </div>
                          {isSportCard && onPostponeWorkout && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currD = ev.startDate.slice(0, 10);
                                const nextD = new Date(currD + 'T12:00:00');
                                nextD.setDate(nextD.getDate() + 1);
                                const targetD = nextD.toISOString().slice(0, 10);
                                const origD = ev.metadata?.originalDate || currD;
                                onPostponeWorkout(ev.id, origD, targetD);
                              }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 4,
                                padding: isSingleDayView ? '4px 8px' : '2px 6px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                cursor: 'pointer',
                                flexShrink: 0,
                                minHeight: isSingleDayView ? '28px' : '22px'
                              }}
                              title="Reporter au lendemain (+1 jour)"
                            >
                              <CalendarClock size={11} />
                              <span>+1j</span>
                            </button>
                          )}
                        </div>

                        <div className="event-meta" style={{ fontSize: isSingleDayView ? '0.76rem' : '0.7rem' }}>
                          <span>
                            <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {formatTime(ev.startDate)} – {formatTime(ev.endDate)}
                          </span>
                          <span>•</span>
                          <span style={{ fontWeight: 700 }}>{ev.durationMinutes}m</span>
                          {ev.metadata?.room && (
                            <span style={{ color: ev.metadata?.isDistanciel ? 'var(--accent-purple)' : 'var(--accent-blue)', fontWeight: 600 }}>
                              <MapPin size={10} style={{ display: 'inline', marginRight: 2 }} />
                              {ev.metadata.room}
                            </span>
                          )}
                        </div>

                        {ev.metadata?.isPostponed && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span>🔄 Reportée du {ev.metadata.originalDate}</span>
                          </div>
                        )}

                        {evComp?.isPostponedCatchup && evComp.executedDate && (
                          <div style={{
                            fontSize: '0.68rem',
                            color: '#38bdf8',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            padding: '3px 6px',
                            borderRadius: 4,
                            marginTop: 3
                          }}>
                            <span>🔄 Réalisée le {formatFriendlyDateStr(evComp.executedDate)} ({evComp.actualActivity?.durationMinutes}m)</span>
                          </div>
                        )}

                        {evComp && !evComp.isPostponedCatchup && (evComp.status === 'COMPLIANT' || evComp.status === 'PARTIAL') && (
                          <div style={{
                            fontSize: '0.68rem',
                            color: '#10b981',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            padding: '3px 6px',
                            borderRadius: 4,
                            marginTop: 3,
                            flexWrap: 'wrap'
                          }}>
                            <CheckCircle2 size={11} /> Validée Garmin ({evComp.actualActivity?.durationMinutes}m{evComp.actualActivity?.distanceKm ? ` • ${evComp.actualActivity.distanceKm.toFixed(1)}km` : ''}{evComp.actualActivity?.elevationGainM ? ` • +${Math.round(evComp.actualActivity.elevationGainM)}m` : ''}{evComp.actualActivity?.avgHeartRate ? ` • ❤️${evComp.actualActivity.avgHeartRate}` : ''})
                          </div>
                        )}

                        {ev.metadata?.targetHeartRate && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
                            ❤️ {ev.metadata.targetHeartRate}
                          </div>
                        )}

                        {ev.metadata?.targetElevationM && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-orange)', fontWeight: 600 }}>
                            ⛰️ +{ev.metadata.targetElevationM}m D+
                          </div>
                        )}

                        {ev.metadata?.conflictRescheduled && (
                          <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span>🔄 Décalé pour cours</span>
                          </div>
                        )}

                        {isFusedMode && (hasAller || hasRetour) && (
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

                  {catchupForThisDay.map(comp => (
                    <div
                      key={`catchup-${comp.id}`}
                      className="event-card sport"
                      onClick={() => {
                        if (comp.plannedEvent) {
                          setSelectedEvent(comp.plannedEvent);
                          setSelectedComparison(comp);
                        }
                      }}
                      style={{
                        borderLeftColor: '#38bdf8',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        padding: isSingleDayView ? '10px 14px' : '8px 10px',
                        cursor: 'pointer'
                      }}
                      title="Séance de rattrapage Garmin. Cliquer pour voir les détails."
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>🔄</span> Rattrapage Garmin
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 3 }}>
                          {comp.actualActivity?.durationMinutes}m
                        </span>
                      </div>
                      <div style={{ fontSize: isSingleDayView ? '0.84rem' : '0.76rem', color: '#ffffff', fontWeight: 700, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comp.actualActivity?.activityName || comp.plannedEvent?.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Remplace la séance du {formatFriendlyDateStr(comp.scheduledDate || '')}
                      </div>
                    </div>
                  ))}

                  {unplannedForThisDay.map(comp => {
                    const act = comp.actualActivity;
                    if (!act) return null;
                    const isRun = act.activityType?.toLowerCase().includes('run') || act.activityType?.toLowerCase().includes('course');
                    const isBike = act.activityType?.toLowerCase().includes('cycl') || act.activityType?.toLowerCase().includes('vélo');
                    const isWalk = act.activityType?.toLowerCase().includes('walk') || act.activityType?.toLowerCase().includes('rando');
                    const icon = isRun ? '🏃' : isBike ? '🚴' : isWalk ? '🥾' : '⚡';

                    const syntheticEvent: CalendarEvent = {
                      id: `unplanned-${act.activityId}`,
                      title: act.activityName || 'Séance Garmin Hors-Plan',
                      description: `Activité non planifiée enregistrée sur Garmin Connect.\nType: ${act.activityType}\nDistance: ${act.distanceKm ? act.distanceKm.toFixed(2) : 0} km\nD+: ${act.elevationGainM || 0}m`,
                      startDate: act.startTimeLocal,
                      endDate: new Date(new Date(act.startTimeLocal).getTime() + act.durationMinutes * 60000).toISOString(),
                      category: 'sport',
                      colorId: 'unplanned',
                      colorHex: '#f59e0b',
                      durationMinutes: act.durationMinutes,
                      emoji: icon,
                      location: 'Garmin Connect',
                      metadata: {
                        targetElevationM: act.elevationGainM,
                        targetHeartRate: act.avgHeartRate ? `${act.avgHeartRate} bpm` : undefined
                      }
                    };

                    return (
                      <div
                        key={`unplanned-${comp.id}`}
                        className="event-card sport"
                        onClick={() => {
                          setSelectedEvent(syntheticEvent);
                          setSelectedComparison(comp);
                        }}
                        title="Activité non planifiée enregistrée sur Garmin. Cliquer pour voir les détails télémétriques."
                        style={{
                          borderLeftColor: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          padding: isSingleDayView ? '10px 14px' : '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>{icon}</span> Bonus Garmin
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: 3 }}>
                            {act.durationMinutes}m
                          </span>
                        </div>
                        <div style={{ fontSize: isSingleDayView ? '0.84rem' : '0.76rem', color: '#ffffff', fontWeight: 700, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.activityName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4, flexWrap: 'wrap' }}>
                          {Boolean(act.distanceKm && act.distanceKm > 0) && (
                            <span>📏 {act.distanceKm!.toFixed(1)} km</span>
                          )}
                          {Boolean(act.elevationGainM && act.elevationGainM > 0) && (
                            <span>⛰️ +{Math.round(act.elevationGainM!)}m</span>
                          )}
                          {Boolean(act.avgHeartRate) && (
                            <span>❤️ {act.avgHeartRate} bpm</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {isFusedMode && mobilityEvent && filter === 'all' && (
                <div
                  className="mobility-daily-chip"
                  onClick={() => {
                    setSelectedEvent(mobilityEvent);
                    setSelectedComparison(null);
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
            </div>
          );
        };

        if (viewMode === 'day') {
          const currentDay = displayedDays[activeDayIndex] || displayedDays[0];
          const dObj = currentDay ? new Date(currentDay.date + 'T12:00:00') : new Date();
          const isToday = currentDay ? currentDay.date === todayKey : false;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Ruban Hebdomadaire Mobile (Lundi -> Dimanche) */}
              <div className="mobile-week-ribbon">
                {displayedDays.map((day, idx) => {
                  const dayObj = new Date(day.date + 'T12:00:00');
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
                  const dateObj = new Date(day.date + 'T12:00:00');
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
                        if (draggedEvent && onPostponeWorkout && draggedEvent.startDate.slice(0, 10) !== day.date) {
                          const origDate = draggedEvent.metadata?.originalDate || draggedEvent.startDate.slice(0, 10);
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
            const dateObj = new Date(day.date + 'T12:00:00');
            const isToday = day.date === todayKey;
            const filteredEvents = day.events.filter(e => filter === 'all' || e.category === filter);
            const catchupForThisDay = comparisons.filter(c => c.isPostponedCatchup && c.executedDate === day.date);
            const unplannedForThisDay = comparisons.filter(c => c.status === 'UNPLANNED' && c.date === day.date);

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
                    {filteredEvents.length + catchupForThisDay.length + unplannedForThisDay.length} événement(s)
                  </span>
                </div>

                {filteredEvents.length === 0 && catchupForThisDay.length === 0 && unplannedForThisDay.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Repos / Aucun événement prévu.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                    {filteredEvents.map(ev => {
                      const evComp = comparisons.find(c => c.plannedEvent?.id === ev.id);

                      if (ev.metadata?.isPostponedPlaceholder) {
                        return (
                          <div
                            key={ev.id}
                            className="event-card ghost-postponed"
                            onClick={() => {
                              setSelectedEvent(ev);
                              setSelectedComparison(null);
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
                                <span>➡️</span> Reportée au {ev.metadata.postponedToDate}
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
                              {ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={ev.id}
                          className={`event-card ${ev.category}`}
                          onClick={() => {
                            setSelectedEvent(ev);
                            setSelectedComparison(evComp || null);
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

                          {ev.metadata?.isPostponed && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>
                              🔄 Reportée du {ev.metadata.originalDate}
                            </div>
                          )}

                          {evComp?.isPostponedCatchup && evComp.executedDate && (
                            <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span>🔄 Réalisée en rattrapage le {formatFriendlyDateStr(evComp.executedDate)} sur Garmin ({evComp.actualActivity?.durationMinutes}m)</span>
                            </div>
                          )}

                          {evComp && !evComp.isPostponedCatchup && (evComp.status === 'COMPLIANT' || evComp.status === 'PARTIAL') && (
                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                              <CheckCircle2 size={11} /> Validée Garmin ({evComp.actualActivity?.durationMinutes}m{evComp.actualActivity?.distanceKm ? ` • ${evComp.actualActivity.distanceKm.toFixed(1)}km` : ''}{evComp.actualActivity?.elevationGainM ? ` • +${Math.round(evComp.actualActivity.elevationGainM)}m` : ''}{evComp.actualActivity?.avgHeartRate ? ` • ❤️${evComp.actualActivity.avgHeartRate}` : ''})
                            </div>
                          )}

                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <MapPin size={11} /> {ev.location}
                          </div>

                          {ev.metadata?.commuteAller && (
                            <div className="journey-strip">
                              <Bus size={11} />
                              <span>Trajet : {formatTime(ev.metadata.commuteAller.departureTime)} ➔ {formatTime(ev.metadata.commuteAller.arrivalTime)} ({ev.metadata.commuteAller.durationMinutes}m)</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Cartes de séances de rattrapage exécutées ce jour */}
                    {catchupForThisDay.map(comp => (
                      <div
                        key={`catchup-list-${comp.id}`}
                        className="event-card sport"
                        onClick={() => {
                          if (comp.plannedEvent) {
                            setSelectedEvent(comp.plannedEvent);
                            setSelectedComparison(comp);
                          }
                        }}
                        style={{
                          borderLeftColor: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          padding: '10px 12px',
                          cursor: 'pointer'
                        }}
                        title="Séance de rattrapage Garmin. Cliquer pour voir les détails."
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🔄</span> Rattrapage Garmin
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                            {comp.actualActivity?.durationMinutes}m réalisés
                          </span>
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#ffffff', fontWeight: 700, marginTop: 4 }}>
                          {comp.actualActivity?.activityName || comp.plannedEvent?.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Remplace la séance du {formatFriendlyDateStr(comp.scheduledDate || '')}
                        </div>
                      </div>
                    ))}

                    {/* Cartes de séances non planifiées (bonus) Garmin ce jour */}
                    {unplannedForThisDay.map(comp => {
                      const act = comp.actualActivity;
                      if (!act) return null;
                      const isRun = act.activityType?.toLowerCase().includes('run') || act.activityType?.toLowerCase().includes('course');
                      const isBike = act.activityType?.toLowerCase().includes('cycl') || act.activityType?.toLowerCase().includes('vélo');
                      const isWalk = act.activityType?.toLowerCase().includes('walk') || act.activityType?.toLowerCase().includes('rando');
                      const icon = isRun ? '🏃' : isBike ? '🚴' : isWalk ? '🥾' : '⚡';

                      const syntheticEvent: CalendarEvent = {
                        id: `unplanned-list-${act.activityId}`,
                        title: act.activityName || 'Séance Garmin Hors-Plan',
                        description: `Activité non planifiée enregistrée sur Garmin Connect.\nType: ${act.activityType}\nDistance: ${act.distanceKm ? act.distanceKm.toFixed(2) : 0} km\nD+: ${act.elevationGainM || 0}m`,
                        startDate: act.startTimeLocal,
                        endDate: new Date(new Date(act.startTimeLocal).getTime() + act.durationMinutes * 60000).toISOString(),
                        category: 'sport',
                        colorId: 'unplanned',
                        colorHex: '#f59e0b',
                        durationMinutes: act.durationMinutes,
                        emoji: icon,
                        location: 'Garmin Connect',
                        metadata: {
                          targetElevationM: act.elevationGainM,
                          targetHeartRate: act.avgHeartRate ? `${act.avgHeartRate} bpm` : undefined
                        }
                      };

                      return (
                        <div
                          key={`unplanned-list-${comp.id}`}
                          className="event-card sport"
                          onClick={() => {
                            setSelectedEvent(syntheticEvent);
                            setSelectedComparison(comp);
                          }}
                          title="Activité non planifiée enregistrée sur Garmin. Cliquer pour voir les détails télémétriques."
                          style={{
                            borderLeftColor: '#f59e0b',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            padding: '10px 12px',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                            <span style={{ fontSize: '0.76rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{icon}</span> Bonus Garmin
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                              {act.durationMinutes}m réalisés
                            </span>
                          </div>
                          <div style={{ fontSize: '0.84rem', color: '#ffffff', fontWeight: 700, marginTop: 4 }}>
                            {act.activityName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4, flexWrap: 'wrap' }}>
                            {Boolean(act.distanceKm && act.distanceKm > 0) && (
                              <span>📏 {act.distanceKm!.toFixed(1)} km</span>
                            )}
                            {Boolean(act.elevationGainM && act.elevationGainM > 0) && (
                              <span>⛰️ +{Math.round(act.elevationGainM!)}m</span>
                            )}
                            {Boolean(act.avgHeartRate) && (
                              <span>❤️ {act.avgHeartRate} bpm</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
        onClose={() => {
          setSelectedEvent(null);
          setSelectedComparison(null);
        }}
        onPostpone={onPostponeWorkout}
        onCancelPostpone={onCancelPostponeWorkout}
      />
    </div>
  );
};
