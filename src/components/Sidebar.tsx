import { Mountain, RefreshCw, Settings } from 'lucide-react';
import type { AccountModalTab } from './AccountModal';
import { NavLinks, type AppTab } from './MobileNav';

interface SidebarProps {
  raceName: string;
  raceDate: string;
  daysToRace: number;
  currentTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  onOpenAccountModal: (tab?: AccountModalTab) => void;
  onRefreshAll: () => void;
  isRecharging: boolean;
  lastSyncTime?: string;
  userDisplayName?: string;
}

export function Sidebar({
  raceName, raceDate, daysToRace, currentTab, onChangeTab,
  onOpenAccountModal, onRefreshAll, isRecharging, lastSyncTime, userDisplayName
}: SidebarProps) {
  const raceLabel = raceName.match(/\(([^)]+)\)/)?.[1] || raceName;
  const raceDay = new Date(`${raceDate}T12:00:00`);
  const formattedRaceDate = Number.isFinite(raceDay.getTime()) ?
    raceDay.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined;
  const syncTime = lastSyncTime && new Date(lastSyncTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon"><Mountain size={21} strokeWidth={1.5} aria-hidden="true" /></span>
        <div><strong>{raceLabel}</strong>{formattedRaceDate && <span>{formattedRaceDate}</span>}</div>
      </div>
      <nav className="sidebar-nav" aria-label="Navigation principale">
        <NavLinks currentTab={currentTab} onChangeTab={onChangeTab} />
      </nav>
      <div className="sidebar-footer">
        {daysToRace > 0 && <p className="sidebar-countdown">Départ dans <strong>{daysToRace} j</strong></p>}
        <button type="button" className="app-nav-link" onClick={onRefreshAll} disabled={isRecharging}>
          <RefreshCw size={17} strokeWidth={1.5} aria-hidden="true" className={isRecharging ? 'spin-animation' : undefined} />
          <span>{isRecharging ? 'Synchronisation…' : 'Synchroniser Garmin'}{syncTime && <small>Dernière synchro à {syncTime}</small>}</span>
        </button>
        <button type="button" className="app-nav-link" onClick={() => onOpenAccountModal('profile')}>
          <Settings size={17} strokeWidth={1.5} aria-hidden="true" />
          <span>Paramètres{userDisplayName && <small>{userDisplayName}</small>}</span>
        </button>
      </div>
    </aside>
  );
}
