import React, { useState } from 'react';
import { ActivityComparison, GarminActivity, GarminSyncState } from '../types/garmin';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  FileSpreadsheet,
  Filter,
  Flame,
  Heart,
  HelpCircle,
  Info,
  Layers,
  LayoutGrid,
  Link2,
  PlusCircle,
  RefreshCw,
  Sliders,
  TrendingDown,
  TrendingUp,
  Unlink,
  X,
  XCircle,
  Zap
} from 'lucide-react';

interface ComparisonDashboardProps {
  comparisons: ActivityComparison[];
  garminState: GarminSyncState;
  onOpenGarminSync: () => void;
  availableGarminActivities?: GarminActivity[];
  manualPairs?: Record<string, string>;
  onManualPair?: (planId: string, garminActivityId: string) => void;
  onManualUnpair?: (planId: string) => void;
}

type StatusFilterType = 'ALL' | 'COMPLIANT' | 'PARTIAL' | 'MISSED' | 'UNPLANNED' | 'PENDING';

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({
  comparisons,
  garminState,
  onOpenGarminSync,
  availableGarminActivities = [],
  manualPairs = {},
  onManualPair,
  onManualUnpair
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [pairingForPlanId, setPairingForPlanId] = useState<string | null>(null);

  // Compteurs
  const countAll = comparisons.length;
  const countCompliant = comparisons.filter(c => c.status === 'COMPLIANT').length;
  const countPartial = comparisons.filter(c => c.status === 'PARTIAL').length;
  const countMissed = comparisons.filter(c => c.status === 'MISSED').length;
  const countUnplanned = comparisons.filter(c => c.status === 'UNPLANNED').length;
  const countPending = comparisons.filter(c => c.status === 'PENDING').length;

  // Filtrage selon le statut actif
  const displayedComparisons = comparisons.filter(c => {
    if (statusFilter === 'ALL') return true;
    return c.status === statusFilter;
  });

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
            <XCircle size={12} /> Non réalisée
          </span>
        );
      case 'UNPLANNED':
        return (
          <span className="status-pill status-unplanned">
            <PlusCircle size={12} /> Bonus
          </span>
        );
      case 'PENDING':
        return (
          <span className="status-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <Clock size={12} /> Aujourd'hui (En attente)
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
            Musculation
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Barre d'Informations Supérieure */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.78rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={15} color="var(--primary)" />
          <span>
            <strong style={{ color: '#fff' }}>Journal de Télémétrie Garmin :</strong> Affichage de {displayedComparisons.length} sur {countAll} séance(s) évaluée(s).
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
          >
            {viewMode === 'table' ? <LayoutGrid size={12} /> : <FileSpreadsheet size={12} />}
            <span>{viewMode === 'table' ? 'Vue Cartes' : 'Vue Tableau Pro'}</span>
          </button>

          <button
            onClick={onOpenGarminSync}
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
          >
            <RefreshCw size={12} />
            <span>Synchro Garmin</span>
          </button>
        </div>
      </div>

      {/* Boutons de Filtre par Statut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} /> Statut :
        </span>

        <button
          className={`btn-secondary ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'ALL' ? 'var(--primary)' : undefined }}
        >
          Toutes ({countAll})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'COMPLIANT' ? 'active' : ''}`}
          onClick={() => setStatusFilter('COMPLIANT')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'COMPLIANT' ? '#10b981' : undefined }}
        >
          ✅ Conformes ({countCompliant})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'PARTIAL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('PARTIAL')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'PARTIAL' ? '#f59e0b' : undefined }}
        >
          ⚠️ Écarts ({countPartial})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'MISSED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('MISSED')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'MISSED' ? '#ef4444' : undefined }}
        >
          ❌ Manquées ({countMissed})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'UNPLANNED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('UNPLANNED')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'UNPLANNED' ? '#38bdf8' : undefined }}
        >
          ➕ Bonus ({countUnplanned})
        </button>

        {countPending > 0 && (
          <button
            className={`btn-secondary ${statusFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
            style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'PENDING' ? '#818cf8' : undefined }}
          >
            ⏳ Aujourd'hui ({countPending})
          </button>
        )}
      </div>

      {/* État vide si aucune séance ne correspond */}
      {displayedComparisons.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255, 87, 34, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {statusFilter === 'ALL' ? 'Aucune activité disponible' : `Aucune séance trouvée avec le statut "${statusFilter.toLowerCase()}"`}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
              {statusFilter === 'ALL'
                ? 'Synchronise avec Garmin Connect ou importe une trace GPX pour activer la comparaison télémétrique.'
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
              <span>⚡ Connecter un compte Garmin</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Tableau Pro Haute Densité */
        <div className="pro-table-wrapper">
          <table className="pro-table">
            <thead>
              <tr>
                <th>Date & Séance Prévue</th>
                <th>Activité Enregistrée Garmin</th>
                <th>Durée</th>
                <th>Fréquence Cardiaque</th>
                <th>Dénivelé D+</th>
                <th>Concordance</th>
                <th>Actions & Évaluation</th>
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
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>
                              {comp.plannedEvent?.title.replace(/^[^a-zA-Z0-9\[]*/, '') || 'Activité Bonus'}
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
                                {comp.actualActivity.activityName}
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
                        {comp.actualActivity?.elevationGainM !== undefined ? (
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
                        ) : comp.plannedEvent?.metadata?.targetElevationM ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Cible : +{comp.plannedEvent.metadata.targetElevationM}m
                          </span>
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
                      </td>
                    </tr>

                    {/* Ligne Déroulante de Détail */}
                    {isExpanded && (
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        <td colSpan={7} style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                          <strong>{act.activityName}</strong> ({act.activityType}) • {act.startTimeLocal.slice(0, 10)}
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

            return (
              <div
                key={comp.id}
                className="glass-panel"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderLeft: comp.status === 'MISSED' ? '3px solid #ef4444' : comp.status === 'COMPLIANT' ? '3px solid #10b981' : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>{comp.plannedEvent?.emoji || '⌚'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{comp.actualActivity?.activityName || comp.plannedEvent?.title}</span>
                        {getActivityTypeBadge(comp.actualActivity?.activityType)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {comp.date} {comp.plannedEvent && `• Prescrit : ${comp.plannedEvent.title}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getStatusBadge(comp.status, comp.complianceScore)}
                    {planId && onManualPair && (
                      isManuallyPaired ? (
                        <button
                          className="btn-secondary"
                          onClick={() => onManualUnpair && onManualUnpair(planId)}
                          style={{ padding: '3px 6px', fontSize: '0.68rem', color: '#f87171' }}
                        >
                          <Unlink size={11} />
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          onClick={() => setPairingForPlanId(pairingForPlanId === planId ? null : planId)}
                          style={{ padding: '3px 6px', fontSize: '0.68rem', color: 'var(--accent-blue)' }}
                        >
                          <Link2 size={11} /> Lier
                        </button>
                      )
                    )}
                  </div>
                </div>

                {comp.actualActivity ? (
                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: 6 }}>
                    <div>
                      <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                      Durée : <strong>{comp.actualActivity.durationMinutes} min</strong> {comp.plannedEvent && `(écart ${comp.durationDeltaMinutes > 0 ? '+' : ''}${comp.durationDeltaMinutes}m)`}
                    </div>
                    {comp.actualActivity.avgPaceMinKm && (
                      <div style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                        ⚡ Allure : <strong>{comp.actualActivity.avgPaceMinKm}</strong>
                      </div>
                    )}
                    {comp.actualActivity.avgHeartRate && (
                      <div>
                        <Heart size={11} style={{ display: 'inline', marginRight: 3 }} />
                        FC : <strong>{comp.actualActivity.avgHeartRate} bpm</strong> (max {comp.actualActivity.maxHeartRate})
                      </div>
                    )}
                    {comp.actualActivity.elevationGainM !== undefined && (
                      <div>
                        <Compass size={11} style={{ display: 'inline', marginRight: 3 }} />
                        D+ / D- : <strong>+{comp.actualActivity.elevationGainM}m</strong> {comp.actualActivity.elevationLossM ? <span style={{ color: 'var(--accent-blue)' }}>(-{comp.actualActivity.elevationLossM}m)</span> : null}
                      </div>
                    )}
                    {comp.actualActivity.trainingEffectLabel && (
                      <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        <Zap size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {comp.actualActivity.trainingEffectLabel} {comp.actualActivity.trainingLoad ? `(Load ${comp.actualActivity.trainingLoad})` : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: comp.status === 'MISSED' ? '#f87171' : 'var(--accent-blue)', fontStyle: 'italic' }}>
                    {comp.status === 'MISSED' ? 'Séance prescrite mais non enregistrée sur la montre.' : 'Prévue aujourd\'hui — synchroniser la montre après la séance.'}
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: 4 }}>
                  {comp.feedbackNotes[0]}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
