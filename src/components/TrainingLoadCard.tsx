import React from 'react';
import { ActivityComparison } from '../types/garmin';
import { WeeklyStatsSummary } from '../services/comparisonEngine';
import { Activity, Award, BarChart3, Clock, Compass, Flame, ShieldAlert, TrendingUp, Zap } from 'lucide-react';

interface TrainingLoadCardProps {
  weeklyStats: WeeklyStatsSummary;
  comparisons: ActivityComparison[];
}

export const TrainingLoadCard: React.FC<TrainingLoadCardProps> = ({ weeklyStats, comparisons }) => {
  const isNative = weeklyStats.hasNativeGarminLoad;
  const loadScore = isNative ? weeklyStats.totalGarminTrainingLoad : (weeklyStats.estimatedTss || 0);

  let loadLevel = 'Base Aérobie Optimale';
  let loadColor = '#10b981';
  let loadAdvice = 'Charge d\'endurance soutenable. Développement aérobie et mitochondrial adapté.';

  if (loadScore > 500) {
    loadLevel = 'Choc de Surcharge Élevé';
    loadColor = '#ef4444';
    loadAdvice = 'Forte fatigue neuromusculaire. Sommeil réparateur et hydratation stricts obligatoires.';
  } else if (loadScore > 320) {
    loadLevel = 'Stimulus Optimal / Productif';
    loadColor = 'var(--primary)';
    loadAdvice = 'Stimulus d\'entraînement progressif et solide pour l\'ultra QMT-80.';
  } else if (loadScore < 140) {
    loadLevel = 'Récupération / Décharge Active';
    loadColor = '#38bdf8';
    loadAdvice = 'Recharge glycogénique et régénération tendineuse/collagène.';
  }

  const durationHours = (weeklyStats.actualDurationMin / 60).toFixed(1);
  const plannedHours = (weeklyStats.plannedDurationMin / 60).toFixed(1);

  // Extract Firstbeat Training Effect summary
  const teLabels: Record<string, number> = {};
  for (const c of comparisons) {
    if (c.actualActivity?.trainingEffectLabel) {
      const lbl = c.actualActivity.trainingEffectLabel.toUpperCase();
      teLabels[lbl] = (teLabels[lbl] || 0) + 1;
    }
  }
  const teList = Object.entries(teLabels);

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
              {isNative ? 'Charge d\'Entraînement Garmin Firstbeat (EPOC)' : 'Score de Stress d\'Entraînement (TSS) & Charge'}
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {isNative
                ? 'Télémétrie physiologique réelle calculée par l\'algorithme Firstbeat de ta montre Garmin'
                : 'Calcul de charge physiologique inspiré d\'Intervals.icu selon l\'intensité cardiaque et le volume'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: '0.74rem',
              padding: '3px 10px',
              borderRadius: 9999,
              background: `${loadColor}15`,
              color: loadColor,
              border: `1px solid ${loadColor}40`,
              fontWeight: 700
            }}
          >
            {isNative ? `Charge EPOC ${loadScore}` : `TSS ${loadScore}`} • {loadLevel}
          </span>
        </div>
      </div>

      {/* 4 Cartes de Métriques Clés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        {/* Volume */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> Volume Hebdo
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>
            {durationHours}h <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {plannedHours}h</span>
          </div>
          <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, weeklyStats.durationCompliancePct)}%`, height: '100%', background: weeklyStats.durationCompliancePct >= 80 ? '#10b981' : '#f59e0b' }} />
          </div>
        </div>

        {/* Dénivelé D+ et D- */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Compass size={12} /> Dénivelé D+ / D-
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
            +{weeklyStats.actualElevationM}m <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>-{weeklyStats.actualElevationLossM || 0}m</span>
          </div>
          <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, weeklyStats.elevationCompliancePct)}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
        </div>

        {/* Cardio */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={12} /> FC Moyenne
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
            {weeklyStats.avgHeartRate > 0 ? `${weeklyStats.avgHeartRate} bpm` : '--'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Concordance : <strong>{weeklyStats.overallComplianceScore}%</strong>
          </div>
        </div>

        {/* Impact Firstbeat */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} /> Bénéfices Séances
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {teList.length > 0 ? (
              teList.slice(0, 3).map(([lbl, count]) => (
                <span
                  key={lbl}
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    color: '#e2e8f0',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {lbl} ({count})
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {isNative ? 'Analyses Firstbeat synchronisées' : 'En attente de télémétrie'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bandeau de conseil physiologique */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: 4, fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={13} color="var(--primary)" />
        <span><strong>Conseil Coach Télémétrie :</strong> {loadAdvice}</span>
      </div>
    </div>
  );
};
