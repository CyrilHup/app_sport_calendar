import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GarminActivity, GarminSyncState, GarminWorkoutTargetMode } from '../../types/garmin';
import { CalendarEvent } from '../../types/calendar';
import {
  clearGarminCredentials,
  loadGarminCredentials,
  loadGarminCredentialsAsync,
  parseGPXString,
  saveGarminCredentials,
  syncWithGarminAPI,
  cleanDuplicateGarminWorkouts,
  getGarminWorkoutTargetMode,
  setGarminWorkoutTargetMode
} from '../../services/garminService';
import {
  isGarminAutoSyncEnabled,
  setGarminAutoSyncEnabled,
  syncCurrentWeekWorkoutsToGarmin
} from '../../services/garminAutoSyncService';
import {
  Activity,
  CheckCircle2,
  FileUp,
  Gauge,
  RefreshCw,
  Trash2,
  Watch
} from 'lucide-react';

export interface GarminTabProps {
  garminState: GarminSyncState;
  onUpdateGarminState: (state: GarminSyncState) => void;
  onActivitiesSynced: (activities: GarminActivity[]) => void;
  calendarEvents: CalendarEvent[];
  onRefreshAll: () => void;
  onUpdateFcMax?: (fcMax: number) => void;
}

export const GarminTab: React.FC<GarminTabProps> = ({
  garminState,
  onUpdateGarminState,
  onActivitiesSynced,
  calendarEvents,
  onRefreshAll,
  onUpdateFcMax
}) => {
  const {
    user,
    saveCloudGarminCredentials,
    clearCloudGarminCredentials,
    updateProfile
  } = useAuth();

  const storedGarminCreds = loadGarminCredentials();
  const cloudGarminEmail = user?.user_metadata?.garmin_email;
  const cloudGarminPassword = user?.user_metadata?.garmin_password;

  const [garminEmail, setGarminEmail] = useState<string>(
    storedGarminCreds?.email || cloudGarminEmail || garminState.accountEmail || ''
  );
  const [garminPassword, setGarminPassword] = useState<string>(
    storedGarminCreds?.password || cloudGarminPassword || ''
  );
  const [garminSyncMsg, setGarminSyncMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isGarminProcessing, setIsGarminProcessing] = useState(false);
  const [showGarminCredsEdit, setShowGarminCredsEdit] = useState(!storedGarminCreds?.email && !cloudGarminEmail);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => isGarminAutoSyncEnabled());
  const [targetMode, setTargetMode] = useState<GarminWorkoutTargetMode>(() => getGarminWorkoutTargetMode());
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState<boolean>(false);
  const [cleanDuplicatesMsg, setCleanDuplicatesMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (user?.user_metadata?.garmin_email) {
      setGarminEmail(user.user_metadata.garmin_email);
      if (user.user_metadata.garmin_password) {
        setGarminPassword(user.user_metadata.garmin_password);
      }
      setShowGarminCredsEdit(false);
    }
  }, [user]);

  useEffect(() => {
    loadGarminCredentialsAsync().then(creds => {
      if (creds?.email) {
        setGarminEmail(prev => prev || creds.email || '');
        if (creds.password) {
          setGarminPassword(prev => prev || creds.password || '');
        }
      }
    });
  }, []);

  const handleGarminAPISync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsGarminProcessing(true);
    setGarminSyncMsg({ text: 'Connexion à Garmin Connect et extraction des activités...', isError: false });

    const creds = (garminEmail && garminPassword)
      ? { email: garminEmail, password: garminPassword }
      : (await loadGarminCredentialsAsync() || undefined);

    const result = await syncWithGarminAPI(creds);

    if (result.success) {
      if (garminEmail && garminPassword) {
        saveGarminCredentials({ email: garminEmail, password: garminPassword });
        if (user) {
          saveCloudGarminCredentials(garminEmail, garminPassword);
        }
      }
      onActivitiesSynced(result.activities);
      onUpdateGarminState({
        connected: true,
        lastSyncTime: new Date().toISOString(),
        accountEmail: garminEmail || storedGarminCreds?.email || 'Compte Garmin',
        activitiesCount: result.count,
        isSyncing: false
      });
      if (result.athleteMaxHr) {
        if (onUpdateFcMax) onUpdateFcMax(result.athleteMaxHr);
        updateProfile({ fcMax: result.athleteMaxHr }).catch(() => {});
      }

      // Ensure current week workouts are pushed / updated on Garmin Forerunner 55
      let pushFeedback = '';
      try {
        if (calendarEvents && calendarEvents.length > 0) {
          const pushRes = await syncCurrentWeekWorkoutsToGarmin(calendarEvents, new Date(), { force: true });
          if (pushRes.pushedCount > 0) {
            pushFeedback = ` • ${pushRes.pushedCount} séance${pushRes.pushedCount > 1 ? 's' : ''} envoyée${pushRes.pushedCount > 1 ? 's' : ''} sur votre montre`;
          } else if (pushRes.alreadyUpToDate) {
            pushFeedback = ` • Séances de la semaine déjà à jour sur votre montre`;
          }
        }
      } catch (pushErr) {
        console.warn('Could not auto-push week workouts to Garmin:', pushErr);
      }

      setGarminSyncMsg({
        text: `✅ ${result.count} activité(s) synchronisée(s)${pushFeedback} !${result.athleteMaxHr ? ` (FCmax : ${result.athleteMaxHr} bpm)` : ''}`,
        isError: false
      });

      onRefreshAll();
    } else {
      setGarminSyncMsg({
        text: `❌ ${result.error}`,
        isError: true
      });
    }
    setIsGarminProcessing(false);
  };

  const handleGarminDisconnect = () => {
    clearGarminCredentials();
    if (user) {
      clearCloudGarminCredentials();
    }
    setGarminEmail('');
    setGarminPassword('');
    setShowGarminCredsEdit(true);
    onUpdateGarminState({
      ...garminState,
      connected: false,
      accountEmail: undefined,
      lastSyncTime: undefined,
      activitiesCount: 0
    });
    setGarminSyncMsg({
      text: 'Identifiants Garmin dissociés.',
      isError: false
    });
  };

  const handleCleanDuplicates = async () => {
    setIsCleaningDuplicates(true);
    setCleanDuplicatesMsg(null);
    try {
      const res = await cleanDuplicateGarminWorkouts();
      if (res.success) {
        setCleanDuplicatesMsg({
          text: res.deletedCount > 0
            ? `✅ ${res.deletedCount} entraînement(s) en double supprimé(s) sur Garmin Connect !`
            : '✨ Aucun doublon sur votre compte Garmin.'
        });
      } else {
        setCleanDuplicatesMsg({ text: res.error || res.message, isError: true });
      }
    } catch (err: any) {
      setCleanDuplicatesMsg({ text: err.message || 'Erreur lors du nettoyage.', isError: true });
    } finally {
      setIsCleaningDuplicates(false);
      setTimeout(() => setCleanDuplicatesMsg(null), 5000);
    }
  };

  const handleGPXUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    setIsGarminProcessing(true);
    setGarminSyncMsg({ text: 'Analyse de la trace GPX...', isError: false });

    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const parsed = parseGPXString(text, file.name);
          onActivitiesSynced([parsed]);
          setIsGarminProcessing(false);
          setGarminSyncMsg({
            text: `✅ "${parsed.activityName}" importée (${parsed.durationMinutes} min, +${parsed.elevationGainM || 0}m D+).`,
            isError: false
          });
        } catch {
          setIsGarminProcessing(false);
          setGarminSyncMsg({ text: '❌ Erreur de lecture du fichier GPX.', isError: true });
        }
      }
    };

    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {garminSyncMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-xs)',
            background: garminSyncMsg.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            border: garminSyncMsg.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '0.8rem',
            color: garminSyncMsg.isError ? '#f87171' : '#34d399'
          }}
        >
          {garminSyncMsg.text}
        </div>
      )}

      {/* Account Connection Card */}
      <div
        style={{
          background: 'rgba(0, 119, 200, 0.08)',
          border: '1px solid rgba(0, 119, 200, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="#38bdf8" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>
                  {garminState.connected ? 'Garmin Connect Lié' : 'Connexion Garmin Connect'}
                </span>
                {garminState.connected && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      padding: '2px 7px',
                      borderRadius: 9999,
                      fontWeight: 700
                    }}
                  >
                    {garminState.activitiesCount || 0} activités
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {garminEmail || garminState.accountEmail || 'Non configuré'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!showGarminCredsEdit && (storedGarminCreds?.email || cloudGarminEmail) && (
              <button
                type="button"
                onClick={() => setShowGarminCredsEdit(true)}
                className="btn-secondary"
                style={{ fontSize: '0.74rem', padding: '5px 10px' }}
              >
                Modifier
              </button>
            )}
            {garminState.connected && (
              <button
                type="button"
                onClick={handleGarminDisconnect}
                className="btn-secondary"
                style={{ fontSize: '0.74rem', padding: '5px 10px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Dissocier
              </button>
            )}
          </div>
        </div>

        {/* Credentials Form (if editing or not connected) */}
        {(!storedGarminCreds?.email || showGarminCredsEdit) && (
          <form onSubmit={handleGarminAPISync} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Courriel Garmin Connect
                </label>
                <input
                  type="text"
                  value={garminEmail}
                  onChange={e => setGarminEmail(e.target.value)}
                  placeholder="votre-email@garmin.com"
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={garminPassword}
                  onChange={e => setGarminPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {storedGarminCreds?.email && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowGarminCredsEdit(false)}
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={isGarminProcessing}
                style={{ fontSize: '0.75rem', padding: '6px 14px' }}
              >
                Enregistrer & Tester
              </button>
            </div>
          </form>
        )}

        {/* Sync Now Action */}
        <button
          type="button"
          onClick={() => handleGarminAPISync()}
          className="btn-primary"
          disabled={isGarminProcessing}
          style={{
            justifyContent: 'center',
            padding: '10px 14px',
            fontSize: '0.82rem',
            background: '#0077c8',
            borderColor: '#0077c8',
            fontWeight: 700
          }}
        >
          <RefreshCw size={14} className={isGarminProcessing ? 'spin-animation' : ''} />
          <span>
            {isGarminProcessing ? 'Synchronisation en cours...' : 'Synchroniser les activités et séances'}
          </span>
        </button>
      </div>

      {/* Synchronisation Automatique de la Semaine (Toggle Row) */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Watch size={18} color="#38bdf8" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#fff' }}>
              Synchronisation automatique de la semaine
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Met à jour automatiquement les séances sur votre montre (Forerunner 55)
            </div>
          </div>
        </div>

        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={e => {
              const val = e.target.checked;
              setAutoSyncEnabled(val);
              setGarminAutoSyncEnabled(val);
            }}
          />
          <span className="settings-toggle-slider" />
        </label>
      </div>

      {/* Mode de Guidage des Cibles */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={16} color="#10b981" />
          <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#fff' }}>
            Mode de guidage des cibles sur la montre
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setTargetMode('SMART_PACE_AND_TRAIL_FREE');
              setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');
            }}
            style={{
              padding: '10px',
              borderRadius: 6,
              textAlign: 'left',
              cursor: 'pointer',
              border: targetMode === 'SMART_PACE_AND_TRAIL_FREE' ? '1.5px solid #10b981' : '1px solid var(--border-color)',
              background: targetMode === 'SMART_PACE_AND_TRAIL_FREE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              color: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', color: targetMode === 'SMART_PACE_AND_TRAIL_FREE' ? '#34d399' : '#fff' }}>
                ⚡ Allure intelligente
              </span>
              {targetMode === 'SMART_PACE_AND_TRAIL_FREE' && <CheckCircle2 size={13} color="#34d399" />}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              Allure sur le plat & libre en trail
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetMode('ALL_FREE');
              setGarminWorkoutTargetMode('ALL_FREE');
            }}
            style={{
              padding: '10px',
              borderRadius: 6,
              textAlign: 'left',
              cursor: 'pointer',
              border: targetMode === 'ALL_FREE' ? '1.5px solid #38bdf8' : '1px solid var(--border-color)',
              background: targetMode === 'ALL_FREE' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              color: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', color: targetMode === 'ALL_FREE' ? '#38bdf8' : '#fff' }}>
                🕊️ 100% Libre
              </span>
              {targetMode === 'ALL_FREE' && <CheckCircle2 size={13} color="#38bdf8" />}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              Guidage temps sans alerte d'allure
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetMode('HR_ONLY');
              setGarminWorkoutTargetMode('HR_ONLY');
            }}
            style={{
              padding: '10px',
              borderRadius: 6,
              textAlign: 'left',
              cursor: 'pointer',
              border: targetMode === 'HR_ONLY' ? '1.5px solid #f43f5e' : '1px solid var(--border-color)',
              background: targetMode === 'HR_ONLY' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              color: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', color: targetMode === 'HR_ONLY' ? '#f43f5e' : '#fff' }}>
                💓 Cardio classique
              </span>
              {targetMode === 'HR_ONLY' && <CheckCircle2 size={13} color="#f43f5e" />}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              Guidage par zones cardiaques
            </div>
          </button>
        </div>
      </div>

      {/* Outils & Entretien (Nettoyage des doublons & Import GPX) */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              Nettoyage des entraînements
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Supprime les doublons éventuels sur Garmin Connect
            </div>
          </div>
          <button
            type="button"
            onClick={handleCleanDuplicates}
            disabled={isCleaningDuplicates || isGarminProcessing}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#fca5a5',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              background: 'rgba(239, 68, 68, 0.08)'
            }}
          >
            <Trash2 size={12} className={isCleaningDuplicates ? 'spin-animation' : ''} />
            <span>{isCleaningDuplicates ? 'Nettoyage...' : 'Purger les doublons'}</span>
          </button>
        </div>

        {cleanDuplicatesMsg && (
          <div
            style={{
              fontSize: '0.74rem',
              color: cleanDuplicatesMsg.isError ? '#f87171' : '#34d399',
              background: cleanDuplicatesMsg.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              padding: '6px 10px',
              borderRadius: 4
            }}
          >
            {cleanDuplicatesMsg.text}
          </div>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              Import manuel d'activité
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Importer un fichier .gpx ponctuel
            </div>
          </div>
          <label
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.74rem'
            }}
          >
            <FileUp size={13} color="var(--primary)" />
            <span>Sélectionner GPX</span>
            <input type="file" accept=".gpx" onChange={handleGPXUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
};
