import React from 'react';
import { Activity, Award, Clock, Compass, Flame, RefreshCw, Zap } from 'lucide-react';
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
}

export const Header: React.FC<HeaderProps> = ({
  periodContext,
  garminState,
  weeklyStats,
  onOpenGarmin,
  onOpenGoogleCalendar,
  onRefreshAll,
  isRecharging,
  lastSyncTime
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
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(255, 107, 53, 0.15)',
                  color: '#ff6b35',
                  fontWeight: 800,
                  border: '1px solid rgba(255, 107, 53, 0.3)'
                }}
              >
                QMT-80 • 80 KM / 4,000M D+
              </span>
            </div>
            <p className="brand-subtitle">
              Ultra-Trail & ÉTS Schedule • Garmin Connect Telemetry
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
              padding: '5px 10px',
              borderRadius: 4,
              background: 'rgba(0, 230, 118, 0.08)',
              border: '1px solid rgba(0, 230, 118, 0.2)',
              fontSize: '0.74rem',
              color: '#00e676',
              fontWeight: 600
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isRecharging ? '#f59e0b' : '#00e676',
                display: 'inline-block'
              }}
            />
            <span>{isRecharging ? 'Syncing...' : `Auto-synced (${formattedSyncTime})`}</span>
          </div>

          <button
            className="btn-primary"
            onClick={onRefreshAll}
            disabled={isRecharging}
            title="Refresh ÉTS iCal and Garmin Connect"
          >
            <RefreshCw size={13} className={isRecharging ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn-secondary"
            onClick={onOpenGoogleCalendar}
            title="Sync directly to Google Calendar"
            style={{
              borderColor: 'rgba(66, 133, 244, 0.4)',
              background: 'rgba(66, 133, 244, 0.1)',
              color: '#60a5fa'
            }}
          >
            <span>📅 Google Calendar</span>
          </button>

          <button className="btn-garmin" onClick={onOpenGarmin}>
            <Activity size={13} />
            <span>Garmin</span>
          </button>
        </div>
      </div>

      {/* Sleek High-Density Telemetry Strip */}
      <div className="telemetry-strip">
        {/* Weekly Volume */}
        <div className="telemetry-item">
          <div className="telemetry-label">
            <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} /> Weekly Volume</span>
            <span style={{ color: 'var(--cyan)' }}>{weeklyStats.durationCompliancePct}%</span>
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
                background: 'linear-gradient(90deg, #00f2fe, #38bdf8)'
              }}
            />
          </div>
        </div>

        {/* Weekly Elevation D+ */}
        <div className="telemetry-item">
          <div className="telemetry-label">
            <span><Compass size={11} style={{ display: 'inline', marginRight: 3 }} /> Elevation Gain (D+)</span>
            <span style={{ color: 'var(--orange)' }}>{weeklyStats.elevationCompliancePct}%</span>
          </div>
          <div className="telemetry-value-row">
            <span className="telemetry-val" style={{ color: '#ff8c5a' }}>
              +{weeklyStats.actualElevationM}m
            </span>
            <span className="telemetry-sub">/ +{weeklyStats.plannedElevationM}m</span>
          </div>
          <div className="telemetry-bar-track">
            <div
              className="telemetry-bar-fill"
              style={{
                width: `${Math.min(100, weeklyStats.elevationCompliancePct)}%`,
                background: 'linear-gradient(90deg, #ff6b35, #f72585)'
              }}
            />
          </div>
        </div>

        {/* Heart Rate / Training Stress */}
        <div className="telemetry-item">
          <div className="telemetry-label">
            <span><Zap size={11} style={{ display: 'inline', marginRight: 3 }} /> Avg Heart Rate</span>
            <span>HRmax 203</span>
          </div>
          <div className="telemetry-value-row">
            <span className="telemetry-val">{weeklyStats.avgHeartRate}</span>
            <span className="telemetry-sub">bpm (Load ~{weeklyStats.estimatedTss} TSS)</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Zone 2 Aerobic / Tailored Threshold
          </div>
        </div>

        {/* Garmin Compliance Rate */}
        <div className="telemetry-item">
          <div className="telemetry-label">
            <span><Award size={11} style={{ display: 'inline', marginRight: 3 }} /> Garmin Compliance</span>
            <span style={{ color: '#00e676' }}>Score</span>
          </div>
          <div className="telemetry-value-row">
            <span className="telemetry-val" style={{ color: '#00e676' }}>
              {weeklyStats.overallComplianceScore}%
            </span>
            <span className="telemetry-sub">
              ({weeklyStats.compliantCount} compliant / {weeklyStats.compliantCount + weeklyStats.partialCount + weeklyStats.missedCount})
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
            "Other" profile fully supported
          </div>
        </div>

        {/* Race Countdown & Periodization Phase */}
        <div className="telemetry-item" style={{ borderRight: 'none' }}>
          <div className="telemetry-label">
            <span><Flame size={11} color="#ff6b35" style={{ display: 'inline', marginRight: 3 }} /> QMT-80 (July 3, 2027)</span>
            <span style={{ color: '#ff6b35', fontWeight: 800 }}>D-{periodContext.daysToRace}</span>
          </div>
          <div className="telemetry-value-row">
            <span className="telemetry-val" style={{ fontSize: '0.95rem' }}>
              {periodContext.label.split('[')[0]}
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Target volume: <strong>{Math.round(periodContext.volumeFactor * 100)}%</strong>
          </div>
        </div>
      </div>
    </header>
  );
};
