import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import {
  computeFullStatsReport,
  formatMinutes,
  TimeRangeScope,
  PLAN_START_DATE,
  FitnessDayPoint
} from '../services/statsEngine';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Dumbbell,
  Filter,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Mountain,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
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

type SubSectionTab = 'overview' | 'running' | 'strength' | 'cardio' | 'qmt' | 'load';

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  garminActivities,
  comparisons,
  allEvents,
  referenceDate = new Date(),
  onOpenGarminSync
}) => {
  // Default to 'plan' (Focus on official preparation start: 1er sept. 2026)
  const [scope, setScope] = useState<TimeRangeScope>('plan');
  const [includeBonuses, setIncludeBonuses] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<SubSectionTab>('overview');
  const [hoveredWeekKey, setHoveredWeekKey] = useState<string | null>(null);
  const [hoveredFitnessDay, setHoveredFitnessDay] = useState<FitnessDayPoint | null>(null);

  // Compute live full report with plan scope and bonus exclusion
  const report = computeFullStatsReport(
    garminActivities,
    comparisons,
    allEvents,
    scope,
    referenceDate,
    includeBonuses
  );

  const { global, running, strength, heartRate, trainingLoad, trailSpecific, qmtPrediction } = report;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
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
              {global.totalSessionsCount} séances planifiées
            </span>
            {scope === 'plan' && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--accent-green)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}
              >
                🎯 Plan QMT actif (Depuis le 1er sept.)
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Télémétrie d'Entraînement & Progression
          </h2>
        </div>

        {/* Filters Controls: Scope + Bonus Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Time Scope Filter Buttons */}
          <div className="filter-chips" style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`chip-btn ${scope === 'plan' ? 'active' : ''}`}
              onClick={() => setScope('plan')}
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Focalisé sur la préparation officielle démarrée le 1er septembre 2026"
            >
              <Target size={13} /> Plan (1er sept.)
            </button>
            <button
              className={`chip-btn ${scope === '4w' ? 'active' : ''}`}
              onClick={() => setScope('4w')}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              4 semaines
            </button>
            <button
              className={`chip-btn ${scope === '12w' ? 'active' : ''}`}
              onClick={() => setScope('12w')}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              12 semaines
            </button>
            <button
              className={`chip-btn ${scope === 'all' ? 'active' : ''}`}
              onClick={() => setScope('all')}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              title="Inclut tout l'historique Garmin Connect (avril, juillet, etc.)"
            >
              Tout l'historique
            </button>
          </div>

          {/* Bonus Filter Toggle Pill */}
          <button
            onClick={() => setIncludeBonuses(prev => !prev)}
            style={{
              fontSize: '0.76rem',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: !includeBonuses ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              border: !includeBonuses ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-color)',
              color: !includeBonuses ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 700,
              transition: 'all 0.15s ease'
            }}
            title="Exclut les activités libres/marches non prescrites pour ne pas fausser le volume du plan"
          >
            <Filter size={12} />
            {!includeBonuses ? 'Séances du plan uniquement' : 'Bonus inclus'}
          </button>
        </div>
      </div>

      {/* Bonus Exclusion Notice Banner */}
      {global.excludedBonusCount > 0 && !includeBonuses && (
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
            fontSize: '0.76rem',
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Info size={14} />
            <strong>Focus Plan QMT :</strong> {global.totalSessionsCount} séances planifiées comptabilisées ({global.excludedBonusCount} activités bonus / marches non prescrites exclues du volume).
          </span>
          <button
            onClick={() => setIncludeBonuses(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.74rem'
            }}
          >
            Inclure les séances bonus
          </button>
        </div>
      )}

      {/* Hero KPI Grid (4 High-Impact Cards with explicit "Compared to What?" baselines) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Card 1: Total Training Time & Weekly Average */}
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
              marginTop: '8px',
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

          {/* Explicit "Compared to What?" */}
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '8px',
              lineHeight: 1.35,
              background: 'rgba(255,255,255,0.02)',
              padding: '4px 6px',
              borderRadius: '4px'
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>📍 Comparé à quoi ?</span>
            <br />
            {global.progressionComparisonText}
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

          <div style={{ fontSize: '0.72rem', color: 'var(--accent-green)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} />
            Marge de sécurité : <strong>+{formatMinutes(qmtPrediction.cutoffMarginMinutes)}</strong> sur barrière (19h)
          </div>

          {/* Explicit "Compared to What?" */}
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '6px',
              lineHeight: 1.35,
              background: 'rgba(255,255,255,0.02)',
              padding: '4px 6px',
              borderRadius: '4px'
            }}
          >
            <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>📍 Comparé à quoi ?</span>
            <br />
            {qmtPrediction.evolutionComparisonText}
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

          {/* Explicit "Compared to What?" */}
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '8px',
              lineHeight: 1.35,
              background: 'rgba(255,255,255,0.02)',
              padding: '4px 6px',
              borderRadius: '4px'
            }}
          >
            <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>📍 Comparé à quoi ?</span>
            <br />
            {heartRate.comparisonBaselineText}
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
              QMT : 44 m/km
            </span>
          </div>

          {/* Explicit "Compared to What?" */}
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '8px',
              lineHeight: 1.35,
              background: 'rgba(255,255,255,0.02)',
              padding: '4px 6px',
              borderRadius: '4px'
            }}
          >
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>📍 Comparé à quoi ?</span>
            <br />
            {running.densityComparisonText}
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
          className={`chip-btn ${activeTab === 'load' ? 'active' : ''}`}
          onClick={() => setActiveTab('load')}
        >
          <Gauge size={14} /> 5. Charge, Forme & Fatigue (CTL/ATL)
        </button>

        <button
          className={`chip-btn ${activeTab === 'qmt' ? 'active' : ''}`}
          onClick={() => setActiveTab('qmt')}
        >
          <Mountain size={14} /> 6. Simulateur Chrono QMT-80
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
                  {scope === 'plan' ? 'Progression microcycle par microcycle depuis le 1er septembre 2026' : 'Historique complet des microcycles'}
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
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Régularité & Progression</h4>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '0.8rem' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Comparaison de référence :</strong>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                  {global.progressionComparisonText}
                </p>
              </div>

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
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
                <span className="kpi-title">Allure Moyenne</span>
                <Zap size={16} color="var(--accent-amber)" />
              </div>
              <div className="kpi-main-value">
                {running.avgPaceMinKm}
              </div>
              <div className="kpi-sub-row">
                <span>Allure ajustée pente (GAP) : <strong>{trailSpecific.gradeAdjustedPaceMinKm}</strong></span>
              </div>
            </div>

            <div className="stats-kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Vitesse Ascensionnelle (VAM)</span>
                <TrendingUp size={16} color="var(--accent-cyan)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-cyan)' }}>
                {trailSpecific.avgVamMPerHour} m/h
              </div>
              <div className="kpi-sub-row">
                <span>Max en côte : <strong>{trailSpecific.maxVamMPerHour} m/h</strong></span>
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
                {running.densityComparisonText}
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
                En ultra-trail de montagne (QMT-80), <strong>3 370 mètres de descente</strong> génèrent des contractions musculaires excentriques répétées. Sans renforcement musculaire régulier au Gym ÉTS ou en calisthénie, les quadriceps subissent des micro-déchirures menant à la tétanie musculaire dès le km 50.
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
                    Tractions, pompes, dips et gainage hollow body (stabilité avec sac d'hydratation).
                  </span>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong>🏋️ Musculation & Force (Gym ÉTS)</strong>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatMinutes(strength.categoryBreakdown.gymForceMinutes)}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Renforcement mollets, ischios et quadriceps (résistance au dénivelé).
                  </span>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong>🧘 Mobilité & Chevilles</strong>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{formatMinutes(strength.categoryBreakdown.coreMobilityMinutes)}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Proprioception et souplesse articulaire pour sentiers accidentés et racines.
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
          {/* Main Answer Banner to user question: "Is my heart rate going down? Compared to what?" */}
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
                  ? '📉 Oui ! Votre fréquence cardiaque moyenne est en baisse.'
                  : heartRate.heartRateTrend === 'STABLE'
                  ? '📊 Fréquence cardiaque aérobie stable et bien calibrée.'
                  : 'Diagnostic Fréquence Cardiaque'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {heartRate.comparisonBaselineText}
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
                Aucune donnée de fréquence cardiaque enregistrée sur cette période.
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

      {/* SECTION 5: Training Load, Fitness & Fatigue (CTL / ATL / TSB / ACWR) */}
      {activeTab === 'load' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}
          >
            <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
              <div className="kpi-header">
                <span className="kpi-title">Condition Physique (CTL)</span>
                <TrendingUp size={16} color="var(--accent-blue)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-blue)' }}>
                {trainingLoad.currentCtl}
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Moyenne pondérée 42 jours (Fitness)</span>
              </div>
            </div>

            <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
              <div className="kpi-header">
                <span className="kpi-title">Fatigue Aiguë (ATL)</span>
                <Flame size={16} color="var(--accent-amber)" />
              </div>
              <div className="kpi-main-value" style={{ color: 'var(--accent-amber)' }}>
                {trainingLoad.currentAtl}
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Charge des 7 derniers jours</span>
              </div>
            </div>

            <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
              <div className="kpi-header">
                <span className="kpi-title">Niveau de Forme (TSB)</span>
                <Scale size={16} color="var(--accent-green)" />
              </div>
              <div className="kpi-main-value" style={{ color: trainingLoad.currentTsb >= 0 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                {trainingLoad.currentTsb > 0 ? `+${trainingLoad.currentTsb}` : trainingLoad.currentTsb}
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Balance Fitness - Fatigue</span>
              </div>
            </div>

            <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--primary)' }}>
              <div className="kpi-header">
                <span className="kpi-title">Ratio ACWR (Risque Blessure)</span>
                <ShieldAlert size={16} color="var(--primary)" />
              </div>
              <div className="kpi-main-value" style={{ color: trainingLoad.acwrStatus === 'OPTIMAL' ? 'var(--accent-green)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'var(--accent-red)' : 'var(--accent-amber)') }}>
                {trainingLoad.acwrRatio}
              </div>
              <div className="kpi-sub-row">
                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                  {trainingLoad.acwrStatus === 'OPTIMAL' ? 'Zone Douce (0.8 - 1.3)' : trainingLoad.acwrStatus}
                </span>
              </div>
            </div>
          </div>

          {/* ACWR Risk Spectrum Gauge */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} color="var(--primary)" />
                  Spectre du Ratio ACWR (Modèle de Gabbett - Risque de Blessure)
                </h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Rapport entre la charge aiguë des 7 derniers jours ({trainingLoad.acuteLoad7d} TRIMP) et la charge chronique sur 28 jours ({trainingLoad.chronicLoad28dWeeklyAvg} TRIMP/sem).
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  background: trainingLoad.acwrStatus === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                  color: trainingLoad.acwrStatus === 'OPTIMAL' ? 'var(--accent-green)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'var(--accent-red)' : 'var(--accent-amber)')
                }}
              >
                Ratio Actuel : {trainingLoad.acwrRatio} • {trainingLoad.acwrStatus === 'OPTIMAL' ? 'Sweet Spot Optimal' : trainingLoad.acwrStatus}
              </span>
            </div>

            {/* Gauge Bar */}
            <div style={{ position: 'relative', paddingTop: '16px', paddingBottom: '24px' }}>
              {/* Colored Segments */}
              <div
                style={{
                  display: 'flex',
                  height: '14px',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ width: '40%', background: '#38bdf8', opacity: 0.85 }} title="Sous-charge (<0.8)" />
                <div style={{ width: '25%', background: '#10b981', opacity: 0.95 }} title="Zone Optimale (0.8 - 1.3)" />
                <div style={{ width: '10%', background: '#f59e0b', opacity: 0.9 }} title="Risque Modéré (1.3 - 1.5)" />
                <div style={{ width: '25%', background: '#ef4444', opacity: 0.85 }} title="Danger Blessure (>1.5)" />
              </div>

              {/* Pin Indicator */}
              {(() => {
                const pinPct = Math.min(98, Math.max(2, (trainingLoad.acwrRatio / 2.0) * 100));
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: `${pinPct}%`,
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <span
                      style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                      }}
                    >
                      ▼ {trainingLoad.acwrRatio}
                    </span>
                  </div>
                );
              })()}

              {/* Labels below bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                <span style={{ color: '#38bdf8' }}>0.0 - 0.8 : Sous-charge</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>0.8 - 1.3 : Sweet Spot (Progression sûre)</span>
                <span style={{ color: '#f59e0b' }}>1.3 - 1.5 : Surcharge modérée</span>
                <span style={{ color: '#ef4444' }}>&gt; 1.5 : Risque blessure élevé</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {trainingLoad.acwrLabel}
            </div>
          </div>

          {/* Interactive Banister Multi-Curve Chart (CTL / ATL / TSB) */}
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
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="var(--accent-blue)" />
                  Dynamique de Charge Physiologique (Modèle Banister CTL / ATL / TSB)
                </h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Historique journalier modélisé des 60 à 90 derniers jours.
                </p>
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: 'var(--accent-blue)', display: 'inline-block', borderRadius: '2px' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>CTL (Fitness 42j)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: 'var(--accent-amber)', display: 'inline-block', borderRadius: '2px' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>ATL (Fatigue 7j)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: 'var(--accent-green)', display: 'inline-block', borderRadius: '2px' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>TSB (Forme)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '10px', background: 'rgba(148, 163, 184, 0.35)', display: 'inline-block', borderRadius: '1px' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Charge Quotidienne</span>
                </div>
              </div>
            </div>

            {/* Hovered Day Tooltip Banner */}
            {hoveredFitnessDay && (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '0.76rem',
                  flexWrap: 'wrap'
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>📅 {hoveredFitnessDay.dateLabel} ({hoveredFitnessDay.date})</strong>
                <span style={{ color: 'var(--accent-blue)' }}>🔵 CTL : <strong>{hoveredFitnessDay.ctl}</strong></span>
                <span style={{ color: 'var(--accent-amber)' }}>🟠 ATL : <strong>{hoveredFitnessDay.atl}</strong></span>
                <span style={{ color: hoveredFitnessDay.tsb >= 0 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                  🟢 TSB : <strong>{hoveredFitnessDay.tsb > 0 ? `+${hoveredFitnessDay.tsb}` : hoveredFitnessDay.tsb}</strong>
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>📊 Charge du jour : <strong>{hoveredFitnessDay.dailyLoad} TRIMP</strong></span>
              </div>
            )}

            {/* SVG Canvas */}
            {(() => {
              const trend = trainingLoad.fitnessTrend || [];
              if (trend.length === 0) {
                return (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '30px', textAlign: 'center' }}>
                    Aucune donnée d'entraînement suffisante pour tracer la modélisation Banister.
                  </div>
                );
              }

              const svgWidth = 760;
              const svgHeight = 220;
              const padL = 40;
              const padR = 20;
              const padT = 20;
              const padB = 30;
              const innerWidth = svgWidth - padL - padR;
              const innerHeight = svgHeight - padT - padB;

              const minTsb = Math.min(-20, ...trend.map(d => d.tsb));
              const maxLoad = Math.max(30, ...trend.map(d => Math.max(d.ctl, d.atl, d.dailyLoad * 0.4)));
              const minVal = Math.min(minTsb, 0);
              const maxVal = Math.max(maxLoad, ...trend.map(d => d.tsb)) * 1.1;
              const valRange = Math.max(1, maxVal - minVal);

              const yFor = (v: number) => padT + innerHeight - ((v - minVal) / valRange) * innerHeight;
              const xFor = (idx: number) => padL + (idx / Math.max(1, trend.length - 1)) * innerWidth;
              const yZero = yFor(0);

              const ctlPath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.ctl).toFixed(1)}`).join(' ');
              const atlPath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.atl).toFixed(1)}`).join(' ');
              const tsbPath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.tsb).toFixed(1)}`).join(' ');

              const maxDaily = Math.max(1, ...trend.map(d => d.dailyLoad));

              return (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}
                  >
                    {/* Grid lines */}
                    <line x1={padL} y1={padT} x2={svgWidth - padR} y2={padT} stroke="rgba(255,255,255,0.05)" />
                    <line x1={padL} y1={yZero} x2={svgWidth - padR} y2={yZero} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
                    <line x1={padL} y1={padT + innerHeight} x2={svgWidth - padR} y2={padT + innerHeight} stroke="rgba(255,255,255,0.05)" />

                    {/* Y Axis Labels */}
                    <text x={padL - 8} y={padT + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                      {Math.round(maxVal)}
                    </text>
                    <text x={padL - 8} y={yZero + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                      0
                    </text>
                    <text x={padL - 8} y={padT + innerHeight} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                      {Math.round(minVal)}
                    </text>

                    {/* Daily Load Bars (TRIMP) */}
                    {trend.map((d, i) => {
                      const barH = (d.dailyLoad / maxDaily) * 45;
                      return (
                        <rect
                          key={`load-${d.date}`}
                          x={xFor(i) - 2}
                          y={padT + innerHeight - barH}
                          width={4}
                          height={barH}
                          fill="rgba(148, 163, 184, 0.22)"
                          rx={1}
                        />
                      );
                    })}

                    {/* CTL Curve (Fitness) */}
                    <path d={ctlPath} fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" />

                    {/* ATL Curve (Fatigue) */}
                    <path d={atlPath} fill="none" stroke="var(--accent-amber)" strokeWidth="2" />

                    {/* TSB Curve (Form) */}
                    <path d={tsbPath} fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeDasharray="4 3" />

                    {/* Date labels on X axis */}
                    {trend.map((d, i) => {
                      if (i % Math.ceil(trend.length / 8) !== 0 && i !== trend.length - 1) return null;
                      return (
                        <text
                          key={`x-${d.date}`}
                          x={xFor(i)}
                          y={svgHeight - 10}
                          fill="var(--text-muted)"
                          fontSize="9.5"
                          textAnchor="middle"
                        >
                          {d.dateLabel}
                        </text>
                      );
                    })}

                    {/* Interactive hover overlays */}
                    {trend.map((d, i) => (
                      <circle
                        key={`hit-${d.date}`}
                        cx={xFor(i)}
                        cy={yFor(d.ctl)}
                        r={8}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredFitnessDay(d)}
                        onClick={() => setHoveredFitnessDay(d)}
                      />
                    ))}

                    {/* Active hover crosshair and points */}
                    {hoveredFitnessDay && (() => {
                      const idx = trend.findIndex(d => d.date === hoveredFitnessDay.date);
                      if (idx === -1) return null;
                      const x = xFor(idx);
                      return (
                        <g>
                          <line x1={x} y1={padT} x2={x} y2={padT + innerHeight} stroke="rgba(255,255,255,0.4)" strokeDasharray="3 3" />
                          <circle cx={x} cy={yFor(hoveredFitnessDay.ctl)} r={4.5} fill="var(--accent-blue)" stroke="#fff" strokeWidth="1.5" />
                          <circle cx={x} cy={yFor(hoveredFitnessDay.atl)} r={4.5} fill="var(--accent-amber)" stroke="#fff" strokeWidth="1.5" />
                          <circle cx={x} cy={yFor(hoveredFitnessDay.tsb)} r={4.5} fill={hoveredFitnessDay.tsb >= 0 ? 'var(--accent-green)' : 'var(--accent-orange)'} stroke="#fff" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              );
            })()}
          </div>

          {/* Trail Biomechanics & Eccentric Load Card */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Mountain size={18} color="var(--accent-cyan)" />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Dénivelé Négatif D- & Stress Excentrique</h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <strong style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)' }}>
                  -{trailSpecific.totalElevationLossM.toLocaleString('fr-CA')} m D-
                </strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  (Course cible : -3 370 m D-)
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
                Score de blindage quadricipital : <strong>{trailSpecific.downhillStressScore}/100</strong> ({trailSpecific.downhillStressLabel}).
                Les descentes répétées créent des microlésions membranaires (désinsertion des disques Z). La calisthénie (fentes & squats lents) associée au trail protège contre la casse musculaire.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Zap size={18} color="var(--accent-amber)" />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Vitesse Ascensionnelle & Allure GAP</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VAM Moyenne en côte</div>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--accent-amber)' }}>{trailSpecific.avgVamMPerHour} m/h</strong>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VAM Maximale</div>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--accent-orange)' }}>{trailSpecific.maxVamMPerHour} m/h</strong>
                </div>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Allure ajustée à la pente (Minetti GAP) : <strong>{trailSpecific.gradeAdjustedPaceMinKm}</strong> (contre {running.avgPaceMinKm} allure GPS brute).
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px'
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0' }}>
              État de Forme & Diagnostic Physiologique
            </h4>
            <div style={{ background: 'var(--bg-main)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {trainingLoad.formLabel}
              </span>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {trainingLoad.acwrLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: QMT-80 Dynamic Race Predictor & Strategy */}
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

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--accent-orange)' }}>📍 Comparé à quoi ?</strong>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                {qmtPrediction.evolutionComparisonText}
              </p>
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
