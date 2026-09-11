import React, { useState } from 'react';
import { PeriodizationContext } from '../types/calendar';
import { formatMinutes, QmtRacePrediction } from '../services/statsEngine';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  Heart,
  Layers,
  MapPin,
  Mountain,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  Zap
} from 'lucide-react';
import { QMT_PHASES, QMT_AID_STATIONS, QMT_MANDATORY_GEAR_ITEMS, TrainingPhaseDetail } from '../data/qmtPlanData';

interface QMTPlanOverviewProps {
  currentContext: PeriodizationContext;
  qmtPrediction?: QmtRacePrediction;
}

export const QMTPlanOverview: React.FC<QMTPlanOverviewProps> = ({ currentContext, qmtPrediction }) => {
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);
  const [activeSubTab, setActiveSubTab] = useState<'roadmap' | 'weekly' | 'raceStrategy' | 'gearSetup'>('roadmap');
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});

  const toggleGear = (item: string) => {
    setCheckedGear(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const phases = QMT_PHASES;
  const currentPhase = phases[selectedPhaseIndex];
  const aidStations = QMT_AID_STATIONS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sub-Navigation Tabs (Ruban Scrollable Moderne) */}
      <div className="filter-chips-scroll" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          className={`chip-btn ${activeSubTab === 'roadmap' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('roadmap')}
        >
          <Layers size={13} /> 1. Périodisation (6 Phases)
        </button>

        <button
          className={`chip-btn ${activeSubTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('weekly')}
        >
          <Calendar size={13} /> 2. Planning Hebdo Type
        </button>

        <button
          className={`chip-btn ${activeSubTab === 'raceStrategy' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('raceStrategy')}
        >
          <Mountain size={13} /> 3. Parcours & Ravitaillements
        </button>

        <button
          className={`chip-btn ${activeSubTab === 'gearSetup' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('gearSetup')}
          style={activeSubTab === 'gearSetup' ? { borderColor: '#38bdf8', color: '#38bdf8' } : undefined}
        >
          <ShieldCheck size={13} /> 4. Sac 5L & Matériel Obligatoire
        </button>
      </div>

      {/* TAB 1: INTERACTIVE SEASON STEPPER (FUSED ROADMAP) */}
      {activeSubTab === 'roadmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Horizontal Roadmap Stepper Bar */}
          <div className="roadmap-stepper">
            {phases.map((p, idx) => {
              const isSelected = idx === selectedPhaseIndex;
              return (
                <button
                  key={p.id}
                  className={`roadmap-step-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedPhaseIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                      PHASE {idx + 1}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: isSelected ? '#fff' : 'var(--text-muted)' }}>
                      {p.weeks.split(' (')[0]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: 2, color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                    {p.shortTitle}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                    Vol : {p.volumePct}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Selected Phase Card */}
          <div className="glass-panel" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 4 }}>
                  <span className="badge-tag" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}>
                    Phase {selectedPhaseIndex + 1} sur 6
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                    {currentPhase.name}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span>📅 <strong>Période :</strong> {currentPhase.period} ({currentPhase.weeks})</span>
                  <span>📍 <strong>Lieu :</strong> {currentPhase.location}</span>
                  <span>📈 <strong>Facteur Volume :</strong> {currentPhase.volumePct}</span>
                </div>
              </div>

              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--primary)'
                }}
              >
                Objectif : {currentPhase.focus}
              </div>
            </div>

            {/* Physiological Purpose */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-xs)',
                marginBottom: '14px',
                fontSize: '0.82rem',
                lineHeight: 1.55
              }}
            >
              <strong style={{ color: 'var(--primary)' }}>🎯 Rôle Physiologique & Adaptation Visée :</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{currentPhase.why}</p>
            </div>

            {/* Benchmark Sessions Grid */}
            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Séances Clés de ce Bloc :
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {currentPhase.keyWorkouts.map((w, wIdx) => (
                  <div
                    key={wIdx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ fontSize: '0.82rem', color: '#ffffff' }}>{w.title}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>{w.metrics}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{w.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Fueling Strategy */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-xs)',
                background: 'rgba(255, 87, 34, 0.06)',
                border: '1px solid rgba(255, 87, 34, 0.25)',
                fontSize: '0.78rem'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🍌</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary)' }}>Consignes Ravitaillement & Hydratation :</strong> {currentPhase.nutritionStrategy}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAY-BY-DAY WEEKLY SCHEDULE TABLE */}
      {activeSubTab === 'weekly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="pro-table-wrapper">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Jour & Durée</th>
                  <th>Protocole de Séance & Thématique</th>
                  <th>Lieu</th>
                  <th style={{ width: '140px' }}>Zone Cible</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Lundi</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 45 – 65 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🤸 Calisthénie 1 (Poussée & Gainage)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Dips, pompes pikes (renforcement épaules), pompes aux anneaux, gainage hollow body. Zéro impact sur les jambes après les sorties du weekend.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Gym ÉTS</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>❤️ Récupération (Z1)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Mardi</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 65 – 85 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>⚡ Côtes D+ & Renforcement Jambes</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Répétitions de côtes courtes au Mont-Royal (172-190 bpm) ou tapis incliné l'hiver (15% @ 6 km/h) enchaînées avec fentes bulgares et squats lents pour blinder les cuisses en descente.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Mont-Royal / Gym</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 87, 34, 0.15)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}>❤️ Zone 4/5 (172-190)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Mercredi</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 45 – 65 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏋️ Calisthénie 2 (Tirage & Dos - Zéro Jambes)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Tractions strictes, tractions horizontales aux anneaux, travail du front lever, suspensions à la barre. Permet une récupération complète des cuisses post-mardi.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Gym ÉTS</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>❤️ Zone 1 (Force)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Jeudi</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 35 – 50 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏃 Footing Aérobie Fondamentale Z2</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Aisance respiratoire absolue. Fréquence cardiaque strictement sous 148 bpm. Foulée légère et économique (170-175 pas/min sous les hanches).</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Quartier / Maisonneuve</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>❤️ Zone 1/2 (&lt; 148)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Vendredi</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 40 – 60 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🤸 Calisthénie 3 (Équilibre, Mobilité Épaules & Gainage)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Équilibres sur les mains (Handstand), mobilité active des épaules, L-sit/V-sit. Enchaîné directement après les cours au Gym ÉTS. Repos pour les jambes avant le choc du weekend.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Gym ÉTS</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>❤️ Zone 1 (Mobilité)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Samedi</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 1h45 – 4h30</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏔️ Sortie Longue Choc en Montagne (WEC 1)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>La séance pilier pour le QMT-80. Cumul de dénivelé continu, alternance course / marche active dès que la pente dépasse 8-10%, résistance musculaire en descente. Ravitaillement : 60g de glucides/h.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Sentiers Mont-Royal</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 87, 34, 0.15)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}>❤️ Zone 2 (&lt; 155)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Dimanche</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 40 – 75 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏃 Footing sur Fatigue (WEC 2) + Mobilité</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Couru directement sur la fatigue musculaire du samedi pour habituer le système nerveux à la fin de course (simulation des KM 50-77 du QMT). Suivi de 20 min d'étirements du bassin et des mollets.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Mont-Royal / Domicile</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>❤️ Strict Z2 (&lt; 148)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RACE PROFILE & AID STATIONS (OFFICIAL QMT DATA) */}
      {activeSubTab === 'raceStrategy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Key Course Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Distance Officielle</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>77,0 KM</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Petite-Rivière ➔ Mont-Sainte-Anne</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dénivelé D+ / D-</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>+3 370 m / -3 200 m</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Niveau technique : 5 / 5</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Barrière Horaire Max</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>19 Heures</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Navette 3h30 AM depuis le Mont-Sainte-Anne</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sac de Délestage (Drop Bag)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>KM 57</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ravitaillement de Saint-Tite-des-Caps</div>
            </div>
          </div>

          {/* SIMULATEUR DE COURSE OFFICIEL QMT-80 */}
          {qmtPrediction && (
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
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '6px 0 2px 0', color: '#fff' }}>
                    Québec Méga Trail QMT-80 (77 km • +3 370m D+)
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Prévision chronométrique et allures personnalisées selon votre volume et endurance aérobie actuels.
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
                    Ambitieux : <strong>{formatMinutes(qmtPrediction.ambitiousMinutes)}</strong>
                  </span>
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                    Cible : <strong>{formatMinutes(qmtPrediction.predictedMinutes)}</strong>
                  </span>
                  <span style={{ color: 'var(--accent-amber)' }}>
                    Prudent : <strong>{formatMinutes(qmtPrediction.conservativeMinutes)}</strong>
                  </span>
                  <span style={{ color: 'var(--accent-red)' }}>
                    Barrière finale : <strong>19h00</strong>
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

              {/* Analyse & Marge */}
              <div style={{ background: 'rgba(255,255,255,0.025)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>{qmtPrediction.predictionAnalysis}</div>
                <span style={{ color: 'var(--accent-green)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  +{formatMinutes(qmtPrediction.cutoffMarginMinutes)} de marge de sécurité
                </span>
              </div>

              {/* Tableau des splits calculés par poste */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                  Temps de Passage & Allures Cibles aux 6 Ravitaillements Officiels
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Poste</th>
                        <th style={{ padding: '8px 12px' }}>KM</th>
                        <th style={{ padding: '8px 12px' }}>D+</th>
                        <th style={{ padding: '8px 12px' }}>Chrono Passage</th>
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
          )}

          {/* Aid Stations Breakdown Table */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mountain size={16} color="var(--primary)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  Postes de Ravitaillement & Découpage Officiel du Parcours
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Fournisseur officiel : Produits XACT Nutrition & Électrolytes à tous les postes
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="pro-table-wrapper desktop-only">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Ravitaillement / Poste</th>
                    <th>Distance & Altitude</th>
                    <th>Assistance & Drop Bag</th>
                    <th>Spécificités & Stratégie de Course</th>
                  </tr>
                </thead>
                <tbody>
                  {aidStations.map((station, sIdx) => (
                    <tr key={sIdx}>
                      <td>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.85rem' }}>{station.name}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{station.km}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Alt: {station.elevation} • Cumul: {station.elevationGain}</div>
                      </td>
                      <td>
                        <span
                          className="badge-tag"
                          style={{
                            background: station.dropBag.includes('DROP') ? 'rgba(16, 185, 129, 0.15)' : (station.crew.includes('Isolé') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)'),
                            color: station.dropBag.includes('DROP') ? '#10b981' : (station.crew.includes('Isolé') ? '#f87171' : '#38bdf8'),
                            border: '1px solid var(--border-color)',
                            fontSize: '0.68rem'
                          }}
                        >
                          {station.dropBag.includes('DROP') ? '🎒 DROP BAG + Assistance' : station.crew}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {station.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Vertical Race Timeline */}
            <div className="race-timeline mobile-only">
              {aidStations.map((station, sIdx) => {
                const isDropBag = station.dropBag.includes('DROP');
                const isFinish = station.name.includes('Arrivée');

                return (
                  <div key={sIdx} className="race-timeline-node">
                    <div className={`race-timeline-dot ${isDropBag ? 'drop-bag' : ''} ${isFinish ? 'finish' : ''}`} />
                    <div className="race-station-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>
                          {station.name}
                        </div>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.84rem' }}>
                          {station.km}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, fontSize: '0.74rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>⛰️ Alt: {station.elevation}</span>
                        <span>•</span>
                        <span>📈 Cumul: {station.elevationGain}</span>
                        <span
                          className="badge-tag"
                          style={{
                            background: isDropBag ? 'rgba(16, 185, 129, 0.15)' : (station.crew.includes('Isolé') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)'),
                            color: isDropBag ? '#10b981' : (station.crew.includes('Isolé') ? '#f87171' : '#38bdf8'),
                            border: '1px solid var(--border-color)',
                            fontSize: '0.68rem',
                            marginLeft: 'auto'
                          }}
                        >
                          {isDropBag ? '🎒 DROP BAG' : station.crew}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, marginTop: 4 }}>
                        {station.notes}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Pacing Strategy Guide */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary)', marginBottom: 6 }}>
                1. KM 0 à 15 : Le Mur du Massif
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Départ au niveau du fleuve (0 m). Les 14 premiers kilomètres avalent 720 m de D+ direct sur Le Massif. Interdiction formelle de courir les fortes pentes : marche active avec cadence régulière pour garder la FC sous 155 bpm. Arriver frais au sommet.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#38bdf8', marginBottom: 6 }}>
                2. KM 15 à 57 : Le Sentier des Caps
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                42 km de sous-bois sauvages, de racines denses, de boue et de dalles de falaise (Cap du Salut, Cap Gribane). Secteur totalement isolé sans aucune assistance. Bien faire le plein de 1,0 L d'eau à Cap Gribane avant la liaison de 13 km vers Saint-Tite.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f59e0b', marginBottom: 6 }}>
                3. KM 57 à 67 : L'Enfer du Mestachibo
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong>BÂTONS STRICTEMENT INTERDITS :</strong> Bâtons obligatoirement pliés et rangés sur le sac de 5L dès Saint-Tite. La vitesse chute à 3-4 km/h au milieu des blocs de granit, des passerelles et des échelles métalliques. Vigilance maximale sur chaque appui.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#10b981', marginBottom: 6 }}>
                4. KM 67 à 77 : Ascension Finale du Mont-Sainte-Anne
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Sortie du canyon. Déploiement des bâtons pour gravir le flanc du Mont-Sainte-Anne. Puiser dans les réserves de glycogène, franchir la crête sommitale et savourer la descente vers l'arche d'arrivée !
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 5L BACKPACK STRATEGY & MANDATORY GEAR (CUSTOMIZED FOR ATHLETE) */}
      {activeSubTab === 'gearSetup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Athlete 5L Backpack Strategy Alert */}
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 800, fontSize: '0.92rem' }}>
              <Sparkles size={16} />
              <span>Optimisation Spécifique pour Sac 5 Litres (Ton Équipement)</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Tu disposes d'un <strong>sac à dos de 5 Litres</strong>, d'une <strong>poche à eau de 2L</strong>, d'une <strong>poche à eau de 1L</strong> et tu prévois d'acheter des <strong>flasques souples (soft flasks)</strong>. Voici la stratégie exacte d'emport pour ne pas manquer de place et respecter le règlement officiel du QMT-80 :
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {/* Why 2L bladder is a trap in 5L */}
            <div className="glass-panel" style={{ padding: '16px', borderLeft: '3px solid #ef4444' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Le piège de la poche à eau de 2L dans un sac 5L :
              </h4>
              <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Une poche 2L pleine pèse <strong>2,0 kg</strong> et compresse <strong>45% du volume interne</strong> d'un sac de 5L.</li>
                <li>Elle bombe le dos, compresse la colonne et ne laisse plus aucune place pour la veste imperméable, la couverture de survie et la trousse de secours.</li>
                <li><strong>Goulot d'étranglement aux ravitos :</strong> pour remplir une poche à eau, tu dois enlever ton sac, débrancher le tuyau, sortir la poche, la refermer et tout réarranger (perte de 4 à 5 minutes par arrêt).</li>
                <li><strong>Conseil :</strong> Conserve la poche de 2L pour tes entraînements d'autonomie pure ou en secours.</li>
              </ul>
            </div>

            {/* The Golden Setup: 2x 500mL Flasks + 1L Bladder Backup */}
            <div className="glass-panel" style={{ padding: '16px', borderLeft: '3px solid #10b981' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} /> La Configuration d'Or Recommandée :
              </h4>
              <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><strong>À l'Avant (Bretelles) :</strong> Achète <strong>2 flasques souples de 500 mL</strong> (1,0 Litre au total). C'est la capacité minimale exigée par le QMT. Remplissage en 30 secondes chrono sans retirer le sac !</li>
                <li><strong>Flasque 1 :</strong> Eau pure (pour rincer la bouche, digérer les gels et s'asperger le visage).</li>
                <li><strong>Flasque 2 :</strong> Boisson d'effort électrolytes/glucides (Tailwind ou XACT).</li>
                <li><strong>À l'Arrière (Sac 5L) :</strong> Place ta <strong>poche de 1L vide ou remplie à 500 mL max</strong> uniquement sur le tronçon chaud de 13 km (Cap Gribane ➔ Saint-Tite). Le reste du temps, elle ne prend aucune place.</li>
              </ul>
            </div>
          </div>

          {/* Strategic Drop Bag Advice for 5L Pack Runner */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              🎒 Stratégie "Sac de Délestage" (Drop Bag) à Saint-Tite-des-Caps (KM 57) :
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              Comme ton sac fait 5L, tu ne dois <strong>pas le surcharger dès le KM 0</strong> ! Utilise le sac officiel fourni par l'organisation pour le déposer au ravitaillement de Saint-Tite (KM 57) avec :
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '0.76rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.025)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                <strong>🔦 Lampe frontale & piles :</strong> Obligatoire à partir de Saint-Tite ! Inutile de la porter dans le sac 5L sur les 57 premiers kilomètres de jour.
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.025)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                <strong>🧦 Chaussettes sèches + Crème Nok :</strong> Pieds neufs avant d'attaquer le terrible canyon du Mestachibo.
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.025)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                <strong>🍌 Ravitaillement fin de course :</strong> Tes 4-5 gels préférés pour les 23 derniers kilomètres (KM 57 à 77).
              </div>
            </div>
          </div>

          {/* Mestachibo Pole Stowage Rule */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-xs)',
              padding: '12px 16px',
              fontSize: '0.78rem',
              color: 'var(--accent-amber)'
            }}
          >
            <strong>⚠️ RÈGLE OFFICIELLE CRUCIALE SUR LES BÂTONS :</strong> Les bâtons de marche sont <strong>strictement interdits dans la section Mestachibo (KM 57-67)</strong> pour des raisons de sécurité (chutes entre les blocs de granit et mains libres requises sur les échelles). Tu as l'obligation de les porter durant toute la course si tu choisis d'en avoir. Assure-toi que ton sac de 5L possède un carquois trail ou des élastiques de portage pour ranger tes bâtons pliés sans gêner tes bras !
          </div>

          {/* Official Mandatory Gear Interactive Checklist */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#10b981" />
                Matériel Obligatoire Officiel QMT-80 (Checklist de Contrôle)
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Vérifications aléatoires sur le parcours par les commissaires de course
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6 }}>
              {QMT_MANDATORY_GEAR_ITEMS.map((item, idx) => {
                const isChecked = Boolean(checkedGear[item]);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleGear(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isChecked ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      color: isChecked ? '#34d399' : 'var(--text-primary)',
                      textDecoration: isChecked ? 'line-through' : 'none'
                    }}
                  >
                    {isChecked ? <CheckSquare size={14} color="#10b981" /> : <Square size={14} color="var(--text-muted)" />}
                    <span>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
