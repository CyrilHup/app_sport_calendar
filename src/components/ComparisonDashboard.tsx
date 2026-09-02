import React, { useState } from 'react';
import { ActivityComparison, GarminSyncState } from '../types/garmin';
import {
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

  const otherCount = comparisons.filter(c => c.actualActivity?.activityType === 'OTHER' || c.inferredType).length;

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
          <span className="status-pill" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <Clock size={12} /> Scheduled (Pending)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Informative 'OTHER' category bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '8px 14px',
          background: 'rgba(168, 85, 247, 0.08)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.78rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag size={15} color="#c084fc" />
          <span>
            <strong>Garmin "Other" Profile Parsing:</strong> {otherCount} session(s) logged under Garmin's generic "Other" profile were matched using physiological signatures (elevation D+, duration, heart rate).
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

      {/* Pro High-Density Table View */}
      {viewMode === 'table' ? (
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
              {comparisons.map(comp => {
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
                              {dateFormatted} • {comp.plannedEvent?.durationMinutes || '--'} min target
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
                              {isOther && (
                                <span className="other-badge">
                                  Other
                                </span>
                              )}
                            </div>
                            {comp.inferredType && (
                              <div style={{ fontSize: '0.68rem', color: '#c084fc' }}>
                                Signature: {comp.inferredType}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>
                            Not recorded
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
                                color: Math.abs(comp.durationDeltaMinutes) <= 5 ? '#00e676' : (comp.durationDeltaMinutes > 0 ? '#38bdf8' : '#fbbf24')
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
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                              (Max {comp.actualActivity.maxHeartRate || '--'})
                            </span>
                            {comp.plannedEvent?.metadata?.targetHeartRateRange && (
                              <div style={{ fontSize: '0.68rem', color: comp.heartRateCompliance === 'OPTIMAL' ? '#00e676' : '#fbbf24' }}>
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
                            <span style={{ fontWeight: 700, color: '#ff8c5a' }}>
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
          {comparisons.map(comp => (
            <div
              key={comp.id}
              className="glass-panel"
              style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>{comp.plannedEvent?.emoji || '⌚'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {comp.plannedEvent?.title || comp.actualActivity?.activityName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {comp.date} {comp.actualActivity && `• ${comp.actualActivity.activityName}`}
                    </div>
                  </div>
                </div>
                <div>{getStatusBadge(comp.status, comp.complianceScore)}</div>
              </div>

              {comp.actualActivity && (
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: 6 }}>
                  <div>
                    <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                    Duration: <strong>{comp.actualActivity.durationMinutes} min</strong> (delta {comp.durationDeltaMinutes > 0 ? '+' : ''}{comp.durationDeltaMinutes}m)
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
