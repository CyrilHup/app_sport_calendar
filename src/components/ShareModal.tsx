import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Share2, Copy, Check, Eye, EyeOff, ShieldCheck, X, Globe, Lock } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [slug, setSlug] = useState(profile?.shareSlug || (user?.id ? user.id.slice(0, 8) : 'cyril'));
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}?share=${slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveShareSettings = async () => {
    setSaving(true);
    const ok = await updateProfile({
      shareSlug: slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      isPublic
    });
    setSaving(false);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #ff5722, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Share2 size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                Partager mon entraînement
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Donnez à vos amis un accès spectateur à votre progression QMT-80
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '14px' }}>
          {/* Toggle Public / Private */}
          <div
            style={{
              background: isPublic ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${isPublic ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: 'var(--radius-xs)',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isPublic ? <Globe size={20} color="#10b981" /> : <Lock size={20} color="#f87171" />}
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#fff' }}>
                  {isPublic ? 'Lien de partage ACTIF' : 'Lien de partage DÉSACTIVÉ'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {isPublic ? 'Accessible à toute personne ayant le lien' : 'Vos données restent 100% privées'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsPublic(!isPublic)}
              style={{ fontSize: '0.74rem', padding: '6px 10px' }}
            >
              {isPublic ? 'Désactiver' : 'Activer'}
            </button>
          </div>

          {/* Link URL and Custom Slug */}
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Identifiant / Alias du lien (Slug)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={slug}
                placeholder="ex: cyril"
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
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
                disabled={saving}
                onClick={handleSaveShareSettings}
                style={{ padding: '8px 12px', fontSize: '0.75rem' }}
              >
                {saving ? '...' : 'Valider'}
              </button>
            </div>
          </div>

          {isPublic && (
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Lien direct à envoyer à vos amis :
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
                  onClick={handleCopy}
                  style={{ padding: '8px 12px' }}
                >
                  {copied ? <Check size={15} color="#fff" /> : <Copy size={15} />}
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div style={{ color: '#10b981', fontSize: '0.75rem', textAlign: 'center' }}>
              Paramètres de partage enregistrés !
            </div>
          )}

          {/* Privacy Guarantee Box */}
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

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
