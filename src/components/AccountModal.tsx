import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GarminActivity, GarminSyncState } from '../types/garmin';
import { CalendarEvent } from '../types/calendar';
import {
  clearGarminCredentials,
  loadGarminCredentials,
  parseGPXString,
  saveGarminCredentials,
  syncWithGarminAPI
} from '../services/garminService';
import {
  downloadICSFile,
  getStoredGCalClientId,
  saveGCalClientId,
  syncDirectToGoogleCalendar,
  GCalSyncProgress
} from '../services/googleCalendarService';
import {
  Activity,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Globe,
  Heart,
  Key,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserPlus,
  X
} from 'lucide-react';

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

  // Synchronise initialTab when modal opens with a specific tab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Auth Context
  const { user, profile, isConfigured, signIn, signUp, signInWithGoogle, signOut, updateProfile } = useAuth();

  // --- TAB 1: Profile & Auth State ---
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

  useEffect(() => {
    if (profile) {
      setProfName(profile.displayName || '');
      setProfHome(profile.homeAddress || '');
      setProfCampus(profile.campusAddress || '');
      setProfFcMax(profile.fcMax || 203);
      setProfIcal(profile.icalUrl || '');
    }
  }, [profile]);

  // --- TAB 2: Garmin State ---
  const storedGarminCreds = loadGarminCredentials();
  const [garminSubTab, setGarminSubTab] = useState<'api' | 'upload' | 'env'>('api');
  const [garminEmail, setGarminEmail] = useState(storedGarminCreds?.email || garminState.accountEmail || '');
  const [garminPassword, setGarminPassword] = useState(storedGarminCreds?.password || '');
  const [garminSyncMsg, setGarminSyncMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isGarminProcessing, setIsGarminProcessing] = useState(false);

  // --- TAB 3: Google Calendar State ---
  const [gcalCopied, setGcalCopied] = useState(false);
  const [gcalClientId, setGcalClientId] = useState(getStoredGCalClientId());
  const [gcalSyncProgress, setGcalSyncProgress] = useState<GCalSyncProgress | null>(null);
  const [gcalSubTab, setGcalSubTab] = useState<'file' | 'subscribe' | 'direct'>('file');

  // --- TAB 4: Share State ---
  const [shareCopied, setShareCopied] = useState(false);
  const [shareSlug, setShareSlug] = useState(profile?.shareSlug || (user?.id ? user.id.slice(0, 8) : 'cyril'));
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
        setAuthSuccessMsg("Compte créé avec succès ! Vérifiez votre boîte mail si la confirmation est activée.");
      }
    } else {
      const res = await signIn(authEmail, authPassword);
      if (res.error) {
        setAuthErrorMsg(res.error);
      } else {
        setAuthSuccessMsg("Connexion réussie ! Vos données sont synchronisées.");
      }
    }
    setAuthSubmitting(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setAuthErrorMsg('');
    setAuthSuccessMsg('');

    const ok = await updateProfile({
      displayName: profName,
      homeAddress: profHome,
      campusAddress: profCampus,
      fcMax: profFcMax,
      icalUrl: profIcal
    });

    if (ok) {
      setAuthSuccessMsg("Profil et adresses privées mis à jour avec succès !");
      setTimeout(() => setAuthSuccessMsg(''), 3000);
    } else {
      setAuthErrorMsg("Erreur lors de la mise à jour du profil.");
    }
    setProfileSaving(false);
  };

  // --- Handlers: Garmin ---
  const handleGarminAPISync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsGarminProcessing(true);
    setGarminSyncMsg({ text: 'Connexion à l\'API Garmin Connect et extraction des activités...', isError: false });

    const creds = garminEmail && garminPassword ? { email: garminEmail, password: garminPassword } : (garminEmail ? { email: garminEmail } : undefined);
    const result = await syncWithGarminAPI(creds);

    setIsGarminProcessing(false);
    if (result.success) {
      if (garminEmail && garminPassword) {
        saveGarminCredentials({ email: garminEmail, password: garminPassword });
      } else if (garminEmail && !storedGarminCreds?.email) {
        saveGarminCredentials({ email: garminEmail });
      }
      onActivitiesSynced(result.activities);
      onUpdateGarminState({
        connected: true,
        lastSyncTime: new Date().toISOString(),
        accountEmail: garminEmail || storedGarminCreds?.email || 'Compte Garmin',
        activitiesCount: result.count,
        isSyncing: false
      });
      setGarminSyncMsg({
        text: `✅ ${result.count} activité(s) synchronisée(s) avec succès (Télémétrie Firstbeat & EPOC complète) !`,
        isError: false
      });
    } else {
      setGarminSyncMsg({
        text: `❌ ${result.error}`,
        isError: true
      });
    }
  };

  const handleGarminDisconnect = () => {
    clearGarminCredentials();
    setGarminEmail('');
    setGarminPassword('');
    onUpdateGarminState({
      ...garminState,
      connected: false,
      accountEmail: undefined,
      lastSyncTime: undefined,
      activitiesCount: 0
    });
    setGarminSyncMsg({
      text: 'Identifiants supprimés et synchronisation automatique désactivée.',
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
            text: `✅ Activité "${parsed.activityName}" importée avec succès (${parsed.durationMinutes} min, +${parsed.elevationGainM || 0}m D+).`,
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

  // --- Handlers: Google Agenda ---
  const handleCopyGcalUrl = () => {
    navigator.clipboard.writeText(subscriptionUrl);
    setGcalCopied(true);
    setTimeout(() => setGcalCopied(false), 2000);
  };

  const handleDownloadICS = () => {
    downloadICSFile(calendarEvents, 'planning_entrainement_qmt80.ics');
  };

  const handleOAuthSync = async () => {
    if (!gcalClientId) {
      alert("Veuillez renseigner un ID Client Google OAuth pour vous connecter directement via l'API.");
      return;
    }

    saveGCalClientId(gcalClientId);
    setGcalSyncProgress({
      total: calendarEvents.length,
      current: 0,
      status: 'SYNCING',
      message: 'Demande d\'autorisation auprès de Google Agenda...'
    });

    try {
      if (!(window as any).google?.accounts?.oauth2) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.body.appendChild(script);
        await new Promise(resolve => (script.onload = resolve));
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: gcalClientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setGcalSyncProgress({
              total: calendarEvents.length,
              current: 0,
              status: 'ERROR',
              message: `Échec de l'autorisation : ${tokenResponse.error}`
            });
            return;
          }

          const accessToken = tokenResponse.access_token;
          await syncDirectToGoogleCalendar(calendarEvents, accessToken, 'primary', setGcalSyncProgress);
        }
      });

      client.requestAccessToken();
    } catch (err: any) {
      setGcalSyncProgress({
        total: calendarEvents.length,
        current: 0,
        status: 'ERROR',
        message: err.message || 'Une erreur OAuth est survenue'
      });
    }
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
        style={{ maxWidth: 640, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, var(--primary), #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: '0 4px 12px rgba(255, 87, 34, 0.25)'
              }}
            >
              {user ? (profile?.displayName ? profile.displayName[0].toUpperCase() : 'A') : '⚡'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {user ? (profile?.displayName || 'Mon Compte Athlète') : 'Espace Athlète & Synchronisations'}
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    background: user ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                    color: user ? '#34d399' : 'var(--text-secondary)',
                    fontWeight: 700,
                    border: user ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)'
                  }}
                >
                  {user ? '🟢 Connecté' : 'Mode Local'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Gestion centralisée de vos comptes, télémétrie Garmin, Google Agenda & partages
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

        {/* Global Synchronize Action Banner */}
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isRecharging ? '#f59e0b' : '#10b981',
                display: 'inline-block'
              }}
            />
            <span>
              {isRecharging ? 'Synchronisation des flux en cours...' : `Dernière synchro : ${formattedSyncTime}`}
            </span>
          </div>

          <button
            className="btn-primary"
            onClick={onRefreshAll}
            disabled={isRecharging}
            style={{ fontSize: '0.75rem', padding: '5px 12px' }}
            title="Rafraîchir simultanément le flux iCal ÉTS et les séances Garmin"
          >
            <RefreshCw size={13} className={isRecharging ? 'spin-animation' : ''} />
            <span>{isRecharging ? 'Synchro en cours...' : 'Tout synchroniser maintenant'}</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.15)',
            padding: '0 20px',
            overflowX: 'auto',
            gap: '6px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <UserIcon size={14} />
            <span>Profil & Compte</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('garmin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: activeTab === 'garmin' ? '#0077c8' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'garmin' ? '2px solid #0077c8' : '2px solid transparent',
              whiteSpace: 'nowrap'
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
            onClick={() => setActiveTab('google')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: activeTab === 'google' ? '#4285F4' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'google' ? '2px solid #4285F4' : '2px solid transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <Calendar size={14} />
            <span>Google Agenda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 14px',
              border: 'none',
              background: 'none',
              color: activeTab === 'share' ? '#f59e0b' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'share' ? '2px solid #f59e0b' : '2px solid transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <Share2 size={14} />
            <span>Partage & Amis</span>
          </button>
        </div>

        {/* Modal Body: Active Tab Content */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', gap: '14px' }}>
          {/* ================================================================= */}
          {/* TAB 1: PROFIL & COMPTE ATHLÈTE */}
          {/* ================================================================= */}
          {activeTab === 'profile' && (
            <div>
              {!isConfigured ? (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '14px',
                    fontSize: '0.8rem',
                    lineHeight: 1.5
                  }}
                >
                  <strong style={{ color: '#f59e0b' }}>⚡ Configuration Supabase :</strong>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                    Pour sauvegarder votre profil dans le cloud, configurez vos variables d'environnement Supabase :
                  </p>
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 4, marginTop: 6, fontSize: '0.75rem' }}>
                    VITE_SUPABASE_URL="https://votre-projet.supabase.co"<br />
                    VITE_SUPABASE_ANON_KEY="votre-cle-anon"
                  </code>
                  <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.74rem' }}>
                    En attendant, l'application fonctionne parfaitement avec votre stockage local sécurisé.
                  </p>
                </div>
              ) : user ? (
                /* Connecté : Formulaire de profil et adresses */
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>
                        {profile?.displayName || user.email}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#10b981' }}>
                        🟢 Compte athlète synchronisé ({user.email})
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => signOut()}
                      style={{ fontSize: '0.75rem', padding: '5px 10px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                      <LogOut size={13} />
                      <span>Déconnexion</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <UserIcon size={12} style={{ display: 'inline', marginRight: 4 }} /> Nom ou Pseudo d'athlète
                      </label>
                      <input
                        type="text"
                        value={profName}
                        onChange={e => setProfName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-xs)',
                          color: '#fff',
                          fontSize: '0.82rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <Heart size={12} style={{ display: 'inline', marginRight: 4 }} /> FC Max Personnalisée (bpm)
                      </label>
                      <input
                        type="number"
                        value={profFcMax}
                        onChange={e => setProfFcMax(parseInt(e.target.value, 10) || 203)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-xs)',
                          color: '#fff',
                          fontSize: '0.82rem'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} /> Adresse Domicile (Privée & Chiffrée)
                    </label>
                    <input
                      type="text"
                      placeholder="ex: 2650 Av. Jeanne-d'Arc, Montréal..."
                      value={profHome}
                      onChange={e => setProfHome(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-xs)',
                        color: '#fff',
                        fontSize: '0.82rem'
                      }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      🔒 Utilisée uniquement pour calculer vos temps de transport en commun vers l'ÉTS et le Mont-Royal.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} /> Flux iCal ÉTS (Privé)
                    </label>
                    <input
                      type="password"
                      placeholder="https://portail.etsmtl.ca/ical/seances?..."
                      value={profIcal}
                      onChange={e => setProfIcal(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-xs)',
                        color: '#fff',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>

                  {authErrorMsg && (
                    <div style={{ color: '#f87171', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                      {authErrorMsg}
                    </div>
                  )}

                  {authSuccessMsg && (
                    <div style={{ color: '#10b981', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                      {authSuccessMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={profileSaving}
                    style={{ padding: '10px 14px', justifyContent: 'center', marginTop: 4 }}
                  >
                    <Save size={15} />
                    <span>{profileSaving ? 'Enregistrement...' : 'Enregistrer mon profil'}</span>
                  </button>
                </form>
              ) : (
                /* Déconnecté : Connexion / Inscription */
                <div>
                  <div
                    style={{
                      display: 'flex',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--radius-xs)',
                      padding: 3,
                      marginBottom: '14px',
                      gap: 4
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: 4,
                        border: 'none',
                        background: !isSignUp ? 'var(--primary-subtle)' : 'transparent',
                        color: !isSignUp ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      <LogIn size={13} style={{ display: 'inline', marginRight: 4 }} /> Se Connecter
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: 4,
                        border: 'none',
                        background: isSignUp ? 'var(--primary-subtle)' : 'transparent',
                        color: isSignUp ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      <UserPlus size={13} style={{ display: 'inline', marginRight: 4 }} /> Créer un Compte
                    </button>
                  </div>

                  <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {isSignUp && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          <UserIcon size={12} style={{ display: 'inline', marginRight: 4 }} /> Nom ou Pseudo
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Cyril"
                          value={authDisplayName}
                          onChange={e => setAuthDisplayName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-xs)',
                            color: '#fff',
                            fontSize: '0.85rem'
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <Mail size={12} style={{ display: 'inline', marginRight: 4 }} /> Adresse Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="cyril@exemple.com"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-xs)',
                          color: '#fff',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <Lock size={12} style={{ display: 'inline', marginRight: 4 }} /> Mot de Passe
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-xs)',
                          color: '#fff',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>

                    {authErrorMsg && (
                      <div style={{ color: '#f87171', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                        {authErrorMsg}
                      </div>
                    )}

                    {authSuccessMsg && (
                      <div style={{ color: '#10b981', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                        {authSuccessMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={authSubmitting}
                      style={{ padding: '10px 14px', justifyContent: 'center', marginTop: 4 }}
                    >
                      {authSubmitting ? 'Chargement...' : isSignUp ? "S'inscrire et synchroniser" : 'Se connecter'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OU</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => signInWithGoogle()}
                      style={{ justifyContent: 'center', padding: '9px 12px' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" style={{ marginRight: 6 }}>
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      Continuer avec Google
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: GARMIN CONNECT */}
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

              {/* Sub-tabs */}
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-xs)', padding: 3, gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setGarminSubTab('api')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: garminSubTab === 'api' ? 'var(--primary-subtle)' : 'transparent',
                    color: garminSubTab === 'api' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ API Garmin Connect
                </button>
                <button
                  type="button"
                  onClick={() => setGarminSubTab('upload')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: garminSubTab === 'upload' ? 'var(--primary-subtle)' : 'transparent',
                    color: garminSubTab === 'upload' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  📁 Import Fichier GPX
                </button>
                <button
                  type="button"
                  onClick={() => setGarminSubTab('env')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: garminSubTab === 'env' ? 'var(--primary-subtle)' : 'transparent',
                    color: garminSubTab === 'env' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  🔑 Config .env
                </button>
              </div>

              {garminSubTab === 'api' && (
                <form onSubmit={handleGarminAPISync} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {storedGarminCreds?.email && (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 700, fontSize: '0.8rem' }}>
                          <CheckCircle2 size={15} />
                          <span>Connexion permanente active ({storedGarminCreds.email})</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Vos séances sont synchronisées automatiquement en arrière-plan.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGarminDisconnect}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          borderRadius: 4,
                          padding: '5px 9px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Déconnecter
                      </button>
                    </div>
                  )}

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
                    Connexion directe à votre compte <strong>Garmin Connect</strong>. Vos identifiants restent stockés localement sur votre navigateur pour maintenir la télémétrie Firstbeat EPOC à jour.
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      Courriel Garmin Connect
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={garminEmail}
                        onChange={e => setGarminEmail(e.target.value)}
                        placeholder="votre-courriel@exemple.com"
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
                      Mot de passe Garmin Connect
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                      <input
                        type="password"
                        value={garminPassword}
                        onChange={e => setGarminPassword(e.target.value)}
                        placeholder="••••••••"
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
                    disabled={isGarminProcessing}
                    style={{ justifyContent: 'center', padding: '11px', marginTop: 4 }}
                  >
                    <RefreshCw size={14} className={isGarminProcessing ? 'spin-animation' : ''} />
                    <span>
                      {isGarminProcessing
                        ? 'Synchronisation en cours...'
                        : (storedGarminCreds?.email ? '🔄 Forcer la Synchronisation Garmin' : '⚡ Mémoriser et Lancer la Synchronisation')}
                    </span>
                  </button>
                </form>
              )}

              {garminSubTab === 'upload' && (
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
                      Glissez votre fichier d'activité (.gpx) ou cliquez pour parcourir
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Exporté directement depuis Garmin Connect ou votre montre GPS
                    </span>
                    <input type="file" accept=".gpx" onChange={handleGPXUpload} style={{ display: 'none' }} />
                  </label>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    💡 <em>Pour exporter depuis Garmin Connect :</em> Ouvrez l'activité ➔ Engrenage ⚙️ ➔ <strong>"Exporter au format GPX"</strong>.
                  </div>
                </div>
              )}

              {garminSubTab === 'env' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
                    <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Key size={14} color="var(--primary)" /> Synchronisation automatique au démarrage :
                    </strong>
                    <p style={{ marginTop: 4 }}>
                      Vous pouvez renseigner vos identifiants Garmin dans le fichier local <code>.env</code> :
                    </p>
                    <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: 4, color: '#e2e8f0', fontSize: '0.75rem', overflowX: 'auto', marginTop: 6 }}>
{`GARMIN_EMAIL="votre-courriel-garmin@exemple.com"
GARMIN_PASSWORD="votre-mot-de-passe"`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: GOOGLE AGENDA */}
          {/* ================================================================= */}
          {activeTab === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-xs)', padding: 3, gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setGcalSubTab('file')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: gcalSubTab === 'file' ? 'var(--primary-subtle)' : 'transparent',
                    color: gcalSubTab === 'file' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Fichier .ICS 1-Clic
                </button>
                <button
                  type="button"
                  onClick={() => setGcalSubTab('subscribe')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: gcalSubTab === 'subscribe' ? 'var(--primary-subtle)' : 'transparent',
                    color: gcalSubTab === 'subscribe' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  📡 Abonnement URL
                </button>
                <button
                  type="button"
                  onClick={() => setGcalSubTab('direct')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: gcalSubTab === 'direct' ? 'var(--primary-subtle)' : 'transparent',
                    color: gcalSubTab === 'direct' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer'
                  }}
                >
                  🔑 API Google OAuth
                </button>
              </div>

              {gcalSubTab === 'file' && (
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
                    <strong>Méthode la plus rapide et sans configuration :</strong>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                      Téléchargez le fichier calendrier généré et importez-le dans Google Agenda. Il intègre l'ensemble des <strong>{calendarEvents.length} événements</strong> (séances trail avec cibles D+, cours ÉTS et trajets).
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleDownloadICS}
                      style={{ flex: '1 1 200px', padding: '10px 14px', justifyContent: 'center' }}
                    >
                      <Download size={15} />
                      <span>Télécharger le Fichier .ICS</span>
                    </button>

                    <a
                      href="https://calendar.google.com/calendar/r/settings/export"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ flex: '1 1 200px', padding: '10px 14px', justifyContent: 'center', textDecoration: 'none' }}
                    >
                      <ExternalLink size={15} />
                      <span>Ouvrir l'Import Google Agenda</span>
                    </a>
                  </div>
                </div>
              )}

              {gcalSubTab === 'subscribe' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Abonnez-vous à cette URL dans Google Agenda ou sur smartphone pour une synchronisation automatique :
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
                    <button type="button" className="btn-secondary" onClick={handleCopyGcalUrl} style={{ padding: '8px 12px' }}>
                      {gcalCopied ? <CheckCircle2 size={15} color="#00e676" /> : <Copy size={15} />}
                      <span>{gcalCopied ? 'Copié !' : 'Copier'}</span>
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
                    <span>Ouvrir "Ajouter par URL" dans Google Agenda</span>
                  </a>
                </div>
              )}

              {gcalSubTab === 'direct' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Connexion directe via l'API REST Google Calendar :
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      ID Client Google OAuth
                    </label>
                    <input
                      type="text"
                      placeholder="ex: 123456789-abc.apps.googleusercontent.com"
                      value={gcalClientId}
                      onChange={e => setGcalClientId(e.target.value)}
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

                  {gcalSyncProgress && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-xs)',
                        background: gcalSyncProgress.status === 'SUCCESS' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 242, 254, 0.1)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{gcalSyncProgress.message}</span>
                        {gcalSyncProgress.total > 0 && (
                          <span>{Math.round((gcalSyncProgress.current / gcalSyncProgress.total) * 100)}%</span>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleOAuthSync}
                    style={{ padding: '10px 14px', justifyContent: 'center' }}
                  >
                    <Sparkles size={15} />
                    <span>Autoriser et Synchroniser sur Google Agenda</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: PARTAGE SPECTATEUR & AMIS */}
          {/* ================================================================= */}
          {activeTab === 'share' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: isSharePublic ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${isSharePublic ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isSharePublic ? <Globe size={20} color="#10b981" /> : <Lock size={20} color="#f87171" />}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#fff' }}>
                      {isSharePublic ? 'Lien de partage ACTIF' : 'Lien de partage DÉSACTIVÉ'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {isSharePublic ? 'Accessible à vos amis avec le lien' : 'Vos données restent 100% privées'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsSharePublic(!isSharePublic)}
                  style={{ fontSize: '0.74rem', padding: '6px 10px' }}
                >
                  {isSharePublic ? 'Désactiver' : 'Activer'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Identifiant personnalisé du lien (Slug)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={shareSlug}
                    placeholder="ex: cyril"
                    onChange={e => setShareSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-xs)',
                      color: '#fff',
                      fontSize: '0.82rem'
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={shareSaving}
                    onClick={handleSaveShareSettings}
                    style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                  >
                    {shareSaving ? '...' : 'Valider'}
                  </button>
                </div>
              </div>

              {isSharePublic && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    Lien direct à partager avec vos proches :
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-xs)',
                        color: '#fff',
                        fontSize: '0.8rem'
                      }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCopyShareUrl}
                      style={{ padding: '8px 12px' }}
                    >
                      {shareCopied ? <Check size={15} color="#fff" /> : <Copy size={15} />}
                      <span>{shareCopied ? 'Copié !' : 'Copier'}</span>
                    </button>
                  </div>
                </div>
              )}

              {shareSuccess && (
                <div style={{ color: '#10b981', fontSize: '0.75rem', textAlign: 'center' }}>
                  Paramètres de partage enregistrés !
                </div>
              )}

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px 14px',
                  fontSize: '0.76rem',
                  lineHeight: 1.55
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#38bdf8', marginBottom: 6 }}>
                  <ShieldCheck size={14} /> Garantie de Confidentialité :
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-secondary)' }}>
                  <div>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>✔ Visible par vos amis :</span> vos blocs d'entraînement, dénivelé cumulé, planning de course et dates clés du QMT-80.
                  </div>
                  <div>
                    <span style={{ color: '#f87171', fontWeight: 700 }}>✖ STRICTEMENT MASQUÉ :</span> votre adresse de domicile, votre adresse email, votre mot de passe et votre lien privé iCal.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
