import { ChevronRight, RefreshCw, Settings } from 'lucide-react';
import type { AccountModalTab } from './AccountModal';
import { appTabs, type AppTab } from './MobileNav';
import type { PeriodizationContext } from '../types/calendar';
import { formatTrainingDuration, type WeeklyRunSummary } from '../services/activityProgress';

interface HeaderProps {
  currentTab: AppTab;
  raceName: string;
  periodContext: PeriodizationContext;
  week: WeeklyRunSummary;
  isRecharging: boolean;
  lastSyncTime?: string;
  onOpenAccountModal: (tab?: AccountModalTab) => void;
  onRefreshAll: () => void;
  onOpenProgression: () => void;
}

export function Header({
  currentTab, raceName, periodContext, week, isRecharging, lastSyncTime,
  onOpenAccountModal, onRefreshAll, onOpenProgression
}: HeaderProps) {
  const raceLabel = raceName.match(/\(([^)]+)\)/)?.[1] || raceName;
  const syncTime = lastSyncTime && new Date(lastSyncTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const title = currentTab === 'periodization' ? `Plan ${raceLabel}` : appTabs[currentTab].label;
  const meters = (value: number | undefined) => value === undefined ? '—' : `${Math.round(value).toLocaleString('fr-CA')} m`;
  return (
    <header className="app-header">
      <div className="app-page-heading">
        <div>
          <h1>{title}</h1>
          {currentTab === 'calendar' && <p>Semaine {periodContext.weekNumber} · {periodContext.label}</p>}
        </div>
        <div className="app-mobile-actions">
          <button type="button" className="btn-secondary app-icon-button" onClick={onRefreshAll}
            disabled={isRecharging} aria-label={isRecharging ? 'Synchronisation en cours' : 'Synchroniser Garmin'}
            title={syncTime ? `Dernière synchronisation Garmin à ${syncTime}` : 'Synchroniser Garmin'}>
            <RefreshCw size={17} strokeWidth={1.5} aria-hidden="true" className={isRecharging ? 'spin-animation' : undefined} />
          </button>
          <button type="button" className="btn-secondary app-icon-button" onClick={() => onOpenAccountModal('profile')}
            aria-label="Paramètres" title="Paramètres">
            <Settings size={17} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {currentTab === 'calendar' && (
        <section className="weekly-checkin surface-panel" aria-label="Course et trail cette semaine">
          <div className="weekly-checkin-title">
            <h2>Cette semaine</h2>
            <p>Réalisé / prévu d’ici dimanche</p>
          </div>
          <dl>
            <div><dt>Temps de course</dt><dd>{formatTrainingDuration(week.recordedMinutes)}
              <span> / {week.plannedMinutes ? formatTrainingDuration(week.plannedMinutes) : '—'}</span></dd></div>
            <div><dt>Dénivelé +</dt><dd>{meters(week.recordedElevation)}
              <span> / {meters(week.plannedElevation)}</span>
              {week.elevationCoverage > 0 && week.elevationCoverage < week.recordedSessions &&
                <small>Mesuré sur {week.elevationCoverage}/{week.recordedSessions} sorties</small>}
            </dd></div>
          </dl>
          <button className="app-text-button" type="button" onClick={onOpenProgression}>
            Historique <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </section>
      )}
    </header>
  );
}
