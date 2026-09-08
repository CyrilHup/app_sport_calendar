import React, { useState, useRef } from 'react';
import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import {
  computeFullStatsReport,
  formatMinutes,
  FitnessDayPoint,
  WeeklyTrendPoint
} from '../services/statsEngine';
import {
  Activity,
  Award,
  BarChart3,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Heart,
  Layers,
  Mountain,
  Scale,
  Shield,
  ShieldAlert,
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

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  garminActivities,
  comparisons,
  allEvents,
  referenceDate = new Date(),
  onOpenGarminSync
}) => {
  // Permanently use full history scope ('all') with all activities (including bonuses)
  const [hoveredWeekKey, setHoveredWeekKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredFitnessDay, setHoveredFitnessDay] = useState<FitnessDayPoint | null>(null);
  const weeklyChartCardRef = useRef<HTMLDivElement>(null);

  const report = computeFullStatsReport(
    garminActivities,
    comparisons,
    allEvents,
    'all',
    referenceDate,
    true
  );

  const { global, running, strength, heartRate, trainingLoad, trailSpecific, qmtPrediction } = report;

  // Max minutes in a week for relative bar chart heights
  const maxWeeklyMinutes = Math.max(...global.weeklyTrend.map(w => w.totalMinutes), 360);

  return (
    <div className="stats-dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Épuré & Synthétique (Vue Unique Complète) */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.95), rgba(14, 20, 36, 0.98))',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
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
                gap: '5px',
                fontSize: '0.74rem',
                fontWeight: 800
              }}
            >
              <BarChart3 size={13} /> TÉLÉMÉTRIE D'ENTRAÎNEMENT & FORME
            </span>
            <span
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--accent-cyan)',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}
            >
              Historique Complet & Toutes Activités
            </span>
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Tableau de Bord & Santé Athlétique
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Synthèse globale consolidée : {global.totalSessionsCount} séances réalisées ({formatMinutes(global.totalDurationMinutes)})
          </p>
        </div>

        {onOpenGarminSync && (
          <button
            onClick={onOpenGarminSync}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Zap size={13} color="var(--primary)" /> Synchronisation Garmin
          </button>
        )}
      </div>

      {/* 2. Le Quatuor d'Indicateurs Maîtres (Cartes Fusionnées Haute Visibilité) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '14px'
        }}
      >
        {/* CARTE 1: Volume Global & Répartition des Disciplines */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Volume Total d'Entraînement</span>
            <div className="kpi-icon" style={{ background: 'rgba(255, 87, 34, 0.15)', color: 'var(--primary)' }}>
              <Clock size={16} />
            </div>
          </div>

          <div className="kpi-main-value" style={{ color: 'var(--text-primary)' }}>
            {formatMinutes(global.totalDurationMinutes)}
          </div>

          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {global.totalSessionsCount} séances
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Moy. {formatMinutes(global.weeklyAverageMinutes)}/sem
            </span>
          </div>

          {/* Barre de répartition tricolore Course / Force / Cross */}
          <div
            style={{
              marginTop: '10px',
              height: '7px',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              overflow: 'hidden',
              gap: '1px'
            }}
          >
            <div
              title={`Course : ${formatMinutes(global.sportBreakdown.running.minutes)} (${global.sportBreakdown.running.pct}%)`}
              style={{ width: `${global.sportBreakdown.running.pct}%`, background: 'var(--primary)' }}
            />
            <div
              title={`Force : ${formatMinutes(global.sportBreakdown.strength.minutes)} (${global.sportBreakdown.strength.pct}%)`}
              style={{ width: `${global.sportBreakdown.strength.pct}%`, background: 'var(--accent-purple)' }}
            />
            <div
              title={`Cross : ${formatMinutes(global.sportBreakdown.crossTraining.minutes + global.sportBreakdown.other.minutes)} (${global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%)`}
              style={{ width: `${global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%`, background: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Détails compacts de répartition */}
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '4px',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ color: 'var(--primary)' }}>🏃 {formatMinutes(global.sportBreakdown.running.minutes)} ({global.sportBreakdown.running.pct}%)</span>
            <span style={{ color: 'var(--accent-purple)' }}>🏋️ {formatMinutes(global.sportBreakdown.strength.minutes)} ({global.sportBreakdown.strength.pct}%)</span>
            <span style={{ color: 'var(--accent-cyan)' }}>🚴 {formatMinutes(global.sportBreakdown.crossTraining.minutes + global.sportBreakdown.other.minutes)} ({global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%)</span>
          </div>
        </div>

        {/* CARTE 2: Course à Pied & Spécificité Montagne */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Course à Pied & Sentiers</span>
            <div className="kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
              <Footprints size={16} />
            </div>
          </div>

          <div className="kpi-main-value" style={{ color: 'var(--primary)' }}>
            {running.totalDistanceKm.toFixed(1)} km
          </div>

          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              {global.sportBreakdown.running.count} sorties • Allure {running.avgPaceMinKm}
            </span>
            {running.avgCadenceSpm > 0 && (
              <span style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {running.avgCadenceSpm} spm
              </span>
            )}
          </div>

          {/* Fusion D+ / D- / Densité */}
          <div
            style={{
              marginTop: '8px',
              background: 'rgba(255,255,255,0.03)',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                +{running.totalElevationGainM.toLocaleString('fr-CA')} m D+
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                -{running.totalElevationLossM.toLocaleString('fr-CA')} m D-
              </span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                {running.elevationDensityMPerKm} m/km
              </span>
            </div>
            {running.longestRun && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                📍 Max : <strong>{running.longestRun.distanceKm} km</strong> ({running.longestRun.name})
              </div>
            )}
          </div>
        </div>

        {/* CARTE 3: Forme Physiologique, Charge & Santé (Banister + Cardio) */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Forme & Charge (Banister)</span>
            <div className="kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>
              <Gauge size={16} />
            </div>
          </div>

          <div className="kpi-main-value" style={{ color: 'var(--accent-purple)', fontSize: '1.25rem' }}>
            CTL {trainingLoad.currentCtl} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>• ATL {trainingLoad.currentAtl}</span>
          </div>

          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              TSB : <strong>{trainingLoad.currentTsb > 0 ? `+${trainingLoad.currentTsb}` : trainingLoad.currentTsb}</strong> ({trainingLoad.formLabel})
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '9999px',
                background: trainingLoad.acwrStatus === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'rgba(56, 189, 248, 0.15)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
                color: trainingLoad.acwrStatus === 'OPTIMAL' ? 'var(--accent-green)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'var(--accent-cyan)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'var(--accent-red)' : 'var(--accent-amber)')),
                fontWeight: 700
              }}
            >
              ACWR {trainingLoad.acwrRatio} ({trainingLoad.acwrStatusLabel})
            </span>
          </div>

          {/* Fusion Cardio & Conseil Prévention */}
          <div
            style={{
              marginTop: '8px',
              background: 'rgba(255,255,255,0.03)',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-red)' }}>
                ❤️ FC moy. {heartRate.overallPeriodAvgHr || heartRate.currentAvgHeartRate || '--'} bpm
              </span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                {running.intensityDistribution.zone2Pct}% en Zone 2
              </span>
            </div>
            {trainingLoad.acwrActionAdvice && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                💡 {trainingLoad.acwrActionAdvice}
              </div>
            )}
          </div>
        </div>

        {/* CARTE 4: Objectif QMT-80 (Chrono Prévisionnel) */}
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

          {/* Marge Barrière & Spécificité */}
          <div
            style={{
              marginTop: '8px',
              background: 'rgba(255,255,255,0.03)',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
              🛡️ +{formatMinutes(qmtPrediction.cutoffMarginMinutes)} de marge
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Barrière finale : 19h00
            </span>
          </div>
        </div>
      </div>

      {/* 3. Section Volume Hebdomadaire & Régularité */}
      <div
        ref={weeklyChartCardRef}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={17} color="var(--primary)" />
              Volume Hebdomadaire & Répartition des Disciplines
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {global.activeWeeksCount} semaines actives • Moyenne de {(global.totalSessionsCount / Math.max(1, global.activeWeeksCount)).toFixed(1)} séances / sem
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
            onScroll={() => {
              setHoveredWeekKey(null);
              setTooltipPos(null);
            }}
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

              const handleHover = (e: React.MouseEvent<HTMLDivElement>) => {
                setHoveredWeekKey(w.weekKey);
                if (weeklyChartCardRef.current) {
                  const cardRect = weeklyChartCardRef.current.getBoundingClientRect();
                  const barRect = e.currentTarget.getBoundingClientRect();
                  const rawX = barRect.left + barRect.width / 2 - cardRect.left;
                  const clampedX = Math.max(120, Math.min(cardRect.width - 120, rawX));
                  const rawY = barRect.top - cardRect.top - 8;
                  setTooltipPos({ x: clampedX, y: rawY });
                }
              };

              return (
                <div
                  key={w.weekKey}
                  onMouseEnter={handleHover}
                  onMouseMove={handleHover}
                  onMouseLeave={() => {
                    setHoveredWeekKey(null);
                    setTooltipPos(null);
                  }}
                  style={{
                    flex: '1 1 55px',
                    minWidth: '55px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                    padding: '4px',
                    borderRadius: '6px',
                    background: isHovered ? 'rgba(255, 87, 34, 0.08)' : 'transparent',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                >
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
                      transform: isHovered ? 'scale(1.06)' : 'none',
                      boxShadow: isHovered ? '0 0 10px rgba(255, 87, 34, 0.4)' : 'none'
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
                      fontWeight: isHovered ? 700 : 500,
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

        {/* Infobulle flottante au niveau de la carte (non découpée par le conteneur scrollable) */}
        {(() => {
          const hoveredWeek = global.weeklyTrend.find(w => w.weekKey === hoveredWeekKey);
          if (!hoveredWeek || !tooltipPos) return null;
          return (
            <div
              style={{
                position: 'absolute',
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(14, 20, 36, 0.98)',
                border: '1px solid rgba(255, 87, 34, 0.5)',
                borderRadius: 'var(--radius-sm, 6px)',
                padding: '8px 12px',
                fontSize: '0.73rem',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                zIndex: 40,
                boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
                lineHeight: 1.45
              }}
            >
              <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📅 {hoveredWeek.weekLabel}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  ({hoveredWeek.sessionCount} séance{hoveredWeek.sessionCount > 1 ? 's' : ''})
                </span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                ⏱️ Total : {formatMinutes(hoveredWeek.totalMinutes)}
              </div>
              <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                🏃 {hoveredWeek.distanceKm.toFixed(1)} km • +{hoveredWeek.elevationGainM}m D+ ({formatMinutes(hoveredWeek.runningMinutes)})
              </div>
              {hoveredWeek.strengthMinutes > 0 && (
                <div style={{ color: '#a78bfa', fontWeight: 600 }}>
                  🏋️ {hoveredWeek.strengthMinutes} min de renforcement
                </div>
              )}
              {hoveredWeek.otherMinutes > 0 && (
                <div style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  ⚡ {hoveredWeek.otherMinutes} min de cross-training
                </div>
              )}
              {hoveredWeek.avgHeartRate && (
                <div style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
                  ❤️ FC moy : {hoveredWeek.avgHeartRate} bpm
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Régularité & Progression : </strong>
          {global.progressionComparisonText}
        </div>
      </div>

      {/* 4. Section Charge Physiologique, Prévention Blessures (ACWR) & Modèle Banister */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={17} color="var(--primary)" />
              Risque de Blessure & Sweet Spot ACWR (Modèle de Tim Gabbett)
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Ratio entre la charge aiguë d'impact Trail des 7 derniers jours ({trainingLoad.acuteLoad7d} TRIMP) et la tolérance chronique sur 28 jours ({trainingLoad.chronicLoad28dWeeklyAvg} TRIMP/sem).
            </p>
          </div>

          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '9999px',
              background: trainingLoad.acwrStatus === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'rgba(56, 189, 248, 0.15)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
              color: trainingLoad.acwrStatus === 'OPTIMAL' ? 'var(--accent-green)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'var(--accent-cyan)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'var(--accent-red)' : 'var(--accent-amber)'))
            }}
          >
            Ratio ACWR : {trainingLoad.acwrRatio} • {trainingLoad.acwrStatusLabel || trainingLoad.acwrStatus}
          </span>
        </div>

        {/* Distinction Charge Course vs Calisthénie sans impact */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', background: 'rgba(255,255,255,0.025)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem' }}>
          <span style={{ color: 'var(--primary)' }}>
            🏃 <strong>Charge d'impact Trail (7j) :</strong> {trainingLoad.acuteLoad7d} TRIMP
          </span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: '#a78bfa' }}>
            🤸 <strong>Calisthénie / Renfo (7j) :</strong> {trainingLoad.calisthenicsAcuteLoad7d} TRIMP ({trainingLoad.calisthenicsSessionsCount7d} séance(s))
          </span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
            (Zéro onde de choc articulaire, exclue du risque de tendinopathie)
          </span>
        </div>

        {/* Jauge Colorée ACWR */}
        <div style={{ position: 'relative', paddingTop: '16px', paddingBottom: '22px' }}>
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
            <div style={{ width: '25%', background: '#10b981', opacity: 0.95 }} title="Zone Optimale Sweet Spot (0.8 - 1.3)" />
            <div style={{ width: '10%', background: '#f59e0b', opacity: 0.9 }} title="Surcharge Modérée (1.3 - 1.5)" />
            <div style={{ width: '25%', background: '#ef4444', opacity: 0.85 }} title="Risque de Blessure (>1.5)" />
          </div>

          {/* Curseur de position */}
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
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 7px',
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

          {/* Légende échelle sous la jauge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            <span style={{ color: '#38bdf8' }}>0.0 - 0.8 : Sous-charge</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>0.8 - 1.3 : Sweet Spot (Progression Sûre)</span>
            <span style={{ color: '#f59e0b' }}>1.3 - 1.5 : Surcharge</span>
            <span style={{ color: '#ef4444' }}>&gt; 1.5 : Risque Élevé</span>
          </div>
        </div>

        {/* Diagnostic & Conseil d'action direct */}
        <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Diagnostic Anti-blessure :</strong> {trainingLoad.acwrLabel}
          </div>
          {trainingLoad.acwrActionAdvice && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.78rem' }}>
              <span>💡</span>
              <span>{trainingLoad.acwrActionAdvice}</span>
            </div>
          )}
        </div>

        {/* Graphique SVG Modèle Banister (Courbes CTL / ATL / TSB & Barres TRIMP) */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ fontSize: '0.94rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="var(--accent-blue)" />
                Dynamique de Charge Physiologique (Modèle Banister CTL / ATL / TSB)
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Historique modélisé sur 90 jours : Fitness chronique (CTL 42j), Fatigue aiguë (ATL 7j) et Forme (TSB).
              </p>
            </div>

            {/* Légende du graphique */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '12px', height: '3px', background: 'var(--accent-blue)', display: 'inline-block', borderRadius: '2px' }} />
                <span>CTL (Fitness 42j)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '12px', height: '3px', background: 'var(--accent-amber)', display: 'inline-block', borderRadius: '2px' }} />
                <span>ATL (Fatigue 7j)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '12px', height: '3px', background: 'var(--accent-green)', display: 'inline-block', borderRadius: '2px' }} />
                <span>TSB (Forme)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '9px', background: 'rgba(148, 163, 184, 0.35)', display: 'inline-block', borderRadius: '1px' }} />
                <span style={{ color: 'var(--text-muted)' }}>Charge Journalière</span>
              </div>
            </div>
          </div>

          {/* Infobulle de survol du jour */}
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
                gap: '14px',
                fontSize: '0.74rem',
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
                  Historique en cours d'accumulation pour tracer le graphique Banister.
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
                  <line x1={padL} y1={padT} x2={svgWidth - padR} y2={padT} stroke="rgba(255,255,255,0.05)" />
                  <line x1={padL} y1={yZero} x2={svgWidth - padR} y2={yZero} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
                  <line x1={padL} y1={padT + innerHeight} x2={svgWidth - padR} y2={padT + innerHeight} stroke="rgba(255,255,255,0.05)" />

                  <text x={padL - 8} y={padT + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                    {Math.round(maxVal)}
                  </text>
                  <text x={padL - 8} y={yZero + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                    0
                  </text>
                  <text x={padL - 8} y={padT + innerHeight} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                    {Math.round(minVal)}
                  </text>

                  {/* Daily Load Bars */}
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

                  <path d={ctlPath} fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" />
                  <path d={atlPath} fill="none" stroke="var(--accent-amber)" strokeWidth="2" />
                  <path d={tsbPath} fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeDasharray="4 3" />

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
      </div>

      {/* 5. Section Spécificité Trail Montagne & Résistance Musculaire (Fusionnée) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px'
        }}
      >
        {/* Volet A : Blindage Excentrique D- & Renforcement */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--accent-green)" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Dénivelé Négatif D- & Armure Musculaire
            </h4>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                -{trailSpecific.totalElevationLossM.toLocaleString('fr-CA')} m D-
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Descente cumulée totale</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                {strength.quadArmorScore}/100
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                {strength.quadArmorRating}
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Sur les <strong>3 370 m D-</strong> du QMT-80, la calisthénie et le renforcement des quadriceps préservent vos fibres musculaires et évitent la tétanie dès le km 50.
          </p>

          <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <span>🏋️ Total Force : <strong>{formatMinutes(strength.totalDurationMinutes)}</strong></span>
            <span>📅 Fréquence : <strong>{strength.weeklyFrequency}/sem</strong></span>
            <span>⚖️ Ratio Force/Course : <strong>{strength.strengthToRunRatioPct}%</strong></span>
          </div>
        </div>

        {/* Volet B : Allure Pente & Vitesse Ascensionnelle (VAM) */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mountain size={18} color="var(--accent-orange)" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Pente, Vitesse Ascensionnelle & Allure GAP
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VAM Moyenne en côte</div>
              <strong style={{ fontSize: '1.15rem', color: 'var(--accent-amber)' }}>{trailSpecific.avgVamMPerHour} m/h</strong>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Max : {trailSpecific.maxVamMPerHour} m/h</div>
            </div>
            <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Allure Ajustée Pente (GAP)</div>
              <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>{trailSpecific.gradeAdjustedPaceMinKm}</strong>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Brute : {running.avgPaceMinKm}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--accent-orange)' }}>Densité D+ : </strong>
            {running.densityComparisonText}
          </div>
        </div>
      </div>

      {/* 6. Section Profil Cardiaque & Efficacité Aérobie (Fusionnée) */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Diagnostic Tendance Cardiaque */}
        <div
          style={{
            background: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0
              ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(56, 189, 248, 0.15))'
              : 'linear-gradient(90deg, rgba(255, 87, 34, 0.12), rgba(245, 158, 11, 0.12))',
            border: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0
              ? '1px solid rgba(16, 185, 129, 0.35)'
              : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 87, 34, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0 ? (
              <TrendingDown size={20} color="var(--accent-green)" />
            ) : (
              <Heart size={20} color="var(--primary)" />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 2px 0' }}>
              {heartRate.heartRateTrend === 'DECREASING'
                ? '📉 Économie d\'énergie : Votre FC moyenne est en baisse à allure égale !'
                : '📊 Fréquence cardiaque aérobie stable et bien calibrée.'}
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              {heartRate.comparisonBaselineText}
            </p>
          </div>
        </div>

        {/* Répartition des 3 Zones Cardiaques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div>
            <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              Répartition du Temps par Zone Cardiaque
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.76rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--accent-green)' }}>Zone 2 (Endurance Fondamentale &lt; 155 bpm)</span>
                  <strong>{running.intensityDistribution.zone2Pct}% ({formatMinutes(running.intensityDistribution.zone2EnduranceMinutes)})</strong>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px' }}>
                  <div style={{ width: `${running.intensityDistribution.zone2Pct}%`, height: '100%', background: 'var(--accent-green)', borderRadius: '9999px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--accent-amber)' }}>Zone 3/4 (Tempo & Seuil 155-175 bpm)</span>
                  <strong>{running.intensityDistribution.zoneTempoThresholdPct}% ({formatMinutes(running.intensityDistribution.zoneTempoThresholdMinutes)})</strong>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px' }}>
                  <div style={{ width: `${running.intensityDistribution.zoneTempoThresholdPct}%`, height: '100%', background: 'var(--accent-amber)', borderRadius: '9999px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--accent-red)' }}>Zone 5 (VO2 Max &gt; 175 bpm)</span>
                  <strong>{running.intensityDistribution.zoneMaxPct}% ({formatMinutes(running.intensityDistribution.zoneMaxMinutes)})</strong>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px' }}>
                  <div style={{ width: `${running.intensityDistribution.zoneMaxPct}%`, height: '100%', background: 'var(--accent-red)', borderRadius: '9999px' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-main)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.82rem' }}>
              <Sparkles size={15} /> Indice d'Efficacité Aérobie (AEI) : {heartRate.aerobicEfficiencyIndex || 'En calibration'}
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              L'AEI mesure la distance parcourue par battement cardiaque. Un AEI croissant démontre un cœur plus puissant et une meilleure capillarisation musculaire.
            </p>
          </div>
        </div>
      </div>

      {/* 7. Section Simulateur Chrono & Stratégie Ravitaillements QMT-80 */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255, 87, 34, 0.10), rgba(14, 20, 36, 0.95))',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
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
              SIMULATEUR DE COURSE OFFICIEL
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
              Québec Méga Trail QMT-80 (77 km • +3 370m D+)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              Allures cibles et prévision fondées sur votre profil d'endurance actuel.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chrono Prévisionnel Cible</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)' }}>
              {formatMinutes(qmtPrediction.predictedMinutes)}
            </div>
          </div>
        </div>

        {/* Barre d'amplitude chronométrique */}
        <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ color: 'var(--accent-green)' }}>
              🟢 Ambitieux : <strong>{formatMinutes(qmtPrediction.ambitiousMinutes)}</strong>
            </span>
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
              🎯 Cible : <strong>{formatMinutes(qmtPrediction.predictedMinutes)}</strong>
            </span>
            <span style={{ color: 'var(--accent-amber)' }}>
              🟠 Prudent : <strong>{formatMinutes(qmtPrediction.conservativeMinutes)}</strong>
            </span>
            <span style={{ color: 'var(--accent-red)' }}>
              🛑 Barrière : <strong>19h00</strong>
            </span>
          </div>
          <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', position: 'relative', overflow: 'hidden' }}>
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

        {/* Tableau compact des 6 ravitaillements officiels */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 700 }}>
            Temps de Passage Estimés aux 6 Ravitaillements
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Poste</th>
                  <th style={{ padding: '8px 12px' }}>KM</th>
                  <th style={{ padding: '8px 12px' }}>D+</th>
                  <th style={{ padding: '8px 12px' }}>Chrono</th>
                  <th style={{ padding: '8px 12px' }}>Allure Section</th>
                  <th style={{ padding: '8px 12px' }}>Stratégie</th>
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
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {split.name}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                      KM {split.km}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--accent-cyan)' }}>
                      +{split.elevationGainM}m
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--primary)' }}>
                      {split.elapsedFormatted}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                      {split.paceMinKm}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {split.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
