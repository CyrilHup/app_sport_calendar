import React, { useState } from 'react';
import './ComparisonDashboard.css';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import { formatDateKey, toLocalDateKey, parseLocalDate, addDays } from '../services/dateUtils';
import { calculateSessionTrimp } from '../services/statsEngine';
import { formatGarminActivityName, isStrengthOrCalisthenics, isTrailOrRunning } from '../services/activityClassifier';
import { getDynamicAthleteProfile } from '../services/garminService';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  FileSpreadsheet,
  Flame,
  Heart,
  LayoutGrid,
  Link2,
  PlusCircle,
  RefreshCw,
  Unlink,
  X,
  XCircle,
  Zap
} from 'lucide-react';

interface ComparisonDashboardProps {
  comparisons: ActivityComparison[];
  onOpenGarminSync: () => void;
  availableGarminActivities?: GarminActivity[];
  manualPairs?: Record<string, string>;
  onManualPair?: (planId: string, garminActivityId: string) => void;
  onManualUnpair?: (planId: string) => void;
  onPostponeWorkout?: (eventId: string, originalDate: string, targetDate: string, reason?: string) => void;
  referenceDateStr?: string;
  athlete?: { fcMax: number; fcRest: number };
}

type StatusFilterType = 'ALL' | 'COMPLIANT' | 'PARTIAL' | 'MISSED' | 'UNPLANNED' | 'PENDING';

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({
  comparisons,
  onOpenGarminSync,
  availableGarminActivities = [],
  manualPairs = {},
  onManualPair,
  onManualUnpair,
  onPostponeWorkout,
  referenceDateStr,
  athlete
}) => {
  const isMobileInitial = typeof window !== 'undefined' && window.innerWidth < 768;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(isMobileInitial ? 'cards' : 'table');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [pairingForPlanId, setPairingForPlanId] = useState<string | null>(null);

  // Compteurs
  const countAll = comparisons.length;
  const countCompliant = comparisons.filter(c => c.status === 'COMPLIANT').length;
  const countPartial = comparisons.filter(c => c.status === 'PARTIAL').length;
  const countMissed = comparisons.filter(c => c.status === 'MISSED').length;
  const countUnplanned = comparisons.filter(c => c.status === 'UNPLANNED').length;
  const countPending = comparisons.filter(c => c.status === 'PENDING').length;
  const profile = getDynamicAthleteProfile(availableGarminActivities, athlete);

  // Filtrage selon le statut actif
  const displayedComparisons = comparisons.filter(c => {
    if (statusFilter === 'ALL') return true;
    return c.status === statusFilter;
  });

  const filters: { value: StatusFilterType; label: string; count: number }[] = [
    { value: 'ALL', label: 'Toutes', count: countAll },
    { value: 'COMPLIANT', label: 'Conformes', count: countCompliant },
    { value: 'PARTIAL', label: 'Avec écarts', count: countPartial },
    { value: 'MISSED', label: 'Sans activité liée', count: countMissed },
    { value: 'UNPLANNED', label: 'Hors plan', count: countUnplanned },
    { value: 'PENDING', label: 'Aujourd’hui', count: countPending }
  ];

  const getStatusBadge = (status: string, score: number) => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <span className="status-pill status-compliant">
            <CheckCircle2 size={12} /> Conforme ({score}%)
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="status-pill status-partial">
            <AlertTriangle size={12} /> Écart ({score}%)
          </span>
        );
      case 'MISSED':
        return (
          <span className="status-pill status-missed">
            <XCircle size={12} /> Sans activité liée
          </span>
        );
      case 'UNPLANNED':
        return (
          <span className="status-pill status-unplanned">
            <PlusCircle size={12} /> Hors plan
          </span>
        );
      case 'PENDING':
        return (
          <span className="status-pill">
            <Clock size={12} /> Aujourd’hui
          </span>
        );
      default:
        return null;
    }
  };

  const getActivityTypeBadge = (type?: string) => {
    switch (type) {
      case 'TRAIL_RUNNING':
        return (
          <span className="badge-tag" style={{ background: 'rgba(255, 87, 34, 0.15)', color: 'var(--primary)', border: '1px solid var(--primary-border)', fontSize: '0.65rem' }}>
            Trail
          </span>
        );
      case 'RUNNING':
        return (
          <span className="badge-tag" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '0.65rem' }}>
            Course
          </span>
        );
      case 'CLIMBING':
        return (
          <span className="badge-tag" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)', fontSize: '0.65rem' }}>
            🧗 Escalade
          </span>
        );
      case 'CYCLING':
        return (
          <span className="badge-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.65rem' }}>
            🚴 Vélo
          </span>
        );
      case 'WALKING':
        return (
          <span className="badge-tag" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.65rem' }}>
            🚶 Marche
          </span>
        );
      case 'STRENGTH_TRAINING':
      case 'FITNESS_EQUIPMENT':
        return (
          <span className="badge-tag" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)', fontSize: '0.65rem' }}>
            Renfo / Calisthénie
          </span>
        );
      case 'OTHER':
        return (
          <span className="other-badge">
            Autre
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sessions-page">
      <div className="surface-panel sessions-toolbar">
        <label>Statut
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilterType)}>
            {filters.map(filter => <option key={filter.value} value={filter.value}>{filter.label} ({filter.count})</option>)}
          </select>
        </label>
        <div className="sessions-actions">
          <button type="button" onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')} className="btn-secondary">
            {viewMode === 'table' ? <LayoutGrid size={16} aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
            {viewMode === 'table' ? 'Cartes' : 'Tableau'}
          </button>
          <button type="button" onClick={onOpenGarminSync} className="btn-secondary">Réglages Garmin</button>
        </div>
      </div>

      {/* État vide si aucune séance ne correspond */}
      {displayedComparisons.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255, 87, 34, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {statusFilter === 'ALL' ? 'Aucune activité disponible' : 'Aucune séance pour ce filtre'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
              {statusFilter === 'ALL'
                ? 'Importe tes activités Garmin ou une trace GPX pour les comparer au plan.'
                : 'Sélectionne un autre filtre ci-dessus ou réinitialise à "Toutes".'}
            </p>
          </div>
          {statusFilter !== 'ALL' ? (
            <button className="btn-secondary" onClick={() => setStatusFilter('ALL')} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              Réinitialiser à Toutes
            </button>
          ) : (
            <button className="btn-primary" onClick={onOpenGarminSync} style={{ padding: '9px 16px', marginTop: 4 }}>
              <RefreshCw size={14} />
              <span>Réglages Garmin</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Tableau Pro Haute Densité */
        <div className="pro-table-wrapper">
          <table className="pro-table">
            <thead>
              <tr>
                <th>Séance prévue</th>
                <th>Activité enregistrée</th>
                <th>Durée</th>
                <th>FC</th>
                <th>Dénivelé +</th>
                <th>Charge</th>
                <th>Concordance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedComparisons.map(comp => {
                const dateObj = new Date(comp.date + 'T12:00:00');
                const dateFormatted = dateObj.toLocaleDateString('fr-CA', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                });

                const isExpanded = expandedId === comp.id;
                const isOther = comp.actualActivity?.activityType === 'OTHER';
                const planId = comp.plannedEvent?.id;
                const isManuallyPaired = Boolean(planId && manualPairs[planId]);

                const actualTrimp = comp.actualActivity ? calculateSessionTrimp(
                  comp.actualActivity.durationMinutes,
                  comp.actualActivity.activityType,
                  comp.actualActivity.activityName,
                  comp.actualActivity.trainingLoad,
                  {
                    avgHeartRate: comp.actualActivity.avgHeartRate,
                    maxHeartRate: comp.actualActivity.maxHeartRate,
                    elevationGainM: comp.actualActivity.elevationGainM,
                    distanceKm: comp.actualActivity.distanceKm,
                    athleteFcMax: profile.fcMax,
                    athleteFcRest: profile.fcRest
                  }
                ) : null;

                const plannedTrimp = comp.plannedEvent ? calculateSessionTrimp(
                  comp.plannedEvent.durationMinutes,
                  comp.plannedEvent.sportType || comp.plannedEvent.title,
                  comp.plannedEvent.title,
                  null,
                  {
                    elevationGainM: comp.plannedEvent.metadata?.targetElevationM,
                    targetHeartRateRange: comp.plannedEvent.metadata?.targetHeartRateRange,
                    targetHeartRate: comp.plannedEvent.metadata?.targetHeartRate,
                    athleteFcMax: profile.fcMax,
                    athleteFcRest: profile.fcRest
                  }
                ) : null;

                return (
                  <React.Fragment key={comp.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : comp.id)}
                      style={{ cursor: 'pointer', background: comp.status === 'MISSED' ? 'rgba(239, 68, 68, 0.03)' : undefined }}
                    >
                      {/* Date & Plan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>
                            {comp.plannedEvent?.emoji || '📅'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <button type="button" className="session-table-toggle" aria-expanded={isExpanded}
                                onClick={event => { event.stopPropagation(); setExpandedId(isExpanded ? null : comp.id); }}>
                                {comp.plannedEvent?.title.replace(/^[^\p{L}\p{N}]+/u, '') || 'Activité hors plan'}
                                <ChevronDown size={14} aria-hidden="true" />
                              </button>
                              {comp.isMergedExecution && comp.subActivities && comp.subActivities.length > 1 && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                  title={`Consolidation de ${comp.subActivities.length} activités du même jour`}
                                >
                                  ⚡ {comp.subActivities.length} {isTrailOrRunning(comp.actualActivity) ? 'sorties combinées' : 'séances combinées'}
                                </span>
                              )}
                              {comp.isPostponedCatchup && comp.scheduledDate && (
                                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 700 }}>
                                  🔄 Remplacée / Reportée du {parseLocalDate(comp.scheduledDate).toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {dateFormatted} • Objectif {comp.plannedEvent?.durationMinutes || comp.actualActivity?.durationMinutes || '--'} min
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Activité Réelle Garmin */}
                      <td>
                        {comp.actualActivity ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {formatGarminActivityName(comp.actualActivity.activityName, comp.plannedEvent?.title, comp.actualActivity.activityType)}
                              </span>
                              {getActivityTypeBadge(comp.actualActivity.activityType)}
                            </div>
                            {comp.inferredType && (
                              <div style={{ fontSize: '0.68rem', color: '#c084fc' }}>
                                Profil inféré : {comp.inferredType}
                              </div>
                            )}
                            {comp.actualActivity.trainingEffectLabel && (
                              <div style={{ fontSize: '0.66rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                <Zap size={10} /> {comp.actualActivity.trainingEffectLabel}
                                {comp.actualActivity.trainingLoad ? ` (${comp.actualActivity.trainingLoad} EPOC)` : ''}
                              </div>
                            )}
                            {isManuallyPaired && (
                              <span style={{ fontSize: '0.65rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                <Link2 size={10} /> Appairé manuellement
                              </span>
                            )}
                          </div>
                        ) : comp.status === 'PENDING' ? (
                          <span style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontStyle: 'italic' }}>
                            Prévue aujourd'hui — En attente d'import
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#f87171', fontStyle: 'italic' }}>
                            Non enregistrée sur la montre
                          </span>
                        )}
                      </td>

                      {/* Durée & Allure */}
                      <td>
                        {comp.actualActivity && comp.plannedEvent ? (
                          <div>
                            <span style={{ fontWeight: 700 }}>
                              {comp.actualActivity.durationMinutes}m
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                              / {comp.plannedEvent.durationMinutes}m
                            </span>
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: 6,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: Math.abs(comp.durationDeltaMinutes) <= 5 ? '#10b981' : (comp.durationDeltaMinutes > 0 ? '#38bdf8' : '#f59e0b')
                              }}
                            >
                              ({comp.durationDeltaMinutes > 0 ? '+' : ''}{comp.durationDeltaMinutes}m)
                            </span>
                            {comp.actualActivity.avgPaceMinKm && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 600, marginTop: 2 }}>
                                ⚡ {comp.actualActivity.avgPaceMinKm}
                              </div>
                            )}
                          </div>
                        ) : comp.actualActivity ? (
                          <div>
                            <span>{comp.actualActivity.durationMinutes} min</span>
                            {comp.actualActivity.avgPaceMinKm && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 600, marginTop: 2 }}>
                                ⚡ {comp.actualActivity.avgPaceMinKm}
                              </div>
                            )}
                          </div>
                        ) : comp.plannedEvent ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            0m / {comp.plannedEvent.durationMinutes}m
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Fréquence Cardiaque */}
                      <td>
                        {comp.actualActivity?.avgHeartRate ? (
                          <div>
                            <span style={{ fontWeight: 700 }}>
                              {comp.actualActivity.avgHeartRate} bpm
                            </span>
                            {comp.actualActivity.maxHeartRate && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                                (Max {comp.actualActivity.maxHeartRate})
                              </span>
                            )}
                            {comp.plannedEvent?.metadata?.targetHeartRateRange && (
                              <div style={{ fontSize: '0.68rem', color: '#10b981' }}>
                                Cible : {comp.plannedEvent.metadata.targetHeartRateRange[0]}-{comp.plannedEvent.metadata.targetHeartRateRange[1]} bpm
                              </div>
                            )}
                          </div>
                        ) : comp.plannedEvent?.metadata?.targetHeartRate ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Cible : {comp.plannedEvent.metadata.targetHeartRate}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Dénivelé D+ & D- */}
                      <td>
                        {(() => {
                          const isPlannedTrailOrRun = comp.plannedEvent && (
                            comp.plannedEvent.sportType === 'TRAIL_INTENSE' ||
                            comp.plannedEvent.sportType === 'TRAIL_LONG' ||
                            comp.plannedEvent.sportType === 'RUN_EASY' ||
                            isTrailOrRunning(comp.plannedEvent) ||
                            Boolean(comp.plannedEvent.metadata?.targetElevationM && comp.plannedEvent.metadata.targetElevationM > 0)
                          );
                          const isStrength = !isPlannedTrailOrRun && (
                            (comp.plannedEvent && isStrengthOrCalisthenics(comp.plannedEvent)) ||
                            (comp.actualActivity && isStrengthOrCalisthenics(comp.actualActivity) && !isTrailOrRunning(comp.actualActivity))
                          );
                          if (isStrength) {
                            return <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>-- (Force)</span>;
                          }
                          if (comp.actualActivity?.elevationGainM !== undefined) {
                            return (
                              <div>
                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                  +{comp.actualActivity.elevationGainM} m
                                </span>
                                {comp.actualActivity.elevationLossM ? (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', marginLeft: 4, fontWeight: 600 }}>
                                    / -{comp.actualActivity.elevationLossM} m
                                  </span>
                                ) : null}
                                {comp.plannedEvent?.metadata?.targetElevationM && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    Cible : +{comp.plannedEvent.metadata.targetElevationM} m
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (comp.plannedEvent?.metadata?.targetElevationM) {
                            return (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Cible : +{comp.plannedEvent.metadata.targetElevationM}m
                              </span>
                            );
                          }
                          return <span style={{ color: 'var(--text-muted)' }}>--</span>;
                        })()}
                      </td>

                      {/* Charge TRIMP */}
                      <td>
                        {actualTrimp ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{
                                fontWeight: 800,
                                color: actualTrimp.isRealTelemetry ? '#38bdf8' : 'var(--text-primary)',
                                fontSize: '0.84rem'
                              }}>
                                ⚡ {actualTrimp.trimp} TRIMP
                              </span>
                              {actualTrimp.isRealTelemetry && (
                                <span
                                  style={{
                                    fontSize: '0.62rem',
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    fontWeight: 700
                                  }}
                                  title="Calculé via FC réelle Banister (réserve cardiaque)"
                                >
                                  Cardio
                                </span>
                              )}
                            </div>
                            {plannedTrimp && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                Prévu : {plannedTrimp.trimp} TRIMP{' '}
                                {actualTrimp.trimp !== plannedTrimp.trimp && (
                                  <span style={{
                                    fontWeight: 700,
                                    color: actualTrimp.trimp > plannedTrimp.trimp ? '#f59e0b' : '#34d399'
                                  }}>
                                    ({actualTrimp.trimp > plannedTrimp.trimp ? '+' : ''}{actualTrimp.trimp - plannedTrimp.trimp})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : plannedTrimp ? (
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              Prévu : {plannedTrimp.trimp} TRIMP
                            </span>
                            <div style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600, marginTop: 1 }}>
                              Réalisé : 0 TRIMP
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Statut */}
                      <td>{getStatusBadge(comp.status, comp.complianceScore)}</td>

                      {/* Actions & Diagnostic */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                            {comp.feedbackNotes[0]}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {/* Bouton Reporter Séance (pour les séances manquées ou en attente) */}
                            {comp.plannedEvent && (comp.status === 'MISSED' || comp.status === 'PENDING') && onPostponeWorkout && (
                              <button
                                className="btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const origDate = comp.plannedEvent?.metadata?.originalDate || toLocalDateKey(comp.plannedEvent!.startDate);
                                  const todayStr = referenceDateStr || formatDateKey(new Date());
                                  let targetDate = todayStr;
                                  if (origDate >= todayStr) {
                                    targetDate = toLocalDateKey(addDays(parseLocalDate(todayStr), 1));
                                  }
                                  onPostponeWorkout(comp.plannedEvent!.id, origDate, targetDate, 'Reporté depuis la télémétrie');
                                }}
                                style={{ padding: '3px 6px', fontSize: '0.68rem', color: 'var(--primary)', borderColor: 'var(--primary-border)', display: 'flex', alignItems: 'center', gap: 3 }}
                                title="Reporter la séance à aujourd'hui / demain"
                              >
                                <CalendarClock size={11} /> Reporter
                              </button>
                            )}

                            {/* Bouton Appairage Manuel */}
                            {planId && onManualPair && (
                              <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                                {isManuallyPaired ? (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => onManualUnpair && onManualUnpair(planId)}
                                    style={{ padding: '3px 6px', fontSize: '0.68rem', color: '#f87171' }}
                                    title="Délier l'appairage manuel"
                                  >
                                    <Unlink size={11} /> Délier
                                  </button>
                                ) : (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => setPairingForPlanId(pairingForPlanId === planId ? null : planId)}
                                    style={{ padding: '3px 6px', fontSize: '0.68rem', color: 'var(--accent-blue)' }}
                                    title="Associer avec une activité Garmin"
                                  >
                                    <Link2 size={11} /> Lier
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Ligne Déroulante de Détail */}
                    {isExpanded && (
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        <td colSpan={8} style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Décomposition Charge TRIMP */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '8px',
                              background: actualTrimp ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                              border: actualTrimp ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid var(--border-color)',
                              borderRadius: 6,
                              padding: '8px 12px',
                              fontSize: '0.76rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Zap size={14} color={actualTrimp ? '#38bdf8' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 700, color: actualTrimp ? '#38bdf8' : 'var(--text-primary)' }}>
                                  {actualTrimp ? `Charge Exécutée : ${actualTrimp.trimp} TRIMP` : `Charge Prévue : ${plannedTrimp?.trimp || 0} TRIMP`}
                                </span>
                                {actualTrimp && plannedTrimp && (
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    (Objectif initial : {plannedTrimp.trimp} TRIMP • Écart : {actualTrimp.trimp - plannedTrimp.trimp > 0 ? `+${actualTrimp.trimp - plannedTrimp.trimp}` : actualTrimp.trimp - plannedTrimp.trimp} TRIMP)
                                  </span>
                                )}
                              </div>
                              {actualTrimp && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                                  {actualTrimp.formulaText} {actualTrimp.details && `• ${actualTrimp.details}`}
                                </div>
                              )}
                            </div>

                            {/* Décomposition des activités combinées */}
                            {comp.isMergedExecution && comp.subActivities && comp.subActivities.length > 1 && (
                              <div style={{
                                background: 'rgba(245, 158, 11, 0.06)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                borderRadius: 6,
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6
                              }}>
                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <Zap size={13} />
                                  <span>Décomposition des {comp.subActivities.length} activités consolidées :</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {comp.subActivities.map((sub, sIdx) => {
                                    const timePart = sub.startTimeLocal?.split('T')[1]?.slice(0, 5) || '';
                                    return (
                                      <div
                                        key={sub.activityId || sIdx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          background: 'rgba(0, 0, 0, 0.25)',
                                          padding: '5px 10px',
                                          borderRadius: 4,
                                          fontSize: '0.74rem'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>#{sIdx + 1}</span>
                                          {timePart && <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{timePart}</span>}
                                          <span style={{ color: '#fff', fontWeight: 600 }}>{sub.activityName}</span>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({sub.activityType})</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                                          <span><strong>{sub.durationMinutes}m</strong></span>
                                          {sub.distanceKm ? <span>{sub.distanceKm.toFixed(1)} km</span> : null}
                                          {sub.avgPaceMinKm ? <span style={{ color: 'var(--accent-blue)' }}>⚡ {sub.avgPaceMinKm}</span> : null}
                                          {sub.elevationGainM ? <span>+{sub.elevationGainM}m</span> : null}
                                          {sub.avgHeartRate ? <span><Heart size={10} style={{ display: 'inline', marginRight: 2 }} />{sub.avgHeartRate} bpm</span> : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Détail & Diagnostics Coach :
                            </div>
                            <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {comp.feedbackNotes.map((n, i) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>

                            {/* Sélecteur d'appairage manuel */}
                            {pairingForPlanId === planId && (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{
                                  marginTop: 8,
                                  padding: 12,
                                  borderRadius: 'var(--radius-xs)',
                                  background: 'var(--bg-surface-elevated)',
                                  border: '1px solid var(--primary-border)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>
                                    Sélectionner une activité Garmin à appairer avec cette séance :
                                  </span>
                                  <button
                                    onClick={() => setPairingForPlanId(null)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                {availableGarminActivities.length === 0 ? (
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    Aucune activité Garmin disponible. Synchronise ta montre d'abord.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                                    {availableGarminActivities.map(act => (
                                      <div
                                        key={act.activityId}
                                        onClick={() => {
                                          onManualPair && onManualPair(planId, act.activityId);
                                          setPairingForPlanId(null);
                                        }}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '6px 10px',
                                          background: 'rgba(255, 255, 255, 0.03)',
                                          borderRadius: 4,
                                          fontSize: '0.74rem',
                                          cursor: 'pointer'
                                        }}
                                        className="btn-hover-effect"
                                      >
                                        <span>
                                          <strong>{act.activityName}</strong> ({act.activityType}) • {toLocalDateKey(act.startTimeLocal)}
                                        </span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                          {act.durationMinutes} min {act.elevationGainM ? `• +${act.elevationGainM}m` : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Vue Cartes Compactes */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedComparisons.map(comp => {
            const planId = comp.plannedEvent?.id;
            const isManuallyPaired = Boolean(planId && manualPairs[planId]);

            const actualTrimp = comp.actualActivity ? calculateSessionTrimp(
              comp.actualActivity.durationMinutes,
              comp.actualActivity.activityType,
              comp.actualActivity.activityName,
              comp.actualActivity.trainingLoad,
              {
                avgHeartRate: comp.actualActivity.avgHeartRate,
                maxHeartRate: comp.actualActivity.maxHeartRate,
                elevationGainM: comp.actualActivity.elevationGainM,
                distanceKm: comp.actualActivity.distanceKm,
                athleteFcMax: profile.fcMax,
                athleteFcRest: profile.fcRest
              }
            ) : null;

            return (
              <article key={comp.id} className="surface-panel session-card">
                <div className="session-card-heading">
                  <div>
                    <h2>{comp.actualActivity
                      ? formatGarminActivityName(comp.actualActivity.activityName, comp.plannedEvent?.title, comp.actualActivity.activityType)
                      : comp.plannedEvent?.title.replace(/^[^\p{L}\p{N}]+/u, '')}</h2>
                    <p>
                      {parseLocalDate(comp.date).toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {comp.isMergedExecution && comp.subActivities && comp.subActivities.length > 1 &&
                        ` · ${comp.subActivities.length} activités combinées`}
                      {comp.isPostponedCatchup && comp.scheduledDate &&
                        ` · prévue le ${parseLocalDate(comp.scheduledDate).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })}`}
                    </p>
                  </div>
                  {getStatusBadge(comp.status, comp.complianceScore)}
                </div>
                <div className="session-card-actions">

                    {comp.plannedEvent && (comp.status === 'MISSED' || comp.status === 'PENDING') && onPostponeWorkout && (
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          const origDate = comp.plannedEvent?.metadata?.originalDate || toLocalDateKey(comp.plannedEvent!.startDate);
                          const todayStr = referenceDateStr || formatDateKey(new Date());
                          let targetDate = todayStr;
                          if (origDate >= todayStr) {
                            targetDate = toLocalDateKey(addDays(parseLocalDate(todayStr), 1));
                          }
                          onPostponeWorkout(comp.plannedEvent!.id, origDate, targetDate, 'Reporté depuis la télémétrie');
                        }}
                        title="Reporter cette séance"
                      >
                        <CalendarClock size={12} /> Reporter
                      </button>
                    )}

                    {planId && onManualPair && (
                      isManuallyPaired ? (
                        <button
                          className="btn-secondary"
                          onClick={() => onManualUnpair && onManualUnpair(planId)}
                          title="Délier l'activité"
                          aria-label="Délier l’activité"
                        >
                          <Unlink size={12} />
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          onClick={() => setPairingForPlanId(pairingForPlanId === planId ? null : planId)}
                          title="Associer avec une activité Garmin"
                        >
                          <Link2 size={12} /> Lier
                        </button>
                      )
                    )}
                </div>

                <dl className="session-card-metrics">
                  {(comp.actualActivity || comp.plannedEvent) && (
                    <div><dt>Durée {comp.actualActivity ? 'réalisée' : 'prévue'}</dt>
                      <dd>{comp.actualActivity?.durationMinutes ?? comp.plannedEvent?.durationMinutes} min
                        {comp.actualActivity && comp.plannedEvent && <small>/ {comp.plannedEvent.durationMinutes} min prévues</small>}
                      </dd>
                    </div>
                  )}
                  {comp.actualActivity?.distanceKm != null && (
                    <div><dt>Distance</dt><dd>{comp.actualActivity.distanceKm.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} km</dd></div>
                  )}
                  {comp.actualActivity?.elevationGainM != null && (
                    <div><dt>Dénivelé +</dt><dd>{comp.actualActivity.elevationGainM.toLocaleString('fr-CA')} m</dd></div>
                  )}
                </dl>
                {comp.actualActivity && (comp.actualActivity.avgHeartRate || comp.actualActivity.avgPaceMinKm || actualTrimp) && (
                  <details className="session-card-detail">
                    <summary>Mesures de la séance</summary>
                    <dl className="session-card-metrics">
                      {comp.actualActivity.avgPaceMinKm && <div><dt>Allure</dt><dd>{comp.actualActivity.avgPaceMinKm}</dd></div>}
                      {comp.actualActivity.avgHeartRate && <div><dt>FC moyenne</dt><dd>{comp.actualActivity.avgHeartRate} bpm
                        {comp.actualActivity.maxHeartRate && <small>Max. {comp.actualActivity.maxHeartRate} bpm</small>}</dd></div>}
                      {comp.actualActivity.trainingLoad != null
                        ? <div><dt>Charge Garmin</dt><dd>{comp.actualActivity.trainingLoad}</dd></div>
                        : actualTrimp && <div><dt>Charge estimée</dt><dd>{actualTrimp.trimp} TRIMP</dd></div>}
                    </dl>
                  </details>
                )}


                {comp.isMergedExecution && comp.subActivities && comp.subActivities.length > 1 && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={12} /> Décomposition ({comp.subActivities.length} activités combinées) :
                    </div>
                    {comp.subActivities.map((sub, sIdx) => {
                      const timePart = sub.startTimeLocal?.split('T')[1]?.slice(0, 5) || '';
                      return (
                        <div
                          key={sub.activityId || sIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.2)',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: '0.72rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ color: 'var(--text-muted)' }}>#{sIdx + 1}</span>
                            {timePart && <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{timePart}</span>}
                            <span style={{ color: '#fff', fontWeight: 600 }}>{sub.activityName}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                            <span><strong>{sub.durationMinutes}m</strong></span>
                            {sub.distanceKm ? <span>{sub.distanceKm.toFixed(1)} km</span> : null}
                            {sub.elevationGainM ? <span>+{sub.elevationGainM}m</span> : null}
                            {sub.avgHeartRate ? <span><Heart size={9} style={{ display: 'inline', marginRight: 2 }} />{sub.avgHeartRate} bpm</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: 4 }}>
                  {comp.feedbackNotes[0]}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
