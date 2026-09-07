import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import {
  computeFullStatsReport,
  formatMinutes,
  TimeRangeScope
} from '../services/statsEngine';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Layers,
  MapPin,
  Mountain,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';

interface StatsDashboardProps {
  garminActivities: GarminActivity[];
  comparisons: ActivityComparison[];
  allEvents: CalendarEvent[];
  referenceDate?: Date;
  onOpenGarminSync?: () => void;
}

type SubSectionTab = 'overview' | 'running' | 'strength' | 'cardio' | 'qmt';

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  garminActivities,
  comparisons,
  allEvents,
  referenceDate = new Date(),
  onOpenGarminSync
}) => {
  const [scope, setScope] = useState<TimeRangeScope>('all');
  const [activeTab, setActiveTab] = useState<SubSectionTab>('overview');
  const [hoveredWeekKey, setHoveredWeekKey] = useState<string | null>(null);

  // Compute live full report
  const report = computeFullStatsReport(
    garminActivities,
    comparisons,
    allEvents,
    scope,
    referenceDate
  );

  const { global, running, strength, heartRate, qmtPrediction } = report;

  // Max minutes in a week for relative bar chart heights
  const maxWeeklyMinutes = Math.max(...global.weeklyTrend.map(w => w.totalMinutes), 360);

  return (
    <div className="stats-dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header & Range Filter */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.95), rgba(14, 20, 36, 0.98))',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: 800
              }}
            >
              <BarChart3 size={13} /> STATISTIQUES & ANALYTICS
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {global.totalSessionsCount} séances analysées
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Télémétrie d'Entraînement & Progression
          </h2>
        </div>

        {/* Time Scope Filter Buttons */}
        <div className="filter-chips" style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`chip-btn ${scope === 'all' ? 'active' : ''}`}
            onClick={() => setScope('all')}
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
          >
            Tout l'historique
          </button>
          <button
            className={`chip-btn ${scope === '12w' ? 'active' : ''}`}
            onClick={() => setScope('12w')}
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
          >
            12 semaines
          </button>
          <button
            className={`chip-btn ${scope === '4w' ? 'active' : ''}`}
            onClick={() => setScope('4w')}
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
          >
            4 semaines
          </button>
        </div>
      </div>

      {/* Hero KPI Grid (4 High-Impact Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Card 1: Total Training Time */}
        <div className="stats-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Temps Total d'Entraînement</span>
            <div className="kpi-icon" style={{ background: 'rgba(255, 87, 34, 0.15)', color: 'var(--primary)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div className="kpi-main-value">
            {formatMinutes(global.totalDurationMinutes)}
          </div>
          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              Moyenne : <strong>{formatMinutes(global.weeklyAverageMinutes)}/sem</strong>
            </span>
            {global.weeklyProgressionPct !== 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: global.weeklyProgressionPct > 0 ? 'var(--accent-green)' : 'var(--accent-amber)'
                }}
              >
                {global.weeklyProgressionPct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {global.weeklyProgressionPct > 0 ? `+${global.weeklyProgressionPct}%` : `${global.weeklyProgressionPct}%`}
              </span>
            )}
          </div>
          {/* Mini discipline distribution bar */}
          <div
            style={{
              marginTop: '10px',
              height: '6px',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              overflow: 'hidden',
              gap: '1px'
            }}
          >
            <div
              title={`Course: ${global.sportBreakdown.running.pct}%`}
              style={{
                width: `${global.sportBreakdown.running.pct}%`,
                background: 'var(--primary)'
              }}
            />
            <div
              title={`Force: ${global.sportBreakdown.strength.pct}%`}
              style={{
                width: `${global.sportBreakdown.strength.pct}%`,
                background: 'var(--accent-purple)'
              }}
            />
            <div
              title="Cross / Autres"
              style={{
                width: `${global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%`,
                background: 'var(--accent-cyan)'
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>🏃 Course {global.sportBreakdown.running.pct}%</span>
            <span>🏋️ Force {global.sportBreakdown.strength.pct}%</span>
            <span>🚴 Cross {global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%</span>
          </div>
        </div>

        {/* Card 2: Dynamic QMT-80 Race Prediction */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-orange)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Chrono Estimé QMT-80 (77 km)</span>
            <div className="kpi-icon" style={{ background: 'rgba(255, 112, 67, 0.15)', color: 'var(--accent-orange)' }}>
              <Mountain size={16} />
            </div>
          </div>
          <div className="kpi-main-value" style={{ color: 'var(--accent-orange)' }}>
            {formatMinutes(qmtPrediction.predictedMinutes)}
          </div>
          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              Fourchette : {formatMinutes(qmtPrediction.ambitiousMinutes)} - {formatMinutes(qmtPrediction.conservativeMinutes)}
            </span>
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                padding: '2px 6px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}
            >
              {qmtPrediction.evolutionDeltaMinutes < 0 ? `${qmtPrediction.evolutionDeltaMinutes} min` : 'Stable'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-green)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} />
            Marge de confort : <strong>+{formatMinutes(qmtPrediction.cutoffMarginMinutes)}</strong> sur barrière (19h)
          </div>
        </div>

        {/* Card 3: Heart Rate Trend & Aerobic Decoupling */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-red)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Tendance Fréquence Cardiaque</span>
            <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)' }}>
              <Heart size={16} />
            </div>
          </div>
          <div className="kpi-main-value" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {heartRate.currentAvgHeartRate ? `${heartRate.currentAvgHeartRate} bpm` : '-'}
            {heartRate.heartRateDeltaBpm !== null && (
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: heartRate.heartRateDeltaBpm <= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                {heartRate.heartRateDeltaBpm < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                {heartRate.heartRateDeltaBpm > 0 ? `+${heartRate.heartRateDeltaBpm}` : heartRate.heartRateDeltaBpm} bpm
              </span>
            )}
          </div>
          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              {heartRate.heartRateTrend === 'DECREASING'
                ? '📉 En baisse (adaptations positives)'
                : heartRate.heartRateTrend === 'STABLE'
                ? 'Économie aérobie stable'
                : 'Charge / Fatigue à surveiller'}
            </span>
            {heartRate.aerobicEfficiencyIndex && (
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.74rem' }}>
                AEI: {heartRate.aerobicEfficiencyIndex}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.3 }}>
            {heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0
              ? 'Le cœur pompe plus de volume avec moins de battements par minute.'
              : 'Enregistrez vos sorties régulières en Zone 2 pour observer la baisse.'}
          </div>
        </div>

        {/* Card 4: Elevation Gain & Mountain Density */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Dénivelé Positif D+ Cumulé</span>
            <div className="kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="kpi-main-value" style={{ color: 'var(--accent-cyan)' }}>
            +{running.totalElevationGainM.toLocaleString('fr-CA')} m
          </div>
          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              Densité : <strong>{running.elevationDensityMPerKm} m D+/km</strong>
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 6px',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-cyan)',
                fontWeight: 700
              }}
            >
              QMT-80 : 44 m/km
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Descente cumulée encaissée : <strong>-{running.totalElevationLossM.toLocaleString('fr-CA')} m D-</strong>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div
        className="filter-chips-scroll"
        style={{
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
          gap: '8px'
        }}
      >
        <button
          className={`chip-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={14} /> 1. Volume & Progression Hebdo
        </button>

        <button
          className={`chip-btn ${activeTab === 'running' ? 'active' : ''}`}
          onClick={() => setActiveTab('running')}
        >
          <Footprints size={14} /> 2. Course à Pied & Sentiers
        </button>

        <button
          className={`chip-btn ${activeTab === 'strength' ? 'active' : ''}`}
          onClick={() => setActiveTab('strength')}
        >
          <Dumbbell size={14} /> 3. Renforcement & Calisthénie
        </button>

        <button
          className={`chip-btn ${activeTab === 'cardio' ? 'active' : ''}`}
          onClick={() => setActiveTab('cardio')}
        >
          <Heart size={14} /> 4. Fréquence Cardiaque & Efficacité
        </button>

        <button
          className={`chip-btn ${activeTab === 'qmt' ? 'active' : ''}`}
          onClick={() => setActiveTab('qmt')}
        >
          <Mountain size={14} /> 5. Simulateur Chrono QMT-80
        </button>
      </div>

      {/* SECTION 1: Overview & Weekly Progression */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Interactive Weekly Volume Bar Chart */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  Volume Hebdomadaire & Répartition des Disciplines
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Progression du temps d'entraînement microcycle par microcycle
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.74rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--primary)' }} />
                  Course / Trail
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-purple)' }} />
                  Renforcement / Calisthénie
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-cyan)' }} />
                  Cross-training
                </span>
              </div>
            </div>

            {global.weeklyTrend.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Aucune séance enregistrée pour cette période.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '12px',
                  height: '180px',
                  paddingTop: '20px',
                  borderBottom: '1px solid var(--border-color)',
                  overflowX: 'auto',
                  paddingBottom: '6px'
                }}
              >
                {global.weeklyTrend.map(w => {
                  const runHeight = (w.runningMinutes / maxWeeklyMinutes) * 140;
                  const strengthHeight = (w.strengthMinutes / maxWeeklyMinutes) * 140;
                  const otherHeight = (w.otherMinutes / maxWeeklyMinutes) * 140;
                  const isHovered = hoveredWeekKey === w.weekKey;

                  return (
                    <div
                      key={w.weekKey}
                      onMouseEnter={() => setHoveredWeekKey(w.weekKey)}
                      onMouseLeave={() => setHoveredWeekKey(null)}
                      style={{
                        flex: '1 1 55px',
                        minWidth: '55px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      {/* Floating Tooltip when hovered */}
                      {isHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            marginBottom: '8px',
                            background: 'rgba(14, 20, 36, 0.96)',
                            border: '1px solid var(--primary-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            fontSize: '0.72rem',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            pointerEvents: 'none'
                          }}
                        >
                          <strong>{w.weekLabel}</strong>
                          <div>Total : {formatMinutes(w.totalMinutes)}</div>
                          <div style={{ color: 'var(--primary)' }}>🏃 {w.distanceKm} km • +{w.elevationGainM}m D+</div>
                          <div style={{ color: 'var(--accent-purple)' }}>🏋️ {w.strengthMinutes} min de force</div>
                          {w.avgHeartRate && <div style={{ color: 'var(--accent-red)' }}>❤️ FC moy : {w.avgHeartRate} bpm</div>}
                        </div>
                      )}

                      {/* Stacked Bar */}
                      <div
                        style={{
                          width: '28px',
                          display: 'flex',
                          flexDirection: 'column-reverse',
                          borderRadius: '4px 4px 0 0',
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.03)',
                          transition: 'transform 0.2s',
                          transform: isHovered ? 'scale(1.06)' : 'none'
                        }}
                      >
                        <div style={{ height: `${runHeight}px`, background: 'var(--primary)' }} />
                        <div style={{ height: `${strengthHeight}px`, background: 'var(--accent-purple)' }} />
                        <div style={{ height: `${otherHeight}px`, background: 'var(--accent-cyan)' }} />
                      </div>

                      {/* Label */}
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                          textAlign: 'center',
                          lineHeight: 1.1
                        }}
                      >
                        {w.weekLabel.replace('Sem. ', '')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Training Progression & Periodization Insights */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '12px'
            }}
          >
            {/* Progression Rate Diagnostic */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Activity size={18} style={{ color: 'var(--accent-green)' }} />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Régularité & Progression Hebdomadaire</h4>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '12px' }}>
                {global.progressionStatus === 'SAFE_PROGRESSION' && (
                  <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                    ✅ Augmentation saine du volume (+{global.weeklyProgressionPct}% par semaine). Vous respectez la règle des 10% maximum pour préserver tendons et articulations.
                  </span>
                )}
                {global.progressionStatus === 'OVERLOAD_WARNING' && (
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                    ⚠️ Hausse rapide du volume (+{global.weeklyProgressionPct}%). Surveillez les signaux de fatigue tendineuse et planifiez une semaine d'allègement (décharge).
                  </span>
                )}
                {global.progressionStatus === 'RECOVERY_MAINTENANCE' && (
                  <span style={{ color: 'var(--accent-blue)' }}>
                    ℹ️ Volume stable ou phase d'allègement/récupération. Idéal pour assimiler les blocs d'entraînement intenses et recharger les réserves glycogéniques.
                  </span>
                )}
                {global.progressionStatus === 'STARTING' && (
                  <span>Phase initiale de reprise. Le volume va s'ajuster avec l'enregistrement des prochaines semaines.</span>
                )}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Semaines actives</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{global.activeWeeksCount} semaines</strong>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Moyenne séances/sem</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {(global.totalSessionsCount / Math.max(1, global.activeWeeksCount)).toFixed(1)} / sem
                  </strong>
                </div>
              </div>
            </div>

            {/* Discipline Breakdown Details */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Répartition par Sport</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span>🏃 Course & Trail ({global.sportBreakdown.running.count} séances)</span>
                    <strong>{formatMinutes(global.sportBreakdown.running.minutes)} ({global.sportBreakdown.running.pct}%)</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${global.sportBreakdown.running.pct}%`, height: '100%', background: 'var(--primary)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span>🏋️ Renforcement & Calisthénie ({global.sportBreakdown.strength.count} séances)</span>
                    <strong>{formatMinutes(global.sportBreakdown.strength.minutes)} ({global.sportBreakdown.strength.pct}%)</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${global.sportBreakdown.strength.pct}%`, height: '100%', background: 'var(--accent-purple)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span>🚴 Cross-training & Autres ({global.sportBreakdown.crossTraining.count + global.sportBreakdown.other.count} séances)</span>
                    <strong>{formatMinutes(global.sportBreakdown.crossTraining.minutes + global.sportBreakdown.other.minutes)} ({global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%)</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%`, height: '100%', background: 'var(--accent-cyan)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Running & Trail Deep Dive */}
      {activeTab === 'running' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Milestone Records Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px'
            }}
          >
            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Distance Totale</span>
                <Footprints size={16} color="var(--primary)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--primary)' }}>
                {running.totalDistanceKm} km
              </div>
              <div className="kpi-sub-row">
                <span>Temps cumulé : <strong>{formatMinutes(running.totalDurationMinutes)}</strong></span>
              </div>
            </div>

            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Allure Moyenne Globale</span>
                <Zap size={16} color="var(--accent-amber)" />
              </div>
              <div className="kpi-main-value">
                {running.avgPaceMinKm}
              </div>
              <div className="kpi-sub-row">
                <span>Cadence moyenne : <strong>{running.avgCadenceSpm} spm</strong></span>
              </div>
            </div>

            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Sortie la Plus Longue</span>
                <Award size={16} color="var(--accent-green)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-green)' }}>
                {running.longestRun ? `${running.longestRun.distanceKm} km` : '-'}
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {running.longestRun ? `${running.longestRun.name} (${formatMinutes(running.longestRun.durationMinutes)})` : 'Aucune sortie'}
                </span>
              </div>
            </div>

            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Séance au Plus Fort D+</span>
                <Mountain size={16} color="var(--accent-cyan)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-cyan)' }}>
                {running.maxElevationRun ? `+${running.maxElevationRun.elevationGainM}m` : '-'}
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {running.maxElevationRun ? `${running.maxElevationRun.name} (${running.maxElevationRun.distanceKm} km)` : 'Aucune sortie'}
                </span>
              </div>
            </div>
          </div>

          {/* Trail Specific Profile Analysis */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Mountain size={18} color="var(--accent-orange)" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Densité de Dénivelé vs Profil QMT-80</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Le parcours officiel du QMT-80 présente un ratio de <strong>43,8 m de D+ par kilomètre</strong> (3 370m pour 77 km). Votre moyenne actuelle à l'entraînement est de <strong>{running.elevationDensityMPerKm} m D+/km</strong>.
              </p>
              <div style={{ marginTop: '12px', background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span>Spécificité Montagne</span>
                  <strong>{Math.min(100, Math.round((running.elevationDensityMPerKm / 44) * 100))}%</strong>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((running.elevationDensityMPerKm / 44) * 100))}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary), var(--accent-orange))'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Intensity Zones */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 10px 0' }}>Répartition des Zones Cardiaques</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--accent-green)' }}>Zone 2 (Endurance Fondamentale &lt; 155 bpm)</span>
                    <strong>{running.intensityDistribution.zone2Pct}% ({formatMinutes(running.intensityDistribution.zone2EnduranceMinutes)})</strong>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px' }}>
                    <div style={{ width: `${running.intensityDistribution.zone2Pct}%`, height: '100%', background: 'var(--accent-green)', borderRadius: '9999px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--accent-amber)' }}>Zone 3/4 (Tempo & Seuil 155-175 bpm)</span>
                    <strong>{running.intensityDistribution.zoneTempoThresholdPct}% ({formatMinutes(running.intensityDistribution.zoneTempoThresholdMinutes)})</strong>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px' }}>
                    <div style={{ width: `${running.intensityDistribution.zoneTempoThresholdPct}%`, height: '100%', background: 'var(--accent-amber)', borderRadius: '9999px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--accent-red)' }}>Zone 5 (VO2 Max &gt; 175 bpm)</span>
                    <strong>{running.intensityDistribution.zoneMaxPct}% ({formatMinutes(running.intensityDistribution.zoneMaxMinutes)})</strong>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px' }}>
                    <div style={{ width: `${running.intensityDistribution.zoneMaxPct}%`, height: '100%', background: 'var(--accent-red)', borderRadius: '9999px' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Strength Training & Calisthenics Deep Dive */}
      {activeTab === 'strength' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Strength KPI Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}
          >
            <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
              <div className="kpi-header">
                <span className="kpi-title">Temps Total de Force</span>
                <Dumbbell size={16} color="var(--accent-purple)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-purple)' }}>
                {formatMinutes(strength.totalDurationMinutes)}
              </div>
              <div className="kpi-sub-row">
                <span>Total séances : <strong>{strength.totalSessionsCount} séances</strong></span>
              </div>
            </div>

            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Fréquence Hebdomadaire</span>
                <Calendar size={16} color="var(--primary)" />
              </div>
              <div className="kpi-main-value">
                {strength.weeklyFrequency} / sem
              </div>
              <div className="kpi-sub-row">
                <span style={{ color: 'var(--text-muted)' }}>
                  Cible ultra : <strong>1.5 à 2 séances/sem</strong>
                </span>
              </div>
            </div>

            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Équilibre Force / Course</span>
                <Layers size={16} color="var(--accent-cyan)" />
              </div>
              <div className="kpi-main-value">
                {strength.strengthToRunRatioPct}%
              </div>
              <div className="kpi-sub-row">
                <span>Recommandé : <strong>20-30%</strong></span>
              </div>
            </div>

            <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
              <div className="kpi-header">
                <span className="kpi-title">Armure Musculaire Excentrique</span>
                <ShieldCheck size={16} color="var(--accent-green)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-green)' }}>
                {strength.quadArmorScore}/100
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontWeight: 700 }}>{strength.quadArmorRating}</span>
              </div>
            </div>
          </div>

          {/* Detailed Strength Focus & Downhill Armor Explanations */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Shield size={18} color="var(--accent-green)" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Protection Articulaire & Résistance aux Descentes</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                En ultra-trail de montagne (QMT-80), <strong>3 370 mètres de descente</strong> génèrent des contractions musculaires excentriques répétées. Sans renforcement musculaire spécifique (squats lents, calisthénie, fentes bulgares), les fibres des quadriceps subissent des micro-déchirures menant à la tétanie musculaire dès le km 50.
              </p>
              <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                  🛡️ Impact estimé sur votre course : +40 minutes préservées en fin de parcours grâce à l'absence de tétanie musculaire !
                </span>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 10px 0' }}>Détail des Formats de Renforcement</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem' }}>
                <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong>🤸 Calisthénie & Gainage (Poids de corps)</strong>
                    <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>{formatMinutes(strength.categoryBreakdown.calisthenicsMinutes)}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Tractions, pompes, dips et gainage hollow body (stabilité avec portage de sac d'hydratation).
                  </span>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong>🏋️ Musculation & Force (Gym ÉTS)</strong>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatMinutes(strength.categoryBreakdown.gymForceMinutes)}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Renforcement lourd des mollets, ischios et quadriceps (résistance au dénivelé).
                  </span>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong>🧘 Mobilité & Chevilles</strong>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{formatMinutes(strength.categoryBreakdown.coreMobilityMinutes)}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Proprioception et souplesse articulaire pour les sentiers accidentés et racines.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Heart Rate & Aerobic Efficiency */}
      {activeTab === 'cardio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Main Answer Banner to user question: "Is my heart rate going down?" */}
          <div
            style={{
              background: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0
                ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(56, 189, 248, 0.15))'
                : 'linear-gradient(90deg, rgba(255, 87, 34, 0.12), rgba(245, 158, 11, 0.12))',
              border: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 87, 34, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0 ? (
                <TrendingDown size={24} color="var(--accent-green)" />
              ) : (
                <Heart size={24} color="var(--primary)" />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                {heartRate.heartRateTrend === 'DECREASING'
                  ? '📉 Oui ! Votre fréquence cardiaque moyenne est en baisse continue.'
                  : heartRate.heartRateTrend === 'STABLE'
                  ? '📊 Fréquence cardiaque stable et socle aérobie bien calibré.'
                  : 'Diagnostic Fréquence Cardiaque'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {heartRate.summaryText}
              </p>
            </div>
          </div>

          {/* Chronological HR Data by Week */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px'
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 14px 0' }}>
              Suivi Chronologique de la Fréquence Cardiaque par Semaine
            </h4>

            {global.weeklyTrend.filter(w => w.avgHeartRate).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>
                Aucune donnée de fréquence cardiaque enregistrée. Connectez Garmin pour synchroniser la télémétrie cardio.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {global.weeklyTrend.filter(w => w.avgHeartRate).map(w => (
                  <div
                    key={w.weekKey}
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{w.weekLabel}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Heart size={14} color="var(--accent-red)" />
                      <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                        {w.avgHeartRate} bpm
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Volume : {formatMinutes(w.totalMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aerobic Efficiency Explained */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px'
            }}
          >
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--accent-cyan)" /> Comprendre l'Indice d'Efficacité Aérobie (AEI)
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              L'indice d'efficacité aérobie mesure les <strong>mètres parcourus par minute pour chaque battement de cœur</strong> (Vitesse / Fréquence Cardiaque). Lorsque votre condition physique progresse, le cœur éjecte plus de sang par battement (augmentation du volume d'éjection systolique) et les fibres musculaires développent plus de mitochondries. Résultat : vous courez à la même vitesse avec une fréquence cardiaque plus basse !
            </p>
          </div>
        </div>
      )}

      {/* SECTION 5: QMT-80 Dynamic Race Predictor & Strategy */}
      {activeTab === 'qmt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Main Predictor Summary Hero */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255, 87, 34, 0.12), rgba(14, 20, 36, 0.95))',
              border: '1px solid var(--primary-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span
                  style={{
                    background: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}
                >
                  PRÉDICTEUR D'ALLURE OFFICIEL
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
                  Québec Méga Trail QMT-80 (77 km • +3 370m D+)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Calcul dynamique fondé sur votre volume d'entraînement, endurance aérobie et renforcement excentrique.
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chrono Prévisionnel Cible</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)' }}>
                  {formatMinutes(qmtPrediction.predictedMinutes)}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                  {qmtPrediction.evolutionDeltaMinutes < 0 ? `📉 Amélioration de ${Math.abs(qmtPrediction.evolutionDeltaMinutes)} min !` : 'Stable'}
                </span>
              </div>
            </div>

            {/* Range Bar */}
            <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent-green)' }}>
                  🟢 Ambitieux : <strong>{formatMinutes(qmtPrediction.ambitiousMinutes)}</strong>
                </span>
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                  🎯 Cible Réaliste : <strong>{formatMinutes(qmtPrediction.predictedMinutes)}</strong>
                </span>
                <span style={{ color: 'var(--accent-amber)' }}>
                  🟠 Prudent : <strong>{formatMinutes(qmtPrediction.conservativeMinutes)}</strong>
                </span>
                <span style={{ color: 'var(--accent-red)' }}>
                  🛑 Barrière Max : <strong>19h00</strong>
                </span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', position: 'relative', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.round((qmtPrediction.ambitiousMinutes / 1140) * 100)}%`,
                    width: `${Math.round(((qmtPrediction.conservativeMinutes - qmtPrediction.ambitiousMinutes) / 1140) * 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-green), var(--primary), var(--accent-amber))'
                  }}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {qmtPrediction.predictionAnalysis}
            </p>
          </div>

          {/* Aid Station Splits Table */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px'
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px 0' }}>
              Temps de Passage aux 6 Ravitaillements Officiels
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Poste de Ravitaillement</th>
                    <th style={{ padding: '8px 10px' }}>Kilomètre</th>
                    <th style={{ padding: '8px 10px' }}>D+ Cumulé</th>
                    <th style={{ padding: '8px 10px' }}>Temps de Course</th>
                    <th style={{ padding: '8px 10px' }}>Allure Section</th>
                    <th style={{ padding: '8px 10px' }}>Recommandations</th>
                  </tr>
                </thead>
                <tbody>
                  {qmtPrediction.aidStationSplits.map((split, i) => (
                    <tr
                      key={split.name}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                      }}
                    >
                      <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {split.name}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                        KM {split.km}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--accent-cyan)' }}>
                        +{split.elevationGainM}m
                      </td>
                      <td style={{ padding: '10px', fontWeight: 800, color: 'var(--primary)' }}>
                        {split.elapsedFormatted}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                        {split.paceMinKm}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {split.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
