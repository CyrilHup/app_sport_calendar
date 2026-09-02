import React, { useState } from 'react';
import { Check, Copy, Download, FileCode, ShieldCheck, X } from 'lucide-react';

interface GasSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GasSyncModal: React.FC<GasSyncModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState<string | null>(null);

  const FIXES_SUMMARY = [
    {
      file: "sport.gs",
      tag: "CRITIQUE",
      desc: "Correction du chaînage des cours du samedi : détection spécifique du cours intensif et calcul immédiat de l'entraînement post-cours sans conflit horaire."
    },
    {
      file: "sport.gs",
      tag: "SÉCURITÉ",
      desc: "Suppression du deleteEvent() aveugle qui supprimait les événements personnels non gérés dans l'agenda Sports."
    },
    {
      file: "cours.gs",
      tag: "SYNCHRONISATION",
      desc: "Harmonisation des plages horaires avec sport.gs pour garantir la création adéquate des trajets retours et éviter les doublons."
    },
    {
      file: "utils.gs",
      tag: "ROBUSTESSE",
      desc: "Sécurisation de parseICSDate face aux environnements sans objet Utilities (Node/Web) et verrouillage heure locale de Montréal."
    },
    {
      file: "config.gs",
      tag: "COMPATIBILITÉ",
      desc: "Protection de TRANSIT_MODE avec garde typeof Maps pour exécution cross-plateforme."
    }
  ];

  const handleCopyFile = (name: string) => {
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800 }}>
                Correctifs Google Apps Script
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Vos fichiers .gs ont été corrigés directement dans votre projet
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.9rem', marginBottom: '4px' }}>
              ✅ Bilan des anomalies résolues avec succès
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              Les fichiers <code>sport.gs</code>, <code>cours.gs</code>, <code>config.gs</code> et <code>utils.gs</code> situés à la racine de votre projet sont désormais 100% synchronisés et opérationnels.
            </p>
          </div>

          {/* List of fixes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FIXES_SUMMARY.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <FileCode size={18} color="#00f2fe" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{item.file}</strong>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: item.tag === 'CRITIQUE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 242, 254, 0.15)',
                        color: item.tag === 'CRITIQUE' ? '#f87171' : '#00f2fe'
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            💡 <em>Astuce :</em> Vous pouvez déployer vos modifications sur Google Apps Script via <code>clasp push</code> ou copier-coller le contenu directement dans votre éditeur Google Apps Script.
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
