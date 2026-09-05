import React, { useState } from 'react';
import { GarminActivity, GarminSyncState } from '../types/garmin';
import { clearGarminCredentials, loadGarminCredentials, parseGPXString, saveGarminCredentials, syncWithGarminAPI } from '../services/garminService';
import { Activity, CheckCircle2, FileUp, Key, Lock, Mail, RefreshCw, X } from 'lucide-react';

interface GarminModalProps {
  isOpen: boolean;
  onClose: () => void;
  garminState: GarminSyncState;
  onUpdateState: (state: GarminSyncState) => void;
  onActivitiesSynced: (activities: GarminActivity[]) => void;
}

export const GarminModal: React.FC<GarminModalProps> = ({
  isOpen,
  onClose,
  garminState,
  onUpdateState,
  onActivitiesSynced
}) => {
  if (!isOpen) return null;

  const storedCreds = loadGarminCredentials();
  const [activeSubTab, setActiveSubTab] = useState<'api' | 'upload' | 'env'>('api');
  const [email, setEmail] = useState(storedCreds?.email || garminState.accountEmail || '');
  const [password, setPassword] = useState(storedCreds?.password || '');
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAPISync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing(true);
    setSyncMessage({ text: 'Connexion à l\'API Garmin Connect et extraction des activités...', isError: false });

    const creds = email && password ? { email, password } : (email ? { email } : undefined);
    const result = await syncWithGarminAPI(creds);

    setIsProcessing(false);
    if (result.success) {
      if (email && password) {
        saveGarminCredentials({ email, password });
      } else if (email && !storedCreds?.email) {
        saveGarminCredentials({ email });
      }
      onActivitiesSynced(result.activities);
      onUpdateState({
        connected: true,
        lastSyncTime: new Date().toISOString(),
        accountEmail: email || storedCreds?.email || 'Compte Garmin',
        activitiesCount: result.count,
        isSyncing: false
      });
      setSyncMessage({
        text: `✅ ${result.count} activité(s) synchronisée(s) avec succès (Télémétrie Firstbeat & EPOC complète) !`,
        isError: false
      });
    } else {
      setSyncMessage({
        text: `❌ ${result.error}`,
        isError: true
      });
    }
  };

  const handleDisconnect = () => {
    clearGarminCredentials();
    setEmail('');
    setPassword('');
    onUpdateState({
      ...garminState,
      connected: false,
      accountEmail: undefined,
      lastSyncTime: undefined,
      activitiesCount: 0
    });
    setSyncMessage({
      text: 'Identifiants supprimés et synchronisation automatique désactivée.',
      isError: false
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    setIsProcessing(true);
    setSyncMessage({ text: 'Analyse de la trace GPX...', isError: false });

    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const parsed = parseGPXString(text, file.name);
          onActivitiesSynced([parsed]);
          setIsProcessing(false);
          setSyncMessage({
            text: `✅ Activité "${parsed.activityName}" importée avec succès (${parsed.durationMinutes} min, +${parsed.elevationGainM || 0}m D+).`,
            isError: false
          });
        } catch {
          setIsProcessing(false);
          setSyncMessage({ text: '❌ Erreur lors de l\'analyse du fichier GPX. Vérifie le format.', isError: true });
        }
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-xs)',
                background: '#0077c8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Activity size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                Synchronisation Télémétrie Garmin
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Connexion directe avec Garmin Connect — Télémétrie réelle et import GPX
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '14px' }}>
          {syncMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-xs)',
                background: syncMessage.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                border: syncMessage.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.8rem',
                color: syncMessage.isError ? '#f87171' : '#34d399'
              }}
            >
              {syncMessage.text}
            </div>
          )}

          {/* Sous-onglets */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-xs)', padding: 3, gap: 4 }}>
            <button
              onClick={() => setActiveSubTab('api')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'api' ? 'var(--primary-subtle)' : 'transparent',
                color: activeSubTab === 'api' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              ⚡ API Garmin Directe
            </button>

            <button
              onClick={() => setActiveSubTab('upload')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'upload' ? 'var(--primary-subtle)' : 'transparent',
                color: activeSubTab === 'upload' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              📁 Fichier GPX
            </button>

            <button
              onClick={() => setActiveSubTab('env')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeSubTab === 'env' ? 'var(--primary-subtle)' : 'transparent',
                color: activeSubTab === 'env' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              🔑 Config Auto (.env)
            </button>
          </div>

          {/* TAB 1: API GARMIN */}
          {activeSubTab === 'api' && (
            <form onSubmit={handleAPISync} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {storedCreds?.email && (
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
                      <span>Connexion permanente active ({storedCreds.email})</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Tes séances se synchronisent désormais automatiquement en arrière-plan (au chargement et via « Synchro Directe »).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
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
                Connexion directe à ton compte <strong>Garmin Connect</strong>. Tes identifiants restent stockés localement sur ton navigateur pour maintenir la synchronisation continue de tes footings et trails.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Courriel ou Nom d'utilisateur Garmin Connect
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ton-courriel@exemple.com (ou laisser vide si dans .env)"
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
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mot de passe (ou laisser vide si dans .env)"
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
                disabled={isProcessing}
                style={{ justifyContent: 'center', padding: '11px', marginTop: 4 }}
              >
                <RefreshCw size={14} className={isProcessing ? 'spin-animation' : ''} />
                <span>{isProcessing ? 'Synchronisation en cours...' : (storedCreds?.email ? '🔄 Forcer une Synchronisation Garmin' : '⚡ Mémoriser et Lancer la Synchronisation')}</span>
              </button>
            </form>
          )}

          {/* TAB 2: GLISSER-DÉPOSER GPX */}
          {activeSubTab === 'upload' && (
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
                  Glisse ton fichier d'activité (.gpx) ou clique pour parcourir
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Exporté directement depuis Garmin Connect ou ta montre GPS
                </span>
                <input type="file" accept=".gpx" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                💡 <em>Pour exporter depuis Garmin Connect :</em> Ouvre l'activité ➔ Clique sur l'icône engrenage ⚙️ ➔ Clique sur <strong>"Exporter au format GPX"</strong>.
              </div>
            </div>
          )}

          {/* TAB 3: CONFIGURATION AUTO .ENV */}
          {activeSubTab === 'env' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
                <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={14} color="var(--primary)" /> Synchronisation automatique au démarrage :
                </strong>
                <p style={{ marginTop: 4 }}>
                  Tu peux renseigner tes identifiants Garmin dans le fichier local <code>.env</code>. L'application synchronisera automatiquement tes données à chaque rechargement sans saisie manuelle :
                </p>
                <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: 4, color: '#e2e8f0', fontSize: '0.75rem', overflowX: 'auto', marginTop: 6 }}>
{`# À ajouter dans ton fichier .env :
GARMIN_EMAIL="ton-courriel-garmin@exemple.com"
GARMIN_PASSWORD="ton-mot-de-passe"`}
                </pre>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                🔒 Tes identifiants restent stockés localement sur ta machine et ne sont jamais transmis sur git.
              </div>
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
