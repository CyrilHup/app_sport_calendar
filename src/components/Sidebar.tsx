import React from 'react';
import {
  Calendar,
  Activity,
  BarChart3,
  TrendingUp,
  Flame,
  RefreshCw,
  Settings,
  User,
  Heart,
  Moon,
  Clock,
  CheckCircle2,
  Mountain
} from 'lucide-react';
import { PeriodizationContext } from '../types/calendar';
import { GarminSyncState, ActivityComparison } from '../types/garmin';
import { WeeklyStatsSummary } from '../services/comparisonEngine';
import { AccountModalTab } from './AccountModal';
import { triggerHapticFeedback } from '../services/hapticsService';
import { getWellnessForDate, calculateReadinessScore } from '../services/readinessEngine';
import { formatDateKey, getGarminLocalDateKey } from '../services/dateUtils';
import { loadStoredGarminActivities } from '../services/garminService';
import { GarminActivity } from '../types/garmin';

export type MainNavTab = 'calendar' | 'compare' | 'stats' | 'periodization';

interface SidebarProps {
  currentTab: MainNavTab;
  onChangeTab: (tab: MainNavTab) => void;
  periodContext: PeriodizationContext;
  garminState: GarminSyncState;
  weeklyStats: WeeklyStatsSummary;
  comparisons?: ActivityComparison[];
  garminActivities?: GarminActivity[];
  referenceDate?: Date;
  referenceDateStr?: string;
  onOpenAccountModal: (tab?: AccountModalTab) => void;
  onRefreshAll: () => void;
  isRecharging: boolean;
  lastSyncTime?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  isLoggedIn?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onChangeTab,
  periodContext,
  garminState,
  weeklyStats,
  comparisons = [],
  garminActivities,
  referenceDate,
  referenceDateStr,
  onOpenAccountModal,
  onRefreshAll,
  isRecharging,
  lastSyncTime,
  userDisplayName,
  userAvatarUrl,
  isLoggedIn
}) => {
  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Direct';

  const todayStr = referenceDateStr || (referenceDate ? formatDateKey(referenceDate) : formatDateKey(new Date()));
  const todayWellness = getWellnessForDate(todayStr);
  const todayComparisons = comparisons.filter(c => c.date === todayStr);
  const isTodaySessionCompleted = todayComparisons.some(
    c => (c.status === 'COMPLIANT' || c.status === 'PARTIAL') && c.plannedEvent?.category === 'sport'
  );

  const allStoredActs = (garminActivities && garminActivities.length > 0)
    ? garminActivities
    : loadStoredGarminActivities();
  const todayGarminActs = allStoredActs.filter(a => getGarminLocalDateKey(a) === todayStr);
  const todayActs = todayGarminActs.length > 0
    ? todayGarminActs
    : todayComparisons.filter(c => Boolean(c.actualActivity)).map(c => c.actualActivity!);

  const readiness = calculateReadinessScore(todayWellness, undefined, todayActs, isTodaySessionCompleted);

  const formatHoursMin = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const navItems: { id: MainNavTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'calendar',
      label: 'Planning',
      icon: <Calendar size={18} />
    },
    {
      id: 'compare',
      label: 'Télémétrie Garmin',
      icon: <Activity size={18} />,
      badge: comparisons.length > 0 ? comparisons.length : undefined
    },
    {
      id: 'stats',
      label: 'Statistiques',
      icon: <BarChart3 size={18} />
    },
    {
      id: 'periodization',
      label: 'Plan QMT-80',
      icon: <TrendingUp size={18} />
    }
  ];

  return (
    <aside className="app-sidebar desktop-only" aria-label="Navigation principale">
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <div className="sidebar-brand-top">
          <div className="sidebar-logo-icon">
            <Mountain size={20} color="#ff5722" />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-row">
              <span className="sidebar-brand-title">QMT-80</span>
              <span className="sidebar-countdown-chip" title={`Départ le 3 Juillet 2027 (${periodContext.daysToRace} jours restants)`}>
                <Flame size={12} /> J-{periodContext.daysToRace}
              </span>
            </div>
            <span className="sidebar-brand-specs">77 KM • +3 370M D+</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Navigation</div>
        <ul className="sidebar-menu-list">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    triggerHapticFeedback('light');
                    onChangeTab(item.id);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  <span className="sidebar-item-label">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="sidebar-item-badge">{item.badge}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Athlete Status & Weekly Progress Widget */}
      <div className="sidebar-status-card">
        <div className="sidebar-status-header">
          <span className="sidebar-status-title">État Athlète (Aujourd'hui)</span>
          <button
            type="button"
            className="sidebar-status-link"
            onClick={() => onOpenAccountModal('garmin')}
            title="Consulter les métriques Garmin"
          >
            Garmin
          </button>
        </div>

        {/* Readiness Pill */}
        <div
          className="sidebar-readiness-box"
          style={{
            borderColor: `${readiness.badgeColorHex}40`,
            background: `${readiness.badgeColorHex}12`
          }}
          onClick={() => onOpenAccountModal('garmin')}
          role="button"
          tabIndex={0}
          title={readiness.summary}
        >
          <div className="sidebar-readiness-row">
            <span className="sidebar-readiness-emoji">{readiness.badgeEmoji}</span>
            <div className="sidebar-readiness-text">
              <span className="sidebar-readiness-val" style={{ color: readiness.badgeColorHex }}>
                Readiness {readiness.score}/100
              </span>
              <span className="sidebar-readiness-desc">{readiness.statusLabel}</span>
            </div>
          </div>
          <div className="sidebar-readiness-sub">
            {readiness.morningScore && readiness.morningScore !== readiness.score ? (
              <span>Réveil {readiness.morningScore}/100</span>
            ) : (
              <span><Moon size={11} /> {readiness.factors.sleepDurationHours}h</span>
            )}
            <span><Heart size={11} /> VFC {readiness.factors.hrvStatus}</span>
          </div>
        </div>

        {/* Weekly Volume Mini-Bar */}
        <div className="sidebar-weekly-summary">
          <div className="sidebar-weekly-labels">
            <span><Clock size={11} /> Volume S{periodContext.weekNumber}</span>
            <span className="sidebar-weekly-pct">{weeklyStats.durationCompliancePct}%</span>
          </div>
          <div className="sidebar-weekly-values">
            <strong>{formatHoursMin(weeklyStats.actualDurationMin)}</strong>
            <span> / {formatHoursMin(weeklyStats.plannedDurationMin)}</span>
          </div>
          <div className="sidebar-bar-track">
            <div
              className="sidebar-bar-fill"
              style={{
                width: `${Math.min(100, weeklyStats.durationCompliancePct)}%`,
                background: 'var(--accent-blue)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Synchro & User Profile */}
      <div className="sidebar-footer">
        {/* Quick Sync Button */}
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light');
            onRefreshAll();
          }}
          disabled={isRecharging}
          className="sidebar-sync-btn"
          title={`Dernière synchronisation : ${formattedSyncTime}. Cliquer pour rafraîchir ÉTS et Garmin.`}
        >
          <span
            className="sidebar-sync-dot"
            style={{
              background: isRecharging ? '#f59e0b' : '#10b981'
            }}
          />
          <RefreshCw
            size={13}
            className={isRecharging ? 'spin-animation' : ''}
            style={{ color: isRecharging ? '#f59e0b' : '#34d399' }}
          />
          <span className="sidebar-sync-text">
            {isRecharging ? 'Synchronisation...' : `Synchro (${formattedSyncTime})`}
          </span>
        </button>

        {/* Athlete Profile / Settings */}
        <button
          type="button"
          className="sidebar-user-btn"
          onClick={() => {
            triggerHapticFeedback('light');
            onOpenAccountModal('profile');
          }}
          title="Mon profil athlète & configurations"
        >
          <div className="sidebar-avatar-box">
            {isLoggedIn && userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={userDisplayName || 'Athlète'}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : isLoggedIn && userDisplayName ? (
              <span>{userDisplayName[0].toUpperCase()}</span>
            ) : (
              <User size={14} />
            )}
          </div>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">
              {isLoggedIn ? (userDisplayName || 'Athlète QMT') : 'Compte Athlète'}
            </span>
            <span className="sidebar-user-status">
              {garminState.connected ? 'Garmin lié • Actif' : 'Non connecté'}
            </span>
          </div>
          <Settings size={14} className="sidebar-settings-icon" />
        </button>
      </div>
    </aside>
  );
};
