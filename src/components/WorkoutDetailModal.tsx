import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  Heart,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Watch,
  X,
  Zap,
  ArrowRight
} from 'lucide-react';
import { RunAlarmModal } from './RunAlarmModal';
import { triggerHapticFeedback } from '../services/hapticsService';
import { pushWorkoutToGarmin, buildWorkoutPayloadFromEvent } from '../services/garminService';
import { GLOBAL_APP_CONFIG } from '../services/periodizationEngine';
import { useAuth } from '../contexts/AuthContext';
import { ActivityComparison } from '../types/garmin';

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

  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
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
  const [selectedWatch, setSelectedWatch] = useState<'FORERUNNER_55' | 'STANDARD'>('FORERUNNER_55');

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

  const toggleGear = (item: string) => {
    setCheckedGear(prev => ({ ...prev, [item]: !prev[item] }));
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

  // Calculateur Nutrition & Hydratation Ultra-Trail
  const isSport = event.category === 'sport';
  const durationHours = event.durationMinutes / 60;
  const isLongTrail = event.sportType === 'TRAIL_LONG';
  const isIntenseTrail = event.sportType === 'TRAIL_INTENSE';

  const carbsPerHour = (isLongTrail || isIntenseTrail) ? 60 : 35;
  const totalCarbsG = Math.round(durationHours * carbsPerHour);
  const totalWaterMl = Math.round(durationHours * 550);
  const totalSodiumMg = Math.round(durationHours * 450);
  const gelsEquivalent = Math.max(1, Math.round(totalCarbsG / 25));

  const mandatoryGearList: string[] = [];
  if (isSport && event.durationMinutes >= 45) {
    mandatoryGearList.push(`${Math.ceil(totalWaterMl / 500)}x 500 mL Flasques souples avec électrolytes`);
    mandatoryGearList.push(`Nutrition énergétique : ~${totalCarbsG}g de glucides (${gelsEquivalent} gels / barres)`);
    mandatoryGearList.push('Téléphone cellulaire chargé avec trace GPX téléchargée');
  }
  if (isLongTrail || event.durationMinutes >= 90) {
    mandatoryGearList.push('Couverture de survie (1,4m x 2m) + sifflet de sécurité (obligatoire QMT-80)');
    mandatoryGearList.push('Veste imperméable respirante à coutures étanches (10 000 Schmerber min)');
    mandatoryGearList.push('Gobelet réutilisable / Ecocup (aucun gobelet jetable aux ravitaillements)');
    mandatoryGearList.push('Bâtons pliables carbone (rangement sur le sac obligatoire pour le Mestachibo)');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>{event.emoji}</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                {event.title}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {formatDate(startDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

        <div className="modal-body" style={{ gap: '12px' }}>
          {/* 🛡️ Alerte Séance Adaptée Anti-blessure */}
          {event.metadata?.isAdapted && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid #38bdf8',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: '#7dd3fc',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#38bdf8' }}>
                <ShieldCheck size={16} />
                <span>Séance adaptée par le Coach Anti-blessure (Protection Tendons & ACWR)</span>
              </div>
              <div>{event.metadata.adaptationReason}</div>
              {event.metadata.originalDurationMinutes && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Durée initiale : {event.metadata.originalDurationMinutes} min • Modulée à {event.durationMinutes} min
                </div>
              )}
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

          {/* Barre Horaires & Lieu */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> Horaires
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {formatTime(startDate)} – {formatTime(endDate)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)' }}>
                {event.durationMinutes} minutes
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> Lieu
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {event.location}
              </div>
              {event.metadata?.room && (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                  Local : {event.metadata.room}
                </span>
              )}
            </div>

            {event.metadata?.targetElevationM && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Compass size={11} /> Objectif D+
                </span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', marginTop: 3 }}>
                  +{event.metadata.targetElevationM} m
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Dénivelé Ultra-Trail
                </span>
              </div>
            )}
          </div>

          {/* Alerte / Confirmation de report */}
          {postponeSuccessMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', padding: '10px 14px', borderRadius: 'var(--radius-xs)', fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
              ✓ {postponeSuccessMsg}
            </div>
          )}

          {/* Séance Fantôme : Déjà reportée vers un autre jour */}
          {event.metadata?.isPostponedPlaceholder && (
            <div style={{ background: 'rgba(100, 116, 139, 0.12)', border: '1px solid rgba(148, 163, 184, 0.3)', padding: '12px 14px', borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.86rem' }}>
                <CalendarClock size={16} />
                <span>Séance Reportée</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Cette séance a été déplacée vers le <strong>{event.metadata.postponedToDate}</strong>.
                {event.metadata.postponedReason && ` (Motif : ${event.metadata.postponedReason})`}
              </p>
              {onCancelPostpone && (
                <button
                  className="btn-secondary"
                  onClick={handleRevertPostpone}
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}
                >
                  <RotateCcw size={13} /> Rétablir la séance sur cette date
                </button>
              )}
            </div>
          )}

          {/* Section Reporter / Déplacer la séance (pour les séances de sport actives) */}
          {isSport && !event.metadata?.isPostponedPlaceholder && onPostpone && !comparison?.actualActivity && (
            <div style={{ background: 'rgba(255, 87, 34, 0.04)', border: '1px solid rgba(255, 87, 34, 0.25)', borderRadius: 'var(--radius-xs)', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPostponeExpanded ? 10 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarClock size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#ffffff' }}>
                    {event.metadata?.isPostponed ? 'Séance Déplacée / Reportée' : 'Reporter ou Déplacer cette séance'}
                  </span>
                  {event.metadata?.isPostponed && (
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255, 87, 34, 0.18)', color: 'var(--primary)', fontWeight: 700 }}>
                      Reportée depuis le {event.metadata.originalDate}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsPostponeExpanded(!isPostponeExpanded)}
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                >
                  {isPostponeExpanded ? 'Réduire' : 'Modifier la date'}
                </button>
              </div>

              {isPostponeExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 8 }}>
                  {/* Raccourcis rapides */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Raccourcis :</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuickPostpone(1)}
                      style={{ padding: '6px 12px', minHeight: '34px', fontSize: '0.76rem', background: 'rgba(255, 255, 255, 0.05)' }}
                    >
                      Demain (+1 j)
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuickPostpone(2)}
                      style={{ padding: '6px 12px', minHeight: '34px', fontSize: '0.76rem', background: 'rgba(255, 255, 255, 0.05)' }}
                    >
                      Après-demain (+2 j)
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuickPostpone(3)}
                      style={{ padding: '6px 12px', minHeight: '34px', fontSize: '0.76rem', background: 'rgba(255, 255, 255, 0.05)' }}
                    >
                      +3 jours
                    </button>
                  </div>

                  {/* Formulaire Date & Heure & Motif */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                        Nouvelle date
                      </label>
                      <input
                        type="date"
                        value={targetDateInput}
                        onChange={e => setTargetDateInput(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#ffffff',
                          fontSize: '0.82rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                        Heure de départ
                      </label>
                      <input
                        type="time"
                        value={targetTimeInput}
                        onChange={e => setTargetTimeInput(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#ffffff',
                          fontSize: '0.82rem'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                      Motif du report (optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : Récupération, météo, imprévu..."
                      value={reasonInput}
                      onChange={e => setReasonInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#ffffff',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>

                  {/* Actions de validation */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={handleConfirmPostpone}
                      style={{
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '7px 14px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <CalendarClock size={14} />
                      <span>Confirmer le report au {targetDateInput}</span>
                    </button>

                    {event.metadata?.isPostponed && onCancelPostpone && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRevertPostpone}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: 'var(--text-secondary)' }}
                        title="Annuler le report et remettre la séance à sa date d'origine"
                      >
                        <RotateCcw size={12} /> Rétablir au {event.metadata.originalDate}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bandeau de Conflit d'Horaire Résolu */}
          {event.metadata?.conflictRescheduled && event.metadata.conflictReason && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', fontSize: '0.78rem', color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>🔄</span>
              <div>
                <strong>Décalage Intelligent :</strong> {event.metadata.conflictReason}
              </div>
            </div>
          )}

          {/* Cibles Cardiaques & Physiologiques */}
          {event.metadata?.targetHeartRate && (
            <div style={{ background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, marginBottom: '4px', fontSize: '0.82rem' }}>
                <Heart size={14} />
                <span>Zone Cardiaque Cible (FCmax = {athleteFcMax} bpm)</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {event.metadata.targetHeartRate}
              </p>
              {event.metadata.targetCadence && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  ⚡ Cadence recommandée : <strong>{event.metadata.targetCadence}</strong>
                </p>
              )}
            </div>
          )}

          {/* Description & Protocole */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Protocole & Consignes de Séance
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

          {/* Calculateur de Ravitaillement & Hydratation QMT-80 */}
          {isSport && event.durationMinutes >= 35 && (
            <div
              style={{
                background: 'rgba(255, 87, 34, 0.05)',
                border: '1px solid rgba(255, 87, 34, 0.25)',
                borderRadius: 'var(--radius-xs)',
                padding: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <Zap size={14} />
                  <span>Calculateur Nutrition & Hydratation Ultra-Trail (QMT-80)</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Cible : {carbsPerHour}g de glucides/heure
                </span>
              </div>

              {/* Métriques nutritionnelles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>{totalCarbsG}g</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Glucides ({gelsEquivalent} gels)</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>{totalWaterMl} mL</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Volume d'Eau</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{totalSodiumMg} mg</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Sodium (Électrolytes)</div>
                </div>
              </div>

              {/* Checklist Matériel */}
              {mandatoryGearList.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={12} color="#10b981" /> Checklist Matériel Recommandé :
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {mandatoryGearList.map((item, idx) => {
                      const isChecked = Boolean(checkedGear[item]);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleGear(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            color: isChecked ? '#34d399' : 'var(--text-secondary)',
                            textDecoration: isChecked ? 'line-through' : 'none'
                          }}
                        >
                          {isChecked ? <CheckSquare size={13} color="#10b981" /> : <Square size={13} color="var(--text-muted)" />}
                          <span>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION: Synchronisation Montre Garmin (Forerunner 55) */}
          {isSport && !event.metadata?.isPostponedPlaceholder && !comparison?.actualActivity && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.85), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-xs)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Watch size={18} color="#60a5fa" />
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff' }}>
                    Synchronisation Montre Garmin
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: 'rgba(59, 130, 246, 0.18)',
                      color: '#93c5fd',
                      fontWeight: 700
                    }}
                  >
                    Forerunner 55 Compatible
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Montre :</label>
                  <select
                    value={selectedWatch}
                    onChange={e => setSelectedWatch(e.target.value as any)}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      color: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      padding: '3px 6px',
                      fontSize: '0.72rem'
                    }}
                  >
                    <option value="FORERUNNER_55">Garmin Forerunner 55 (Cardio/Run)</option>
                    <option value="STANDARD">Garmin Standard (Fenix/Forerunner 265+)</option>
                  </select>
                </div>
              </div>

              {/* Résumé des étapes Garmin */}
              {workoutPreview && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '8px 10px',
                    borderRadius: 4,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                    Structure envoyée à la montre : {workoutPreview.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {workoutPreview.steps.slice(0, 4).map((st, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>•</span>
                        <span>{st.stepNotes || `${st.stepType} (${st.durationSeconds ? st.durationSeconds + 's' : ''})`}</span>
                      </div>
                    ))}
                    {workoutPreview.steps.length > 4 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        + {workoutPreview.steps.length - 4} autres intervalles et temps de repos programmés
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Message de succès ou d'erreur */}
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
                    {garminPushResult.success ? <CheckCircle2 size={15} /> : <X size={15} />}
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

              {/* Bouton d'action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={handlePushToGarmin}
                  disabled={isPushingGarmin}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: isPushingGarmin ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  {isPushingGarmin ? (
                    <>
                      <Loader2 size={14} className="spin-animation" />
                      <span>Envoi vers Garmin Connect...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Envoyer vers ma Garmin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>


        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              triggerHapticFeedback('light');
              setIsAlarmModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <Bell size={15} />
            <span>Alarme & Rappel</span>
          </button>
          <button className="btn-secondary" onClick={onClose}>
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
