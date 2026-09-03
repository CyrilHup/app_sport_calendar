import React, { useState } from 'react';
import { ActivityComparison, GarminActivity, GarminSyncState } from '../types/garmin';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  Filter,
  Heart,
  LayoutGrid,
  Link2,
  PlusCircle,
  RefreshCw,
  Tag,
  Unlink,
  X,
  XCircle
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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pairingForPlanId, setPairingForPlanId] = useState<string | null>(null);

  // Counts for each status category
  const countAll = comparisons.length;
  const countCompliant = comparisons.filter(c => c.status === 'COMPLIANT').length;
  const countPartial = comparisons.filter(c => c.status === 'PARTIAL').length;
  const countMissed = comparisons.filter(c => c.status === 'MISSED').length;
  const countUnplanned = comparisons.filter(c => c.status === 'UNPLANNED').length;
  const countPending = comparisons.filter(c => c.status === 'PENDING').length;

  // Filter comparisons according to active status chip
  const displayedComparisons = comparisons.filter(c => {
    if (statusFilter === 'ALL') return true;
    return c.status === statusFilter;
  });

  const getStatusBadge = (status: string, score: number) => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <span className="status-pill status-compliant">
            <CheckCircle2 size={12} /> Compliant ({score}%)
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="status-pill status-partial">
            <AlertTriangle size={12} /> Variance ({score}%)
          </span>
        );
      case 'MISSED':
        return (
          <span className="status-pill status-missed">
            <XCircle size={12} /> Missed
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
            <Clock size={12} /> Today (Pending)
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
            Run
          </span>
        );
      case 'STRENGTH_TRAINING':
      case 'FITNESS_EQUIPMENT':
        return (
          <span className="badge-tag" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)', fontSize: '0.65rem' }}>
            Strength
          </span>
        );
      case 'OTHER':
        return (
          <span className="other-badge">
            Other
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Informative Header Bar */}
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
            <strong style={{ color: '#fff' }}>Garmin Telemetry Log:</strong> Showing {displayedComparisons.length} of {countAll} evaluated session(s).
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
          >
            {viewMode === 'table' ? <LayoutGrid size={12} /> : <FileSpreadsheet size={12} />}
            <span>{viewMode === 'table' ? 'Card View' : 'Pro Table View'}</span>
          </button>

          <button
            onClick={onOpenGarminSync}
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
          >
            <RefreshCw size={12} />
            <span>Garmin Sync</span>
          </button>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} /> Status:
        </span>

        <button
          className={`btn-secondary ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'ALL' ? 'var(--primary)' : undefined }}
        >
          All ({countAll})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'COMPLIANT' ? 'active' : ''}`}
          onClick={() => setStatusFilter('COMPLIANT')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'COMPLIANT' ? '#10b981' : undefined }}
        >
          ✅ Compliant ({countCompliant})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'PARTIAL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('PARTIAL')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'PARTIAL' ? '#f59e0b' : undefined }}
        >
          ⚠️ Variance ({countPartial})
        </button>

        <button
          className={`btn-secondary ${statusFilter === 'MISSED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('MISSED')}
          style={{ padding: '4px 9px', fontSize: '0.74rem', borderColor: statusFilter === 'MISSED' ? '#ef4444' : undefined }}
        >
          ❌ Missed ({countMissed})
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
            ⏳ Today ({countPending})
          </button>
        )}
      </div>

      {/* Empty State when no workouts match filter */}
      {displayedComparisons.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255, 87, 34, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {statusFilter === 'ALL' ? 'No Activities Available' : `No ${statusFilter.toLowerCase()} sessions found`}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
              {statusFilter === 'ALL'
                ? 'Synchronize with Garmin Connect or import a GPX track to start telemetry matching.'
                : 'Try choosing another filter above or reset to "All".'}
            </p>
          </div>
          {statusFilter !== 'ALL' ? (
            <button className="btn-secondary" onClick={() => setStatusFilter('ALL')} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              Reset Filter to All
            </button>
          ) : (
            <button className="btn-primary" onClick={onOpenGarminSync} style={{ padding: '9px 16px', marginTop: 4 }}>
              <RefreshCw size={14} />
              <span>⚡ Connect Garmin Account</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Pro High-Density Table View */
        <div className="pro-table-wrapper">
          <table className="pro-table">
            <thead>
              <tr>
                <th>Date & Prescribed Session</th>
                <th>Garmin Logged Activity</th>
                <th>Duration</th>
                <th>Heart Rate (bpm)</th>
                <th>Elevation Gain</th>
                <th>Compliance</th>
                <th>Actions & Assessment</th>
              </tr>
            </thead>
            <tbody>
              {displayedComparisons.map(comp => {
                const dateObj = new Date(comp.date + 'T12:00:00');
                const dateFormatted = dateObj.toLocaleDateString('en-US', {
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
                              {comp.plannedEvent?.title.replace(/^[^a-zA-Z0-9\[]*/, '') || 'Bonus Activity'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {dateFormatted} • {comp.plannedEvent?.durationMinutes || comp.actualActivity?.durationMinutes || '--'} min target
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Garmin Actual Activity */}
                      <td>
                        {comp.actualActivity ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {comp.actualActivity.activityName}
                              </span>
                              {getActivityTypeBadge(comp.actualActivity.activityType)}
                            </div>
                            {isOther && comp.inferredType && (
                              <div style={{ fontSize: '0.68rem', color: '#c084fc' }}>
                                Inferred profile: {comp.inferredType}
                              </div>
                            )}
                            {isManuallyPaired && (
                              <span style={{ fontSize: '0.65rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                <Link2 size={10} /> Paired manually
                              </span>
                            )}
                          </div>
                        ) : comp.status === 'PENDING' ? (
                          <span style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontStyle: 'italic' }}>
                            Scheduled for today — Pending upload
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#f87171', fontStyle: 'italic' }}>
                            Not recorded on Garmin watch
                          </span>
                        )}
                      </td>

                      {/* Duration Comparison */}
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
                          </div>
                        ) : comp.actualActivity ? (
                          <span>{comp.actualActivity.durationMinutes} min</span>
                        ) : comp.plannedEvent ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            0m / {comp.plannedEvent.durationMinutes}m
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Heart Rate */}
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
                                Target: {comp.plannedEvent.metadata.targetHeartRateRange[0]}-{comp.plannedEvent.metadata.targetHeartRateRange[1]} bpm
                              </div>
                            )}
                          </div>
                        ) : comp.plannedEvent?.metadata?.targetHeartRate ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Target: {comp.plannedEvent.metadata.targetHeartRate}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Elevation D+ */}
                      <td>
                        {comp.actualActivity?.elevationGainM !== undefined ? (
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              +{comp.actualActivity.elevationGainM} m
                            </span>
                            {comp.plannedEvent?.metadata?.targetElevationM && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                                / +{comp.plannedEvent.metadata.targetElevationM} m
                              </span>
                            )}
                          </div>
                        ) : comp.plannedEvent?.metadata?.targetElevationM ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Target: +{comp.plannedEvent.metadata.targetElevationM}m
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>{getStatusBadge(comp.status, comp.complianceScore)}</td>

                      {/* Actions & Feedback snippet */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                            {comp.feedbackNotes[0]}
                          </div>

                          {/* Manual Pairing Actions */}
                          {planId && onManualPair && (
                            <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                              {isManuallyPaired ? (
                                <button
                                  className="btn-secondary"
                                  onClick={() => onManualUnpair && onManualUnpair(planId)}
                                  style={{ padding: '3px 6px', fontSize: '0.68rem', color: '#f87171' }}
                                  title="Unpair manual link"
                                >
                                  <Unlink size={11} /> Unpair
                                </button>
                              ) : (
                                <button
                                  className="btn-secondary"
                                  onClick={() => setPairingForPlanId(pairingForPlanId === planId ? null : planId)}
                                  style={{ padding: '3px 6px', fontSize: '0.68rem', color: 'var(--accent-blue)' }}
                                  title="Pair with a Garmin activity"
                                >
                                  <Link2 size={11} /> Pair
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable row detail */}
                    {isExpanded && (
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        <td colSpan={7} style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Detailed Breakdown & Coach Diagnostics:
                            </div>
                            <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {comp.feedbackNotes.map((n, i) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>

                            {/* Inline Manual Pairing Selector if active for this plan */}
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
                                    Select Garmin Activity to pair with this session:
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
                                    No Garmin activities available. Sync your watch first.
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
        /* Compact Card View */
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
                        {comp.date} {comp.plannedEvent && `• Prescribed: ${comp.plannedEvent.title}`}
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
                          <Link2 size={11} /> Pair
                        </button>
                      )
                    )}
                  </div>
                </div>

                {comp.actualActivity ? (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: 6 }}>
                    <div>
                      <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                      Duration: <strong>{comp.actualActivity.durationMinutes} min</strong> {comp.plannedEvent && `(delta ${comp.durationDeltaMinutes > 0 ? '+' : ''}${comp.durationDeltaMinutes}m)`}
                    </div>
                    {comp.actualActivity.avgHeartRate && (
                      <div>
                        <Heart size={11} style={{ display: 'inline', marginRight: 3 }} />
                        Heart Rate: <strong>{comp.actualActivity.avgHeartRate} bpm</strong> (max {comp.actualActivity.maxHeartRate})
                      </div>
                    )}
                    {comp.actualActivity.elevationGainM !== undefined && (
                      <div>
                        <Compass size={11} style={{ display: 'inline', marginRight: 3 }} />
                        Elevation Gain: <strong>+{comp.actualActivity.elevationGainM} m</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: comp.status === 'MISSED' ? '#f87171' : 'var(--accent-blue)', fontStyle: 'italic' }}>
                    {comp.status === 'MISSED' ? 'Session prescribed but no matching workout recorded.' : 'Scheduled for today — upload workout to compare.'}
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
