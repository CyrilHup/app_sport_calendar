import React, { useState, useRef } from 'react';
import { CalendarEvent } from '../types/calendar';
import { ActivityComparison, GarminActivity } from '../types/garmin';
import {
  computeFullStatsReport,
  formatMinutes,
  FitnessDayPoint,
  WeeklyTrendPoint,
  TimeRangeScope
} from '../services/statsEngine';
import { StatsMetricModal, StatsMetricTopic } from './StatsMetricModal';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HelpCircle,
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
  referenceDate = new Date()
}) => {
  // Timeline scope selector: 'plan' (default 1er sept.), '4w' (28j glissants), 'all' (historique complet)
  const [scope, setScope] = useState<TimeRangeScope>('plan');
  const [hoveredWeekKey, setHoveredWeekKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredFitnessDay, setHoveredFitnessDay] = useState<FitnessDayPoint | null>(null);
  const [infoTopic, setInfoTopic] = useState<StatsMetricTopic>(null);
  const weeklyChartCardRef = useRef<HTMLDivElement>(null);

  // Computes report for selected timeline scope.
  // NOTE: Physiological Banister CTL/ATL/TSB & ACWR always evaluate on full 90-day history.
  const report = computeFullStatsReport(
    garminActivities,
    comparisons,
    allEvents,
    scope,
    referenceDate,
    true
  );

  const { global, running, strength, heartRate, trainingLoad, trailSpecific, qmtPrediction } = report;

  // Max minutes in a week for relative bar chart heights
  const maxWeeklyMinutes = Math.max(...global.weeklyTrend.map(w => w.totalMinutes), 360);

  return (
    <div className="stats-dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Épuré avec Sélecteur de Timeline (Plan QMT / 4 semaines / Tout) */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.95), rgba(14, 20, 36, 0.98))',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 22px',
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
                gap: '5px',
                fontSize: '0.74rem',
                fontWeight: 800
              }}
            >
              <BarChart3 size={13} /> TÉLÉMÉTRIE D'ENTRAÎNEMENT & FORME
            </span>
            <span
              style={{
                background: scope === 'plan' ? 'rgba(16, 185, 129, 0.14)' : (scope === '4w' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.08)'),
                color: scope === 'plan' ? 'var(--accent-green)' : (scope === '4w' ? 'var(--accent-cyan)' : 'var(--text-secondary)'),
                padding: '2px 9px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}
            >
              {scope === 'plan' ? '🎯 Plan QMT actif (Depuis le 1er sept.)' : (scope === '4w' ? '📅 4 dernières semaines glissantes' : '🌐 Tout l\'historique')}
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Tableau de Bord & Santé Athlétique
          </h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {scope === 'plan'
              ? `Sur le plan QMT : ${global.totalSessionsCount} séances réalisées (${formatMinutes(global.totalDurationMinutes)})`
              : (scope === '4w'
                ? `Sur les 28 derniers jours : ${global.totalSessionsCount} séances réalisées (${formatMinutes(global.totalDurationMinutes)})`
                : `Cumul historique complet : ${global.totalSessionsCount} séances réalisées (${formatMinutes(global.totalDurationMinutes)})`)}
          </p>
        </div>

        {/* Sélecteur de Timeline épuré (Plan / 4 semaines / Tout) */}
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '3px',
            border: '1px solid var(--border-color)',
            gap: '3px',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => setScope('plan')}
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: scope === 'plan' ? 'var(--primary)' : 'transparent',
              color: scope === 'plan' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            title="Focalisé sur la préparation officielle démarrée le 1er septembre 2026"
          >
            🎯 Plan QMT (1er sept.)
          </button>
          <button
            onClick={() => setScope('4w')}
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: scope === '4w' ? 'var(--primary)' : 'transparent',
              color: scope === '4w' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            title="Cycle d'entraînement récent sur les 28 derniers jours"
          >
            📅 4 dernières sem.
          </button>
          <button
            onClick={() => setScope('all')}
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: scope === 'all' ? 'var(--primary)' : 'transparent',
              color: scope === 'all' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            title="Historique complet des données Garmin Connect"
          >
            🌐 Tout l'historique
          </button>
        </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="kpi-title">Volume d'Entraînement</span>
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255, 87, 34, 0.15)', color: 'var(--primary)', fontWeight: 700 }}>
                {scope === 'plan' ? 'Plan QMT' : (scope === '4w' ? '4 sem.' : 'Historique')}
              </span>
            </div>
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
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Course : {formatMinutes(global.sportBreakdown.running.minutes)} ({global.sportBreakdown.running.pct}%)</span>
            <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Force : {formatMinutes(global.sportBreakdown.strength.minutes)} ({global.sportBreakdown.strength.pct}%)</span>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Cross : {formatMinutes(global.sportBreakdown.crossTraining.minutes + global.sportBreakdown.other.minutes)} ({global.sportBreakdown.crossTraining.pct + global.sportBreakdown.other.pct}%)</span>
          </div>
        </div>

        {/* CARTE 2: Course à Pied & Spécificité Montagne */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <div className="kpi-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="kpi-title">Course à Pied & Sentiers</span>
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {scope === 'plan' ? 'Plan QMT' : (scope === '4w' ? '4 sem.' : 'Historique')}
              </span>
            </div>
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
                Max : <strong>{running.longestRun.distanceKm} km</strong> ({running.longestRun.name})
              </div>
            )}
          </div>
        </div>

        {/* CARTE 3: Forme Physiologique, Charge & Santé (Banister + Cardio) */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
          <div className="kpi-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="kpi-title">Forme & Charge (Banister)</span>
              <button
                onClick={() => setInfoTopic('banister')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '1px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title="Comprendre le modèle Banister (CTL / ATL / TSB)"
              >
                <HelpCircle size={14} />
              </button>
              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', fontWeight: 700 }} title="Calculé sur l'historique complet (90 jours) pour préserver la décroissance CTL et la tolérance chronique ACWR">
                90j continu
              </span>
            </div>
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
              onClick={() => setInfoTopic('acwr')}
              style={{
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '9999px',
                background: trainingLoad.acwrStatus === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'rgba(56, 189, 248, 0.15)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
                color: trainingLoad.acwrStatus === 'OPTIMAL' ? 'var(--accent-green)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'var(--accent-cyan)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'var(--accent-red)' : 'var(--accent-amber)')),
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Cliquer pour voir l'explication du ratio ACWR"
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
                FC moy. {heartRate.overallPeriodAvgHr || heartRate.currentAvgHeartRate || '--'} bpm
              </span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                {running.intensityDistribution.zone2Pct}% en Zone 2
              </span>
            </div>
            {trainingLoad.acwrActionAdvice && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                {trainingLoad.acwrActionAdvice}
              </div>
            )}
          </div>
        </div>

        {/* CARTE 4: Profil Cardiaque & Efficacité Aérobie (AEI) */}
        <div className="stats-kpi-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <div className="kpi-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="kpi-title">Efficacité Aérobie (AEI)</span>
              <button
                onClick={() => setInfoTopic('aei')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '1px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title="Comprendre l'Indice d'Efficacité Aérobie (AEI)"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)' }}>
              <Heart size={16} />
            </div>
          </div>

          <div className="kpi-main-value" style={{ color: 'var(--accent-green)' }}>
            {heartRate.aerobicEfficiencyIndex ? `${heartRate.aerobicEfficiencyIndex} m/bpm` : 'En calibration'}
          </div>

          <div className="kpi-sub-row">
            <span style={{ color: 'var(--text-secondary)' }}>
              FC moy : {heartRate.overallPeriodAvgHr || heartRate.currentAvgHeartRate || '--'} bpm
            </span>
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                padding: '2px 7px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}
            >
              {running.intensityDistribution.zone2Pct}% en Zone 2
            </span>
          </div>

          {/* Analyse Économie Cardiaque */}
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
            <span style={{ color: heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0 ? 'var(--accent-green)' : 'var(--text-secondary)', fontWeight: 600 }}>
              {heartRate.heartRateDeltaBpm && heartRate.heartRateDeltaBpm < 0
                ? `Économie : -${Math.abs(heartRate.heartRateDeltaBpm)} bpm`
                : 'Rythme cardiaque régulier'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Cible Z2 &lt; 155 bpm
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={17} color="var(--primary)" />
                Risque de Blessure & Sweet Spot ACWR (Modèle de Tim Gabbett)
              </h3>
              <button
                onClick={() => setInfoTopic('acwr')}
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#f59e0b',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <HelpCircle size={13} /> Comprendre le calcul
              </button>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Ratio entre la charge aiguë d'impact Trail des 7 derniers jours ({trainingLoad.acuteLoad7d} TRIMP) et la tolérance chronique sur 28 jours ({trainingLoad.chronicLoad28dWeeklyAvg} TRIMP/sem).
            </p>
          </div>

          <span
            onClick={() => setInfoTopic('acwr')}
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '9999px',
              background: trainingLoad.acwrStatus === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.15)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'rgba(56, 189, 248, 0.15)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)')),
              color: trainingLoad.acwrStatus === 'OPTIMAL' ? 'var(--accent-green)' : (trainingLoad.acwrStatus === 'CALIBRATING' ? 'var(--accent-cyan)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'var(--accent-red)' : 'var(--accent-amber)')),
              cursor: 'pointer'
            }}
            title="Cliquer pour voir l'explication"
          >
            Ratio ACWR : {trainingLoad.acwrRatio} • {trainingLoad.acwrStatusLabel || trainingLoad.acwrStatus}
          </span>
        </div>

        {/* Distinction Charge Course vs Calisthénie sans impact */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', background: 'rgba(255,255,255,0.025)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem' }}>
          <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={14} /> <strong>Charge d'impact Trail (7j) :</strong> {trainingLoad.acuteLoad7d} TRIMP
          </span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Dumbbell size={14} /> <strong>Calisthénie / Renfo (7j) :</strong> {trainingLoad.calisthenicsAcuteLoad7d} TRIMP ({trainingLoad.calisthenicsSessionsCount7d} séance{trainingLoad.calisthenicsSessionsCount7d > 1 ? 's' : ''})
          </span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} /> Zéro onde de choc articulaire, exclue du risque de tendinopathie
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="var(--accent-blue)" />
                  Dynamique de Charge Physiologique (Modèle Banister CTL / ATL / TSB)
                </h4>
                <button
                  onClick={() => setInfoTopic('banister')}
                  style={{
                    background: 'rgba(168, 85, 247, 0.12)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#a855f7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <HelpCircle size={13} /> Comprendre le modèle
                </button>
              </div>
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
                background: 'rgba(20, 28, 48, 0.96)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '0.76rem',
                flexWrap: 'wrap',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>{hoveredFitnessDay.dateLabel} ({hoveredFitnessDay.date})</strong>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>CTL (Fitness) : <strong>{hoveredFitnessDay.ctl}</strong></span>
              <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>ATL (Fatigue) : <strong>{hoveredFitnessDay.atl}</strong></span>
              <span style={{ color: hoveredFitnessDay.tsb >= 0 ? 'var(--accent-green)' : 'var(--accent-orange)', fontWeight: 700 }}>
                TSB (Forme) : <strong>{hoveredFitnessDay.tsb > 0 ? `+${hoveredFitnessDay.tsb}` : hoveredFitnessDay.tsb}</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>Charge jour : <strong>{hoveredFitnessDay.dailyLoad} TRIMP</strong></span>
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

                  {/* High performance continuous mouse-tracking overlay across the full curve area */}
                  <rect
                    x={padL}
                    y={padT}
                    width={innerWidth}
                    height={innerHeight}
                    fill="transparent"
                    style={{ cursor: 'crosshair' }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const mouseX = e.clientX - rect.left;
                      const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
                      const nearestIdx = Math.round(ratio * (trend.length - 1));
                      if (trend[nearestIdx]) {
                        setHoveredFitnessDay(trend[nearestIdx]);
                      }
                    }}
                    onMouseLeave={() => setHoveredFitnessDay(null)}
                  />

                  {hoveredFitnessDay && (() => {
                    const idx = trend.findIndex(d => d.date === hoveredFitnessDay.date);
                    if (idx === -1) return null;
                    const x = xFor(idx);
                    return (
                      <g style={{ pointerEvents: 'none' }}>
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
                ? 'Économie d\'énergie : Votre FC moyenne est en baisse à allure égale !'
                : 'Fréquence cardiaque aérobie stable et bien calibrée.'}
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

          <div style={{ background: 'var(--bg-main)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.84rem' }}>
                <Sparkles size={15} /> Indice d'Efficacité Aérobie (AEI) : {heartRate.aerobicEfficiencyIndex || 'En calibration'}
              </div>
              <button
                onClick={() => setInfoTopic('aei')}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <HelpCircle size={13} /> Comprendre l'AEI
              </button>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              L'AEI mesure la distance parcourue par battement cardiaque. Un AEI croissant démontre un cœur plus puissant et une meilleure capillarisation musculaire.
            </p>
          </div>
        </div>
      </div>

      {/* Modale d'aide pédagogique sur les calculs (ACWR, Banister, AEI) */}
      <StatsMetricModal topic={infoTopic} onClose={() => setInfoTopic(null)} />
    </div>
  );
};
