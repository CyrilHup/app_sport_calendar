import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GarminActivity, GarminSyncState, GarminWorkoutTargetMode } from '../../types/garmin';
import {
  clearGarminCredentials,
  hasGarminPersonalApi,
  loadGarminCredentials,
  loadGarminCredentialsAsync,
  parseGPXString,
  saveGarminCredentials,
  getGarminWorkoutTargetMode,
  setGarminWorkoutTargetMode
} from '../../services/garminService';
import type {
  GarminActivitySyncMode,
  GarminActivitySyncResult,
  GarminCredentials
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
  onRequestGarminSync: (
    mode: GarminActivitySyncMode,
    credentials?: GarminCredentials
  ) => Promise<GarminActivitySyncResult | null>;
}

export const GarminTab: React.FC<GarminTabProps> = ({
  garminState,
  activities,
  onUpdateGarminState,
  onActivitiesSynced,
  onRequestGarminSync
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
    clearCloudGarminCredentials
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
  const [personalApi, setPersonalApi] = useState(false);
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
    let active = true;
    void hasGarminPersonalApi().then(available => {
      if (active) {
        setPersonalApi(available);
        if (available) setShowGarminCredsEdit(false);
      }
    });
    return () => { active = false; };
  }, [user?.id]);

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

  const handleGarminAPISync = async (e?: React.FormEvent, mode: GarminActivitySyncMode = 'incremental') => {
    if (e) e.preventDefault();
    setIsGarminProcessing(true);
    setGarminSyncMsg({
      text: mode === 'full'
        ? 'Connexion à Garmin Connect et récupération de tout votre historique complet...'
        : 'Connexion à Garmin Connect et synchronisation incrémentielle rapide...',
      isError: false
    });

    try {
      const creds = personalApi ? undefined : (garminEmail && garminPassword)
        ? { email: garminEmail, password: garminPassword }
        : (await loadGarminCredentialsAsync() || undefined);
      const result = await onRequestGarminSync(mode, creds);
      if (!result) {
        setGarminSyncMsg({
          text: 'Synchronisation annulée : le compte connecté a changé avant la fin.',
          isError: true
        });
        return;
      }

      if (result.success) {
        if (!personalApi && garminEmail && garminPassword && user) {
          await saveCloudGarminCredentials(garminEmail);
        }

        setGarminSyncMsg({
          text: `${result.count} activités enregistrées dans l’application`,
          isError: false
        });
      } else {
        // The app pipeline already merges and persists any partial activities.
        setGarminSyncMsg({
          text: `❌ ${result.error || 'La synchronisation Garmin a échoué.'}`,
          isError: true
        });
      }
    } catch (error) {
      setGarminSyncMsg({
        text: `❌ ${error instanceof Error ? error.message : 'La synchronisation Garmin a échoué.'}`,
        isError: true
      });
    } finally {
      setIsGarminProcessing(false);
    }

  };

  const handleGarminCredentialsSubmit = async (event: React.FormEvent) => {
    if (!personalApi) {
      await handleGarminAPISync(event);
      return;
    }
    event.preventDefault();
    if (!garminEmail.trim() || !garminPassword) return;
    saveGarminCredentials({ email: garminEmail.trim(), password: garminPassword });
    setShowGarminCredsEdit(false);
    setGarminSyncMsg({
      text: 'Identifiants conservés pour cette session. La connexion sera vérifiée au prochain envoi vers la montre.',
      isError: false
    });
  };

  const handleGarminDisconnect = () => {
    clearGarminCredentials();
    if (user) {
      clearCloudGarminCredentials();
    }
    setGarminEmail('');
    setGarminPassword('');
    setShowGarminCredsEdit(!personalApi);
    if (personalApi) {
      setGarminSyncMsg({ text: 'Identifiants de publication oubliés sur cet appareil.', isError: false });
      return;
    }
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
    <div className="account-stack">
      {garminSyncMsg && (
        <div className={`account-feedback ${garminSyncMsg.isError ? 'account-feedback--error' : 'account-feedback--success'}`} role={garminSyncMsg.isError ? 'alert' : 'status'}>
          {garminSyncMsg.text}
        </div>
      )}

      {/* Account Connection Card */}
      <div className="account-card account-card--stack">
        <div className="account-row account-row--wrap">
          <div className="account-leading">
            <Activity size={18} />
            <div className="account-copy">
              <div className="account-title">
                {personalApi ? 'Garmin Connect · API personnelle' : 'Connexion Garmin Connect'}
              </div>
              <div className="account-description">
                {personalApi
                  ? 'Import des activités et du bien-être'
                  : (garminEmail || garminState.accountEmail || 'Non configuré')}
                {garminState.connected && ` · ${garminState.activitiesCount || 0} activités importées`}
              </div>
            </div>
          </div>

          <div className="account-actions">
            {!showGarminCredsEdit && (personalApi || storedGarminCreds?.email || cloudGarminEmail) && (
              <button
                type="button"
                onClick={() => setShowGarminCredsEdit(true)}
                className="btn-secondary"
              >
                {personalApi ? 'Connexion pour la montre' : 'Modifier'}
              </button>
            )}
            {(personalApi ? Boolean(storedGarminCreds?.email) : garminState.connected) && (
              <button
                type="button"
                onClick={handleGarminDisconnect}
                className="btn-secondary"
              >
                {personalApi ? 'Oublier les identifiants' : 'Dissocier'}
              </button>
            )}
          </div>
        </div>

        {/* Credentials Form (if editing or not connected) */}
        {(showGarminCredsEdit || (!personalApi && !storedGarminCreds?.email)) && (
          <form onSubmit={handleGarminCredentialsSubmit} className="account-form account-form--separated">
            {personalApi && (
              <p className="account-description">
                L’envoi des séances planifiées vers la montre utilise cette connexion séparée.
              </p>
            )}
            <div className="account-form-grid">
              <div className="account-field">
                <label htmlFor="garmin-account-email">
                  Courriel Garmin Connect
                </label>
                <input
                  id="garmin-account-email"
                  type="email"
                  value={garminEmail}
                  onChange={e => setGarminEmail(e.target.value)}
                  placeholder="votre-email@garmin.com"
                />
              </div>
              <div className="account-field">
                <label htmlFor="garmin-account-password">
                  Mot de passe
                </label>
                <input
                  id="garmin-account-password"
                  type="password"
                  value={garminPassword}
                  onChange={e => setGarminPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="account-action-row account-action-row--end">
              {(personalApi || storedGarminCreds?.email) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowGarminCredsEdit(false)}
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={isGarminProcessing}
              >
                {personalApi ? 'Enregistrer pour la session' : 'Enregistrer et tester'}
              </button>
            </div>
          </form>
        )}

        {/* Sync Actions: Incremental (Fast) & Full History */}
        <div className="account-form account-garmin-actions">
          <button
            type="button"
            onClick={() => handleGarminAPISync(undefined, 'incremental')}
            className="btn-primary"
            disabled={isGarminProcessing}
            title="Synchronise uniquement les dernières séances récentes et les éventuelles modifications"
          >
            <RefreshCw size={14} className={isGarminProcessing ? 'spin-animation' : ''} />
            <span>
              {isGarminProcessing ? 'Synchronisation en cours…' : 'Importer les activités récentes'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleGarminAPISync(undefined, 'full')}
            className="btn-secondary"
            disabled={isGarminProcessing}
            title="Importe les activités disponibles via Garmin Connect"
          >
            <Activity size={14} />
            <span>
              Importer l’historique Garmin
            </span>
          </button>
        </div>
      </div>

      {/* Supabase account used for cloud sync */}
      <div className="account-card account-card--stack">
        {user ? (
          <>
            <div className="account-row account-row--wrap">
              <div className="account-leading">
                <CheckCircle2 size={18} />
                <div>
                  <div className="account-title">Compte cloud connecté</div>
                  <div className="account-description">{user.email || 'Compte authentifié'}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleSupabaseSignOut()}
                disabled={isSupabaseAuthProcessing}
              >
                <LogOut size={12} />
                Déconnexion
              </button>
            </div>
            <div className="account-description">
              Ce compte permet la synchronisation cloud de vos activités et réglages.
            </div>
          </>
        ) : (
          <>
            <div className="account-leading">
              <LogIn size={18} />
              <div>
                <div className="account-title">Connexion cloud requise</div>
                <div className="account-description">
                  Connectez-vous pour utiliser la synchronisation cloud.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSupabaseGoogleSignIn()}
              disabled={!isConfigured || isSupabaseAuthProcessing}
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
              aria-controls={showSupabaseEmailForm ? 'supabase-email-form' : undefined}
              className="account-link-button account-link-button--center"
            >
              <span>Ou utiliser courriel et mot de passe</span>
              {showSupabaseEmailForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showSupabaseEmailForm && (
              <form id="supabase-email-form" onSubmit={handleSupabaseAuthSubmit} className="account-form account-form--separated">
                {supabaseSignUpMode && (
                  <div className="account-field">
                    <label htmlFor="supabase-signup-name">Nom ou prénom</label>
                    <input
                      id="supabase-signup-name"
                      type="text"
                      value={supabaseDisplayName}
                      onChange={e => setSupabaseDisplayName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="account-field">
                  <label htmlFor="supabase-account-email">Courriel</label>
                  <input
                    id="supabase-account-email"
                    type="email"
                    required
                    value={supabaseEmail}
                    onChange={e => setSupabaseEmail(e.target.value)}
                  />
                </div>
                <div className="account-field">
                  <label htmlFor="supabase-account-password">Mot de passe</label>
                  <input
                    id="supabase-account-password"
                    type="password"
                    required
                    minLength={6}
                    value={supabasePassword}
                    onChange={e => setSupabasePassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary account-form-submit" disabled={!isConfigured || isSupabaseAuthProcessing}>
                  {isSupabaseAuthProcessing ? 'Chargement…' : supabaseSignUpMode ? "S'inscrire" : 'Se connecter'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupabaseSignUpMode(previous => !previous);
                    setSupabaseAuthMsg(null);
                  }}
                  className="account-link-button"
                >
                  {supabaseSignUpMode ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
                </button>
              </form>
            )}

            {!isConfigured && (
              <div className="account-feedback">
                Supabase n’est pas configuré dans les variables publiques de l’application.
              </div>
            )}
            {supabaseAuthMsg && (
              <div className={`account-feedback ${supabaseAuthMsg.isError ? 'account-feedback--error' : 'account-feedback--success'}`} role={supabaseAuthMsg.isError ? 'alert' : 'status'}>
                {supabaseAuthMsg.text}
              </div>
            )}
          </>
        )}
      </div>

      {/* Synchronisation Automatique de la Semaine (Toggle Row) */}
      <div className="account-card account-row account-sync-toggle">
        <div className="account-leading">
          <Watch size={18} />
          <div>
            <div className="account-title">
              Synchronisation automatique de la semaine
            </div>
            <div className="account-description">
              Met à jour automatiquement les séances sur votre montre (Forerunner 55)
            </div>
            {autoSyncEnabled && !storedGarminCreds?.password && (
              <div className="account-description">
                Si la session Garmin du serveur a expiré, renseignez les identifiants de publication pour reprendre l’envoi.
              </div>
            )}
          </div>
        </div>

        <label className="settings-toggle-switch" aria-label="Synchronisation automatique des séances Garmin">
          <input
            type="checkbox"
            aria-label="Synchronisation automatique des séances Garmin"
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
      <div className="account-card account-card--stack">
        <div className="account-leading">
          <Gauge size={16} />
          <div className="account-title">
            Mode de guidage des cibles sur la montre
          </div>
        </div>

        <div className="account-choice-grid">
          <button
            type="button"
            className="account-choice"
            aria-pressed={targetMode === 'SMART_PACE_AND_TRAIL_FREE'}
            onClick={() => {
              setTargetMode('SMART_PACE_AND_TRAIL_FREE');
              setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');
            }}
          >
            <div className="account-choice-title">
              <span>Allure intelligente</span>
              {targetMode === 'SMART_PACE_AND_TRAIL_FREE' && <CheckCircle2 size={14} />}
            </div>
            <div className="account-choice-description">
              Allure sur le plat & libre en trail
            </div>
          </button>

          <button
            type="button"
            className="account-choice"
            aria-pressed={targetMode === 'ALL_FREE'}
            onClick={() => {
              setTargetMode('ALL_FREE');
              setGarminWorkoutTargetMode('ALL_FREE');
            }}
          >
            <div className="account-choice-title">
              <span>100 % libre</span>
              {targetMode === 'ALL_FREE' && <CheckCircle2 size={14} />}
            </div>
            <div className="account-choice-description">
              Guidage temps sans alerte d'allure
            </div>
          </button>

          <button
            type="button"
            className="account-choice"
            aria-pressed={targetMode === 'HR_ONLY'}
            onClick={() => {
              setTargetMode('HR_ONLY');
              setGarminWorkoutTargetMode('HR_ONLY');
            }}
          >
            <div className="account-choice-title">
              <span>Cardio classique</span>
              {targetMode === 'HR_ONLY' && <CheckCircle2 size={14} />}
            </div>
            <div className="account-choice-description">
              Guidage par zones cardiaques
            </div>
          </button>
        </div>
      </div>

      {/* Import manuel d’activité GPX */}
      <div className="account-card account-card--stack">
        <div className="account-row account-row--wrap">
          <div>
            <div className="account-title">
              Import manuel d'activité
            </div>
            <div className="account-description">
              Importer un fichier .gpx ponctuel
            </div>
          </div>
          <label className="btn-secondary account-file-button">
            <FileUp size={14} />
            <span>Sélectionner GPX</span>
            <input type="file" accept=".gpx" onChange={handleGPXUpload} />
          </label>
        </div>
      </div>
    </div>
  );
};
