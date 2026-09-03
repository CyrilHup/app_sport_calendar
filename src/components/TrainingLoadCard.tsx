import React from 'react';
import { ActivityComparison } from '../types/garmin';
import { WeeklyStatsSummary } from '../services/comparisonEngine';
import { Activity, Award, BarChart3, Clock, Compass, Flame, ShieldAlert, TrendingUp, Zap } from 'lucide-react';

interface TrainingLoadCardProps {
  weeklyStats: WeeklyStatsSummary;
  comparisons: ActivityComparison[];
}

export const TrainingLoadCard: React.FC<TrainingLoadCardProps> = ({ weeklyStats, comparisons }) => {
  const tss = weeklyStats.estimatedTss || 0;

  let tssLevel = 'Optimal Baseline';
  let tssColor = '#10b981';
  let tssAdvice = 'Sustainable endurance volume. Mitochondria aerobic development.';

  if (tss > 400) {
    tssLevel = 'Peak Overload Shock';
    tssColor = '#ef4444';
    tssAdvice = 'High neuromuscular fatigue. Strict recovery sleep & hydration mandatory.';
  } else if (tss > 280) {
    tssLevel = 'High Functional Overreach';
    tssColor = 'var(--primary)';
    tssAdvice = 'Solid progressive training stimulus for QMT-80 ultra endurance.';
  } else if (tss < 120) {
    tssLevel = 'Deload / Active Recovery';
    tssColor = '#38bdf8';
    tssAdvice = 'Glycogen replenishment and structural collagen/tendon regeneration.';
  }

  const durationHours = (weeklyStats.actualDurationMin / 60).toFixed(1);
  const plannedHours = (weeklyStats.plannedDurationMin / 60).toFixed(1);

  // Group last 4 microcycle weeks to show a 4-week TSS progression mini-chart
  const dates = [...new Set(comparisons.map(c => c.date))].sort();
  const recentComparisons = comparisons.slice(0, 28); // 4 weeks

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(255, 87, 34, 0.12)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <BarChart3 size={16} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
              Training Stress Score & Microcycle Load
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Intervals.icu physiological load calculation based on HR intensity and volume
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: '0.74rem',
              padding: '3px 10px',
              borderRadius: 9999,
              background: `${tssColor}15`,
              color: tssColor,
              border: `1px solid ${tssColor}40`,
              fontWeight: 700
            }}
          >
            TSS {tss} • {tssLevel}
          </span>
        </div>
      </div>

      {/* 3 Metrics Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> Volume Hebdo (Heures)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>
            {durationHours}h <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {plannedHours}h prévu</span>
          </div>
          <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, weeklyStats.durationCompliancePct)}%`, height: '100%', background: weeklyStats.durationCompliancePct >= 80 ? '#10b981' : '#f59e0b' }} />
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Compass size={12} /> Dénivelé Positif D+
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
            +{weeklyStats.actualElevationM}m <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ +{weeklyStats.plannedElevationM}m</span>
          </div>
          <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, weeklyStats.elevationCompliancePct)}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={12} /> Fréquence Cardiaque Moyenne
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
            {weeklyStats.avgHeartRate} bpm <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>(Z2 cible: 138-155)</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Compliance globale : <strong>{weeklyStats.overallComplianceScore}%</strong>
          </div>
        </div>
      </div>

      {/* Physiological advice banner */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: 4, fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={13} color="var(--primary)" />
        <span><strong>Conseil Télémétrie :</strong> {tssAdvice}</span>
      </div>
    </div>
  );
};
