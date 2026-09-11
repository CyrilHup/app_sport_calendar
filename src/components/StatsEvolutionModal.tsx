import React, { useState, useMemo } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Clock,
  Footprints,
  Gauge,
  Heart,
  HelpCircle,
  Info,
  Minus,
  Mountain,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import { GarminActivity, GarminWellnessData } from '../types/garmin';
import { TrainingLoadStats, formatMinutes, PLAN_START_DATE } from '../services/statsEngine';

export type EvolutionMetricType =
  | 'volume'
  | 'running'
  | 'avg_hr'
  | 'aei'
  | 'fc_max'
  | 'resting_hr'
  | 'endurance_pace'
  | 'banister';

interface StatsEvolutionModalProps {
  metric: EvolutionMetricType | null;
  onClose: () => void;
  garminActivities: GarminActivity[];
  wellnessHistory?: Record<string, GarminWellnessData>;
  trainingLoad?: TrainingLoadStats;
  athleteFcMax?: number;
  baselineRestingHr?: number;
}

interface DataPoint {
  id: string;
  date: string; // YYYY-MM-DD
  label: string; // date formatée
  value: number;
  displayValue: string;
  subValue?: string;
  title?: string;
  secondaryValue?: number; // e.g. D+ for running
}

function parsePaceSeconds(paceStr?: string): number {
  if (!paceStr) return 0;
  const parts = paceStr.split(':').map(p => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  const val = parseFloat(paceStr);
  return isNaN(val) ? 0 : Math.round(val * 60);
}

function formatPace(seconds: number): string {
  if (!seconds || seconds <= 0) return '--';
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${String(sec).padStart(2, '0')} /km`;
}

function formatDateFr(dateStr: string): string {
  try {
    const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export const StatsEvolutionModal: React.FC<StatsEvolutionModalProps> = ({
  metric,
  onClose,
  garminActivities,
  wellnessHistory = {},
  trainingLoad,
  athleteFcMax = 203,
  baselineRestingHr = 48
}) => {
  const [scope, setScope] = useState<'4w' | 'plan' | 'all'>('plan');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  if (!metric) return null;

  // Filtrer les données selon le scope temporel
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 10);
    const planStart = PLAN_START_DATE;

    return garminActivities.filter(a => {
      const actDate = a.startTimeLocal.slice(0, 10);
      if (scope === 'plan') {
        return actDate >= planStart && actDate <= nowStr;
      }
      if (scope === '4w') {
        const d4w = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return actDate >= d4w && actDate <= nowStr;
      }
      return true; // 'all'
    }).sort((a, b) => new Date(a.startTimeLocal).getTime() - new Date(b.startTimeLocal).getTime());
  }, [garminActivities, scope]);

  // Extraction de la série temporelle selon la métrique
  const { title, subtitle, icon, unit, points, advice, isInverseBetter, referenceValue } = useMemo(() => {
    const pts: DataPoint[] = [];
    let t = '';
    let sub = '';
    let ic = <Activity size={20} />;
    let u = '';
    let adv = '';
    let invBetter = false; // true si une baisse est positive (ex: FC moy, FC repos, allure)
    let refVal: number | undefined = undefined;

    switch (metric) {
      case 'volume': {
        t = "Évolution du Volume d'Entraînement";
        sub = "Volume cumulé et régularité des séances";
        ic = <Clock size={20} color="var(--primary)" />;
        u = "min";
        invBetter = false;
        adv = "Pour l'ultra-trail QMT-80, la régularité du volume hebdomadaire prévaut sur les pics isolés. Veillez à ne pas augmenter votre volume de plus de 10% d'une semaine à l'autre.";

        // Regrouper par semaine
        const weekMap = new Map<string, { minutes: number; count: number; date: string }>();
        for (const act of filteredActivities) {
          const d = new Date(act.startTimeLocal);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
          const cur = weekMap.get(monday) || { minutes: 0, count: 0, date: monday };
          cur.minutes += act.durationMinutes || 0;
          cur.count += 1;
          weekMap.set(monday, cur);
        }

        const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [wKey, wData] of sortedWeeks) {
          pts.push({
            id: wKey,
            date: wData.date,
            label: `Sem. du ${formatDateFr(wData.date)}`,
            value: wData.minutes,
            displayValue: formatMinutes(wData.minutes),
            subValue: `${wData.count} séance${wData.count > 1 ? 's' : ''}`,
            title: `Volume hebdomadaire`
          });
        }
        break;
      }

      case 'running': {
        t = "Évolution Course à Pied & Sentiers";
        sub = "Distance (km) et dénivelé (+D m) par sortie";
        ic = <Footprints size={20} color="var(--accent-cyan)" />;
        u = "km";
        invBetter = false;
        adv = "Sur le QMT-80 (+3 500 m D+), l'accumulation progressive de dénivelé et de sorties longues permet d'endurcir les quadriceps contre la fatigue excentrique.";

        const runActs = filteredActivities.filter(
          a => a.activityType === 'RUNNING' || a.activityType === 'TRAIL_RUNNING'
        );
        for (const act of runActs) {
          const dist = act.distanceKm || 0;
          if (dist > 0) {
            pts.push({
              id: act.activityId,
              date: act.startTimeLocal.slice(0, 10),
              label: formatDateFr(act.startTimeLocal),
              value: dist,
              displayValue: `${dist.toFixed(1)} km`,
              subValue: act.elevationGainM ? `+${act.elevationGainM}m D+ • ${act.avgPaceMinKm || ''}` : act.avgPaceMinKm,
              title: act.activityName,
              secondaryValue: act.elevationGainM || 0
            });
          }
        }
        break;
      }

      case 'avg_hr': {
        t = "Évolution Fréquence Cardiaque Moyenne";
        sub = "Économie cardiaque et battements par minute en course";
        ic = <Heart size={20} color="var(--accent-red)" />;
        u = "bpm";
        invBetter = true;
        adv = "Une diminution de votre fréquence cardiaque moyenne à allure équivalente indique une augmentation du volume d'éjection systolique : votre cœur propulse plus d'oxygène à chaque battement.";

        const hrActs = filteredActivities.filter(a => (a.avgHeartRate || 0) > 60);
        for (const act of hrActs) {
          pts.push({
            id: act.activityId,
            date: act.startTimeLocal.slice(0, 10),
            label: formatDateFr(act.startTimeLocal),
            value: act.avgHeartRate!,
            displayValue: `${act.avgHeartRate} bpm`,
            subValue: act.avgPaceMinKm ? `Allure : ${act.avgPaceMinKm}` : `${act.durationMinutes} min`,
            title: act.activityName
          });
        }
        break;
      }

      case 'aei': {
        t = "Indice d'Efficacité Aérobie (AEI)";
        sub = "Vitesse de déplacement par battement cardiaque (mètres/min / bpm)";
        ic = <Heart size={20} color="var(--accent-green)" />;
        u = "m/bpm";
        invBetter = false;
        adv = "L'AEI mesure directement le rendement énergétique de votre moteur aérobie. Plus l'indice monte, plus vous courez vite tout en économisant votre réserve cardiaque.";

        const aeiActs = filteredActivities.filter(a => {
          if (!a.avgHeartRate || a.avgHeartRate < 60) return false;
          if (!a.distanceKm || a.distanceKm < 1) return false;
          if (!a.durationMinutes || a.durationMinutes <= 0) return false;
          return a.activityType === 'RUNNING' || a.activityType === 'TRAIL_RUNNING';
        });

        for (const act of aeiActs) {
          const speedMPerMin = (act.distanceKm! * 1000) / act.durationMinutes;
          const aeiVal = Math.round((speedMPerMin / act.avgHeartRate!) * 100) / 100;
          if (aeiVal > 0.5 && aeiVal < 3.0) {
            pts.push({
              id: act.activityId,
              date: act.startTimeLocal.slice(0, 10),
              label: formatDateFr(act.startTimeLocal),
              value: aeiVal,
              displayValue: `${aeiVal} m/bpm`,
              subValue: `${act.avgHeartRate} bpm • ${act.avgPaceMinKm || ''}`,
              title: act.activityName
            });
          }
        }
        break;
      }

      case 'fc_max': {
        t = "Pics de Fréquence Cardiaque Maximale";
        sub = "Fréquences cardiaques de pointe atteintes par séance";
        ic = <Zap size={20} color="var(--accent-amber)" />;
        u = "bpm";
        invBetter = false;
        refVal = athleteFcMax;
        adv = `Votre FC Max calibrée est de ${athleteFcMax} bpm. Elle sert de référence pour borner vos zones d'intensité (Zone 2 < 155 bpm). Les séances d'endurance fondamentale ne doivent pas approcher ce plafond.`;

        const maxActs = filteredActivities.filter(a => (a.maxHeartRate || 0) > 130);
        for (const act of maxActs) {
          pts.push({
            id: act.activityId,
            date: act.startTimeLocal.slice(0, 10),
            label: formatDateFr(act.startTimeLocal),
            value: act.maxHeartRate!,
            displayValue: `${act.maxHeartRate} bpm`,
            subValue: `Moyenne : ${act.avgHeartRate ? `${act.avgHeartRate} bpm` : '--'}`,
            title: act.activityName
          });
        }
        break;
      }

      case 'resting_hr': {
        t = "Fréquence Cardiaque au Repos (FC Repos)";
        sub = "Fréquence cardiaque basale mesurée au réveil par Garmin Connect";
        ic = <Heart size={20} color="var(--accent-purple)" />;
        u = "bpm";
        invBetter = true;
        refVal = baselineRestingHr;
        adv = `Votre FC au repos basale est de ${baselineRestingHr} bpm. Une élévation persistante de +4 à +6 bpm au réveil est le signal avant-coureur d'une fatigue nerveuse accumulée ou d'une mauvaise récupération.`;

        const dates = Object.keys(wellnessHistory).sort();
        const nowStr = new Date().toISOString().slice(0, 10);
        const planStart = PLAN_START_DATE;

        for (const dKey of dates) {
          if (scope === 'plan' && (dKey < planStart || dKey > nowStr)) continue;
          if (scope === '4w') {
            const d4w = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            if (dKey < d4w || dKey > nowStr) continue;
          }

          const w = wellnessHistory[dKey];
          if (w.restingHeartRate && w.restingHeartRate > 30 && w.restingHeartRate < 100) {
            pts.push({
              id: dKey,
              date: dKey,
              label: formatDateFr(dKey),
              value: w.restingHeartRate,
              displayValue: `${w.restingHeartRate} bpm`,
              subValue: w.sleep?.score ? `Sommeil : ${w.sleep.score}/100` : undefined,
              title: `FC Repos journalière`
            });
          }
        }
        break;
      }

      case 'endurance_pace': {
        t = "Évolution de l'Allure Endurance (Zone 2)";
        sub = "Allure de course en endurance fondamentale sur le plat";
        ic = <Footprints size={20} color="var(--accent-green)" />;
        u = "sec/km";
        invBetter = true;
        adv = "L'amélioration de l'allure en Zone 2 est le baromètre suprême de votre développement mitochondrial. Courir de plus en plus vite à basse FC vous garantit de boucler 80 km sans épuiser vos réserves de glycogène.";

        const z2Acts = filteredActivities.filter(a => {
          if (a.activityType !== 'RUNNING' && a.activityType !== 'TRAIL_RUNNING') return false;
          if (!a.distanceKm || a.distanceKm < 1.5) return false;
          if (!a.avgPaceMinKm) return false;
          const density = (a.elevationGainM || 0) / (a.distanceKm || 1);
          return density < 35; // parcours plat représentatif de l'allure aérobie
        });

        for (const act of z2Acts) {
          const paceSec = parsePaceSeconds(act.avgPaceMinKm);
          if (paceSec > 180 && paceSec < 600) {
            pts.push({
              id: act.activityId,
              date: act.startTimeLocal.slice(0, 10),
              label: formatDateFr(act.startTimeLocal),
              value: paceSec,
              displayValue: act.avgPaceMinKm!,
              subValue: `${act.distanceKm} km • FC ${act.avgHeartRate || '--'} bpm`,
              title: act.activityName
            });
          }
        }
        break;
      }

      case 'banister': {
        t = "Modèle Banister : Fitness (CTL), Fatigue (ATL) & Forme (TSB)";
        sub = "Dynamique impulsion-réponse sur 90+ jours";
        ic = <Gauge size={20} color="var(--accent-purple)" />;
        u = "pts";
        invBetter = false;
        adv = "Le CTL (Fitness) se construit sur 42 jours, tandis que l'ATL (Fatigue) répond sur 7 jours. Un TSB équilibré entre -10 et +5 assure une progression optimale sans risquer le surmenage.";

        const fitnessData = trainingLoad?.fitnessTrend || trainingLoad?.fitnessHistory;
        if (fitnessData && fitnessData.length > 0) {
          const now = new Date();
          const nowStr = now.toISOString().slice(0, 10);
          const planStart = PLAN_START_DATE;

          for (const fh of fitnessData) {
            if (scope === 'plan' && (fh.date < planStart || fh.date > nowStr)) continue;
            if (scope === '4w') {
              const d4w = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
              if (fh.date < d4w || fh.date > nowStr) continue;
            }

            pts.push({
              id: fh.date,
              date: fh.date,
              label: formatDateFr(fh.date),
              value: fh.ctl,
              displayValue: `CTL ${fh.ctl}`,
              subValue: `ATL ${fh.atl} • TSB ${fh.tsb > 0 ? `+${fh.tsb}` : fh.tsb}`,
              title: `Charge quotidienne`
            });
          }
        }
        break;
      }
    }

    return {
      title: t,
      subtitle: sub,
      icon: ic,
      unit: u,
      points: pts,
      advice: adv,
      isInverseBetter: invBetter,
      referenceValue: refVal
    };
  }, [metric, filteredActivities, wellnessHistory, trainingLoad, athleteFcMax, baselineRestingHr, scope]);

  // Statistiques calculées sur la série
  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map(p => p.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = points[points.length - 1];
    const first = points[0];

    // Tendance entre le début et la fin
    let delta = 0;
    let deltaPct = 0;
    if (points.length >= 2) {
      delta = latest.value - first.value;
      deltaPct = first.value !== 0 ? Math.round((delta / first.value) * 100) : 0;
    }

    const isPositive = isInverseBetter ? delta < 0 : delta > 0;
    const isNeutral = Math.abs(deltaPct) < 2;

    return {
      count: points.length,
      latest,
      avg: Math.round(avg * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      delta,
      deltaPct,
      isPositive,
      isNeutral
    };
  }, [points, isInverseBetter]);

  // Dimensionnement SVG
  const svgWidth = 660;
  const svgHeight = 220;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  // Calcul des coordonnées du tracé
  const { pathData, areaPathData, pointCoords, yMin, yMax } = useMemo(() => {
    if (points.length === 0) return { pathData: '', areaPathData: '', pointCoords: [], yMin: 0, yMax: 100 };

    const values = points.map(p => p.value);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (referenceValue !== undefined) {
      minV = Math.min(minV, referenceValue);
      maxV = Math.max(maxV, referenceValue);
    }
    if (minV === maxV) {
      minV = Math.max(0, minV * 0.8);
      maxV = maxV * 1.2 || 10;
    }
    const margin = (maxV - minV) * 0.12;
    const effMin = Math.max(0, minV - margin);
    const effMax = maxV + margin;

    const coords = points.map((p, idx) => {
      const x = points.length === 1
        ? padLeft + chartWidth / 2
        : padLeft + (idx / (points.length - 1)) * chartWidth;
      const y = padTop + chartHeight - ((p.value - effMin) / (effMax - effMin)) * chartHeight;
      return { ...p, x, y };
    });

    if (coords.length === 1) {
      const c = coords[0];
      return {
        pathData: `M ${padLeft} ${c.y} L ${padLeft + chartWidth} ${c.y}`,
        areaPathData: `M ${padLeft} ${c.y} L ${padLeft + chartWidth} ${c.y} L ${padLeft + chartWidth} ${padTop + chartHeight} L ${padLeft} ${padTop + chartHeight} Z`,
        pointCoords: coords,
        yMin: effMin,
        yMax: effMax
      };
    }

    let pData = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const midX = (prev.x + cur.x) / 2;
      pData += ` C ${midX} ${prev.y}, ${midX} ${cur.y}, ${cur.x} ${cur.y}`;
    }

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottomY = padTop + chartHeight;
    const aData = `${pData} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return {
      pathData: pData,
      areaPathData: aData,
      pointCoords: coords,
      yMin: effMin,
      yMax: effMax
    };
  }, [points, chartWidth, chartHeight, padLeft, padTop, referenceValue]);

  // Y de la ligne de référence moyenne
  const avgY = useMemo(() => {
    if (!stats || yMax === yMin) return null;
    return padTop + chartHeight - ((stats.avg - yMin) / (yMax - yMin)) * chartHeight;
  }, [stats, yMin, yMax, padTop, chartHeight]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #111827 0%, #0c1220 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              {icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  {title}
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700
                  }}
                >
                  📈 Courbe
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Timeline Filter */}
            <div
              style={{
                display: 'inline-flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--border-color)',
                gap: '2px'
              }}
            >
              <button
                onClick={() => setScope('plan')}
                style={{
                  padding: '4px 9px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: scope === 'plan' ? 'var(--primary)' : 'transparent',
                  color: scope === 'plan' ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                Plan QMT
              </button>
              <button
                onClick={() => setScope('4w')}
                style={{
                  padding: '4px 9px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: scope === '4w' ? 'var(--primary)' : 'transparent',
                  color: scope === '4w' ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                4 sem.
              </button>
              <button
                onClick={() => setScope('all')}
                style={{
                  padding: '4px 9px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: scope === 'all' ? 'var(--primary)' : 'transparent',
                  color: scope === 'all' ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                Tout
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Graphique SVG Interactif */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.28)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px 12px 10px 12px',
              position: 'relative'
            }}
          >
            {points.length === 0 ? (
              <div
                style={{
                  height: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.84rem'
                }}
              >
                Aucune donnée enregistrée pour cette période.
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Lignes de grille horizontales */}
                  {[0, 0.33, 0.66, 1].map((ratio, i) => {
                    const y = padTop + chartHeight * ratio;
                    const val = yMax - (yMax - yMin) * ratio;
                    const labelStr = metric === 'endurance_pace'
                      ? formatPace(val)
                      : metric === 'volume'
                      ? formatMinutes(val)
                      : Math.round(val);

                    return (
                      <g key={i}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={padLeft + chartWidth}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.06)"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padLeft - 8}
                          y={y + 4}
                          textAnchor="end"
                          fill="var(--text-muted)"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {labelStr}
                        </text>
                      </g>
                    );
                  })}

                  {/* Ligne de moyenne horizontale */}
                  {avgY !== null && (
                    <g>
                      <line
                        x1={padLeft}
                        y1={avgY}
                        x2={padLeft + chartWidth}
                        y2={avgY}
                        stroke="rgba(56, 189, 248, 0.45)"
                        strokeDasharray="4 4"
                        strokeWidth="1.2"
                      />
                      <text
                        x={padLeft + chartWidth + 6}
                        y={avgY + 3}
                        fill="var(--accent-cyan)"
                        fontSize="9"
                        fontWeight="700"
                      >
                        Moy.
                      </text>
                    </g>
                  )}

                  {/* Remplissage dégradé sous la courbe */}
                  {areaPathData && <path d={areaPathData} fill="url(#curveGradient)" />}

                  {/* Ligne principale de la courbe */}
                  {pathData && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Points interactifs */}
                  {pointCoords.map(pt => {
                    const isHovered = hoveredPoint?.id === pt.id;
                    return (
                      <g key={pt.id}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 3.5}
                          fill={isHovered ? '#ffffff' : 'var(--primary)'}
                          stroke="#0c1220"
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                          onMouseEnter={() => setHoveredPoint(pt)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      </g>
                    );
                  })}

                  {/* Dates en bas (X-axis) */}
                  {pointCoords.length > 0 && (
                    <>
                      <text
                        x={pointCoords[0].x}
                        y={padTop + chartHeight + 18}
                        textAnchor="start"
                        fill="var(--text-muted)"
                        fontSize="10"
                      >
                        {pointCoords[0].label}
                      </text>
                      {pointCoords.length > 2 && (
                        <text
                          x={pointCoords[Math.floor(pointCoords.length / 2)].x}
                          y={padTop + chartHeight + 18}
                          textAnchor="middle"
                          fill="var(--text-muted)"
                          fontSize="10"
                        >
                          {pointCoords[Math.floor(pointCoords.length / 2)].label}
                        </text>
                      )}
                      <text
                        x={pointCoords[pointCoords.length - 1].x}
                        y={padTop + chartHeight + 18}
                        textAnchor="end"
                        fill="var(--text-muted)"
                        fontSize="10"
                      >
                        {pointCoords[pointCoords.length - 1].label}
                      </text>
                    </>
                  )}
                </svg>

                {/* Infobulle de survol fixe */}
                {hoveredPoint && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '16px',
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255, 87, 34, 0.5)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.74rem',
                      color: '#ffffff',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
                      pointerEvents: 'none',
                      lineHeight: 1.4
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '2px' }}>
                      📅 {hoveredPoint.label} {hoveredPoint.title ? `• ${hoveredPoint.title}` : ''}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>
                      {hoveredPoint.displayValue}
                    </div>
                    {hoveredPoint.subValue && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {hoveredPoint.subValue}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Grille de 4 Cartes KPI Résumé */}
          {stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px'
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  Dernière valeur
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {stats.latest.displayValue}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {stats.latest.label}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  Moyenne sur la période
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  {metric === 'endurance_pace'
                    ? formatPace(stats.avg)
                    : metric === 'volume'
                    ? formatMinutes(stats.avg)
                    : `${stats.avg} ${unit}`}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {stats.count} point{stats.count > 1 ? 's' : ''}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  Min / Max
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                  {metric === 'endurance_pace'
                    ? `${formatPace(stats.min)} / ${formatPace(stats.max)}`
                    : metric === 'volume'
                    ? `${formatMinutes(stats.min)} / ${formatMinutes(stats.max)}`
                    : `${stats.min} / ${stats.max} ${unit}`}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Étendue observée
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  Tendance
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: stats.isNeutral
                      ? 'var(--text-secondary)'
                      : stats.isPositive
                      ? 'var(--accent-green)'
                      : 'var(--accent-amber)'
                  }}
                >
                  {stats.isNeutral ? (
                    <>
                      <Minus size={14} /> Stable
                    </>
                  ) : stats.isPositive ? (
                    <>
                      <ArrowUpRight size={15} />{' '}
                      {stats.deltaPct > 0 ? `+${stats.deltaPct}%` : `${stats.deltaPct}%`}
                    </>
                  ) : (
                    <>
                      <ArrowDownRight size={15} />{' '}
                      {stats.deltaPct > 0 ? `+${stats.deltaPct}%` : `${stats.deltaPct}%`}
                    </>
                  )}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {stats.isPositive ? 'Adaptation favorable' : 'À surveiller'}
                </div>
              </div>
            </div>
          )}

          {/* Encadré d'expertise physiologique QMT-80 */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--accent-green)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} />
              Conseil Coach QMT-80 :
            </div>
            {advice}
          </div>
        </div>
      </div>
    </div>
  );
};
