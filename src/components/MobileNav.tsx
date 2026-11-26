import { Activity, BarChart3, Calendar, Compass } from 'lucide-react';

export const appTabs = {
  calendar: { label: 'Planning', Icon: Calendar },
  compare: { label: 'Séances', Icon: Activity },
  stats: { label: 'Progression', Icon: BarChart3 },
  periodization: { label: 'Plan', Icon: Compass }
};

export type AppTab = keyof typeof appTabs;

interface NavigationProps {
  currentTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

export function NavLinks({ currentTab, onChangeTab }: NavigationProps) {
  return (Object.keys(appTabs) as AppTab[]).map(tab => {
    const { label, Icon } = appTabs[tab];
    return (
      <button key={tab} type="button" className="app-nav-link" onClick={() => onChangeTab(tab)}
        aria-current={tab === currentTab ? 'page' : undefined}>
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  });
}

export function MobileNav(props: NavigationProps) {
  return <nav className="mobile-bottom-nav" aria-label="Navigation principale"><NavLinks {...props} /></nav>;
}
