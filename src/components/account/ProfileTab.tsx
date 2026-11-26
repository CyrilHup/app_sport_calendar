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
import { useManagedTimeout } from '../../hooks/useManagedTimeout';

export interface ProfileTabProps {
  onRefreshAll?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onRefreshAll }) => {
  const scheduleTimeout = useManagedTimeout();
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
      scheduleTimeout(() => setProfileSuccessMsg(''), 3000);
      onRefreshAll?.();
    }
  };

  return (
    <div className="account-stack">
      {/* Account Status / Login */}
      {user ? (
        <div className="account-card account-row account-row--wrap">
          <div className="account-leading">
            <div className="account-avatar">
              {user && (user.user_metadata?.avatar_url || user.user_metadata?.picture || profile?.avatarUrl) ? (
                <img
                  src={user.user_metadata?.avatar_url || user.user_metadata?.picture || profile?.avatarUrl}
                  alt={profile?.displayName || 'Avatar'}
                  referrerPolicy="no-referrer"
                  className="account-avatar-image"
                  onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                profile?.displayName ? profile.displayName[0].toUpperCase() : 'A'
              )}
            </div>
            <div className="account-copy">
              <div className="account-title">
                {profile?.displayName || user.email}
              </div>
              <div className="account-description account-inline-status">
                <CheckCircle2 size={12} /> Compte synchronisé · {user.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => signOut()}
          >
            <LogOut size={12} />
            <span>Déconnexion</span>
          </button>
        </div>
      ) : (
        /* Sign-In Card */
        <div className="account-card account-card--stack account-login-card">
          <h3 className="account-title">
            Connexion Google
          </h3>
          <p className="account-description account-login-description">
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
          >
            <span>Continuer avec Google</span>
          </button>

          {authErrorMsg && (
            <div className="account-feedback account-feedback--error" role="alert">
              {authErrorMsg}
            </div>
          )}

          {authSuccessMsg && (
            <div className="account-feedback account-feedback--success" role="status">
              {authSuccessMsg}
            </div>
          )}

          {/* Email fallback */}
          <button
            type="button"
            onClick={() => setShowEmailForm(!showEmailForm)}
            className="account-link-button"
            aria-expanded={showEmailForm}
            aria-controls={showEmailForm ? 'account-email-form' : undefined}
          >
            <span>Ou connexion par courriel</span>
            {showEmailForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showEmailForm && (
            <form id="account-email-form" onSubmit={handleAuthSubmit} className="account-form account-login-form">
              {isSignUp && (
                <div className="account-field">
                  <label htmlFor="account-signup-name">Nom ou prénom</label>
                  <input
                    id="account-signup-name"
                    type="text"
                    value={authDisplayName}
                    onChange={e => setAuthDisplayName(e.target.value)}
                  />
                </div>
              )}
              <div className="account-field">
                <label htmlFor="account-signin-email">Courriel</label>
                <input
                  id="account-signin-email"
                  type="email"
                  required
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="account-field">
                <label htmlFor="account-signin-password">Mot de passe</label>
                <input
                  id="account-signin-password"
                  type="password"
                  required
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary account-form-submit" disabled={authSubmitting}>
                {authSubmitting ? 'Chargement…' : isSignUp ? "S'inscrire" : 'Se connecter'}
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="account-link-button"
              >
                {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Profile Details Form */}
      <form onSubmit={handleSaveProfile} className="account-card account-card--stack account-form">
        <div className="account-field">
          <label htmlFor="account-profile-name">
            Nom d'athlète
          </label>
          <input
            id="account-profile-name"
            type="text"
            value={profName}
            onChange={e => setProfName(e.target.value)}
            placeholder="Votre prénom ou pseudo"
          />
        </div>

        {/* FC Max */}
        <div className="account-row account-fc-max">
          <div className="account-leading">
            <Heart size={16} />
            <div>
              <div className="account-title">
                Fréquence Cardiaque Maximale (FCmax)
              </div>
              <div className="account-description">
                Détectée automatiquement via vos activités Garmin
              </div>
            </div>
          </div>
          <span className="account-fc-max-value">
            {profFcMax} bpm
          </span>
        </div>

        <div className="account-field">
          <label htmlFor="account-home-address">
            Adresse Domicile
          </label>
          <input
            id="account-home-address"
            type="text"
            value={profHome}
            onChange={e => setProfHome(e.target.value)}
            placeholder="Ex : Rue Sherbrooke, Montréal..."
          />
        </div>

        <div className="account-field">
          <label htmlFor="account-campus-address">
            Adresse Campus ÉTS
          </label>
          <input
            id="account-campus-address"
            type="text"
            value={profCampus}
            onChange={e => setProfCampus(e.target.value)}
            placeholder="1100 Rue Notre-Dame Ouest, Montréal..."
          />
        </div>

        <div className="account-action-row">
          <button
            type="submit"
            className="btn-primary"
            disabled={profileSaving}
          >
            <Save size={13} />
            <span>{profileSaving ? 'Enregistrement...' : 'Enregistrer le profil'}</span>
          </button>
          {profileSuccessMsg && (
            <span className="account-feedback account-feedback--success" role="status">
              {profileSuccessMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
