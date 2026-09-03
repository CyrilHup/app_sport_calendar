import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import {
  downloadICSFile,
  getStoredGCalClientId,
  saveGCalClientId,
  syncDirectToGoogleCalendar,
  GCalSyncProgress
} from '../services/googleCalendarService';
import {
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Key,
  Layers,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  events
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [clientId, setClientId] = useState(getStoredGCalClientId());
  const [syncProgress, setSyncProgress] = useState<GCalSyncProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'direct' | 'subscribe' | 'file'>('file');

  const subscriptionUrl = `${window.location.origin}/api/calendar.ics`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(subscriptionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadICSFile(events, 'qmt80_training_schedule.ics');
  };

  const handleOAuthSync = async () => {
    if (!clientId) {
      alert("Please provide a Google OAuth Client ID to connect directly via Google API.");
      return;
    }

    saveGCalClientId(clientId);
    setSyncProgress({
      total: events.length,
      current: 0,
      status: 'SYNCING',
      message: 'Requesting Google Calendar authorization...'
    });

    try {
      // Load Google Identity Services dynamically if needed
      if (!(window as any).google?.accounts?.oauth2) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.body.appendChild(script);
        await new Promise(resolve => (script.onload = resolve));
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setSyncProgress({
              total: events.length,
              current: 0,
              status: 'ERROR',
              message: `Authorization failed: ${tokenResponse.error}`
            });
            return;
          }

          const accessToken = tokenResponse.access_token;
          await syncDirectToGoogleCalendar(events, accessToken, 'primary', setSyncProgress);
        }
      });

      client.requestAccessToken();
    } catch (err: any) {
      setSyncProgress({
        total: events.length,
        current: 0,
        status: 'ERROR',
        message: err.message || 'OAuth error occurred'
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #4285F4, #34A853)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calendar size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                Google Calendar Synchronization
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Sync your entire training schedule & classes directly to Google Calendar
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ gap: '14px' }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-xs)', padding: 3, gap: 4 }}>
            <button
              onClick={() => setActiveTab('file')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'file' ? 'var(--primary-subtle)' : 'transparent',
                color: activeTab === 'file' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              ⚡ 1-Click File Import
            </button>

            <button
              onClick={() => setActiveTab('subscribe')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'subscribe' ? 'var(--primary-subtle)' : 'transparent',
                color: activeTab === 'subscribe' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              📡 Live URL Feed
            </button>

            <button
              onClick={() => setActiveTab('direct')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'direct' ? 'var(--primary-subtle)' : 'transparent',
                color: activeTab === 'direct' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              🔑 Direct Google API
            </button>
          </div>

          {/* Tab 1: 1-Click File Import */}
          {activeTab === 'file' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px 14px',
                  fontSize: '0.8rem',
                  lineHeight: 1.5
                }}
              >
                <strong>Fastest Zero-Setup Method:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  Download the generated calendar file and import it directly into your Google Calendar. It includes all <strong>{events.length} events</strong> (trail workouts with elevation targets, ÉTS courses, and commutes) perfectly formatted.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  onClick={handleDownload}
                  style={{ flex: '1 1 200px', padding: '10px 14px', justifyContent: 'center' }}
                >
                  <Download size={15} />
                  <span>Download .ICS Calendar File</span>
                </button>

                <a
                  href="https://calendar.google.com/calendar/r/settings/export"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ flex: '1 1 200px', padding: '10px 14px', justifyContent: 'center', textDecoration: 'none' }}
                >
                  <ExternalLink size={15} />
                  <span>Open Google Calendar Import Page</span>
                </a>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: 4 }}>
                💡 <em>Steps:</em> Click "Download .ICS" ➔ Open Google Calendar Import Page ➔ Select the downloaded file and click "Import". You're done in 10 seconds!
              </div>
            </div>
          )}

          {/* Tab 2: Live Subscription Feed */}
          {activeTab === 'subscribe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Subscribe to this live feed URL in Google Calendar or your smartphone. Any updates will automatically synchronize in the background:
              </p>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={subscriptionUrl}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xs)',
                    color: '#fff',
                    fontSize: '0.8rem'
                  }}
                />
                <button className="btn-secondary" onClick={handleCopyUrl} style={{ padding: '8px 12px' }}>
                  {copied ? <CheckCircle2 size={15} color="#00e676" /> : <Copy size={15} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <a
                href="https://calendar.google.com/calendar/r/settings/addbyurl"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none', justifyContent: 'center', padding: '9px 12px' }}
              >
                <ExternalLink size={14} />
                <span>Open Google Calendar "Add by URL"</span>
              </a>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                📌 In Google Calendar, click <em>Other calendars (+)</em> ➔ <em>From URL</em> ➔ Paste the link.
              </div>
            </div>
          )}

          {/* Tab 3: Direct Google API OAuth */}
          {activeTab === 'direct' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Connect directly using Google Calendar REST API. Pushes all events straight to your primary Google Calendar:
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Google OAuth Client ID (from Google Cloud Console)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xs)',
                    color: '#fff',
                    fontSize: '0.8rem'
                  }}
                />
              </div>

              {syncProgress && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-xs)',
                    background: syncProgress.status === 'SUCCESS' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 242, 254, 0.1)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{syncProgress.message}</span>
                    {syncProgress.total > 0 && (
                      <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                    )}
                  </div>
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handleOAuthSync}
                style={{ padding: '10px 14px', justifyContent: 'center' }}
              >
                <Sparkles size={15} />
                <span>Authorize & Sync to Google Calendar</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
