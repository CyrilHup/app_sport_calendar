import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Save,
  Sparkles
} from 'lucide-react';
import { CalendarEvent } from '../../types/calendar';
import { triggerGoogleCalendarOAuthSync, downloadICSFile } from '../../services/googleCalendarService';

interface CalendarTabProps {
  calendarEvents: CalendarEvent[];
  onRefreshAll: () => void;
  isRecharging?: boolean;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  calendarEvents,
  onRefreshAll,
  isRecharging = false
}) => {
  const { profile, updateProfile } = useAuth();

  const [profIcal, setProfIcal] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  const [gcalSyncProgress, setGcalSyncProgress] = useState<{
    current: number;
    total: number;
    message: string;
    status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  } | null>(null);

  const [showAdvancedCalendarOptions, setShowAdvancedCalendarOptions] = useState(false);
  const [gcalCopied, setGcalCopied] = useState(false);

  useEffect(() => {
    if (profile?.icalUrl !== undefined) {
      setProfIcal(profile.icalUrl || '');
    }
  }, [profile?.icalUrl]);

  const subscriptionUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/calendar.ics` : '';

  const handleSaveIcalAndRefresh = async () => {
    setProfileSaving(true);
    const ok = await updateProfile({ icalUrl: profIcal });
    setProfileSaving(false);
    if (ok) {
      setProfileSuccessMsg('Flux iCal enregistré et planning actualisé.');
      onRefreshAll();
      setTimeout(() => setProfileSuccessMsg(''), 3500);
    }
  };

  const handleDirectGoogleCalendarSync = async () => {
    const res = await triggerGoogleCalendarOAuthSync(calendarEvents, setGcalSyncProgress);
    if (res.success) {
      setTimeout(() => {
        setGcalSyncProgress(null);
      }, 4000);
    }
  };

  const handleCopyGcalUrl = () => {
    if (!subscriptionUrl) return;
    navigator.clipboard.writeText(subscriptionUrl);
    setGcalCopied(true);
    setTimeout(() => setGcalCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* SECTION 1: Planning ÉTS */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="var(--primary)" />
            <strong style={{ fontSize: '0.86rem', color: '#fff' }}>
              Planning de cours ÉTS (iCal)
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              padding: '2px 7px',
              borderRadius: 9999,
              background: profIcal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              color: profIcal ? '#34d399' : 'var(--text-muted)',
              fontWeight: 700
            }}
          >
            {profIcal ? '🟢 Flux Enregistré' : 'Non configuré'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            placeholder="URL du flux .ics de vos cours..."
            value={profIcal}
            onChange={e => setProfIcal(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.8rem'
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveIcalAndRefresh}
            disabled={profileSaving || isRecharging}
            style={{ padding: '8px 14px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
          >
            <Save size={13} />
            <span>{profileSaving ? 'Sauvegarde...' : 'Enregistrer'}</span>
          </button>
        </div>

        {profileSuccessMsg && (
          <div
            style={{
              fontSize: '0.74rem',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '6px 10px',
              borderRadius: 4
            }}
          >
            {profileSuccessMsg}
          </div>
        )}
      </div>

      {/* SECTION 2: Google Agenda & Export */}
      <div
        style={{
          background: 'rgba(66, 133, 244, 0.06)',
          border: '1px solid rgba(66, 133, 244, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#4285F4" />
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#fff' }}>
                Google Agenda
              </strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Exporter {calendarEvents.length} séances et cours vers votre agenda
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleDirectGoogleCalendarSync}
            style={{
              background: '#4285F4',
              borderColor: '#4285F4',
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            <span>Synchroniser Google Agenda</span>
          </button>
        </div>

        {/* Progress bar if syncing */}
        {gcalSyncProgress && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background:
                gcalSyncProgress.status === 'SUCCESS'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(66, 133, 244, 0.15)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{gcalSyncProgress.message}</span>
              {gcalSyncProgress.total > 0 && (
                <strong>{Math.round((gcalSyncProgress.current / gcalSyncProgress.total) * 100)}%</strong>
              )}
            </div>
            {gcalSyncProgress.status === 'SYNCING' && gcalSyncProgress.total > 0 && (
              <div
                style={{
                  width: '100%',
                  height: 4,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${(gcalSyncProgress.current / gcalSyncProgress.total) * 100}%`,
                    height: '100%',
                    background: '#4285F4',
                    transition: 'width 0.2s'
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Advanced export options dropdown */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setShowAdvancedCalendarOptions(!showAdvancedCalendarOptions)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 0
            }}
          >
            <span>Autres options d'export (Abonnement iCal live, Fichier .ics)</span>
            {showAdvancedCalendarOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdvancedCalendarOptions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={subscriptionUrl}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: '0.75rem'
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopyGcalUrl}
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  {gcalCopied ? <CheckCircle2 size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{gcalCopied ? 'Copié' : 'Copier URL'}</span>
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadICSFile(calendarEvents, 'planning_qmt80.ics')}
                style={{ fontSize: '0.74rem', padding: '6px 12px', justifyContent: 'center', alignSelf: 'flex-start' }}
              >
                <Download size={13} />
                <span>Télécharger le fichier .ics</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
