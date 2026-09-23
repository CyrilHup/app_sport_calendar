import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GarminActivity, GarminSyncState, GarminWorkoutTargetMode } from '../../types/garmin';
import {
  clearGarminCredentials,
  loadGarminCredentials,
  loadGarminCredentialsAsync,
  parseGPXString,
  saveGarminCredentials,
  syncWithGarminAPI,
  getGarminWorkoutTargetMode,
  setGarminWorkoutTargetMode
} from '../../services/garminService';
import {
  isGarminAutoSyncEnabled,
  setGarminAutoSyncEnabled
} from '../../services/garminAutoSyncService';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  Gauge,
  LogIn,
  LogOut,
  RefreshCw,
  Watch
} from 'lucide-react';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';

export interface GarminTabProps {
  garminState: GarminSyncState;
  activities: GarminActivity[];
  onUpdateGarminState: (state: GarminSyncState) => void;
  onActivitiesSynced: (activities: GarminActivity[]) => void;
  onRefreshFromSyncedGarmin: () => void;
  onUpdateFcMax?: (fcMax: number) => void;
}

export const GarminTab: React.FC<GarminTabProps> = ({
  garminState,
  activities,
  onUpdateGarminState,
  onActivitiesSynced,
  onRefreshFromSyncedGarmin,
  onUpdateFcMax
}) => {
  const scheduleTimeout = useManagedTimeout();
  const {
    user,
    isConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    saveCloudGarminCredentials,
    clearCloudGarminCredentials,
    updateProfile
  } = useAuth();

  const storedGarminCreds = loadGarminCredentials();
  const cloudGarminEmail = user?.user_metadata?.garmin_email;

  const [garminEmail, setGarminEmail] = useState<string>(
    storedGarminCreds?.email || cloudGarminEmail || garminState.accountEmail || ''
  );
  const [garminPassword, setGarminPassword] = useState<string>(
    storedGarminCreds?.password || ''
  );
  const [garminSyncMsg, setGarminSyncMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isGarminProcessing, setIsGarminProcessing] = useState(false);
  const [showGarminCredsEdit, setShowGarminCredsEdit] = useState(!storedGarminCreds?.password);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => isGarminAutoSyncEnabled());
  const [targetMode, setTargetMode] = useState<GarminWorkoutTargetMode>(() => getGarminWorkoutTargetMode());
  const [showSupabaseEmailForm, setShowSupabaseEmailForm] = useState(false);
  const [supabaseSignUpMode, setSupabaseSignUpMode] = useState(false);
  const [supabaseEmail, setSupabaseEmail] = useState('');
  const [supabasePassword, setSupabasePassword] = useState('');
  const [supabaseDisplayName, setSupabaseDisplayName] = useState('');
  const [supabaseAuthMsg, setSupabaseAuthMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSupabaseAuthProcessing, setIsSupabaseAuthProcessing] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.garmin_email) {
      setGarminEmail(user.user_metadata.garmin_email);
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

  const handleSupabaseAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseAuthMsg(null);
    setIsSupabaseAuthProcessing(true);

    try {
      const result = supabaseSignUpMode
        ? await signUp(supabaseEmail.trim(), supabasePassword, supabaseDisplayName.trim())
        : await signIn(supabaseEmail.trim(), supabasePassword);

      if (result.error) {
        setSupabaseAuthMsg({ text: result.error, isError: true });
      } else {
        setSupabasePassword('');
        setSupabaseAuthMsg({
          text: supabaseSignUpMode
            ? 'Compte créé. Validez votre courriel si Supabase le demande, puis connectez-vous.'
            : 'Connexion Supabase réussie. La synchronisation cloud est active.',
          isError: false
        });
      }
    } catch (error) {
      setSupabaseAuthMsg({
        text: error instanceof Error ? error.message : 'Connexion Supabase impossible.',
        isError: true
      });
    } finally {
      setIsSupabaseAuthProcessing(false);
    }
  };

  const handleSupabaseGoogleSignIn = async () => {
    setSupabaseAuthMsg(null);
    setIsSupabaseAuthProcessing(true);
    const result = await signInWithGoogle();
    if (result.error) {
      setSupabaseAuthMsg({ text: result.error, isError: true });
      setIsSupabaseAuthProcessing(false);
    }
  };

  const handleSupabaseSignOut = async () => {
    setIsSupabaseAuthProcessing(true);
    await signOut();
    setSupabaseAuthMsg(null);
    setIsSupabaseAuthProcessing(false);
  };

  const handleGarminAPISync = async (e?: React.FormEvent, mode: 'incremental' | 'full' = 'incremental') => {
    if (e) e.preventDefault();
    setIsGarminProcessing(true);
    setGarminSyncMsg({
      text: mode === 'full'
        ? 'Connexion à Garmin Connect et récupération de tout votre historique complet...'
        : 'Connexion à Garmin Connect et synchronisation incrémentielle rapide...',
      isError: false
    });

    const creds = (garminEmail && garminPassword)
      ? { email: garminEmail, password: garminPassword }
      : (await loadGarminCredentialsAsync() || undefined);

    const result = await syncWithGarminAPI(creds, { mode });

    if (result.success) {
      if (garminEmail && garminPassword) {
        saveGarminCredentials({ email: garminEmail, password: garminPassword });
        if (user) {
          await saveCloudGarminCredentials(garminEmail);
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
        await updateProfile({ fcMax: result.athleteMaxHr });
      }

      setGarminSyncMsg({
        text: `✅ ${result.count} activité(s) dans votre historique${mode === 'full' ? ' complet' : ''} !${result.athleteMaxHr ? ` (FCmax : ${result.athleteMaxHr} bpm)` : ''}`,
        isError: false
      });

      onRefreshFromSyncedGarmin();
    } else {
      // Any partial sync can still return valid activities. Expose them without
      // presenting the overall Garmin sync as complete.
      if (result.activities.length > 0) {
        onActivitiesSynced(result.activities);
      }
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
        } catch (error) {
          setIsGarminProcessing(false);
          setGarminSyncMsg({
            text: `❌ ${error instanceof Error ? error.message : 'Erreur de lecture du fichier GPX.'}`,
            isError: true
          });
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

        {/* Sync Actions: Incremental (Fast) & Full History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => handleGarminAPISync(undefined, 'incremental')}
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
            title="Synchronise uniquement les dernières séances récentes et les éventuelles modifications"
          >
            <RefreshCw size={14} className={isGarminProcessing ? 'spin-animation' : ''} />
            <span>
              {isGarminProcessing ? 'Synchronisation en cours...' : '⚡ Synchronisation Rapide (Incrémentielle)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleGarminAPISync(undefined, 'full')}
            className="btn-secondary"
            disabled={isGarminProcessing}
            style={{
              justifyContent: 'center',
              padding: '8px 12px',
              fontSize: '0.76rem',
              borderColor: 'rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Télécharge l'intégralité de vos activités Garmin depuis l'achat de la montre et les sauvegarde sur votre cloud Supabase"
          >
            <Activity size={14} />
            <span>
              🌐 Synchronisation Complète (Tout l'historique de la montre)
            </span>
          </button>
        </div>
      </div>

      {/* Supabase account used for cloud sync */}
      <div
        style={{
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.28)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#a78bfa" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>Compte Supabase connecté</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{user.email || 'Compte authentifié'}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleSupabaseSignOut()}
                disabled={isSupabaseAuthProcessing}
                style={{ fontSize: '0.72rem', padding: '5px 9px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <LogOut size={12} />
                Déconnexion
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Ce compte permet la synchronisation cloud de vos activités et réglages.
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogIn size={18} color="#a78bfa" />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>Connexion Supabase requise</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Connectez-vous pour utiliser la synchronisation cloud.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSupabaseGoogleSignIn()}
              disabled={!isConfigured || isSupabaseAuthProcessing}
              style={{ justifyContent: 'center', padding: '8px 12px', fontSize: '0.78rem', background: '#4285F4', borderColor: '#4285F4' }}
            >
              <span>{isSupabaseAuthProcessing ? 'Connexion…' : 'Continuer avec Google'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSupabaseEmailForm(previous => !previous);
                setSupabaseAuthMsg(null);
              }}
              aria-expanded={showSupabaseEmailForm}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <span>Ou utiliser courriel et mot de passe</span>
              {showSupabaseEmailForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showSupabaseEmailForm && (
              <form onSubmit={handleSupabaseAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                {supabaseSignUpMode && (
                  <input
                    type="text"
                    placeholder="Nom ou prénom"
                    value={supabaseDisplayName}
                    onChange={e => setSupabaseDisplayName(e.target.value)}
                    required
                    style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.78rem' }}
                  />
                )}
                <input
                  type="email"
                  required
                  placeholder="Courriel"
                  value={supabaseEmail}
                  onChange={e => setSupabaseEmail(e.target.value)}
                  style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.78rem' }}
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mot de passe"
                  value={supabasePassword}
                  onChange={e => setSupabasePassword(e.target.value)}
                  style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.78rem' }}
                />
                <button type="submit" className="btn-secondary" disabled={!isConfigured || isSupabaseAuthProcessing} style={{ justifyContent: 'center', padding: '7px' }}>
                  {isSupabaseAuthProcessing ? 'Chargement…' : supabaseSignUpMode ? "S'inscrire" : 'Se connecter'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupabaseSignUpMode(previous => !previous);
                    setSupabaseAuthMsg(null);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer' }}
                >
                  {supabaseSignUpMode ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
                </button>
              </form>
            )}

            {!isConfigured && (
              <div style={{ color: '#fbbf24', fontSize: '0.7rem' }}>
                Supabase n’est pas configuré dans les variables publiques de l’application.
              </div>
            )}
            {supabaseAuthMsg && (
              <div
                role="status"
                style={{
                  color: supabaseAuthMsg.isError ? '#f87171' : '#34d399',
                  background: supabaseAuthMsg.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  padding: '6px 9px',
                  borderRadius: 4,
                  fontSize: '0.72rem'
                }}
              >
                {supabaseAuthMsg.text}
              </div>
            )}
          </>
        )}
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
            {autoSyncEnabled && !storedGarminCreds?.password && (
              <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: 6 }}>
                Les activités déjà importées restent visibles. Si la session Garmin du serveur a expiré,
                renseignez vos identifiants ci-dessus pour reprendre l’envoi des séances.
              </div>
            )}
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

      {/* Import manuel d’activité GPX */}
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
