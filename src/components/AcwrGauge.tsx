import React from 'react';
import { ACWR_POLICY, acwrGaugePosition, acwrGaugeWidth } from '../services/trainingModelConfig';

const zones = [
  { start: 0, end: ACWR_POLICY.underloadBelow, color: '#38bdf8', label: 'Sous-charge' },
  { start: ACWR_POLICY.underloadBelow, end: ACWR_POLICY.moderateAbove, color: '#10b981', label: 'Sweet Spot' },
  { start: ACWR_POLICY.moderateAbove, end: ACWR_POLICY.highAbove, color: '#f59e0b', label: 'Surcharge' },
  { start: ACWR_POLICY.highAbove, end: ACWR_POLICY.gaugeMaximum, color: '#ef4444', label: 'Charge élevée' }
] as const;

export const AcwrGauge: React.FC<{ ratio: number }> = ({ ratio }) => (
  <div style={{ position: 'relative', paddingTop: '16px', paddingBottom: '22px' }}>
    <div style={{ display: 'flex', height: '14px', borderRadius: '9999px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
      {zones.map(zone => (
        <div
          key={zone.label}
          style={{ width: acwrGaugeWidth(zone.start, zone.end), background: zone.color, opacity: 0.9 }}
          title={`${zone.label} (${zone.start} – ${zone.end})`}
        />
      ))}
    </div>
    <div style={{ position: 'absolute', top: '4px', left: acwrGaugePosition(ratio), transform: 'translateX(-50%)', pointerEvents: 'none' }}>
      <span style={{ background: 'var(--bg-main)', border: '1px solid var(--primary)', color: 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
        ▼ {ratio}
      </span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
      {zones.map(zone => (
        <span key={zone.label} style={{ color: zone.color, fontWeight: zone.label === 'Sweet Spot' ? 700 : undefined }}>
          {zone.start === 0 ? '< ' : zone.start === ACWR_POLICY.highAbove ? '> ' : `${zone.start} – `}
          {zone.start === 0 ? zone.end : zone.start === ACWR_POLICY.highAbove ? zone.start : zone.end} : {zone.label}
        </span>
      ))}
    </div>
  </div>
);
