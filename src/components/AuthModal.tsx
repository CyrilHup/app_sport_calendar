import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, LogIn, UserPlus, LogOut, Save, ShieldCheck, Mail, Lock, User as UserIcon, MapPin, Heart, Calendar } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShare?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenShare }) => {
  const { user, profile, isConfigured, signIn, signUp, signInWithGoogle, signOut, updateProfile } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Profile fields when logged in
  const [profName, setProfName] = useState('');
  const [profHome, setProfHome] = useState('');
  const [profCampus, setProfCampus] = useState('');
  const [profFcMax, setProfFcMax] = useState<number>(203);
  const [profIcal, setProfIcal] = useState('');

  useEffect(() => {
    if (profile) {
      setProfName(profile.displayName || '');
      setProfHome(profile.homeAddress || '');
      setProfCampus(profile.campusAddress || '');
      setProfFcMax(profile.fcMax || 203);
      setProfIcal(profile.icalUrl || '');
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    if (isSignUp) {
      const res = await signUp(email, password, displayName);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Compte créé avec succès ! Vérifiez votre boîte mail si la confirmation est activée.");
      }
    } else {
      const res = await signIn(email, password);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Connexion réussie ! Vos données sont synchronisées.");
        setTimeout(() => onClose(), 1200);
      }
    }
    setSubmitting(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const ok = await updateProfile({
      displayName: profName,
      homeAddress: profHome,
      campusAddress: profCampus,
      fcMax: profFcMax,
      icalUrl: profIcal
    });

    if (ok) {
      setSuccessMsg("Profil et adresses privées mis à jour avec succès !");
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg("Erreur lors de la mise à jour du profil.");
    }
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                {user ? 'Mon Compte Athlète' : 'Espace Athlète Sécurisé'}
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                {user
                  ? 'Synchronisation multi-appareils & données privées'
                  : 'Connectez-vous pour synchroniser sur mobile et PC'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '14px' }}>
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
              <strong style={{ color: '#f59e0b' }}>⚡ Configuration Supabase Requise :</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                Pour activer le système de comptes sur votre déploiement, ajoutez simplement vos clés Supabase dans les variables d'environnement Vercel :
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
            /* Logged in state : Profile & Private Settings */
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
                    🟢 Connecté ({user.email})
                  </div>
                </div>
                {onOpenShare && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onOpenShare}
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                  >
                    Partager avec mes amis
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    <UserIcon size={12} style={{ display: 'inline', marginRight: 4 }} /> Nom d'athlète
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
                    <Heart size={12} style={{ display: 'inline', marginRight: 4 }} /> FC Max (bpm)
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
                  placeholder="ex: 123 Rue de la Montagne, Montréal..."
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
                  🔒 Stockée dans votre profil privé uniquement, jamais exposée aux spectateurs.
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

              {errorMsg && (
                <div style={{ color: '#f87171', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{ color: '#10b981', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                  {successMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Save size={15} /> Enregistrer mon profil
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => signOut()}
                  style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <LogOut size={15} /> Déconnexion
                </button>
              </div>
            </form>
          ) : (
            /* Logged out : Sign In / Sign Up */
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
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
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
                    value={email}
                    onChange={e => setEmail(e.target.value)}
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
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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

                {errorMsg && (
                  <div style={{ color: '#f87171', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div style={{ color: '#10b981', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: 4 }}>
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ padding: '10px 14px', justifyContent: 'center', marginTop: 4 }}
                >
                  {submitting ? 'Chargement...' : isSignUp ? "S'inscrire et synchroniser" : 'Se connecter'}
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

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
