import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GarminActivity, GarminSyncState } from '../types/garmin';
import { CalendarEvent } from '../types/calendar';
import {
  Activity,
  Calendar,
  RefreshCw,
  Share2,
  User as UserIcon,
  X
} from 'lucide-react';
import { ProfileTab } from './account/ProfileTab';
import { GarminTab } from './account/GarminTab';
import { CalendarTab } from './account/CalendarTab';
import { ShareTab } from './account/ShareTab';

export type AccountModalTab = 'profile' | 'garmin' | 'google' | 'share';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AccountModalTab;
  garminState: GarminSyncState;
  onUpdateGarminState: (state: GarminSyncState) => void;
  onActivitiesSynced: (activities: GarminActivity[]) => void;
  calendarEvents: CalendarEvent[];
  onRefreshAll: () => void;
  isRecharging: boolean;
  lastSyncTime?: string;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
  garminState,
  onUpdateGarminState,
  onActivitiesSynced,
  calendarEvents,
  onRefreshAll,
  isRecharging,
  lastSyncTime
}) => {
  const [activeTab, setActiveTab] = useState<AccountModalTab>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const { user, profile } = useAuth();

  if (!isOpen) return null;

  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Direct';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 620, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#fff' }}>
              Paramètres
            </h2>
            {user && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  fontWeight: 600,
                  border: '1px solid rgba(16, 185, 129, 0.25)'
                }}
              >
                {user.email}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.15)',
            padding: '0 14px',
            gap: 4
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 12px',
              border: 'none',
              background: 'none',
              color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            <UserIcon size={14} />
            <span>Compte & Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('google')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 12px',
              border: 'none',
              background: 'none',
              color: activeTab === 'google' ? '#4285F4' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'google' ? '2px solid #4285F4' : '2px solid transparent'
            }}
          >
            <Calendar size={14} />
            <span>Calendriers & Google</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('garmin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 12px',
              border: 'none',
              background: 'none',
              color: activeTab === 'garmin' ? '#0077c8' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'garmin' ? '2px solid #0077c8' : '2px solid transparent'
            }}
          >
            <Activity size={14} />
            <span>Garmin Connect</span>
            {garminState.connected && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 12px',
              border: 'none',
              background: 'none',
              color: activeTab === 'share' ? '#f59e0b' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'share' ? '2px solid #f59e0b' : '2px solid transparent'
            }}
          >
            <Share2 size={14} />
            <span>Partage</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '18px', gap: '14px' }}>
          {activeTab === 'profile' && <ProfileTab onRefreshAll={onRefreshAll} />}

          {activeTab === 'google' && (
            <CalendarTab
              calendarEvents={calendarEvents}
              onRefreshAll={onRefreshAll}
              isRecharging={isRecharging}
            />
          )}

          {activeTab === 'garmin' && (
            <GarminTab
              garminState={garminState}
              onUpdateGarminState={onUpdateGarminState}
              onActivitiesSynced={onActivitiesSynced}
              calendarEvents={calendarEvents}
              onRefreshAll={onRefreshAll}
            />
          )}

          {activeTab === 'share' && <ShareTab />}
        </div>
      </div>
    </div>
  );
};
