import React from 'react';
import { AlertTriangle, KeyRound, RefreshCw, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { triggerHapticFeedback } from '../services/hapticsService';

export interface SyncErrorInfo {
  title: string;
  message: string;
  details?: string;
  isMissingCreds?: boolean;
}

interface SyncErrorModalProps {
  error: SyncErrorInfo | null;
  onClose: () => void;
  onRetry: () => void;
  onOpenGarminSettings: () => void;
  isRetrying?: boolean;
}

export const SyncErrorModal: React.FC<SyncErrorModalProps> = ({
  error,
  onClose,
  onRetry,
  onOpenGarminSettings,
  isRetrying = false
}) => {
  if (!error) return null;
  const needsCalendarReview = /Identifiants Garmin divergents|au moins une séance a commencé/.test(error.details || '');

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 10001,
        backdropFilter: 'blur(6px)',
        backgroundColor: 'rgba(6, 10, 20, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '100%',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, #161b2a 0%, #0d1220 100%)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.8), 0 0 20px rgba(239, 68, 68, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.07)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}
            >
              {error.isMissingCreds ? <KeyRound size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                {error.title}
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#f87171',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '2px'
                }}
              >
                <ShieldAlert size={12} /> Échec de synchronisation Garmin
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              onClose();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {error.message}
          </p>

          {error.details && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.76rem',
                color: '#fca5a5',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                lineHeight: 1.4
              }}
            >
              <strong>Motif :</strong> {error.details}
            </div>
          )}

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45
            }}
          >
            💡 <em>Astuce :</em> {needsCalendarReview
              ? 'Vérifiez les deux dates dans Garmin Connect. La synchronisation reste suspendue pour éviter un doublon ou la modification d’une séance déjà commencée.'
              : 'Vos séances et calculs locaux restent accessibles. Connectez ou reconnectez votre compte Garmin Connect pour importer vos dernières activités réelles.'}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              onClose();
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            Fermer
          </button>

          {error.isMissingCreds ? (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('medium');
                onClose();
                onOpenGarminSettings();
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, var(--primary), #e64a19)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Connecter Garmin</span>
              <ArrowRight size={14} />
            </button>
          ) : !needsCalendarReview ? (
            <>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light');
                  onClose();
                  onOpenGarminSettings();
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  cursor: 'pointer'
                }}
              >
                Réglages Garmin
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('medium');
                  onRetry();
                }}
                disabled={isRetrying}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--primary), #e64a19)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isRetrying ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} className={isRetrying ? 'spin-animation' : ''} />
                <span>{isRetrying ? 'Nouvelle tentative...' : 'Réessayer'}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
