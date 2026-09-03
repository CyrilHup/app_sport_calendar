import React, { useState } from 'react';
import { GarminActivity, GarminSyncState } from '../types/garmin';
import { parseGPXString, syncWithGarminAPI } from '../services/garminService';
import { Activity, CheckCircle2, FileUp, Info, Key, Lock, Mail, RefreshCw, X, Zap } from 'lucide-react';

interface GarminModalProps {
  isOpen: boolean;
  onClose: () => void;
  garminState: GarminSyncState;
  onUpdateState: (state: GarminSyncState) => void;
  onActivitiesSynced: (activities: GarminActivity[]) => void;
}

export const GarminModal: React.FC<GarminModalProps> = ({
  isOpen,
  onClose,
  garminState,
  onUpdateState,
  onActivitiesSynced
}) => {
  if (!isOpen) return null;

  const [activeSubTab, setActiveSubTab] = useState<'api' | 'upload' | 'env'>('api');
  const [email, setEmail] = useState(garminState.accountEmail || '');
  const [password, setPassword] = useState('');
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAPISync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing(true);
    setSyncMessage({ text: 'Connecting to Garmin API and fetching activities...', isError: false });

    const creds = email && password ? { email, password } : undefined;
    const result = await syncWithGarminAPI(creds);

    setIsProcessing(false);
    if (result.success) {
      onActivitiesSynced(result.activities);
      onUpdateState({
        connected: true,
        lastSyncTime: new Date().toISOString(),
        accountEmail: email || 'Garmin Account',
        activitiesCount: result.count,
        isSyncing: false,
        mode: 'LIVE'
      });
      setSyncMessage({
        text: `✅ Successfully synchronized ${result.count} real workout(s) directly from Garmin Connect!`,
        isError: false
      });
    } else {
      setSyncMessage({
        text: `❌ ${result.error}`,
        isError: true
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    setIsProcessing(true);
    setSyncMessage({ text: 'Parsing GPX activity track...', isError: false });

    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const parsed = parseGPXString(text, file.name);
          onActivitiesSynced([parsed]);
          setIsProcessing(false);
          setSyncMessage({
            text: `✅ Successfully imported "${parsed.activityName}" (${parsed.durationMinutes} min, +${parsed.elevationGainM || 0}m D+).`,
            isError: false
          });
        } catch {
          setIsProcessing(false);
          setSyncMessage({ text: '❌ Error parsing GPX file. Verify track format.', isError: true });
        }
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-xs)',
                background: '#0077c8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Activity size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                Garmin API Telemetry Sync
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Live synchronization with Garmin Connect — Zero hardcoded data
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '14px' }}>
          {syncMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-xs)',
                background: syncMessage.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                border: syncMessage.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.8rem',
                color: syncMessage.isError ? '#f87171' : '#34d399'
              }}
            >
              {syncMessage.text}
            </div>
          )}

          {/* Sub-tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-xs)', padding: 3, gap: 4 }}>
            <button
              onClick={() => setActiveSubTab('api')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'api' ? 'var(--primary-subtle)' : 'transparent',
                color: activeSubTab === 'api' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              ⚡ Live Garmin API
            </button>

            <button
              onClick={() => setActiveSubTab('upload')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'upload' ? 'var(--primary-subtle)' : 'transparent',
                color: activeSubTab === 'upload' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              📁 Drop GPX File
            </button>

            <button
              onClick={() => setActiveSubTab('env')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'env' ? 'var(--primary-subtle)' : 'transparent',
                color: activeSubTab === 'env' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              🔑 Auto-Sync (.env)
            </button>
          </div>

          {/* TAB 1: LIVE GARMIN API */}
          {activeSubTab === 'api' && (
            <form onSubmit={handleAPISync} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)'
                }}
              >
                Connects directly to your <strong>Garmin Connect</strong> account via the internal Garmin API and pulls your real activities (runs, trail sessions, workouts, HR telemetry, and elevation D+).
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Garmin Connect Email / Username
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your-email@example.com (or leave empty if in .env)"
                    style={{
                      width: '100%',
                      padding: '9px 10px 9px 32px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-xs)',
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Garmin Connect Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password (or leave empty if in .env)"
                    style={{
                      width: '100%',
                      padding: '9px 10px 9px 32px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-xs)',
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isProcessing}
                style={{ justifyContent: 'center', padding: '11px', marginTop: 4 }}
              >
                <RefreshCw size={14} className={isProcessing ? 'spin-animation' : ''} />
                <span>{isProcessing ? 'Connecting & Fetching Activities...' : '⚡ Synchronize Live with Garmin API'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: GPX FILE DROP */}
          {activeSubTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '24px 16px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <FileUp size={28} color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                  Drop your activity file (.gpx) or click to browse
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Exported directly from Garmin Connect or your GPS watch
                </span>
                <input type="file" accept=".gpx" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                💡 <em>Export from Garmin Connect:</em> Open the activity ➔ Click the gear icon ⚙️ ➔ Click <strong>"Export to GPX"</strong>.
              </div>
            </div>
          )}

          {/* TAB 3: AUTO-SYNC .ENV CONFIG */}
          {activeSubTab === 'env' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
                <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={14} color="var(--primary)" /> Zero-Click Automatic Startup Sync:
                </strong>
                <p style={{ marginTop: 4 }}>
                  You can configure your Garmin credentials in your local <code>.env</code> file. The app will automatically synchronize with Garmin Connect on page load without needing manual password entry:
                </p>
                <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: 4, color: '#e2e8f0', fontSize: '0.75rem', overflowX: 'auto', marginTop: 6 }}>
{`# Add to your .env file:
GARMIN_EMAIL="your-garmin-email@example.com"
GARMIN_PASSWORD="your-garmin-password"`}
                </pre>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                🔒 Your credentials remain stored locally on your machine and are never pushed to git.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
