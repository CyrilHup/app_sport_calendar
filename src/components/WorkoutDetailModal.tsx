import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../types/calendar';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Heart,
  MapPin,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  X,
  Activity,
  AlertCircle,
  Zap
} from 'lucide-react';
import { RunAlarmModal } from './RunAlarmModal';
import { triggerHapticFeedback } from '../services/hapticsService';
import { buildWorkoutPayloadFromEvent } from '../services/garminService';
import { GLOBAL_APP_CONFIG } from '../services/periodizationEngine';
import { useAuth } from '../contexts/AuthContext';
import { ActivityComparison } from '../types/garmin';
import { formatTime, formatDateKey } from '../services/dateUtils';
import { calculateSessionTrimp } from '../services/statsEngine';
import { isStrengthOrCalisthenics, isTrailOrRunning } from '../services/activityClassifier';
import { UnifiedDayWorkoutGroup, SportActivityItem } from '../services/workoutAggregator';

interface WorkoutDetailModalProps {
  event: CalendarEvent | null;
  comparison?: ActivityComparison | null;
  unifiedGroup?: UnifiedDayWorkoutGroup | null;
  onClose: () => void;
  onPostpone?: (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => void;
  onCancelPostpone?: (eventId: string) => void;
  onOpenGarminSync?: () => void;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({
  event,
  comparison,
  unifiedGroup,
  onClose,
  onPostpone,
  onCancelPostpone,
  onOpenGarminSync
}) => {
  if (!event && !unifiedGroup) return null;

  const isMultiMerged = Boolean(unifiedGroup && unifiedGroup.isMerged);
  const [activeItemIndex, setActiveItemIndex] = useState<'global' | number>(isMultiMerged ? 'global' : 0);

  useEffect(() => {
    setActiveItemIndex(isMultiMerged ? 'global' : 0);
  }, [unifiedGroup?.id, isMultiMerged]);

  const activeItem: SportActivityItem | null =
    (isMultiMerged && typeof activeItemIndex === 'number')
      ? unifiedGroup!.items[activeItemIndex]
      : null;

  const effectiveEvent: CalendarEvent = activeItem?.plannedEvent || (activeItem ? {
    id: activeItem.id,
    title: activeItem.title,
    description: 'Activité enregistrée sur Garmin Connect.',
    startDate: activeItem.startTime ? activeItem.startTime.toISOString() : `${unifiedGroup!.date}T12:00:00`,
    endDate: activeItem.endTime ? activeItem.endTime.toISOString() : `${unifiedGroup!.date}T13:00:00`,
    category: 'sport',
    colorId: 'sport',
    colorHex: activeItem.discipline === 'RUNNING' ? '#ff5722' : '#10b981',
    durationMinutes: activeItem.durationMinutes,
    emoji: activeItem.emoji,
    location: 'Garmin Connect'
  } : (event || {
    id: unifiedGroup!.id,
    title: unifiedGroup!.title,
    description: 'Activité combinée',
    startDate: `${unifiedGroup!.date}T12:00:00`,
    endDate: `${unifiedGroup!.date}T13:00:00`,
    category: 'sport',
    colorId: 'sport',
    colorHex: '#ff5722',
    durationMinutes: unifiedGroup!.totalDurationMinutes,
    emoji: unifiedGroup!.emoji,
    location: 'Garmin Connect'
  }));

  const effectiveComparison: ActivityComparison | null | undefined =
    activeItem ? (activeItem.comparison || null) : comparison;

  const { profile } = useAuth();
  const athleteFcMax = profile?.fcMax || GLOBAL_APP_CONFIG.ATHLETE_FC_MAX || 203;

  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState<boolean>(false);

  const originalDateKey = effectiveEvent.metadata?.originalDate || effectiveEvent.startDate.slice(0, 10);
  const currentEventDateKey = effectiveEvent.startDate.slice(0, 10);

  // Date de demain par défaut pour le report rapide
  const baseDate = new Date(currentEventDateKey + 'T12:00:00');
  const defaultTomorrow = new Date(baseDate);
  defaultTomorrow.setDate(defaultTomorrow.getDate() + 1);
  const defaultTomorrowStr = defaultTomorrow.toISOString().slice(0, 10);

  const defaultHours = String(new Date(effectiveEvent.startDate).getHours()).padStart(2, '0');
  const defaultMins = String(new Date(effectiveEvent.startDate).getMinutes()).padStart(2, '0');

  const [targetDateInput, setTargetDateInput] = useState<string>(defaultTomorrowStr);
  const [targetTimeInput, setTargetTimeInput] = useState<string>(`${defaultHours}:${defaultMins}`);
  const [reasonInput, setReasonInput] = useState<string>(effectiveEvent.metadata?.postponedReason || 'Déplacée / Reportée');
  const [isPostponeExpanded, setIsPostponeExpanded] = useState<boolean>(Boolean(effectiveEvent.metadata?.isPostponed));
  const [postponeSuccessMsg, setPostponeSuccessMsg] = useState<string | null>(null);

  const selectedWatch = 'FORERUNNER_55';
  const workoutPreview = effectiveEvent.category === 'sport' ? buildWorkoutPayloadFromEvent(effectiveEvent, effectiveEvent.startDate.slice(0, 10), selectedWatch) : null;

  const handleQuickPostpone = (daysOffset: number) => {
    const d = new Date(currentEventDateKey + 'T12:00:00');
    d.setDate(d.getDate() + daysOffset);
    const newDateStr = d.toISOString().slice(0, 10);
    setTargetDateInput(newDateStr);
  };

  const handleConfirmPostpone = () => {
    if (!onPostpone) return;
    onPostpone(
      effectiveEvent.id,
      originalDateKey,
      targetDateInput,
      reasonInput,
      targetTimeInput
    );
    setPostponeSuccessMsg(`Séance reportée avec succès au ${targetDateInput} !`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleRevertPostpone = () => {
    if (!onCancelPostpone) return;
    onCancelPostpone(effectiveEvent.id);
    setPostponeSuccessMsg(`Séance rétablie à sa date initiale (${originalDateKey}) !`);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const startDate = new Date(effectiveEvent.startDate);
  const endDate = new Date(effectiveEvent.endDate);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const isSport = effectiveEvent.category === 'sport';
  const isAdapted = Boolean(effectiveEvent.metadata?.isAdapted);

  const titleLower = effectiveEvent.title.toLowerCase();

  // 1. PRIORITÉ ABSOLUE AU TRAIL ET À LA COURSE À PIED
  const isTrailOrRun = isSport && (
    effectiveEvent.sportType === 'TRAIL_INTENSE' ||
    effectiveEvent.sportType === 'TRAIL_LONG' ||
    effectiveEvent.sportType === 'RUN_EASY' ||
    isTrailOrRunning(effectiveEvent) ||
    titleLower.includes('trail') ||
    titleLower.includes('hill repeats') ||
    titleLower.includes('côte') ||
    titleLower.includes('cotes') ||
    titleLower.includes('footing') ||
    titleLower.includes('running') ||
    titleLower.includes('course') ||
    titleLower.includes('rando-course') ||
    titleLower.includes('mont-royal') ||
    titleLower.includes('mont royal') ||
    Boolean(effectiveEvent.metadata?.targetElevationM && effectiveEvent.metadata.targetElevationM > 0)
  );

  // 2. Calisthénie / Musculation STRICTEMENT exclusive au trail/running
  const isCalisthenics = isSport && !isTrailOrRun && (
    effectiveEvent.sportType === 'CALISTHENICS' ||
    effectiveEvent.sportType === 'GYM_FORCE' ||
    effectiveEvent.sportType === 'MOBILITY' ||
    titleLower.includes('calisth') ||
    isStrengthOrCalisthenics(effectiveEvent)
  );

  const actualStartDate = effectiveComparison?.actualActivity?.startTimeLocal ? new Date(effectiveComparison.actualActivity.startTimeLocal) : null;
  const actualDurationMinutes = effectiveComparison?.actualActivity?.durationMinutes;
  const actualEndDate = (actualStartDate && actualDurationMinutes) ? new Date(actualStartDate.getTime() + actualDurationMinutes * 60000) : null;
  const isDifferentDayExecution = Boolean(actualStartDate && formatDateKey(actualStartDate) !== formatDateKey(startDate));

  const isRecoveryFooting = isSport && !isCalisthenics && !titleLower.includes('trail') && !titleLower.includes('côte') && !titleLower.includes('hill') && (
    (effectiveEvent.sportType === 'RUN_EASY' && (titleLower.includes('footing') || titleLower.includes('récupération') || titleLower.includes('doux'))) ||
    Boolean(effectiveEvent.metadata?.isAdapted)
  );

  const effectiveElevationM = isCalisthenics ? 0 : (isRecoveryFooting ? 0 : (effectiveEvent.metadata?.targetElevationM ?? 0));
  const effectiveLocation = (isRecoveryFooting && effectiveEvent.location?.toLowerCase().includes('mont royal'))
    ? 'Terrain plat / Parc (évite le D+)'
    : (effectiveEvent.location || 'Garmin Connect');

  const plannedTrimpInfo = isSport ? calculateSessionTrimp(
    effectiveEvent.durationMinutes,
    isRecoveryFooting ? 'RUN_EASY' : effectiveEvent.sportType,
    effectiveEvent.title,
    null
  ) : null;

  const originalTrimpInfo = isSport && isAdapted ? calculateSessionTrimp(
    effectiveEvent.metadata?.originalDurationMinutes || effectiveEvent.durationMinutes,
    (effectiveEvent.metadata as any)?.originalSportType || effectiveEvent.sportType,
    effectiveEvent.metadata?.originalTitle || effectiveEvent.title,
    null
  ) : null;

  const actualTrimpInfo = (isSport && effectiveComparison?.actualActivity) ? calculateSessionTrimp(
    effectiveComparison.actualActivity.durationMinutes,
    effectiveComparison.actualActivity.activityType,
    effectiveComparison.actualActivity.activityName,
    effectiveComparison.actualActivity.trainingLoad,
    {
      avgHeartRate: effectiveComparison.actualActivity.avgHeartRate,
      maxHeartRate: effectiveComparison.actualActivity.maxHeartRate,
      elevationGainM: effectiveComparison.actualActivity.elevationGainM,
      distanceKm: effectiveComparison.actualActivity.distanceKm,
      athleteFcMax
    }
  ) : null;

  const sessionTrimpInfo = actualTrimpInfo || plannedTrimpInfo;

  const trimpSaved = (originalTrimpInfo && plannedTrimpInfo) ? Math.max(0, originalTrimpInfo.trimp - plannedTrimpInfo.trimp) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>{isMultiMerged && activeItemIndex === 'global' ? unifiedGroup!.emoji : effectiveEvent.emoji}</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                {isMultiMerged && activeItemIndex === 'global'
                  ? unifiedGroup!.title
                  : (isCalisthenics ? 'Entraînement Calisthénie' : effectiveEvent.title)}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                {isMultiMerged && activeItemIndex === 'global' ? (
                  <span>{formatDate(startDate)} • <strong style={{ color: '#38bdf8' }}>{unifiedGroup!.items.length} sorties combinées</strong></span>
                ) : (
                  <>
                    {actualStartDate ? formatDate(actualStartDate) : formatDate(startDate)}
                    {isDifferentDayExecution && (
                      <span style={{ color: '#38bdf8', display: 'block', fontSize: '0.72rem', marginTop: 2, fontWeight: 600 }}>
                        🔄 Séance réalisée sur Garmin (prévue le {formatDate(startDate)})
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px 20px', gap: '14px', overflowY: 'auto', flex: 1 }}>
          {/* Tab Navigation Multi-séances */}
          {isMultiMerged && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, borderBottom: '1px solid var(--border-color)', marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setActiveItemIndex('global')}
                style={{
                  background: activeItemIndex === 'global' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${activeItemIndex === 'global' ? '#38bdf8' : 'var(--border-color)'}`,
                  color: activeItemIndex === 'global' ? '#38bdf8' : 'var(--text-secondary)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap'
                }}
              >
                <span>📊</span>
                <span>Vue Globale ({unifiedGroup!.totalDurationMinutes}m)</span>
              </button>

              {unifiedGroup!.items.map((it, idx) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setActiveItemIndex(idx)}
                  style={{
                    background: activeItemIndex === idx ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${activeItemIndex === idx ? '#10b981' : 'var(--border-color)'}`,
                    color: activeItemIndex === idx ? '#34d399' : 'var(--text-secondary)',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{it.emoji}</span>
                  <span>{it.plannedEvent ? `Sortie ${idx + 1} (Plan)` : `Sortie ${idx + 1}`}</span>
                  <span style={{ opacity: 0.75, fontSize: '0.68rem' }}>({it.durationMinutes}m{it.distanceKm ? ` • ${it.distanceKm}km` : ''})</span>
                </button>
              ))}
            </div>
          )}

          {isMultiMerged && activeItemIndex === 'global' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Synthèse Télémetrique Globale */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.08))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={17} color="#38bdf8" />
                    <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#ffffff' }}>
                      Synthèse Consolidée des {unifiedGroup!.items.length} Activités du Jour
                    </span>
                  </div>
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      borderRadius: 9999,
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}
                  >
                    🔗 Séances Fusionnées
                  </span>
                </div>

                {/* 5 Tuiles de synthèse */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⏱️ Durée Totale</div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#ffffff' }}>
                      {unifiedGroup!.totalDurationMinutes} min
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                      {unifiedGroup!.items.map(it => `${it.durationMinutes}m`).join(' + ')}
                    </span>
                  </div>

                  {unifiedGroup!.totalDistanceKm > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>📍 Distance Totale</div>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--primary)' }}>
                        {unifiedGroup!.totalDistanceKm} km
                      </div>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                        {unifiedGroup!.items.filter(it => it.distanceKm).map(it => `${it.distanceKm}km`).join(' + ')}
                      </span>
                    </div>
                  )}

                  {unifiedGroup!.totalElevationGainM > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⛰️ Dénivelé Cumulé</div>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--accent-green)' }}>
                        +{unifiedGroup!.totalElevationGainM} m
                      </div>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                        D- : -{unifiedGroup!.totalElevationLossM} m
                      </span>
                    </div>
                  )}

                  <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>❤️ Cardio Moyen</div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--accent-red)' }}>
                      {unifiedGroup!.weightedAvgHeartRate ? `${unifiedGroup!.weightedAvgHeartRate} bpm` : '--'}
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                      {unifiedGroup!.maxHeartRate ? `Pic max ${unifiedGroup!.maxHeartRate} bpm` : 'Moyenne pondérée'}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                      <Zap size={11} color="#38bdf8" /> Charge Globale
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#38bdf8' }}>
                      {unifiedGroup!.totalTrimp} TRIMP
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--accent-green)' }}>
                      Cumul physiologique ACWR
                    </span>
                  </div>
                </div>
              </div>

              {/* Liste Chronologique des Sorties Individuelles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Détail chronologique des activités ({unifiedGroup!.items.length})
                </div>

                {unifiedGroup!.items.map((it, idx) => {
                  const itStart = it.startTime ? formatTime(it.startTime) : null;
                  const itEnd = it.endTime ? formatTime(it.endTime) : null;

                  return (
                    <div
                      key={it.id}
                      onClick={() => setActiveItemIndex(idx)}
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'border-color 0.15s, background 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1.1rem' }}>{it.emoji}</span>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>
                            {it.title}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: it.itemType === 'PLANNED_COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : (it.itemType === 'UNPLANNED_BONUS' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                            color: it.itemType === 'PLANNED_COMPLETED' ? '#34d399' : (it.itemType === 'UNPLANNED_BONUS' ? '#fbbf24' : '#38bdf8'),
                            border: `1px solid ${it.itemType === 'PLANNED_COMPLETED' ? '#10b981' : (it.itemType === 'UNPLANNED_BONUS' ? '#f59e0b' : '#38bdf8')}`
                          }}
                        >
                          {it.itemType === 'PLANNED_COMPLETED' ? '✅ Validée Garmin' : (it.itemType === 'UNPLANNED_BONUS' ? 'Bonus Garmin' : '🔄 Reportée')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        {itStart && itEnd && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={11} /> {itStart} – {itEnd}
                          </span>
                        )}
                        <span>•</span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{it.durationMinutes}m réelles</span>
                        {it.distanceKm && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>📏 {it.distanceKm.toFixed(1)} km</span>
                          </>
                        )}
                        {it.elevationGainM ? (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>⛰️ +{Math.round(it.elevationGainM)}m</span>
                          </>
                        ) : null}
                        {it.avgHeartRate && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>❤️ {it.avgHeartRate} bpm</span>
                          </>
                        )}
                        <span>•</span>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>⚡ {it.trimp} TRIMP</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          Voir la télémétrie complète de cette sortie ➔
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fiche Pédagogique Cumul de Charge */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '10px 12px', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                💡 <strong>Comment ces séances cumulées alimentent votre entraînement ?</strong> Le modèle de Banister et le ratio ACWR (Sweet Spot Tim Gabbett) additionnent directement le volume et la charge physiologique de vos {unifiedGroup!.items.length} sorties de la journée (<strong>{unifiedGroup!.totalTrimp} TRIMP cumulés</strong>). La charge aiguë (ATL 7 jours) intègre cette fatigue globale pour calibrer précisément votre niveau de forme et votre risque de blessure.
              </div>
            </div>
          ) : (
            <>
              {isMultiMerged && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 6, padding: '6px 12px', fontSize: '0.74rem', marginBottom: 6 }}>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    Affichage de la sortie {(activeItemIndex as number) + 1} sur {unifiedGroup!.items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveItemIndex('global')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    ← Revenir à la synthèse globale
                  </button>
                </div>
              )}
          {/* 🛡️ Alerte Séance Adaptée Anti-blessure */}
          {isAdapted && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(14, 20, 36, 0.95))',
                border: '1px solid #38bdf8',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                fontSize: '0.8rem',
                color: '#e0f2fe',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#38bdf8', fontSize: '0.88rem' }}>
                  <ShieldCheck size={17} />
                  <span>Séance Allégée Anti-blessure (Protection Tendons & ACWR)</span>
                </div>
                {trimpSaved > 0 && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '2px 8px', borderRadius: 9999, fontWeight: 800, fontSize: '0.74rem' }}>
                    -{trimpSaved} TRIMP d'impact économisés
                  </span>
                )}
              </div>

              <div>{effectiveEvent.metadata?.adaptationReason}</div>

              {/* Comparaison détaillée de la charge */}
              {originalTrimpInfo && plannedTrimpInfo && (
                <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '8px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.74rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Charge initiale prévue : </span>
                    <strong style={{ color: 'var(--accent-orange)' }}>{originalTrimpInfo.trimp} TRIMP</strong>
                    <span style={{ color: 'var(--text-muted)' }}> ({effectiveEvent.metadata?.originalDurationMinutes} min)</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>➔</span>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Charge modulée : </span>
                    <strong style={{ color: 'var(--accent-green)' }}>{plannedTrimpInfo.trimp} TRIMP</strong>
                    <span style={{ color: 'var(--text-muted)' }}> ({effectiveEvent.durationMinutes} min)</span>
                  </div>
                </div>
              )}

              <p style={{ margin: 0, fontSize: '0.73rem', color: '#93c5fd', lineHeight: 1.45 }}>
                💡 <strong>Pourquoi cette réduction de charge ?</strong> La charge aiguë (7 jours) additionne directement les TRIMPs de vos séances de course. En remplaçant les chocs excentriques intenses (côtes D+) par un footing régénérant à plat, vous retirez {trimpSaved > 0 ? `${trimpSaved} TRIMP` : 'de la fatigue'} du numérateur ACWR pour ramener le ratio dans le Sweet Spot (&lt; 1.3) et donner à vos tendons le temps de surcompenser.
              </p>
            </div>
          )}

          {/* Télémétrie Réalisée Garmin Connect (Si séance complétée) */}
          {effectiveComparison?.actualActivity && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(6, 182, 212, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>
                    Télémétrie Réelle Garmin Connect
                  </span>
                </div>
                {effectiveComparison?.complianceScore !== undefined && (
                  <span
                    style={{
                      background: effectiveComparison.complianceScore >= 80 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                      color: effectiveComparison.complianceScore >= 80 ? '#34d399' : '#fbbf24',
                      border: `1px solid ${effectiveComparison.complianceScore >= 80 ? '#10b981' : '#f59e0b'}`,
                      borderRadius: 9999,
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}
                  >
                    {effectiveComparison.complianceScore}% de conformité
                  </span>
                )}
              </div>

              {/* 4 Sleek Telemetry Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⏱️ Durée Réelle</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#ffffff' }}>
                    {effectiveComparison.actualActivity.durationMinutes} min
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    Prescrit : {effectiveEvent.durationMinutes}m ({effectiveComparison.actualActivity.durationMinutes >= effectiveEvent.durationMinutes ? '+' : ''}{effectiveComparison.actualActivity.durationMinutes - effectiveEvent.durationMinutes}m)
                  </span>
                </div>

                {!isCalisthenics && Boolean(effectiveComparison.actualActivity.distanceKm && effectiveComparison.actualActivity.distanceKm > 0) && (
                  <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>📍 Distance</div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--primary)' }}>
                      {effectiveComparison.actualActivity.distanceKm} km
                    </div>
                    {effectiveComparison.actualActivity.avgPaceMinKm && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        Allure {effectiveComparison.actualActivity.avgPaceMinKm}
                      </span>
                    )}
                  </div>
                )}

                {!isCalisthenics && Boolean((effectiveComparison.actualActivity.elevationGainM && effectiveComparison.actualActivity.elevationGainM > 0) || (effectiveComparison.actualActivity.elevationLossM && effectiveComparison.actualActivity.elevationLossM > 0)) && (
                  <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⛰️ Dénivelé D+/D-</div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--accent-green)' }}>
                      +{effectiveComparison.actualActivity.elevationGainM || 0} m
                    </div>
                    {Boolean(effectiveComparison.actualActivity.elevationLossM) && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        -{effectiveComparison.actualActivity.elevationLossM} m
                      </span>
                    )}
                  </div>
                )}

                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>❤️ Cardiaque / EPOC</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--accent-red)' }}>
                    {effectiveComparison.actualActivity.avgHeartRate ? `${effectiveComparison.actualActivity.avgHeartRate} bpm` : '--'}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    {effectiveComparison.actualActivity.trainingLoad ? `Charge EPOC ${effectiveComparison.actualActivity.trainingLoad}` : (effectiveComparison.actualActivity.maxHeartRate ? `Max ${effectiveComparison.actualActivity.maxHeartRate} bpm` : '')}
                  </span>
                </div>

                {actualTrimpInfo && (
                  <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                      <Zap size={11} color="#38bdf8" /> Charge Réelle
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#38bdf8' }}>
                      {actualTrimpInfo.trimp} TRIMP
                    </div>
                    <span style={{ fontSize: '0.68rem', color: plannedTrimpInfo && actualTrimpInfo.trimp !== plannedTrimpInfo.trimp ? '#fbbf24' : 'var(--accent-green)' }}>
                      {plannedTrimpInfo && actualTrimpInfo.trimp !== plannedTrimpInfo.trimp
                        ? `${actualTrimpInfo.trimp > plannedTrimpInfo.trimp ? '+' : ''}${actualTrimpInfo.trimp - plannedTrimpInfo.trimp} vs prévu`
                        : (actualTrimpInfo.isRealTelemetry ? 'Banister FC' : 'EPOC')}
                    </span>
                  </div>
                )}
              </div>

              {/* Feedback notes */}
              {effectiveComparison.feedbackNotes && effectiveComparison.feedbackNotes.length > 0 && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 4, lineHeight: 1.4 }}>
                  {effectiveComparison.feedbackNotes.join(' • ')}
                </div>
              )}
            </div>
          )}

          {/* Grille Métriques Clés : Horaires, Lieu, D+, Cardio */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {/* Horaires */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                <Clock size={11} /> {actualStartDate ? 'Horaires Réels' : 'Horaires'}
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {actualStartDate && actualEndDate
                  ? `${formatTime(actualStartDate)} – ${formatTime(actualEndDate)}`
                  : `${formatTime(startDate)} – ${formatTime(endDate)}`}
              </div>
              <span style={{ fontSize: '0.72rem', color: actualDurationMinutes ? '#10b981' : 'var(--accent-blue)', fontWeight: 600 }}>
                {actualDurationMinutes ? `${actualDurationMinutes} minutes (réalisées)` : `${effectiveEvent.durationMinutes} minutes`}
              </span>
              {actualStartDate && (actualDurationMinutes !== effectiveEvent.durationMinutes || formatTime(actualStartDate) !== formatTime(startDate)) && (
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Prévu : {formatTime(startDate)} – {formatTime(endDate)} ({effectiveEvent.durationMinutes}m)
                </div>
              )}
            </div>

            {/* Lieu */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                <MapPin size={11} /> Lieu
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={effectiveLocation}>
                {effectiveLocation}
              </div>
              {effectiveEvent.metadata?.room ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                  Local : {effectiveEvent.metadata.room}
                </span>
              ) : isAdapted ? (
                <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                  {isRecoveryFooting ? 'Plat sans chocs' : 'Adapté anti-blessure'}
                </span>
              ) : isCalisthenics ? (
                <span style={{ fontSize: '0.68rem', color: '#c4b5fd', fontWeight: 600 }}>
                  Poids du corps / Salle
                </span>
              ) : null}
            </div>

            {/* Objectif D+ (si sport de course/trail) */}
            {isSport && !isCalisthenics && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Compass size={11} /> Dénivelé D+
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: effectiveElevationM > 0 ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: 3 }}>
                  {effectiveElevationM > 0 ? `+${effectiveElevationM} m` : '0 m (Plat)'}
                </div>
                <span style={{ fontSize: '0.68rem', color: isAdapted ? '#38bdf8' : 'var(--text-secondary)' }}>
                  {isRecoveryFooting ? 'Terrain plat (sans D+)' : (isAdapted ? 'D+ allégé' : (effectiveElevationM > 0 ? 'Ultra-Trail' : 'Récupération souple'))}
                </span>
              </div>
            )}

            {/* Discipline Calisthénie (remplace D+ qui n'a pas de sens) */}
            {isSport && isCalisthenics && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Activity size={11} color="var(--accent-purple)" /> Discipline
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#c4b5fd', marginTop: 3 }}>
                  Calisthénie
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  Poids du corps • Zéro D+
                </span>
              </div>
            )}

            {/* Cible Cardiaque */}
            {effectiveEvent.metadata?.targetHeartRate && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Heart size={11} color="var(--accent-red)" /> Cible Cardio / Intensité
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--accent-red)', marginTop: 3 }}>
                  {effectiveEvent.metadata.targetHeartRate}
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  FCmax = {athleteFcMax} bpm
                </span>
              </div>
            )}

            {/* Charge Séance (TRIMP) */}
            {isSport && sessionTrimpInfo && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Zap size={11} color={sessionTrimpInfo.isMechanicalImpact ? '#38bdf8' : '#a78bfa'} /> Charge Séance
                </span>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: sessionTrimpInfo.isMechanicalImpact ? '#38bdf8' : '#c4b5fd', marginTop: 3 }}>
                  {sessionTrimpInfo.trimp} TRIMP
                </div>
                <span style={{ fontSize: '0.68rem', color: actualTrimpInfo ? '#38bdf8' : (sessionTrimpInfo.isMechanicalImpact ? 'var(--accent-green)' : 'var(--text-secondary)') }}>
                  {actualTrimpInfo
                    ? `Réalisé sur montre (${actualTrimpInfo.isRealTelemetry ? 'Banister FC' : 'EPOC'})`
                    : (sessionTrimpInfo.isMechanicalImpact ? 'Impact Course (ACWR)' : 'Force / Zéro choc')}
                </span>
              </div>
            )}
          </div>

          {/* Fiche Pédagogique de la Charge Physiologique */}
          {isSport && sessionTrimpInfo && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-xs)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>
                  <Zap size={14} color="var(--accent-orange)" />
                  <span>
                    {actualTrimpInfo ? 'CHARGE PHYSIOLOGIQUE RÉELLEMENT ENREGISTRÉE' : 'COMMENT CETTE CHARGE EST CALCULÉE ET UTILISÉE ?'}
                  </span>
                </div>
              </div>

              {/* Décomposition Pédagogique des Coefficients */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 12px', borderRadius: 6, fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: 5, borderLeft: `3px solid ${actualTrimpInfo ? '#38bdf8' : 'var(--accent-cyan)'}` }}>
                <div style={{ fontWeight: 800, color: actualTrimpInfo ? '#38bdf8' : 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>📊 {actualTrimpInfo ? 'Calcul physiologique réel (Montre Garmin) :' : 'Décomposition du calcul théorique :'}</span>
                  <span style={{ fontFamily: 'monospace' }}>{sessionTrimpInfo.formulaText}</span>
                </div>

                {actualTrimpInfo?.isRealTelemetry ? (
                  <>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      • <strong style={{ color: '#e2e8f0' }}>Fréquence cardiaque réelle :</strong> {sessionTrimpInfo.details}.
                    </div>
                    {effectiveComparison?.actualActivity?.avgPaceMinKm && (
                      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        • <strong style={{ color: '#e2e8f0' }}>Allure soutenue ({effectiveComparison.actualActivity.avgPaceMinKm}) :</strong> Intensité aérobie plus élevée qu'une simple récupération, entraînant une dépense et une fatigue plus rapides par minute.
                      </div>
                    )}
                    {plannedTrimpInfo && actualTrimpInfo.trimp !== plannedTrimpInfo.trimp && (
                      <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '6px 8px', borderRadius: 4, color: '#93c5fd', marginTop: 4, lineHeight: 1.4 }}>
                        💡 <strong>Plan vs Réel :</strong> Le plan prévoyait {effectiveEvent.durationMinutes} min de {isCalisthenics ? 'calisthénie / renforcement' : (titleLower.includes('trail') || titleLower.includes('côte') || titleLower.includes('hill') ? 'trail & côtes' : 'course à pied')} ({plannedTrimpInfo.trimp} TRIMP). La séance réalisée ({effectiveComparison?.actualActivity?.durationMinutes} min) {isCalisthenics ? 'a été réalisée' : 'a été courue'} à un rythme plus soutenu (FC moy. {effectiveComparison?.actualActivity?.avgHeartRate || '--'} bpm, pic {effectiveComparison?.actualActivity?.maxHeartRate || '--'} bpm). La charge réelle enregistrée (<strong>{actualTrimpInfo.trimp} TRIMP</strong>) est celle qui alimente votre charge aiguë (ATL) et votre ratio ACWR pour protéger fidèlement vos tendons.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      • <strong style={{ color: '#e2e8f0' }}>0.80 TRIMP/min (Modèle Banister) :</strong> Taux standard de dépense aérobie en endurance douce (~48 TRIMP pour 1 heure en Zone 2).
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      • <strong style={{ color: '#e2e8f0' }}>Facteur {sessionTrimpInfo.factor} ({sessionTrimpInfo.factorLabel}) :</strong> Majoration des contraintes mécaniques liées aux impacts répétés de la foulée au sol (+15% par rapport à une activité sans choc).
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                      ➔ Taux net appliqué : 0.80 × {sessionTrimpInfo.factor} = {sessionTrimpInfo.ratePerMin} TRIMP / minute d'effort.
                    </div>
                  </>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {sessionTrimpInfo.isMechanicalImpact ? (
                  <>
                    🏃 <strong>Impact articulaire mécanique (Course / Trail) :</strong> Cette séance de <strong>{actualTrimpInfo ? (effectiveComparison?.actualActivity?.durationMinutes || effectiveEvent.durationMinutes) : effectiveEvent.durationMinutes} min</strong> applique des forces de freinage excentriques répétées. Ses <strong>{sessionTrimpInfo.trimp} TRIMP</strong> sont directement ajoutés à votre <strong>charge aiguë (7 jours)</strong> pour surveiller le risque de blessure tendineuse (ratio ACWR de Tim Gabbett) et alimentent votre fatigue ATL dans le modèle Banister.
                  </>
                ) : (
                  <>
                    🛡️ <strong>Renforcement / Force au poids du corps :</strong> Cette séance de <strong>{actualTrimpInfo ? (effectiveComparison?.actualActivity?.durationMinutes || effectiveEvent.durationMinutes) : effectiveEvent.durationMinutes} min</strong> ne génère <strong>aucune onde de choc au sol</strong>. Ses <strong>{sessionTrimpInfo.trimp} TRIMP</strong> développent votre force structurelle et votre fitness CTL général, mais sont <strong>totalement isolés du ratio ACWR de blessure tendineuse</strong> pour vous éviter de fausses alertes.
                  </>
                )}
              </div>
            </div>
          )}

          {/* SÉANCE CALISTHÉNIE : Entraînement libre au poids du corps sans déroulé rigide */}
          {isSport && isCalisthenics ? (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xs)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', marginBottom: 4 }}>
                <Activity size={14} color="var(--primary)" />
                <span>Entraînement Calisthénie</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Séance libre au poids du corps ({actualDurationMinutes || effectiveEvent.durationMinutes} min) : pratique autonome selon vos sensations (tractions, dips, gainage, pompes), sans programme ni déroulé imposé.
              </div>
            </div>
          ) : isSport && workoutPreview && workoutPreview.steps && workoutPreview.steps.length > 0 ? (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xs)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>
                  <Activity size={14} color="var(--primary)" />
                  <span>DÉROULÉ CONCRET DE LA SÉANCE</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {effectiveEvent.durationMinutes} min au total
                </span>
              </div>

              {/* Timeline des étapes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workoutPreview.steps.map((st, idx) => {
                  const mins = st.durationSeconds ? Math.round(st.durationSeconds / 60) : 0;
                  const isWarmup = st.stepType === 'WARMUP';
                  const isCooldown = st.stepType === 'COOLDOWN';
                  const isInterval = st.stepType === 'INTERVAL';

                  const badgeColor = isWarmup
                    ? '#38bdf8'
                    : isCooldown
                    ? '#a78bfa'
                    : isInterval
                    ? '#f97316'
                    : '#34d399';

                  const badgeLabel = isWarmup
                    ? 'Échauffement'
                    : isCooldown
                    ? 'Retour au calme'
                    : isInterval
                    ? 'Corps de séance'
                    : 'Récupération';

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderLeft: `3px solid ${badgeColor}`,
                        borderRadius: 4
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 85 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: badgeColor }}>
                          {badgeLabel}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff' }}>
                          {mins > 0 ? `${mins} min` : (st.durationSeconds ? `${st.durationSeconds}s` : 'Libre')}
                        </span>
                      </div>

                      <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        <div>{st.stepNotes}</div>
                        {st.targetHrLow && st.targetHrHigh && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Cible : {st.targetHrLow} – {st.targetHrHigh} bpm
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Règle d'or / Consignes clés directes */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>⚠️ Règles clés :</span>
                {isRecoveryFooting ? (
                  <>
                    <span>• <strong>Course 100% sur terrain plat ou herbeux souple</strong> : aucun dénivelé, aucune côte pour reposer tendons et genoux.</span>
                    <span>• <strong>Allure de récupération douce</strong> : rester strictement sous 142 bpm (Zone 1/2) en aisance respiratoire totale.</span>
                  </>
                ) : effectiveEvent?.sportType === 'TRAIL_LONG' || effectiveElevationM >= 200 ? (
                  <>
                    <span>• ⛰️ <strong>Stratégie Rando-Course Ultra-Trail QMT-80</strong> : pour accumuler +{effectiveElevationM} m D+ tout en restant sous 155 bpm (Zone 2), alternez marche et course.</span>
                    <span>• <strong>Power-Hike obligatoire en côte</strong> : dès que la pente dépasse 7 à 8 % (ou dès que la FC approche 150 bpm), passez en marche rapide active (mains en appui sur les cuisses ou bâtons) pour brider les pulsations en Zone 2.</span>
                    <span>• <strong>Relance fluide sur le plat & descentes</strong> : courez souplement dès que le terrain s'adoucit pour travailler la foulée d'endurance sans exploser le cardio.</span>
                    <span>• <strong>Filière lipidique</strong> : respecter la Zone 2 permet d'optimiser la combustion des graisses indispensable pour boucler 80 km sans panne de glycogène.</span>
                  </>
                ) : (
                  <>
                    <span>• <strong>Marche active (power-hike)</strong> dès que la pente dépasse 8% pour économiser les tendons et mollets.</span>
                    <span>• Respect strict de la <strong>Zone 2</strong> pour favoriser la filière lipidique sans stress lactique.</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Description & Consignes
              </h4>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  padding: '12px',
                  borderRadius: 'var(--radius-xs)',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.82rem',
                  lineHeight: 1.55
                }}
              >
                {effectiveEvent.description}
              </div>
            </div>
          )}

          {/* Section Reporter / Déplacer la séance (repliable discrète) */}
          {isSport && !effectiveEvent.metadata?.isPostponedPlaceholder && onPostpone && !effectiveComparison?.actualActivity && (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xs)', padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarClock size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {effectiveEvent.metadata?.isPostponed ? `Séance reportée depuis le ${effectiveEvent.metadata.originalDate}` : 'Déplacer ou reporter cette séance'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsPostponeExpanded(!isPostponeExpanded)}
                  style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                >
                  {isPostponeExpanded ? 'Fermer' : 'Modifier la date'}
                </button>
              </div>

              {isPostponeExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  {/* Raccourcis rapides */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Raccourcis :</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuickPostpone(1)}
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                    >
                      Demain (+1 j)
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuickPostpone(2)}
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                    >
                      Après-demain (+2 j)
                    </button>
                  </div>

                  {/* Date & Heure */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Nouvelle date</label>
                      <input
                        type="date"
                        value={targetDateInput}
                        onChange={e => setTargetDateInput(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>Heure</label>
                      <input
                        type="time"
                        value={targetTimeInput}
                        onChange={e => setTargetTimeInput(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleConfirmPostpone}
                      style={{
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '6px 12px',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <CalendarClock size={13} />
                      <span>Valider pour le {targetDateInput}</span>
                    </button>

                    {effectiveEvent.metadata?.isPostponed && onCancelPostpone && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRevertPostpone}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}
                      >
                        <RotateCcw size={12} /> Rétablir
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </>
        )}
        </div>

        {/* Footer avec Actions Principales directes : Garmin, Alarme, Fermer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Bouton Alarme & Rappel */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                triggerHapticFeedback('light');
                setIsAlarmModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                fontSize: '0.78rem',
                fontWeight: 600
              }}
            >
              <Bell size={13} />
              <span>Alarme & Rappel</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 14px', fontSize: '0.78rem' }}
          >
            Fermer
          </button>
        </div>
      </div>

      <RunAlarmModal
        isOpen={isAlarmModalOpen}
        onClose={() => setIsAlarmModalOpen(false)}
        workout={{
          id: effectiveEvent.id,
          title: effectiveEvent.title,
          date: effectiveEvent.startDate,
          activityType: effectiveEvent.sportType || 'SPORT'
        }}
      />
    </div>
  );
};
