import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Heart,
  HelpCircle,
  Loader2,
  MapPin,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Watch,
  X,
  Activity,
  AlertCircle,
  Zap
} from 'lucide-react';
import { RunAlarmModal } from './RunAlarmModal';
import { triggerHapticFeedback } from '../services/hapticsService';
import { pushWorkoutToGarmin, buildWorkoutPayloadFromEvent } from '../services/garminService';
import { GLOBAL_APP_CONFIG } from '../services/periodizationEngine';
import { useAuth } from '../contexts/AuthContext';
import { ActivityComparison } from '../types/garmin';
import { calculateSessionTrimp } from '../services/statsEngine';

interface WorkoutDetailModalProps {
  event: CalendarEvent | null;
  comparison?: ActivityComparison | null;
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
  onClose,
  onPostpone,
  onCancelPostpone,
  onOpenGarminSync
}) => {
  if (!event) return null;

  const { profile } = useAuth();
  const athleteFcMax = profile?.fcMax || GLOBAL_APP_CONFIG.ATHLETE_FC_MAX || 203;

  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState<boolean>(false);

  const originalDateKey = event.metadata?.originalDate || event.startDate.slice(0, 10);
  const currentEventDateKey = event.startDate.slice(0, 10);

  // Date de demain par défaut pour le report rapide
  const baseDate = new Date(currentEventDateKey + 'T12:00:00');
  const defaultTomorrow = new Date(baseDate);
  defaultTomorrow.setDate(defaultTomorrow.getDate() + 1);
  const defaultTomorrowStr = defaultTomorrow.toISOString().slice(0, 10);

  const defaultHours = String(new Date(event.startDate).getHours()).padStart(2, '0');
  const defaultMins = String(new Date(event.startDate).getMinutes()).padStart(2, '0');

  const [targetDateInput, setTargetDateInput] = useState<string>(defaultTomorrowStr);
  const [targetTimeInput, setTargetTimeInput] = useState<string>(`${defaultHours}:${defaultMins}`);
  const [reasonInput, setReasonInput] = useState<string>(event.metadata?.postponedReason || 'Déplacée / Reportée');
  const [isPostponeExpanded, setIsPostponeExpanded] = useState<boolean>(Boolean(event.metadata?.isPostponed));
  const [postponeSuccessMsg, setPostponeSuccessMsg] = useState<string | null>(null);

  // Garmin Workout Push state
  const [isPushingGarmin, setIsPushingGarmin] = useState<boolean>(false);
  const [garminPushResult, setGarminPushResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const selectedWatch = 'FORERUNNER_55';

  const workoutPreview = event.category === 'sport' ? buildWorkoutPayloadFromEvent(event, event.startDate.slice(0, 10), selectedWatch) : null;

  const handlePushToGarmin = async () => {
    setIsPushingGarmin(true);
    setGarminPushResult(null);
    triggerHapticFeedback('light');

    const result = await pushWorkoutToGarmin(event, event.startDate.slice(0, 10), selectedWatch);
    setIsPushingGarmin(false);
    setGarminPushResult(result);
    if (result.success) {
      triggerHapticFeedback('success');
    } else {
      triggerHapticFeedback('warning');
    }
  };

  const handleQuickPostpone = (daysOffset: number) => {
    const d = new Date(currentEventDateKey + 'T12:00:00');
    d.setDate(d.getDate() + daysOffset);
    const newDateStr = d.toISOString().slice(0, 10);
    setTargetDateInput(newDateStr);
  };

  const handleConfirmPostpone = () => {
    if (!onPostpone) return;
    onPostpone(
      event.id,
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
    onCancelPostpone(event.id);
    setPostponeSuccessMsg(`Séance rétablie à sa date initiale (${originalDateKey}) !`);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const isSport = event.category === 'sport';
  const isAdapted = Boolean(event.metadata?.isAdapted);

  const titleLower = event.title.toLowerCase();
  const isRecoveryFooting = isSport && (
    event.sportType === 'RUN_EASY' ||
    titleLower.includes('footing') ||
    titleLower.includes('récupération') ||
    titleLower.includes('aérobie doux')
  );

  const effectiveElevationM = isRecoveryFooting ? 0 : (event.metadata?.targetElevationM ?? 0);
  const effectiveLocation = (isRecoveryFooting && event.location.toLowerCase().includes('mont royal'))
    ? 'Terrain plat / Parc (évite le D+)'
    : event.location;

  const sessionTrimpInfo = isSport ? calculateSessionTrimp(
    event.durationMinutes,
    isRecoveryFooting ? 'RUN_EASY' : event.sportType,
    event.title,
    comparison?.actualActivity?.trainingLoad
  ) : null;

  const originalTrimpInfo = isSport && isAdapted ? calculateSessionTrimp(
    event.metadata?.originalDurationMinutes || event.durationMinutes,
    (event.metadata as any)?.originalSportType || event.sportType,
    event.metadata?.originalTitle || event.title
  ) : null;

  const trimpSaved = (originalTrimpInfo && sessionTrimpInfo) ? Math.max(0, originalTrimpInfo.trimp - sessionTrimpInfo.trimp) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>{event.emoji}</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                {event.title}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                {formatDate(startDate)}
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

              <div>{event.metadata?.adaptationReason}</div>

              {/* Comparaison détaillée de la charge */}
              {originalTrimpInfo && sessionTrimpInfo && (
                <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '8px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.74rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Charge initiale prévue : </span>
                    <strong style={{ color: 'var(--accent-orange)' }}>{originalTrimpInfo.trimp} TRIMP</strong>
                    <span style={{ color: 'var(--text-muted)' }}> ({event.metadata?.originalDurationMinutes} min)</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>➔</span>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Charge modulée : </span>
                    <strong style={{ color: 'var(--accent-green)' }}>{sessionTrimpInfo.trimp} TRIMP</strong>
                    <span style={{ color: 'var(--text-muted)' }}> ({event.durationMinutes} min)</span>
                  </div>
                </div>
              )}

              <p style={{ margin: 0, fontSize: '0.73rem', color: '#93c5fd', lineHeight: 1.45 }}>
                💡 <strong>Pourquoi cette réduction de charge ?</strong> La charge aiguë (7 jours) additionne directement les TRIMPs de vos séances de course. En remplaçant les chocs excentriques intenses (côtes D+) par un footing régénérant à plat, vous retirez {trimpSaved > 0 ? `${trimpSaved} TRIMP` : 'de la fatigue'} du numérateur ACWR pour ramener le ratio dans le Sweet Spot (&lt; 1.3) et donner à vos tendons le temps de surcompenser.
              </p>
            </div>
          )}

          {/* Télémétrie Réalisée Garmin Connect (Si séance complétée) */}
          {comparison?.actualActivity && (
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
                {comparison?.complianceScore !== undefined && (
                  <span
                    style={{
                      background: comparison.complianceScore >= 80 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                      color: comparison.complianceScore >= 80 ? '#34d399' : '#fbbf24',
                      border: `1px solid ${comparison.complianceScore >= 80 ? '#10b981' : '#f59e0b'}`,
                      borderRadius: 9999,
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}
                  >
                    {comparison.complianceScore}% de conformité
                  </span>
                )}
              </div>

              {/* 4 Sleek Telemetry Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⏱️ Durée Réelle</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#ffffff' }}>
                    {comparison.actualActivity.durationMinutes} min
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    Prescrit : {event.durationMinutes}m ({comparison.actualActivity.durationMinutes >= event.durationMinutes ? '+' : ''}{comparison.actualActivity.durationMinutes - event.durationMinutes}m)
                  </span>
                </div>

                {comparison.actualActivity.distanceKm && (
                  <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>📍 Distance</div>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--primary)' }}>
                      {comparison.actualActivity.distanceKm} km
                    </div>
                    {comparison.actualActivity.avgPaceMinKm && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        Allure {comparison.actualActivity.avgPaceMinKm}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>⛰️ Dénivelé D+/D-</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--accent-green)' }}>
                    +{comparison.actualActivity.elevationGainM || 0} m
                  </div>
                  {Boolean(comparison.actualActivity.elevationLossM) && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      -{comparison.actualActivity.elevationLossM} m
                    </span>
                  )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px', borderRadius: 4 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>❤️ Cardiaque / EPOC</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--accent-red)' }}>
                    {comparison.actualActivity.avgHeartRate ? `${comparison.actualActivity.avgHeartRate} bpm` : '--'}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    {comparison.actualActivity.trainingLoad ? `Charge EPOC ${comparison.actualActivity.trainingLoad}` : (comparison.actualActivity.maxHeartRate ? `Max ${comparison.actualActivity.maxHeartRate} bpm` : '')}
                  </span>
                </div>
              </div>

              {/* Feedback notes */}
              {comparison.feedbackNotes && comparison.feedbackNotes.length > 0 && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 4, lineHeight: 1.4 }}>
                  {comparison.feedbackNotes.join(' • ')}
                </div>
              )}
            </div>
          )}

          {/* Grille Métriques Clés : Horaires, Lieu, D+, Cardio */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {/* Horaires */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                <Clock size={11} /> Horaires
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {formatTime(startDate)} – {formatTime(endDate)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                {event.durationMinutes} minutes
              </span>
            </div>

            {/* Lieu */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                <MapPin size={11} /> Lieu
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={effectiveLocation}>
                {effectiveLocation}
              </div>
              {event.metadata?.room ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                  Local : {event.metadata.room}
                </span>
              ) : isAdapted ? (
                <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                  {isRecoveryFooting ? 'Plat sans chocs' : 'Adapté anti-blessure'}
                </span>
              ) : null}
            </div>

            {/* Objectif D+ (si sport) */}
            {isSport && (
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

            {/* Cible Cardiaque */}
            {event.metadata?.targetHeartRate && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Heart size={11} color="var(--accent-red)" /> Cible Cardio
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--accent-red)', marginTop: 3 }}>
                  {event.metadata.targetHeartRate}
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
                <span style={{ fontSize: '0.68rem', color: sessionTrimpInfo.isMechanicalImpact ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                  {sessionTrimpInfo.isMechanicalImpact ? 'Impact Course (ACWR)' : 'Force / Zéro choc'}
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
                  <span>COMMENT CETTE CHARGE EST CALCULÉE ET UTILISÉE ?</span>
                </div>
              </div>
              {/* Décomposition Pédagogique des Coefficients */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 12px', borderRadius: 6, fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: 5, borderLeft: '3px solid var(--accent-cyan)' }}>
                <div style={{ fontWeight: 800, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📊 Décomposition du calcul :</span>
                  <span style={{ fontFamily: 'monospace' }}>{event.durationMinutes} min × {sessionTrimpInfo.ratePerMin} TRIMP/min = {sessionTrimpInfo.trimp} TRIMP</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  • <strong style={{ color: '#e2e8f0' }}>0.80 TRIMP/min (Modèle Banister) :</strong> Taux standard de dépense aérobie en endurance douce (~48 TRIMP pour 1 heure en Zone 2).
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  • <strong style={{ color: '#e2e8f0' }}>Facteur {sessionTrimpInfo.factor} ({sessionTrimpInfo.factorLabel}) :</strong> Majoration des contraintes mécaniques liées aux impacts répétés de la foulée au sol (+15% par rapport à une activité sans choc).
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                  ➔ Taux net appliqué : 0.80 × {sessionTrimpInfo.factor} = {sessionTrimpInfo.ratePerMin} TRIMP / minute d'effort.
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {sessionTrimpInfo.isMechanicalImpact ? (
                  <>
                    🏃 <strong>Impact articulaire mécanique (Course / Trail) :</strong> Cette séance de <strong>{event.durationMinutes} min</strong> applique des forces de freinage excentriques répétées. Ses <strong>{sessionTrimpInfo.trimp} TRIMP</strong> sont directement ajoutés à votre <strong>charge aiguë (7 jours)</strong> pour surveiller le risque de blessure tendineuse (ratio ACWR de Tim Gabbett) et alimentent votre fatigue ATL dans le modèle Banister.
                  </>
                ) : (
                  <>
                    🛡️ <strong>Renforcement / Force au poids du corps :</strong> Cette séance de <strong>{event.durationMinutes} min</strong> ne génère <strong>aucune onde de choc au sol</strong>. Ses <strong>{sessionTrimpInfo.trimp} TRIMP</strong> développent votre force structurelle et votre fitness CTL général, mais sont <strong>totalement isolés du ratio ACWR de blessure tendineuse</strong> pour vous éviter de fausses alertes.
                  </>
                )}
              </div>
            </div>
          )}

          {/* DÉROULÉ CONCRET DE LA SÉANCE : Ce que je dois faire */}
          {isSport && workoutPreview && workoutPreview.steps && workoutPreview.steps.length > 0 ? (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xs)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>
                  <Activity size={14} color="var(--primary)" />
                  <span>DÉROULÉ CONCRET DE LA SÉANCE</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {event.durationMinutes} min au total
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
                {event.description}
              </div>
            </div>
          )}

          {/* Section Reporter / Déplacer la séance (repliable discrète) */}
          {isSport && !event.metadata?.isPostponedPlaceholder && onPostpone && !comparison?.actualActivity && (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xs)', padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarClock size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {event.metadata?.isPostponed ? `Séance reportée depuis le ${event.metadata.originalDate}` : 'Déplacer ou reporter cette séance'}
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

                    {event.metadata?.isPostponed && onCancelPostpone && (
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

          {/* Feedback de push Garmin */}
          {garminPushResult && (
            <div
              style={{
                background: garminPushResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${garminPushResult.success ? '#10b981' : '#ef4444'}`,
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: '0.78rem',
                color: garminPushResult.success ? '#34d399' : '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {garminPushResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{garminPushResult.message || garminPushResult.error}</span>
              </div>
              {!garminPushResult.success && onOpenGarminSync && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onOpenGarminSync}
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  Connecter Garmin
                </button>
              )}
            </div>
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
            {/* Bouton Envoi Montre Garmin (Toujours accessible pour programmer ou renvoyer vers la montre) */}
            {isSport && !event.metadata?.isPostponedPlaceholder && (
              <button
                type="button"
                onClick={handlePushToGarmin}
                disabled={isPushingGarmin}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: isPushingGarmin ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                }}
                title="Programmer directement la séance sur Garmin Connect (Forerunner 55)"
              >
                {isPushingGarmin ? (
                  <>
                    <Loader2 size={13} className="spin-animation" />
                    <span>Envoi vers montre...</span>
                  </>
                ) : (
                  <>
                    <Watch size={14} />
                    <span>{comparison?.actualActivity ? 'Renvoyer vers Forerunner 55' : 'Envoyer vers Forerunner 55'}</span>
                  </>
                )}
              </button>
            )}

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
          id: event.id,
          title: event.title,
          date: event.startDate,
          activityType: event.sportType || 'SPORT'
        }}
      />
    </div>
  );
};
