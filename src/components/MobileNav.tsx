import React from 'react';
import { Activity, Calendar, TrendingUp } from 'lucide-react';

interface MobileNavProps {
  currentTab: 'calendar' | 'compare' | 'periodization';
  onChangeTab: (tab: 'calendar' | 'compare' | 'periodization') => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav-item ${currentTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onChangeTab('calendar')}
      >
        <Calendar size={18} />
        <span>Schedule</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'compare' ? 'active' : ''}`}
        onClick={() => onChangeTab('compare')}
      >
        <Activity size={18} />
        <span>Garmin</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'periodization' ? 'active' : ''}`}
        onClick={() => onChangeTab('periodization')}
      >
        <TrendingUp size={18} />
        <span>QMT-80 Plan</span>
      </button>
    </nav>
  );
};
