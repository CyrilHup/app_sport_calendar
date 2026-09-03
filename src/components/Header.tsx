import React from 'react';
import { Activity, Award, Calendar, ChevronRight, Clock, Compass, Flame, RefreshCw, ShieldAlert, TrendingUp, Zap } from 'lucide-react';
import { PeriodizationContext } from '../types/calendar';
import { GarminSyncState } from '../types/garmin';
import { WeeklyStatsSummary } from '../services/comparisonEngine';

interface HeaderProps {
  periodContext: PeriodizationContext;
  garminState: GarminSyncState;
  weeklyStats: WeeklyStatsSummary;
  onOpenGarmin: () => void;
  onOpenGoogleCalendar: () => void;
  onRefreshAll: () => void;
  isRecharging: boolean;
  lastSyncTime?: string;
  onSelectPeriodizationTab?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  periodContext,
  garminState,
  weeklyStats,
  onOpenGarmin,
  onOpenGoogleCalendar,
  onRefreshAll,
  isRecharging,
  lastSyncTime,
  onSelectPeriodizationTab
}) => {
  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Live';

  const formatHoursMin = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  return (
    <header className="app-header">
      {/* Top Brand & Actions Bar */}
      <div className="header-top">
        <div className="brand-section">
          <div className="brand-badge">🏔️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="brand-title">QMT-80 Performance Hub</h1>
              <span className="badge-tag" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}>
                80 KM • +4,000M D+
              </span>
            </div>
            <p className="brand-subtitle">
              Ultra-Trail Periodization & Academic Commute Engine
            </p>
          </div>
        </div>

        <div className="header-actions">
          {/* Live Sync Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.74rem',
              color: '#34d399',
              fontWeight: 600
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isRecharging ? '#f59e0b' : '#10b981',
                display: 'inline-block'
              }}
            />
            <span>{isRecharging ? 'Syncing...' : `Synced (${formattedSyncTime})`}</span>
          </div>

          <button
            className="btn-primary"
            onClick={onRefreshAll}
            disabled={isRecharging}
            title="Refresh iCal and Garmin telemetry"
          >
            <RefreshCw size={13} className={isRecharging ? 'spin-animation' : ''} />
            <span>Sync Live</span>
          </button>

          <button
            className="btn-secondary"
            onClick={onOpenGoogleCalendar}
            title="Export / Subscribe to Google Calendar"
          >
            <Calendar size={13} color="var(--accent-blue)" />
            <span>Google Calendar</span>
          </button>

          <button className="btn-garmin" onClick={onOpenGarmin} title="Manage Garmin telemetry & GPX imports">
            <Activity size={13} />
            <span>Garmin</span>
          </button>
        </div>
      </div>

      {/* Fused Command Bar (Combines Telemetry + Periodization Status) */}
      <div className="fused-command-bar">
        {/* Top bar: Phase & Countdown */}
        <div className="command-bar-top">
          <div className="command-phase-info">
            <div className="phase-pill">
              <TrendingUp size={13} />
              <span>{periodContext.label}</span>
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              Volume Target: <strong>{Math.round(periodContext.volumeFactor * 100)}%</strong>
            </span>

            {periodContext.isDeload && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--accent-amber)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 700
                }}
              >
                <ShieldAlert size={12} /> Recovery Deload
              </span>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {periodContext.description}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="countdown-pill">
              <Flame size={13} color="var(--primary)" style={{ display: 'inline', marginRight: 4 }} />
              <span>QMT-80 (July 3, 2027):</span> <strong style={{ color: 'var(--primary)' }}>D-{periodContext.daysToRace}</strong>
            </div>

            {onSelectPeriodizationTab && (
              <button
                onClick={onSelectPeriodizationTab}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                Plan Roadmap <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom grid: 4 Sleek Telemetry Gauges */}
        <div className="telemetry-metrics-grid">
          {/* Weekly Volume */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} /> Weekly Volume</span>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{weeklyStats.durationCompliancePct}%</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val">{formatHoursMin(weeklyStats.actualDurationMin)}</span>
              <span className="telemetry-sub">/ {formatHoursMin(weeklyStats.plannedDurationMin)}</span>
            </div>
            <div className="telemetry-bar-track">
              <div
                className="telemetry-bar-fill"
                style={{
                  width: `${Math.min(100, weeklyStats.durationCompliancePct)}%`,
                  background: 'var(--accent-blue)'
                }}
              />
            </div>
          </div>

          {/* Elevation D+ */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Compass size={11} style={{ display: 'inline', marginRight: 3 }} /> Elevation Gain</span>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{weeklyStats.elevationCompliancePct}%</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val" style={{ color: 'var(--primary)' }}>
                +{weeklyStats.actualElevationM}m
              </span>
              <span className="telemetry-sub">/ +{weeklyStats.plannedElevationM}m D+</span>
            </div>
            <div className="telemetry-bar-track">
              <div
                className="telemetry-bar-fill"
                style={{
                  width: `${Math.min(100, weeklyStats.elevationCompliancePct)}%`,
                  background: 'var(--primary)'
                }}
              />
            </div>
          </div>

          {/* Average Heart Rate / TSS */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Zap size={11} style={{ display: 'inline', marginRight: 3 }} /> Aerobic Intensity</span>
              <span style={{ color: 'var(--text-muted)' }}>HRmax 203</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val">{weeklyStats.avgHeartRate}</span>
              <span className="telemetry-sub">bpm avg • ~{weeklyStats.estimatedTss} TSS</span>
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Zone 2 Base / Incline Threshold
            </div>
          </div>

          {/* Garmin Compliance */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Award size={11} style={{ display: 'inline', marginRight: 3 }} /> Telemetry Match</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>{weeklyStats.overallComplianceScore}%</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val" style={{ color: '#34d399' }}>
                {weeklyStats.compliantCount} Done
              </span>
              <span className="telemetry-sub">
                {weeklyStats.partialCount > 0 && `• ${weeklyStats.partialCount} variance`}
                {weeklyStats.missedCount > 0 && `• ${weeklyStats.missedCount} missed`}
              </span>
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: 2 }}>
              "Other" signature analyzer active
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
