import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  CheckCircle2,
  Copy,
  Save,
  Share2
} from 'lucide-react';

export const ShareTab: React.FC = () => {
  const { profile, updateProfile } = useAuth();

  const [shareSlug, setShareSlug] = useState('');
  const [isSharePublic, setIsSharePublic] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (profile) {
      setShareSlug(profile.shareSlug || '');
      setIsSharePublic(profile.isPublic ?? false);
    }
  }, [profile]);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?share=${shareSlug}` : '';

  const handleCopyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleSaveShareSettings = async () => {
    setShareSaving(true);
    const formattedSlug = shareSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const ok = await updateProfile({
      shareSlug: formattedSlug,
      isPublic: isSharePublic
    });
    setShareSaving(false);
    if (ok) {
      setShareSlug(formattedSlug);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Public Share Toggle Card */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Share2 size={18} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#fff' }}>
              Lien public en lecture seule
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Permet de partager votre planning QMT-80 à un proche ou un coach
            </div>
          </div>
        </div>

        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={isSharePublic}
            onChange={e => setIsSharePublic(e.target.checked)}
          />
          <span className="settings-toggle-slider" />
        </label>
      </div>

      {/* Slug & Link Configuration */}
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
        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Identifiant personnalisé du lien (slug)
          </label>
          <input
            type="text"
            value={shareSlug}
            onChange={e => setShareSlug(e.target.value)}
            placeholder="mon-plan-qmt80"
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: '#fff',
              fontSize: '0.8rem'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            URL de partage
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: '#fff',
                fontSize: '0.76rem'
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyShareUrl}
              style={{ padding: '8px 12px', fontSize: '0.76rem' }}
            >
              {shareCopied ? <CheckCircle2 size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{shareCopied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
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
            <span>{shareSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
          {shareSuccess && (
            <span style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 600 }}>
              Paramètres de partage enregistrés !
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
