import React, { useState } from 'react';
import { Activity, Award, Calendar, ChevronDown, ChevronRight, ChevronUp, Clock, Compass, Flame, RefreshCw, ShieldAlert, TrendingUp, Zap, User, Settings } from 'lucide-react';
import { PeriodizationContext } from '../types/calendar';
import { ActivityComparison, GarminSyncState } from '../types/garmin';
import { WeeklyStatsSummary } from '../services/comparisonEngine';
import { AccountModalTab } from './AccountModal';
import { triggerHapticFeedback } from '../services/hapticsService';

interface HeaderProps {
  periodContext: PeriodizationContext;
  garminState: GarminSyncState;
  weeklyStats: WeeklyStatsSummary;
  comparisons?: ActivityComparison[];
  onOpenAccountModal: (tab?: AccountModalTab) => void;
  onRefreshAll: () => void;
  isRecharging: boolean;
  lastSyncTime?: string;
  onSelectPeriodizationTab?: () => void;
  userDisplayName?: string;
  userAvatarUrl?: string;
  isLoggedIn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  periodContext,
  garminState,
  weeklyStats,
  comparisons,
  onOpenAccountModal,
  onRefreshAll,
  isRecharging,
  lastSyncTime,
  onSelectPeriodizationTab,
  userDisplayName,
  userAvatarUrl,
  isLoggedIn
}) => {
  const [isHudOpenOnMobile, setIsHudOpenOnMobile] = useState<boolean>(false);

  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Direct';

  const formatHoursMin = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const isNative = weeklyStats.hasNativeGarminLoad;
  const loadScore = isNative ? weeklyStats.totalGarminTrainingLoad : (weeklyStats.estimatedTss || 0);

  let loadLevel = 'Base Aérobie Optimale';
  let loadColor = '#10b981';
  let loadAdvice = "Charge d'endurance soutenable. Développement aérobie et mitochondrial adapté.";

  if (loadScore > 500) {
    loadLevel = 'Choc de Surcharge Élevé';
    loadColor = '#ef4444';
    loadAdvice = 'Forte fatigue neuromusculaire. Sommeil réparateur et hydratation stricts obligatoires.';
  } else if (loadScore > 320) {
    loadLevel = 'Stimulus Optimal / Productif';
    loadColor = 'var(--primary)';
    loadAdvice = "Stimulus d'entraînement progressif et solide pour l'ultra QMT-80.";
  } else if (loadScore < 140) {
    loadLevel = 'Récupération / Décharge Active';
    loadColor = '#38bdf8';
    loadAdvice = 'Recharge glycogénique et régénération tendineuse/collagène.';
  }

  const teLabels: Record<string, number> = {};
  if (comparisons) {
    for (const c of comparisons) {
      if (c.actualActivity?.trainingEffectLabel) {
        const lbl = c.actualActivity.trainingEffectLabel.toUpperCase();
        teLabels[lbl] = (teLabels[lbl] || 0) + 1;
      }
    }
  }
  const teList = Object.entries(teLabels);

  return (
    <header className="app-header">
      {/* Top Brand & Actions Bar - Sleek Single Line */}
      <div className="header-top">
        <div className="brand-section">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="brand-title">
                <span className="mobile-only">QMT-80</span>
                <span className="desktop-only">QMT-80 Performance Hub</span>
              </h1>
              <span className="badge-tag desktop-only" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}>
                77 KM • +3 370M D+ • LIMITE 19H
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(255, 87, 34, 0.15)', color: 'var(--primary)', padding: '2px 7px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 800 }}>
                <Flame size={12} /> J-{periodContext.daysToRace}
              </span>
            </div>
            <p className="brand-subtitle desktop-only">
              Périodisation Ultra-Trail & Moteur de Trajets Universitaires (ÉTS)
            </p>
          </div>
        </div>

        <div className="header-actions">
          {/* Quick Sync Button */}
          <button
            onClick={() => {
              triggerHapticFeedback('light');
              onRefreshAll();
            }}
            disabled={isRecharging}
            className="sync-action-btn"
            title={`Dernière synchro : ${formattedSyncTime}. Cliquer pour rafraîchir ÉTS et Garmin.`}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isRecharging ? '#f59e0b' : '#10b981',
                display: 'inline-block',
                flexShrink: 0
              }}
            />
            <RefreshCw size={13} className={isRecharging ? 'spin-animation' : ''} style={{ color: isRecharging ? '#f59e0b' : '#34d399' }} />
            <span className="desktop-only" style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 600 }}>
              {isRecharging ? 'Synchro...' : `Synchro (${formattedSyncTime})`}
            </span>
          </button>

          {/* Unified Athlete Account Button with Google Photo */}
          <button
            className="account-action-btn"
            onClick={() => {
              triggerHapticFeedback('light');
              onOpenAccountModal('profile');
            }}
            title="Mon compte athlète, Garmin Connect, Google Agenda et Partage"
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: isLoggedIn ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 700,
                flexShrink: 0,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              {isLoggedIn && userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName || 'Athlète'}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : isLoggedIn && userDisplayName ? (
                userDisplayName[0].toUpperCase()
              ) : (
                <User size={13} />
              )}
            </div>
            <span className="desktop-only" style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>
              {isLoggedIn ? (userDisplayName || 'Mon Compte') : 'Mon Compte & Services'}
            </span>
            <Settings size={13} className="desktop-only" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Mobile Streamlined Telemetry Progress Strip */}
      <div
        className="mobile-hud-summary"
        onClick={() => setIsHudOpenOnMobile(!isHudOpenOnMobile)}
        role="button"
        tabIndex={0}
        aria-label="Afficher la télémétrie"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', overflow: 'hidden' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {periodContext.label.split(' (')[0]}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {formatHoursMin(weeklyStats.actualDurationMin)} / {formatHoursMin(weeklyStats.plannedDurationMin)}
          </span>
          <span style={{ color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            +{weeklyStats.actualElevationM}m D+
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
          <span>{isHudOpenOnMobile ? 'Fermer' : 'Détails'}</span>
          {isHudOpenOnMobile ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {/* Fused Command Bar (Combines Telemetry + Periodization Status + Coach Advice) */}
      <div className={`fused-command-bar ${isHudOpenOnMobile ? 'mobile-open' : ''}`}>
        {/* Top bar: Phase, Physiological Load & Countdown */}
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
              Cible de Volume : <strong>{Math.round(periodContext.volumeFactor * 100)}%</strong>
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
                <ShieldAlert size={12} /> Semaine de Décharge
              </span>
            )}

            {/* Physiological Load Pill */}
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 9px',
                borderRadius: 'var(--radius-full)',
                background: `${loadColor}15`,
                color: loadColor,
                border: `1px solid ${loadColor}40`,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
              title={isNative ? 'Charge Firstbeat EPOC calculée par Garmin' : 'Score de stress estimé TSS'}
            >
              <Zap size={11} />
              {isNative ? `Charge EPOC ${loadScore}` : `TSS ${loadScore}`} • {loadLevel}
            </span>

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {periodContext.description}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="countdown-pill">
              <Flame size={13} color="var(--primary)" style={{ display: 'inline', marginRight: 4 }} />
              <span>QMT-80 (3 Juillet 2027) :</span> <strong style={{ color: 'var(--primary)' }}>J-{periodContext.daysToRace}</strong>
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
                Voir le Plan <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Middle grid: 4 Sleek Telemetry Gauges */}
        <div className="telemetry-metrics-grid">
          {/* Weekly Volume */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} /> Volume Hebdomadaire</span>
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

          {/* Elevation D+ / D- */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Compass size={11} style={{ display: 'inline', marginRight: 3 }} /> Dénivelé D+ / D-</span>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{weeklyStats.elevationCompliancePct}%</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val" style={{ color: 'var(--primary)' }}>
                +{weeklyStats.actualElevationM}m
              </span>
              <span className="telemetry-sub">/ +{weeklyStats.plannedElevationM}m D+</span>
              {Boolean(weeklyStats.actualElevationLossM) && (
                <span style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: 700, marginLeft: 2 }}>
                  -{weeklyStats.actualElevationLossM}m D-
                </span>
              )}
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

          {/* Average Heart Rate / TSS & Training Effects */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Zap size={11} style={{ display: 'inline', marginRight: 3 }} /> Intensité Cardiaque</span>
              <span style={{ color: 'var(--text-muted)' }}>FCmax 203</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val">{weeklyStats.avgHeartRate > 0 ? weeklyStats.avgHeartRate : '--'}</span>
              <span className="telemetry-sub">
                bpm moy. • {isNative ? `${loadScore} EPOC` : `~${weeklyStats.estimatedTss} TSS`}
              </span>
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {teList.length > 0 ? (
                teList.slice(0, 3).map(([lbl, count]) => (
                  <span
                    key={lbl}
                    style={{
                      fontSize: '0.62rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      color: '#e2e8f0',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {lbl} ({count})
                  </span>
                ))
              ) : (
                <span>Zone 2 Base / Seuil en Côte</span>
              )}
            </div>
          </div>

          {/* Garmin Compliance */}
          <div className="telemetry-item">
            <div className="telemetry-label">
              <span><Award size={11} style={{ display: 'inline', marginRight: 3 }} /> Concordance Télémétrie</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>{weeklyStats.overallComplianceScore}%</span>
            </div>
            <div className="telemetry-value-row">
              <span className="telemetry-val" style={{ color: '#34d399' }}>
                {weeklyStats.compliantCount} Réalisées
              </span>
              <span className="telemetry-sub">
                {weeklyStats.partialCount > 0 && `• ${weeklyStats.partialCount} écart`}
                {weeklyStats.missedCount > 0 && `• ${weeklyStats.missedCount} manquée`}
              </span>
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Analyseur d'activité Garmin actif
            </div>
          </div>
        </div>

        {/* Bottom Coach Advice Strip */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            paddingTop: '8px',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={13} color="var(--primary)" />
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>Conseil Coach Télémétrie :</strong> {loadAdvice}
            </span>
          </div>
          {isNative && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Algorithme Firstbeat Garmin Connect actif
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
