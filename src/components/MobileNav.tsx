import React from 'react';
import { Activity, BarChart3, Calendar, TrendingUp } from 'lucide-react';

export type MainAppTab = 'calendar' | 'compare' | 'periodization' | 'stats';

interface MobileNavProps {
  currentTab: MainAppTab;
  onChangeTab: (tab: MainAppTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav-item ${currentTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onChangeTab('calendar')}
      >
        <Calendar size={18} />
        <span>Planning</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'compare' ? 'active' : ''}`}
        onClick={() => onChangeTab('compare')}
      >
        <Activity size={18} />
        <span>Télémétrie</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'stats' ? 'active' : ''}`}
        onClick={() => onChangeTab('stats')}
      >
        <BarChart3 size={18} />
        <span>Stats</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'periodization' ? 'active' : ''}`}
        onClick={() => onChangeTab('periodization')}
      >
        <TrendingUp size={18} />
        <span>Plan QMT</span>
      </button>
    </nav>
  );
};
