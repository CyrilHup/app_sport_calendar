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

  let tssLevel = 'Base Aérobie Optimale';
  let tssColor = '#10b981';
  let tssAdvice = 'Charge d\'endurance soutenable. Développement aérobie et mitochondrial.';

  if (tss > 400) {
    tssLevel = 'Choc de Surcharge Élevé';
    tssColor = '#ef4444';
    tssAdvice = 'Forte fatigue neuromusculaire. Sommeil réparateur et hydratation stricts obligatoires.';
  } else if (tss > 280) {
    tssLevel = 'Surmenage Fonctionnel';
    tssColor = 'var(--primary)';
    tssAdvice = 'Stimulus d\'entraînement progressif et solide pour l\'ultra QMT-80.';
  } else if (tss < 120) {
    tssLevel = 'Décharge / Récupération Active';
    tssColor = '#38bdf8';
    tssAdvice = 'Recharge glycogénique et régénération tendineuse/collagène.';
  }

  const durationHours = (weeklyStats.actualDurationMin / 60).toFixed(1);
  const plannedHours = (weeklyStats.plannedDurationMin / 60).toFixed(1);

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
              Score de Stress d'Entraînement (TSS) & Charge du Microcycle
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Calcul de charge physiologique inspiré d'Intervals.icu selon l'intensité cardiaque et le volume
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

      {/* 3 Cartes de Métriques Clés */}
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
            {weeklyStats.avgHeartRate} bpm <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>(Z2 cible : 138-155)</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Concordance globale : <strong>{weeklyStats.overallComplianceScore}%</strong>
          </div>
        </div>
      </div>

      {/* Bandeau de conseil physiologique */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: 4, fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={13} color="var(--primary)" />
        <span><strong>Conseil Télémétrie :</strong> {tssAdvice}</span>
      </div>
    </div>
  );
};
