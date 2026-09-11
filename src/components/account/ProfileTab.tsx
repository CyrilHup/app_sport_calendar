import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Heart,
  LogOut,
  Save
} from 'lucide-react';

export interface ProfileTabProps {
  onRefreshAll?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onRefreshAll }) => {
  const {
    user,
    profile,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateProfile
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
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setProfName(profile.displayName || '');
      setProfHome(profile.homeAddress || '');
      setProfCampus(profile.campusAddress || '');
      setProfFcMax(profile.fcMax || 203);
    }
  }, [profile]);

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
        setAuthSuccessMsg('Compte créé avec succès !');
      }
    } else {
      const res = await signIn(authEmail, authPassword);
      if (res.error) {
        setAuthErrorMsg(res.error);
      } else {
        setAuthSuccessMsg('Connexion réussie !');
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
      fcMax: profFcMax
    });

    setProfileSaving(false);
    if (ok) {
      setProfileSuccessMsg('Profil enregistré.');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
      onRefreshAll?.();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Account Status / Login */}
      {user ? (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.85rem',
                overflow: 'hidden'
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
                profile?.displayName ? profile.displayName[0].toUpperCase() : 'A'
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#fff' }}>
                {profile?.displayName || user.email}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
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
        /* Sign-In Card */
        <div
          style={{
            background: 'rgba(66, 133, 244, 0.08)',
            border: '1px solid rgba(66, 133, 244, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 10
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
            Connexion Google
          </h3>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', maxWidth: 400 }}>
            Synchronisez vos données sur tous vos appareils
          </p>

          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              setAuthErrorMsg('');
              const res = await signInWithGoogle();
              if (res?.error) setAuthErrorMsg(res.error);
            }}
            style={{
              padding: '8px 18px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: '#4285F4',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              marginTop: 4
            }}
          >
            <span>Continuer avec Google</span>
          </button>

          {authErrorMsg && (
            <div style={{ color: '#f87171', fontSize: '0.74rem', background: 'rgba(239, 68, 68, 0.1)', padding: '5px 10px', borderRadius: 4 }}>
              {authErrorMsg}
            </div>
          )}

          {authSuccessMsg && (
            <div style={{ color: '#10b981', fontSize: '0.74rem', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 10px', borderRadius: 4 }}>
              {authSuccessMsg}
            </div>
          )}

          {/* Email fallback */}
          <button
            type="button"
            onClick={() => setShowEmailForm(!showEmailForm)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>Ou connexion par courriel</span>
            {showEmailForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showEmailForm && (
            <form onSubmit={handleAuthSubmit} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {isSignUp && (
                <input
                  type="text"
                  placeholder="Nom ou prénom"
                  value={authDisplayName}
                  onChange={e => setAuthDisplayName(e.target.value)}
                  style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.78rem' }}
                />
              )}
              <input
                type="email"
                required
                placeholder="Courriel"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.78rem' }}
              />
              <input
                type="password"
                required
                placeholder="Mot de passe"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.78rem' }}
              />
              <button type="submit" className="btn-secondary" disabled={authSubmitting} style={{ justifyContent: 'center', padding: '7px' }}>
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

      {/* Profile Details Form */}
      <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Nom d'athlète
          </label>
          <input
            type="text"
            value={profName}
            onChange={e => setProfName(e.target.value)}
            placeholder="Votre prénom ou pseudo"
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
          />
        </div>

        {/* FC Max */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Heart size={15} color="var(--accent-red)" />
            <div>
              <div style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>
                Fréquence Cardiaque Maximale (FCmax)
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                Détectée automatiquement via vos activités Garmin
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-red)' }}>
            {profFcMax} bpm
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Adresse Domicile
          </label>
          <input
            type="text"
            value={profHome}
            onChange={e => setProfHome(e.target.value)}
            placeholder="Ex : Rue Sherbrooke, Montréal..."
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Adresse Campus ÉTS
          </label>
          <input
            type="text"
            value={profCampus}
            onChange={e => setProfCampus(e.target.value)}
            placeholder="1100 Rue Notre-Dame Ouest, Montréal..."
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={profileSaving}
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
          >
            <Save size={13} />
            <span>{profileSaving ? 'Enregistrement...' : 'Enregistrer le profil'}</span>
          </button>
          {profileSuccessMsg && (
            <span style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 600 }}>
              {profileSuccessMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
