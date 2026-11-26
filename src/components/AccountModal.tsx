import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GarminActivity, GarminSyncState } from '../types/garmin';
import type {
  GarminActivitySyncMode,
  GarminActivitySyncResult,
  GarminCredentials
} from '../services/garminService';
import {
  Activity,
  Share2,
  User as UserIcon,
  X
} from 'lucide-react';
import { ProfileTab } from './account/ProfileTab';
import { GarminTab } from './account/GarminTab';
import { ShareTab } from './account/ShareTab';
import './AccountModal.css';

export type AccountModalTab = 'profile' | 'garmin' | 'share';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AccountModalTab;
  garminState: GarminSyncState;
  garminActivities: GarminActivity[];
  onUpdateGarminState: (state: GarminSyncState) => void;
  onActivitiesSynced: (activities: GarminActivity[]) => void;
  onRequestGarminSync: (
    mode: GarminActivitySyncMode,
    credentials?: GarminCredentials
  ) => Promise<GarminActivitySyncResult | null>;
  onRefreshAll: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
  garminState,
  garminActivities,
  onUpdateGarminState,
  onActivitiesSynced,
  onRequestGarminSync,
  onRefreshAll
}) => {
  const [activeTab, setActiveTab] = useState<AccountModalTab>(initialTab);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
      } else if (document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay account-modal-overlay" onClick={onClose}>
      <div
        className="modal-content account-modal-shell"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        {/* Modal Header */}
        <div className="modal-header account-modal-header">
          <div className="account-modal-heading">
            <h2 id="account-modal-title">Paramètres</h2>
            {user?.email && <span>{user.email}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="account-modal-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className="account-modal-tabs"
          role="tablist"
          aria-label="Sections des paramètres"
          onKeyDown={event => {
            const tabOrder: AccountModalTab[] = ['profile', 'garmin', 'share'];
            const currentIndex = tabOrder.indexOf(activeTab);
            let nextIndex = currentIndex;

            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              nextIndex = (currentIndex + 1) % tabOrder.length;
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              nextIndex = (currentIndex + tabOrder.length - 1) % tabOrder.length;
            } else if (event.key === 'Home') {
              nextIndex = 0;
            } else if (event.key === 'End') {
              nextIndex = tabOrder.length - 1;
            } else {
              return;
            }

            event.preventDefault();
            const nextTab = tabOrder[nextIndex];
            if (!nextTab) return;
            setActiveTab(nextTab);
            document.getElementById(`account-tab-${nextTab}`)?.focus();
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="account-modal-tab"
            role="tab"
            id="account-tab-profile"
            aria-selected={activeTab === 'profile'}
            aria-controls="account-modal-panel"
            tabIndex={activeTab === 'profile' ? 0 : -1}
          >
            <UserIcon size={14} />
            <span>Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('garmin')}
            className="account-modal-tab"
            role="tab"
            id="account-tab-garmin"
            aria-selected={activeTab === 'garmin'}
            aria-controls="account-modal-panel"
            tabIndex={activeTab === 'garmin' ? 0 : -1}
          >
            <Activity size={14} />
            <span>Garmin</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className="account-modal-tab"
            role="tab"
            id="account-tab-share"
            aria-selected={activeTab === 'share'}
            aria-controls="account-modal-panel"
            tabIndex={activeTab === 'share' ? 0 : -1}
          >
            <Share2 size={14} />
            <span>Partager</span>
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="modal-body account-modal-body"
          id="account-modal-panel"
          role="tabpanel"
          aria-labelledby={`account-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'profile' && <ProfileTab onRefreshAll={onRefreshAll} />}

          {activeTab === 'garmin' && (
            <GarminTab
              garminState={garminState}
              activities={garminActivities}
              onUpdateGarminState={onUpdateGarminState}
              onActivitiesSynced={onActivitiesSynced}
              onRequestGarminSync={onRequestGarminSync}
            />
          )}

          {activeTab === 'share' && <ShareTab />}
        </div>
      </div>
    </div>
  );
};
