import React, { useState } from 'react';
import { ActivityComparison, GarminSyncState } from '../types/garmin';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  Heart,
  LayoutGrid,
  PlusCircle,
  RefreshCw,
  Tag,
  XCircle
} from 'lucide-react';

interface ComparisonDashboardProps {
  comparisons: ActivityComparison[];
  garminState: GarminSyncState;
  onOpenGarminSync: () => void;
}

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({
  comparisons,
  garminState,
  onOpenGarminSync
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Show only already done sessions (sessions with recorded actualActivity)
  const displayedComparisons = comparisons.filter(c => c.actualActivity !== undefined);

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
            <strong style={{ color: '#fff' }}>Garmin Telemetry Log:</strong> Showing {displayedComparisons.length} completed workout(s) evaluated against prescribed training targets.
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

      {displayedComparisons.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255, 87, 34, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              No Garmin Activities Synchronized Yet
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
              Connect your Garmin Connect account or enter your credentials to pull your real training telemetry directly via the Garmin API.
            </p>
          </div>
          <button className="btn-primary" onClick={onOpenGarminSync} style={{ padding: '9px 16px', marginTop: 4 }}>
            <RefreshCw size={14} />
            <span>⚡ Synchronize with Garmin API</span>
          </button>
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
                <th>Coach Assessment</th>
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

                return (
                  <React.Fragment key={comp.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : comp.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Date & Plan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>
                            {comp.plannedEvent?.emoji || '📅'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>
                              {comp.plannedEvent?.title.replace(/^[^a-zA-Z0-9\[]*/, '') || 'Free Activity'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {dateFormatted} • {comp.plannedEvent?.durationMinutes || comp.actualActivity?.durationMinutes || '--'} min target
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Garmin Actual Activity */}
                      <td>
                        {comp.actualActivity && (
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
                          </div>
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
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>{getStatusBadge(comp.status, comp.complianceScore)}</td>

                      {/* Feedback snippet */}
                      <td style={{ maxWidth: 280 }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {comp.feedbackNotes[0]}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable row detail */}
                    {isExpanded && (
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        <td colSpan={7} style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Detailed Breakdown & Coach Advice:
                            </div>
                            <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {comp.feedbackNotes.map((n, i) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>
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
          {displayedComparisons.map(comp => (
            <div
              key={comp.id}
              className="glass-panel"
              style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
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
                <div>{getStatusBadge(comp.status, comp.complianceScore)}</div>
              </div>

              {comp.actualActivity && (
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
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: 4 }}>
                {comp.feedbackNotes[0]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
