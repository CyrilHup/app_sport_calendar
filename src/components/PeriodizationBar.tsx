import React, { useState } from 'react';
import { PeriodizationContext } from '../types/calendar';
import { ChevronDown, ChevronUp, ShieldAlert, TrendingUp } from 'lucide-react';

interface PeriodizationBarProps {
  context: PeriodizationContext;
}

const PHASES = [
  { id: 'FONDATION_RAMP_1', name: 'Ramp-up W1 (55%)', period: 'Sep 1-7' },
  { id: 'FONDATION_RAMP_2', name: 'Ramp-up W2 (75%)', period: 'Sep 8-14' },
  { id: 'FONDATION_RAMP_3', name: 'Ramp-up W3 (90%)', period: 'Sep 15-21' },
  { id: 'FONDATION', name: 'Fall Foundation', period: 'Oct-Nov' },
  { id: 'PUISSANCE_HIVERNALE', name: 'Winter Power & Hills', period: 'Jan-Feb 2027' },
  { id: 'VOLUME_WEC_1', name: 'Volume & Back-to-Back', period: 'Mar-May' },
  { id: 'SPECIFIQUE_PIC', name: 'Mestashibo Peak', period: 'May-Jun' },
  { id: 'AFFUTAGE', name: 'Tapering', period: 'Late Jun' }
];

export const PeriodizationBar: React.FC<PeriodizationBarProps> = ({ context }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        marginBottom: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={15} color="var(--cyan)" />
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff' }}>
            {context.label}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(0, 242, 254, 0.1)',
              color: 'var(--cyan)',
              fontWeight: 700
            }}
          >
            Vol: {Math.round(context.volumeFactor * 100)}%
          </span>

          {context.isDeload && (
            <span style={{ fontSize: '0.7rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}>
              <ShieldAlert size={12} /> Deload
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {context.description.slice(0, 80)}...
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: '0.72rem'
            }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{isExpanded ? 'Collapse' : 'Phases'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Phase Timeline */}
      {isExpanded && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {PHASES.map(p => {
              const isCurrent = context.phase === p.id;
              return (
                <div
                  key={p.id}
                  style={{
                    flex: '1 0 120px',
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: isCurrent ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: isCurrent ? '1px solid var(--cyan)' : '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isCurrent ? 'var(--cyan)' : 'var(--text-primary)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {p.period}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            💡 <strong>Block focus:</strong> {context.description}
          </div>
        </div>
      )}
    </div>
  );
};
