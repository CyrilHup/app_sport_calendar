import React, { useState } from 'react';
import {
  Activity,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Flame,
  RefreshCw,
  TrendingUp,
  Zap,
  User,
  Settings,
  SlidersHorizontal,
  ShieldAlert
} from 'lucide-react';
import { PeriodizationContext } from '../types/calendar';
import { ActivityComparison, GarminSyncState } from '../types/garmin';
import { WeeklyStatsSummary } from '../services/comparisonEngine';
import { AccountModalTab } from './AccountModal';
import { triggerHapticFeedback } from '../services/hapticsService';
import { GLOBAL_APP_CONFIG } from '../services/periodizationEngine';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  currentTab?: 'calendar' | 'compare' | 'stats' | 'periodization';
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
  currentTab = 'calendar',
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
  const { profile } = useAuth();
  const athleteFcMax = profile?.fcMax || GLOBAL_APP_CONFIG.ATHLETE_FC_MAX || 203;

  const [isHudOpenOnMobile, setIsHudOpenOnMobile] = useState<boolean>(false);
  const [showWeeklyGauges, setShowWeeklyGauges] = useState<boolean>(true);

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

  // Tab Titles for Desktop Context
  const getTabTitle = () => {
    switch (currentTab) {
      case 'calendar':
        return 'Planning Hebdomadaire';
      case 'compare':
        return 'Télémétrie Garmin & Activités';
      case 'stats':
        return 'Statistiques & Progression';
      case 'periodization':
        return 'Plan Directeur QMT-80';
      default:
        return 'Planning';
    }
  };

  return (
    <header className="app-header">
      {/* Top Header Bar */}
      <div className="header-top">
        {/* Left Side: Desktop Page Context / Mobile Brand */}
        <div className="brand-section">
          {/* Mobile Brand (Shown only on small screens) */}
          <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="brand-title">QMT-80</h1>
            <span className="sidebar-countdown-chip" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
              <Flame size={12} /> J-{periodContext.daysToRace}
            </span>
          </div>

          {/* Desktop Page Title + Clean Microcycle Pill */}
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="content-page-title">{getTabTitle()}</h1>
            <div className="phase-pill-clean">
              <TrendingUp size={13} />
              <span>Semaine {periodContext.weekNumber} • {periodContext.label}</span>
              <span className="phase-pct-badge">{Math.round(periodContext.volumeFactor * 100)}%</span>
            </div>
            {periodContext.isDeload && (
              <span className="phase-deload-pill">
                <ShieldAlert size={12} /> Décharge
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Quick Actions */}
        <div className="header-actions">
          {/* Toggle weekly metrics on desktop planning view */}
          {currentTab === 'calendar' && (
            <button
              type="button"
              className="action-icon-pill desktop-only"
              onClick={() => setShowWeeklyGauges(!showWeeklyGauges)}
              title={showWeeklyGauges ? 'Masquer le récapitulatif hebdomadaire' : 'Afficher le récapitulatif hebdomadaire'}
              style={{ fontSize: '0.74rem' }}
            >
              <SlidersHorizontal size={13} />
              <span>{showWeeklyGauges ? 'Masquer Objectifs' : 'Objectifs Hebdo'}</span>
            </button>
          )}

          {/* Quick Sync Button (Mobile & Desktop fallback) */}
          <button
            onClick={() => {
              triggerHapticFeedback('light');
              onRefreshAll();
            }}
            disabled={isRecharging}
            className="sync-action-btn mobile-only"
            title={`Dernière synchro : ${formattedSyncTime}`}
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
            <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
              {isRecharging ? 'Sync...' : formattedSyncTime}
            </span>
          </button>

          {/* User Profile Button on Mobile */}
          <button
            className="account-action-btn mobile-only"
            onClick={() => {
              triggerHapticFeedback('light');
              onOpenAccountModal('profile');
            }}
            title="Mon profil athlète"
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
                overflow: 'hidden'
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
            S{periodContext.weekNumber}
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

      {/* Weekly Targets & Telemetry Panel (Shown on Calendar view or when mobile HUD is opened) */}
      {currentTab === 'calendar' && showWeeklyGauges && (
        <div className={`fused-command-bar ${isHudOpenOnMobile ? 'mobile-open' : ''}`}>
          {/* Header clearly explaining that these are WEEKLY targets */}
          <div className="command-bar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="weekly-panel-title">Objectifs Hebdomadaires</span>
              <span className="weekly-panel-subtitle">
                Semaine {periodContext.weekNumber} • Cible {Math.round(periodContext.volumeFactor * 100)}%
              </span>
            </div>
          </div>

          {/* 4 Sleek Telemetry Gauges */}
          <div className="telemetry-metrics-grid">
            {/* Weekly Volume */}
            <div className="telemetry-item">
              <div className="telemetry-label">
                <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} /> Volume Hebdo</span>
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
                  <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700, marginLeft: 2 }}>
                    -{weeklyStats.actualElevationLossM}m
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

            {/* Average Heart Rate / Training Effects */}
            <div className="telemetry-item">
              <div className="telemetry-label">
                <span><Zap size={11} style={{ display: 'inline', marginRight: 3 }} /> Intensité Cardiaque</span>
                <span style={{ color: 'var(--text-muted)' }}>FCmax {athleteFcMax}</span>
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
                <span><Award size={11} style={{ display: 'inline', marginRight: 3 }} /> Concordance Garmin</span>
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
                {isNative ? 'Firstbeat EPOC actif' : 'Télémétrie Garmin active'}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
