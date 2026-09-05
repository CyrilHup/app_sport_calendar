import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import {
  downloadICSFile,
  getStoredGCalClientId,
  saveGCalClientId,
  syncDirectToGoogleCalendar,
  GCalSyncProgress
} from '../services/googleCalendarService';
import {
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Key,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  events
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [clientId, setClientId] = useState(getStoredGCalClientId());
  const [syncProgress, setSyncProgress] = useState<GCalSyncProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'direct' | 'subscribe' | 'file'>('file');

  const subscriptionUrl = `${window.location.origin}/api/calendar.ics`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(subscriptionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadICSFile(events, 'planning_entrainement_qmt80.ics');
  };

  const handleOAuthSync = async () => {
    if (!clientId) {
      alert("Veuillez renseigner un ID Client Google OAuth pour vous connecter directement via l'API.");
      return;
    }

    saveGCalClientId(clientId);
    setSyncProgress({
      total: events.length,
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
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setSyncProgress({
              total: events.length,
              current: 0,
              status: 'ERROR',
              message: `Échec de l'autorisation : ${tokenResponse.error}`
            });
            return;
          }

          const accessToken = tokenResponse.access_token;
          await syncDirectToGoogleCalendar(events, accessToken, 'primary', setSyncProgress);
        }
      });

      client.requestAccessToken();
    } catch (err: any) {
      setSyncProgress({
        total: events.length,
        current: 0,
        status: 'ERROR',
        message: err.message || 'Une erreur OAuth est survenue'
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #4285F4, #34A853)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calendar size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                Synchronisation Google Agenda
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Exporte ton planning d'entraînement et tes cours directement sur ton agenda Google
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ gap: '14px' }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-xs)', padding: 3, gap: 4 }}>
            <button
              onClick={() => setActiveTab('file')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'file' ? 'var(--primary-subtle)' : 'transparent',
                color: activeTab === 'file' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              ⚡ Import 1-Clic (.ICS)
            </button>

            <button
              onClick={() => setActiveTab('subscribe')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'subscribe' ? 'var(--primary-subtle)' : 'transparent',
                color: activeTab === 'subscribe' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              📡 Lien d'Abonnement URL
            </button>

            <button
              onClick={() => setActiveTab('direct')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'direct' ? 'var(--primary-subtle)' : 'transparent',
                color: activeTab === 'direct' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              🔑 API Google Directe
            </button>
          </div>

          {/* Tab 1: Import fichier .ics */}
          {activeTab === 'file' && (
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
                  Télécharge le fichier calendrier généré et importe-le directement dans ton Google Agenda. Il intègre l'ensemble des <strong>{events.length} événements</strong> (séances trail avec cibles de dénivelé D+, cours ÉTS et trajets calculés).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  onClick={handleDownload}
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

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: 4 }}>
                💡 <em>Étapes :</em> Clique sur "Télécharger le Fichier .ICS" ➔ Ouvre la page d'import Google Agenda ➔ Sélectionne le fichier téléchargé et valide. C'est fait en 10 secondes !
              </div>
            </div>
          )}

          {/* Tab 2: Flux d'abonnement */}
          {activeTab === 'subscribe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Abonne-toi à cette URL de flux dynamique dans Google Agenda ou sur ton smartphone. Toute mise à jour se synchronisera automatiquement en arrière-plan :
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
                <button className="btn-secondary" onClick={handleCopyUrl} style={{ padding: '8px 12px' }}>
                  {copied ? <CheckCircle2 size={15} color="#00e676" /> : <Copy size={15} />}
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
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

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                📌 Dans Google Agenda, clique sur <em>Autres agendas (+)</em> ➔ <em>À partir de l'URL</em> ➔ Colle le lien.
              </div>
            </div>
          )}

          {/* Tab 3: API Google OAuth */}
          {activeTab === 'direct' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Connexion directe via l'API REST Google Calendar. Envoie tous les événements instantanément sur ton agenda principal :
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  ID Client Google OAuth (depuis la Google Cloud Console)
                </label>
                <input
                  type="text"
                  placeholder="ex: 123456789-abc.apps.googleusercontent.com"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
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

              {syncProgress && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-xs)',
                    background: syncProgress.status === 'SUCCESS' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 242, 254, 0.1)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{syncProgress.message}</span>
                    {syncProgress.total > 0 && (
                      <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                    )}
                  </div>
                </div>
              )}

              <button
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

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
