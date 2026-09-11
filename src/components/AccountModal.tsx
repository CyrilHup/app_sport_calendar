import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GarminActivity, GarminSyncState, GarminWorkoutTargetMode } from '../types/garmin';
import { CalendarEvent } from '../types/calendar';
import {
  clearGarminCredentials,
  loadGarminCredentials,
  loadGarminCredentialsAsync,
  parseGPXString,
  saveGarminCredentials,
  syncWithGarminAPI,
  cleanDuplicateGarminWorkouts,
  getGarminWorkoutTargetMode,
  setGarminWorkoutTargetMode,
  getAthleteBasePace,
  setAthleteBasePace,
  formatSecondsToPace,
  parsePaceToSeconds
} from '../services/garminService';
import {
  isGarminAutoSyncEnabled,
  setGarminAutoSyncEnabled,
  syncCurrentWeekWorkoutsToGarmin
} from '../services/garminAutoSyncService';
import {
  downloadICSFile,
  triggerGoogleCalendarOAuthSync,
  GCalSyncProgress
} from '../services/googleCalendarService';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Gauge,
  Heart,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Moon,
  RefreshCw,
  Save,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  User as UserIcon,
  Watch,
  X,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getLatestWellnessData, calculateReadinessScore } from '../services/readinessEngine';

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

  const {
    user,
    profile,
    isConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateProfile,
    saveCloudGarminCredentials,
    clearCloudGarminCredentials
  } = useAuth();

  // Auth form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Profile fields
  const [profName, setProfName] = useState('');
  const [profHome, setProfHome] = useState('');
  const [profCampus, setProfCampus] = useState('');
  const [profFcMax, setProfFcMax] = useState<number>(203);
  const [profIcal, setProfIcal] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setProfName(profile.displayName || '');
      setProfHome(profile.homeAddress || '');
      setProfCampus(profile.campusAddress || '');
      setProfFcMax(profile.fcMax || 203);
      setProfIcal(profile.icalUrl || '');
    }
  }, [profile]);

  // Garmin state: Check local storage OR cloud user_metadata from Google account
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
  const [basePace, setBasePace] = useState<string>(() => getAthleteBasePace());
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
    if (isOpen) {
      loadGarminCredentialsAsync().then(creds => {
        if (creds?.email) {
          setGarminEmail(prev => prev || creds.email || '');
          if (creds.password) {
            setGarminPassword(prev => prev || creds.password || '');
          }
        }
      });
    }
  }, [isOpen]);

  // Google Calendar state
  const [gcalCopied, setGcalCopied] = useState(false);
  const [gcalSyncProgress, setGcalSyncProgress] = useState<GCalSyncProgress | null>(null);
  const [showAdvancedCalendarOptions, setShowAdvancedCalendarOptions] = useState(false);

  // Share state
  const [shareCopied, setShareCopied] = useState(false);
  const [shareSlug, setShareSlug] = useState(profile?.shareSlug || (user?.id ? user.id.slice(0, 8) : 'athlete'));
  const [isSharePublic, setIsSharePublic] = useState(profile?.isPublic ?? true);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    if (profile?.shareSlug) {
      setShareSlug(profile.shareSlug);
    }
    if (profile?.isPublic !== undefined) {
      setIsSharePublic(profile.isPublic);
    }
  }, [profile]);

  if (!isOpen) return null;

  const subscriptionUrl = `${window.location.origin}/api/calendar.ics`;
  const shareUrl = `${window.location.origin}?share=${shareSlug}`;

  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Direct';

  // --- Handlers: Auth ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg('');
    setAuthSuccessMsg('');
    setAuthSubmitting(true);

    if (isSignUp) {
      const res = await signUp(authEmail, authPassword, authDisplayName);
      if (res.error) {
        setAuthErrorMsg(res.error);
      } else {
        setAuthSuccessMsg('Compte créé avec succès ! Vos données sont synchronisées.');
      }
    } else {
      const res = await signIn(authEmail, authPassword);
      if (res.error) {
        setAuthErrorMsg(res.error);
      } else {
        setAuthSuccessMsg('Connexion réussie ! Vos données sont synchronisées.');
      }
    }
    setAuthSubmitting(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccessMsg('');

    const ok = await updateProfile({
      displayName: profName,
      homeAddress: profHome,
      campusAddress: profCampus,
      fcMax: profFcMax,
      icalUrl: profIcal
    });

    if (ok) {
      setProfileSuccessMsg('Profil et préférences mis à jour !');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
      onRefreshAll();
    }
    setProfileSaving(false);
  };

  // --- Handlers: iCal ÉTS direct save & refresh ---
  const handleSaveIcalAndRefresh = async () => {
    setProfileSaving(true);
    const ok = await updateProfile({ icalUrl: profIcal });
    setProfileSaving(false);
    if (ok) {
      setProfileSuccessMsg('Flux iCal enregistré ! Actualisation du planning en cours...');
      onRefreshAll();
      setTimeout(() => setProfileSuccessMsg(''), 3500);
    }
  };

  // --- Handlers: Garmin ---
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
        setProfFcMax(result.athleteMaxHr);
        updateProfile({ fcMax: result.athleteMaxHr }).catch(() => {});
      }

      // Also ensure current week workouts are pushed / updated on Garmin Forerunner 55
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
        text: `✅ ${result.count} activité(s) Garmin synchronisées${pushFeedback} !${result.athleteMaxHr ? ` (FCmax détectée : ${result.athleteMaxHr} bpm)` : ''}`,
        isError: false
      });

      // Refresh calendar & comparisons
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
      text: 'Identifiants Garmin dissociés (local et Cloud).',
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
            ? `✅ ${res.deletedCount} entraînement${res.deletedCount > 1 ? 's' : ''} en double supprimé${res.deletedCount > 1 ? 's' : ''} sur Garmin Connect !`
            : '✨ Aucun doublon détecté sur votre compte Garmin (tout est propre !).'
        });
      } else {
        setCleanDuplicatesMsg({ text: res.error || res.message, isError: true });
      }
    } catch (err: any) {
      setCleanDuplicatesMsg({ text: err.message || 'Erreur lors du nettoyage.', isError: true });
    } finally {
      setIsCleaningDuplicates(false);
      setTimeout(() => setCleanDuplicatesMsg(null), 7000);
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
            text: `✅ Activité "${parsed.activityName}" importée et synchronisée sur votre compte (${parsed.durationMinutes} min, +${parsed.elevationGainM || 0}m D+).`,
            isError: false
          });
        } catch {
          setIsGarminProcessing(false);
          setGarminSyncMsg({ text: '❌ Erreur lors de l\'analyse du fichier GPX. Vérifiez le format.', isError: true });
        }
      }
    };

    reader.readAsText(file);
  };

  // --- Handlers: Google Calendar 1-Click Sync ---
  const handleDirectGoogleCalendarSync = async () => {
    const res = await triggerGoogleCalendarOAuthSync(calendarEvents, setGcalSyncProgress);
    if (res.success) {
      setTimeout(() => {
        setGcalSyncProgress(null);
      }, 4000);
    }
  };

  const handleCopyGcalUrl = () => {
    navigator.clipboard.writeText(subscriptionUrl);
    setGcalCopied(true);
    setTimeout(() => setGcalCopied(false), 2000);
  };

  // --- Handlers: Share ---
  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleSaveShareSettings = async () => {
    setShareSaving(true);
    const ok = await updateProfile({
      shareSlug: shareSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      isPublic: isSharePublic
    });
    setShareSaving(false);
    if (ok) {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 620, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: user
                  ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                  : 'linear-gradient(135deg, var(--primary), #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              {user && (user.user_metadata?.avatar_url || user.user_metadata?.picture || profile?.avatarUrl) ? (
                <img
                  src={user.user_metadata?.avatar_url || user.user_metadata?.picture || profile?.avatarUrl}
                  alt={profile?.displayName || 'Avatar'}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              ) : user ? (
                profile?.displayName ? profile.displayName[0].toUpperCase() : 'G'
              ) : (
                '⚡'
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  {user ? (profile?.displayName || 'Mon Compte Athlète') : 'Espace Athlète & Synchronisation'}
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: user ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                    color: user ? '#34d399' : 'var(--text-secondary)',
                    fontWeight: 700,
                    border: user ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)'
                  }}
                >
                  {user ? '🟢 Compte Google Lié' : 'Mode Local'}
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {user
                  ? `Synchronisé sur tous vos appareils (${user.email})`
                  : 'Connectez votre compte pour synchroniser votre PC et votre smartphone'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Global Quick Refresh Strip */}
        <div
          style={{
            padding: '8px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isRecharging ? '#f59e0b' : '#10b981',
                display: 'inline-block'
              }}
            />
            <span>{isRecharging ? 'Synchronisation multi-flux en cours...' : `Dernière synchro : ${formattedSyncTime}`}</span>
          </div>
          <button
            className="btn-primary"
            onClick={onRefreshAll}
            disabled={isRecharging}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            <RefreshCw size={12} className={isRecharging ? 'spin-animation' : ''} />
            <span>{isRecharging ? 'En cours...' : 'Tout actualiser'}</span>
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
          {/* ================================================================= */}
          {/* TAB 1: COMPTE & PROFIL GOOGLE */}
          {/* ================================================================= */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Google Account Banner */}
              {user ? (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 800,
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      {user && (user.user_metadata?.avatar_url || user.user_metadata?.picture || profile?.avatarUrl) ? (
                        <img
                          src={user.user_metadata?.avatar_url || user.user_metadata?.picture || profile?.avatarUrl}
                          alt={profile?.displayName || 'Avatar'}
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        profile?.displayName ? profile.displayName[0].toUpperCase() : 'G'
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
                        {profile?.displayName || user.email}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> Compte Google synchronisé ({user.email})
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => signOut()}
                    style={{ fontSize: '0.74rem', padding: '5px 10px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  >
                    <LogOut size={12} />
                    <span>Déconnexion</span>
                  </button>
                </div>
              ) : (
                /* Unauthenticated: Clean Google Sign-In Hero */
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.08), rgba(255, 87, 34, 0.08))',
                    border: '1px solid rgba(66, 133, 244, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 12
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Connectez votre Compte Google
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 420 }}>
                      Synchronisez instantanément vos activités Garmin, votre calendrier de cours ÉTS et vos séances trail entre votre ordinateur et votre téléphone.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={async () => {
                      setAuthErrorMsg('');
                      const res = await signInWithGoogle();
                      if (res?.error) setAuthErrorMsg(res.error);
                    }}
                    style={{
                      padding: '11px 24px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      background: '#4285F4',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 'var(--radius-xs)',
                      cursor: 'pointer',
                      border: 'none',
                      marginTop: 4
                    }}
                  >
                    <span>Continuer avec Google</span>
                  </button>

                  {authErrorMsg && (
                    <div style={{ color: '#f87171', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: 4 }}>
                      {authErrorMsg}
                    </div>
                  )}

                  {/* Discreet Email fallback */}
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(!showEmailForm)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 4
                    }}
                  >
                    <span>Ou connexion classique par e-mail</span>
                    {showEmailForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showEmailForm && (
                    <form onSubmit={handleAuthSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                      {isSignUp && (
                        <input
                          type="text"
                          placeholder="Votre prénom / nom"
                          value={authDisplayName}
                          onChange={e => setAuthDisplayName(e.target.value)}
                          style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
                        />
                      )}
                      <input
                        type="email"
                        required
                        placeholder="votre-email@exemple.com"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
                      />
                      <input
                        type="password"
                        required
                        placeholder="Mot de passe"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
                      />
                      <button type="submit" className="btn-secondary" disabled={authSubmitting} style={{ justifyContent: 'center', padding: '8px' }}>
                        {authSubmitting ? 'Chargement...' : isSignUp ? "S'inscrire" : 'Se connecter'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Profile Details Form (always accessible) */}
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    Préférences de l'Athlète & Adresses Privées
                  </h4>
                  {profileSuccessMsg && (
                    <span style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 700 }}>
                      {profileSuccessMsg}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      Nom ou Pseudo d'athlète
                    </label>
                    <input
                      type="text"
                      value={profName}
                      onChange={e => setProfName(e.target.value)}
                      placeholder="Votre prénom ou pseudo"
                      style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      FC Max de l'Athlète (bpm)
                    </label>
                    <input
                      type="number"
                      value={profFcMax}
                      onChange={e => setProfFcMax(parseInt(e.target.value, 10) || 203)}
                      style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.82rem' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)' }}>
                      ⚡ Synchronisée automatiquement depuis votre profil et vos pics Garmin Connect.
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} /> Adresse Domicile (Privée)
                  </label>
                  <input
                    type="text"
                    value={profHome}
                    onChange={e => setProfHome(e.target.value)}
                    placeholder="Ex : 123 Rue Sherbrooke, Montréal, QC..."
                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.82rem' }}
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    🔒 Utilisée pour calculer les temps de transport en commun vers l'ÉTS et le Mont-Royal.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={profileSaving}
                  style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  <Save size={13} />
                  <span>{profileSaving ? 'Enregistrement...' : 'Enregistrer les préférences'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: CALENDRIERS & GOOGLE AGENDA */}
          {/* ================================================================= */}
          {activeTab === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* SECTION A: ÉTS iCal Feed */}
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
                    <strong style={{ fontSize: '0.88rem', color: '#fff' }}>
                      Planning Académique ÉTS (iCal)
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      borderRadius: 9999,
                      background: profIcal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: profIcal ? '#34d399' : '#f59e0b',
                      fontWeight: 700
                    }}
                  >
                    {profIcal ? '🟢 Flux Enregistré' : 'Flux Par Défaut'}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Collez l'URL de votre calendrier étudiant ÉTS. Elle est liée à votre Compte Google et synchronisée sur votre téléphone et PC.
                </p>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    placeholder="https://exemple.com/calendrier.ics"
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
                    <span>{profileSaving ? 'Sauvegarde...' : 'Sauvegarder & Actualiser'}</span>
                  </button>
                </div>

                {profileSuccessMsg && (
                  <div style={{ fontSize: '0.74rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: 4 }}>
                    {profileSuccessMsg}
                  </div>
                )}
              </div>

              {/* SECTION B: Direct 1-Click Google Calendar Sync */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.08), rgba(66, 133, 244, 0.03))',
                  border: '1px solid rgba(66, 133, 244, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: '#4285F4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}
                  >
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                      Synchronisation Directe Google Agenda
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      Poussez vos <strong>{calendarEvents.length} séances et cours</strong> directement dans votre Google Agenda.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDirectGoogleCalendarSync}
                  style={{
                    background: '#4285F4',
                    justifyContent: 'center',
                    padding: '12px 16px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    boxShadow: '0 4px 14px rgba(66, 133, 244, 0.35)'
                  }}
                >
                  <Sparkles size={16} />
                  <span>Synchroniser dans mon Google Agenda</span>
                </button>

                {/* Progress bar if syncing */}
                {gcalSyncProgress && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: gcalSyncProgress.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(66, 133, 244, 0.15)',
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
                      <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
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
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedCalendarOptions(!showAdvancedCalendarOptions)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0
                    }}
                  >
                    <span>Autres options (Abonnement URL live, Apple Calendar, Outlook)</span>
                    {showAdvancedCalendarOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showAdvancedCalendarOptions && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
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
                        <button type="button" className="btn-secondary" onClick={handleCopyGcalUrl} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                          {gcalCopied ? <CheckCircle2 size={13} color="#10b981" /> : <Copy size={13} />}
                          <span>{gcalCopied ? 'Copié !' : 'Copier'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => downloadICSFile(calendarEvents, 'planning_qmt80.ics')}
                        style={{ fontSize: '0.75rem', padding: '7px 12px', justifyContent: 'center' }}
                      >
                        <Download size={13} />
                        <span>Télécharger le fichier .ICS</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: GARMIN CONNECT */}
          {/* ================================================================= */}
          {activeTab === 'garmin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

              {/* Cloud Garmin Status Card */}
              <div
                style={{
                  background: 'rgba(0, 119, 200, 0.08)',
                  border: '1px solid rgba(0, 119, 200, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 800, fontSize: '0.88rem' }}>
                    <Activity size={16} />
                    <span>
                      {garminState.connected
                        ? `Connecté : ${garminState.activitiesCount} activités synchronisées`
                        : 'Garmin Connect'}
                    </span>
                    {user && (user.user_metadata?.garmin_email || garminEmail) && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          padding: '2px 7px',
                          borderRadius: 9999,
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontWeight: 700
                        }}
                      >
                        🟢 Lié au Compte Google
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {user
                      ? `Vos accès Garmin sont rattachés à votre compte Google (${user.email}). Ils se reconnectent et s'actualisent automatiquement à chaque ouverture.`
                      : 'Connectez votre compte Google pour sauvegarder vos identifiants Garmin et les synchroniser sur votre smartphone.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(!showGarminCredsEdit && (storedGarminCreds?.email || cloudGarminEmail)) && (
                    <button
                      type="button"
                      onClick={() => setShowGarminCredsEdit(true)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      Modifier
                    </button>
                  )}
                  {garminState.connected && (
                    <button
                      type="button"
                      onClick={handleGarminDisconnect}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      Dissocier
                    </button>
                  )}
                </div>
              </div>

              {/* Carte Synchronisation Automatique de la Semaine */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Watch size={18} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#fff' }}>
                      Synchronisation Automatique de la Semaine (Forerunner 55)
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Envoie et met à jour automatiquement les séances de la semaine courante (lundi au dimanche) sur votre montre. Dès qu'une séance est reportée, déplacée ou adaptée, Garmin est synchronisé sans émojis pour un affichage net.
                    </p>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={e => {
                      const val = e.target.checked;
                      setAutoSyncEnabled(val);
                      setGarminAutoSyncEnabled(val);
                    }}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Carte Mode de Guidage des Cibles & Anti-Vibrations */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04))',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Gauge size={18} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Guidage des Cibles Garmin & Anti-Vibrations</span>
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 800 }}>
                          ACTIF
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Évite les vibrations continues au poignet causées par des cibles cardiaques trop basses. Choisissez votre stratégie de guidage :
                      </p>
                    </div>
                  </div>
                </div>

                {/* Options de Guidage */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetMode('SMART_PACE_AND_TRAIL_FREE');
                      setGarminWorkoutTargetMode('SMART_PACE_AND_TRAIL_FREE');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: targetMode === 'SMART_PACE_AND_TRAIL_FREE' ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                      background: targetMode === 'SMART_PACE_AND_TRAIL_FREE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: targetMode === 'SMART_PACE_AND_TRAIL_FREE' ? '#34d399' : '#fff' }}>
                        ⚡ Allure sur plat & Libre en trail
                      </span>
                      {targetMode === 'SMART_PACE_AND_TRAIL_FREE' && <CheckCircle2 size={13} color="#34d399" />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      Allure réaliste sur le plat avec marge anti-bip. 100% libre en trail & Mont-Royal (zéro vibration en côte/descente).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetMode('ALL_FREE');
                      setGarminWorkoutTargetMode('ALL_FREE');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: targetMode === 'ALL_FREE' ? '1.5px solid #38bdf8' : '1px solid var(--border-color)',
                      background: targetMode === 'ALL_FREE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: targetMode === 'ALL_FREE' ? '#38bdf8' : '#fff' }}>
                        🕊️ 100% Libre / Zéro bip
                      </span>
                      {targetMode === 'ALL_FREE' && <CheckCircle2 size={13} color="#38bdf8" />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      Guidage par temps & structure uniquement. Aucun contrôle de zone ou d'allure, confort absolu.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetMode('HR_ONLY');
                      setGarminWorkoutTargetMode('HR_ONLY');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: targetMode === 'HR_ONLY' ? '1.5px solid #f43f5e' : '1px solid var(--border-color)',
                      background: targetMode === 'HR_ONLY' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: targetMode === 'HR_ONLY' ? '#f43f5e' : '#fff' }}>
                        💓 Fréquence Cardiaque
                      </span>
                      {targetMode === 'HR_ONLY' && <CheckCircle2 size={13} color="#f43f5e" />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      Consignes cardio traditionnelles (125-142 bpm pour récupération). Vibre si hors zone.
                    </div>
                  </button>
                </div>

                {/* Réglage de l'Allure de Base de Footing */}
                {targetMode !== 'ALL_FREE' && targetMode !== 'HR_ONLY' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 4 }}>
                    <div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#fff' }}>
                        Allure cible de base pour l'endurance (min/km)
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Calibrée sur vos footings récents. Plage générée : {basePace ? `${formatSecondsToPace(parsePaceToSeconds(basePace) - 15)} – ${formatSecondsToPace(parsePaceToSeconds(basePace) + 20)}/km` : '5:50 – 6:25/km'}.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="text"
                        value={basePace}
                        onChange={e => {
                          const val = e.target.value;
                          setBasePace(val);
                          if (/^\d{1,2}:\d{2}$/.test(val)) {
                            setAthleteBasePace(val);
                          }
                        }}
                        placeholder="6:05"
                        style={{
                          width: 65,
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          color: '#fff',
                          fontSize: '0.82rem',
                          textAlign: 'center',
                          fontWeight: 700
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/km</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Latest Garmin Telemetry & Wellness Ingestion */}
              {(() => {
                const latestWellness = getLatestWellnessData();
                const readinessEval = calculateReadinessScore(latestWellness, 48);
                return (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Heart size={15} color="var(--accent-red)" />
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                          Télémétrie Récupération & Sommeil Garmin
                        </strong>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: `${readinessEval.badgeColorHex}22`,
                          color: readinessEval.badgeColorHex
                        }}
                      >
                        {readinessEval.badgeEmoji} Readiness : {readinessEval.score}/100
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <Moon size={11} color="#818cf8" /> Sommeil
                        </div>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {latestWellness?.sleep
                            ? `${Math.floor(latestWellness.sleep.totalMinutes / 60)}h${String(Math.round(latestWellness.sleep.totalMinutes % 60)).padStart(2, '0')}`
                            : '7h30'}
                        </strong>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          Score : {latestWellness?.sleep?.score ? `${latestWellness.sleep.score}/100` : '80/100'}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <Zap size={11} color="var(--accent-cyan)" /> VRC Nocturne
                        </div>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {latestWellness?.hrv?.weeklyAvg || latestWellness?.hrv?.lastNightAvg ? `${latestWellness.hrv.weeklyAvg || latestWellness.hrv.lastNightAvg} ms` : 'Équilibrée'}
                        </strong>
                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-green)' }}>
                          {latestWellness?.hrv?.status || 'BALANCED'}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <Heart size={11} color="var(--accent-red)" /> FC Repos
                        </div>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {typeof latestWellness?.restingHeartRate === 'number' ? latestWellness.restingHeartRate : 48} bpm
                        </strong>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {latestWellness?.date ? `Sync : ${latestWellness.date}` : 'Automatique'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Watch Compatibility & Push Info */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <Watch size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                    Compatibilité Garmin Forerunner 55 & Profils d'Entraînement
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    La Forerunner 55 ne disposant pas d'un profil natif de musculation, vos séances de renforcement et de calisthénie sont synchronisées sous forme de séances <strong>Cardio structurées</strong> (intervalles avec décompte, vibrations et libellés d'exercices). Elles s'exécutent avec guidage au poignet et sont automatiquement réassignées en <em>Renforcement / Calisthénie</em> lors de la resynchronisation.
                  </p>
                </div>
              </div>

              {/* Sync Action */}
              <form onSubmit={handleGarminAPISync} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(!storedGarminCreds?.email || showGarminCredsEdit) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
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
                      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
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
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isGarminProcessing}
                  style={{
                    justifyContent: 'center',
                    padding: '11px',
                    fontSize: '0.84rem',
                    background: '#0077c8',
                    color: '#fff',
                    borderColor: '#0077c8'
                  }}
                >
                  <RefreshCw size={14} className={isGarminProcessing ? 'spin-animation' : ''} />
                  <span>
                    {isGarminProcessing ? 'Synchronisation en cours...' : '🔄 Synchroniser mes séances Garmin maintenant'}
                  </span>
                </button>
              </form>

              {/* Outil de nettoyage automatique des doublons Garmin */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '10px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                      🧹 Nettoyage des doublons d'entraînements
                    </strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Supprime automatiquement les anciennes versions (avec émojis, titres antérieurs ou doublons) pour ne garder que la séance propre sur votre montre.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCleanDuplicates}
                    disabled={isCleaningDuplicates || isGarminProcessing}
                    className="btn-secondary"
                    style={{
                      padding: '7px 12px',
                      fontSize: '0.76rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#fca5a5',
                      borderColor: 'rgba(239, 68, 68, 0.35)',
                      background: 'rgba(239, 68, 68, 0.08)'
                    }}
                    title="Recherche et supprime les doublons dans Garmin Connect"
                  >
                    <Trash2 size={13} className={isCleaningDuplicates ? 'spin-animation' : ''} />
                    <span>{isCleaningDuplicates ? 'Nettoyage en cours...' : 'Purger les doublons'}</span>
                  </button>
                </div>

                {cleanDuplicatesMsg && (
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: 4,
                      fontSize: '0.74rem',
                      background: cleanDuplicatesMsg.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      border: cleanDuplicatesMsg.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                      color: cleanDuplicatesMsg.isError ? '#f87171' : '#34d399'
                    }}
                  >
                    {cleanDuplicatesMsg.text}
                  </div>
                )}
              </div>

              {/* GPX Upload Area */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '16px',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-xs)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <FileUp size={18} color="var(--primary)" />
                <span>
                  Ou <strong>glissez un fichier d'activité (.gpx)</strong> depuis votre montre
                </span>
                <input type="file" accept=".gpx" onChange={handleGPXUpload} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: PARTAGE & AMIS */}
          {/* ================================================================= */}
          {activeTab === 'share' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 800, fontSize: '0.88rem' }}>
                  <Share2 size={16} />
                  <span>Lien Public Spectateur & Entraîneur</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Permet à vos proches et à votre coach de suivre votre préparation QMT-80, vos cibles D+ et vos séances Garmin en temps réel, sans pouvoir modifier vos données.
                </p>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isSharePublic}
                    onChange={e => setIsSharePublic(e.target.checked)}
                  />
                  <span>Rendre mon profil QMT-80 accessible via le lien public</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Identifiant personnalisé (slug)
                </label>
                <input
                  type="text"
                  value={shareSlug}
                  onChange={e => setShareSlug(e.target.value)}
                  placeholder="mon-plan-qmt80"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: '0.8rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: '0.78rem'
                  }}
                />
                <button type="button" className="btn-secondary" onClick={handleCopyShareUrl} style={{ padding: '8px 12px' }}>
                  {shareCopied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{shareCopied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveShareSettings}
                  disabled={shareSaving}
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  <Save size={13} />
                  <span>{shareSaving ? 'Enregistrement...' : 'Enregistrer le lien de partage'}</span>
                </button>
                {shareSuccess && (
                  <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>
                    Paramètres de partage enregistrés !
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
