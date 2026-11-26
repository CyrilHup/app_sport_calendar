import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  CheckCircle2,
  Copy,
  Save,
  Share2
} from 'lucide-react';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';

export const ShareTab: React.FC = () => {
  const scheduleTimeout = useManagedTimeout();
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
    scheduleTimeout(() => setShareCopied(false), 2000);
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
      scheduleTimeout(() => setShareSuccess(false), 2500);
    }
  };

  return (
    <div className="account-stack">
      {/* Public Share Toggle Card */}
      <div className="account-card account-row account-share-toggle">
        <div className="account-leading">
          <Share2 size={18} />
          <div className="account-copy">
            <div className="account-title">
              Lien public en lecture seule
            </div>
            <div className="account-description">
              Permet de partager votre planning QMT-80 à un proche ou un coach
            </div>
          </div>
        </div>

        <label className="settings-toggle-switch" aria-label="Rendre le planning public">
          <input
            type="checkbox"
            aria-label="Rendre le planning public"
            checked={isSharePublic}
            onChange={e => setIsSharePublic(e.target.checked)}
          />
          <span className="settings-toggle-slider" />
        </label>
      </div>

      {/* Slug & Link Configuration */}
      <div className="account-card account-card--stack">
        <div className="account-field">
          <label htmlFor="account-share-slug">
            Identifiant personnalisé du lien (slug)
          </label>
          <input
            id="account-share-slug"
            type="text"
            value={shareSlug}
            onChange={e => setShareSlug(e.target.value)}
            placeholder="mon-plan-qmt80"
          />
        </div>

        <div className="account-field">
          <label htmlFor="account-share-url">
            URL de partage
          </label>
          <div className="account-share-url-row">
            <input
              id="account-share-url"
              type="text"
              readOnly
              value={shareUrl}
              className="account-input"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyShareUrl}
            >
              {shareCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              <span>{shareCopied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        <div className="account-action-row">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveShareSettings}
            disabled={shareSaving}
          >
            <Save size={13} />
            <span>{shareSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
          {shareSuccess && (
            <span className="account-feedback account-feedback--success" role="status">
              Paramètres de partage enregistrés !
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
