import React, { useState } from 'react';
import { PeriodizationContext } from '../types/calendar';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Layers,
  Mountain,
  ShieldCheck,
  Square
} from 'lucide-react';
import { QMT_PHASES, QMT_AID_STATIONS, QMT_MANDATORY_GEAR_ITEMS } from '../data/qmtPlanData';
import { FlexibleTrainingWeek } from './FlexibleTrainingWeek';
import { recentRunBaseline } from '../services/trainingBaseline';
import './QMTPlanOverview.css';

interface QMTPlanOverviewProps {
  currentContext: PeriodizationContext;
  strengthSessionsThisWeek: number;
  strengthSessionsLast28d: number;
  runBaseline: ReturnType<typeof recentRunBaseline>;
}

function phaseIndex(phase: string): number {
  if (phase.startsWith('FONDATION_RAMP')) return 0;
  if (phase === 'FONDATION') return 1;
  if (phase === 'PUISSANCE_HIVERNALE') return 2;
  if (phase === 'VOLUME_WEC_1') return 3;
  if (phase === 'SPECIFIQUE_PIC') return 4;
  return 5;
}

export const QMTPlanOverview: React.FC<QMTPlanOverviewProps> = ({ currentContext, strengthSessionsThisWeek, strengthSessionsLast28d, runBaseline }) => {
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(() => phaseIndex(currentContext.phase));
  const [activeSubTab, setActiveSubTab] = useState<'roadmap' | 'weekly' | 'raceStrategy' | 'gearSetup'>('roadmap');
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});

  const toggleGear = (item: string) => {
    setCheckedGear(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const phases = QMT_PHASES;
  const currentPhase = phases[selectedPhaseIndex];
  const aidStations = QMT_AID_STATIONS;

  return (
    <div className="qmt-plan-overview">
      <div className="qmt-plan-tabs" role="group" aria-label="Sections du plan QMT">
        <button
          type="button"
          aria-pressed={activeSubTab === 'roadmap'}
          className={`qmt-plan-tab ${activeSubTab === 'roadmap' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('roadmap')}
        >
          <Layers size={16} aria-hidden="true" /> <span>Phases</span>
        </button>

        <button
          type="button"
          aria-pressed={activeSubTab === 'weekly'}
          className={`qmt-plan-tab ${activeSubTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('weekly')}
        >
          <Calendar size={16} aria-hidden="true" /> <span>Semaine</span>
        </button>

        <button
          type="button"
          aria-pressed={activeSubTab === 'raceStrategy'}
          className={`qmt-plan-tab ${activeSubTab === 'raceStrategy' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('raceStrategy')}
        >
          <Mountain size={16} aria-hidden="true" /> <span>Parcours & ravitos</span>
        </button>

        <button
          type="button"
          aria-pressed={activeSubTab === 'gearSetup'}
          className={`qmt-plan-tab ${activeSubTab === 'gearSetup' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('gearSetup')}
        >
          <ShieldCheck size={16} aria-hidden="true" /> <span>Sac & matériel</span>
        </button>
      </div>

      {/* TAB 1: INTERACTIVE SEASON STEPPER (FUSED ROADMAP) */}
      {activeSubTab === 'roadmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Horizontal Roadmap Stepper Bar */}
          <div className="qmt-plan-stepper" role="group" aria-label="Phases du plan">
            {phases.map((p, idx) => {
              const isSelected = idx === selectedPhaseIndex;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`qmt-plan-step ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedPhaseIndex(idx)}
                >
                  <span className="qmt-plan-step-meta">Phase {idx + 1} · {p.weeks.split(' (')[0]}</span>
                  <span className="qmt-plan-step-title">{p.shortTitle}</span>
                  <span className="qmt-plan-step-volume">Volume {p.volumePct}</span>
                </button>
              );
            })}
          </div>

          {/* Detailed Selected Phase Card */}
          <div className="glass-panel qmt-plan-phase-detail" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 4 }}>
                  <span className="badge-tag qmt-plan-phase-count">
                    Phase {selectedPhaseIndex + 1} / 6
                  </span>
                  <h3 className="qmt-plan-phase-title">
                    {currentPhase.name}
                  </h3>
                </div>
                <div className="qmt-plan-phase-meta">
                  <span><strong>Période</strong> {currentPhase.period} ({currentPhase.weeks})</span>
                  <span><strong>Lieu</strong> {currentPhase.location}</span>
                  <span><strong>Volume</strong> {currentPhase.volumePct}</span>
                </div>
              </div>

              <div className="qmt-plan-focus">
                Objectif : {currentPhase.focus}
              </div>
            </div>

            {/* Physiological Purpose */}
            <div className="qmt-plan-purpose">
              <strong>Pourquoi cette phase</strong>
              <p>{currentPhase.why}</p>
            </div>

            {/* Benchmark Sessions Grid */}
            <div style={{ marginBottom: '14px' }}>
              <h4 className="qmt-plan-section-title">
                Séances clés
              </h4>
              <div className="qmt-plan-workouts">
                {currentPhase.keyWorkouts.map((w, wIdx) => (
                  <div
                    key={wIdx}
                    className="qmt-plan-workout"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong>{w.title}</strong>
                      <span>{w.metrics}</span>
                    </div>
                    <p>{w.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Fueling Strategy */}
            <div className="qmt-plan-fueling">
              <strong>Ravitaillement et hydratation</strong>
              <span>{currentPhase.nutritionStrategy}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FLEXIBLE WEEKLY TRAINING */}
      {activeSubTab === 'weekly' && (
        <FlexibleTrainingWeek context={currentContext} strengthSessionsThisWeek={strengthSessionsThisWeek} strengthSessionsLast28d={strengthSessionsLast28d} runBaseline={runBaseline} />
      )}
      {/* TAB 3: RACE PROFILE & AID STATIONS (OFFICIAL QMT DATA) */}
      {activeSubTab === 'raceStrategy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Key Course Stats */}
          <div className="qmt-plan-race-stats">
            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div className="qmt-plan-stat-label">Distance</div>
              <div className="qmt-plan-stat-value">77,0 km</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Petite-Rivière ➔ Mont-Sainte-Anne</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div className="qmt-plan-stat-label">Dénivelé D+ / D-</div>
              <div className="qmt-plan-stat-value">+3 370 m / -3 200 m</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Niveau technique : 5 / 5</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div className="qmt-plan-stat-label">Barrière horaire</div>
              <div className="qmt-plan-stat-value">19 heures</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Navette 3h30 AM depuis le Mont-Sainte-Anne</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div className="qmt-plan-stat-label">Sac de délestage</div>
              <div className="qmt-plan-stat-value">Km 57</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ravitaillement de Saint-Tite-des-Caps</div>
            </div>
          </div>

          {/* Aid Stations Breakdown Table */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mountain size={16} aria-hidden="true" />
                <h3 className="qmt-plan-panel-title">
                  Repères des postes de ravitaillement
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Distances et services à revérifier dans le guide 2027 de l'organisation.
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
                        <div className="qmt-plan-station-name">{station.name}</div>
                      </td>
                      <td>
                        <div className="qmt-plan-station-distance">{station.km}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Alt: {station.elevation} • Cumul: {station.elevationGain}</div>
                      </td>
                      <td>
                        <span
                          className="badge-tag qmt-plan-aid-badge"
                        >
                          {station.dropBag.includes('DROP') ? 'Drop bag + assistance' : station.crew}
                        </span>
                      </td>
                      <td className="qmt-plan-station-notes">
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
                        <div className="qmt-plan-station-name">
                          {station.name}
                        </div>
                        <span className="qmt-plan-station-distance">
                          {station.km}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, fontSize: '0.74rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Alt. {station.elevation}</span>
                        <span>•</span>
                        <span>D+ cumulé {station.elevationGain}</span>
                        <span
                          className="badge-tag qmt-plan-aid-badge"
                        >
                          {isDropBag ? 'Drop bag' : station.crew}
                        </span>
                      </div>

                      <p className="qmt-plan-station-notes">
                        {station.notes}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Pacing Strategy Guide */}
          <div className="qmt-plan-race-stages">
            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div className="qmt-plan-stage-heading">
                Km 0 à 15 · Le Mur du Massif
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Départ au niveau du fleuve (0 m). Les 14 premiers kilomètres avalent 720 m de D+ direct sur Le Massif. Interdiction formelle de courir les fortes pentes : marche active avec cadence régulière pour garder la FC sous 155 bpm. Arriver frais au sommet.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div className="qmt-plan-stage-heading">
                Km 15 à 57 · Le Sentier des Caps
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                42 km de sous-bois sauvages, de racines denses, de boue et de dalles de falaise (Cap du Salut, Cap Gribane). Secteur totalement isolé sans aucune assistance. Bien faire le plein de 1,0 L d'eau à Cap Gribane avant la liaison de 13 km vers Saint-Tite.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div className="qmt-plan-stage-heading">
                Km 57 à 67 · Le Mestachibo
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong>BÂTONS STRICTEMENT INTERDITS :</strong> Bâtons obligatoirement pliés et rangés sur le sac de 5L dès Saint-Tite. La vitesse chute à 3-4 km/h au milieu des blocs de granit, des passerelles et des échelles métalliques. Vigilance maximale sur chaque appui.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div className="qmt-plan-stage-heading">
                Km 67 à 77 · Mont-Sainte-Anne
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Sortie du canyon. Déploiement des bâtons pour gravir le flanc du Mont-Sainte-Anne, franchir la crête sommitale et descendre vers l'arrivée.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 5L BACKPACK STRATEGY & MANDATORY GEAR (CUSTOMIZED FOR ATHLETE) */}
      {activeSubTab === 'gearSetup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Athlete 5L Backpack Strategy Alert */}
          <div className="qmt-plan-gear-summary">
            <strong>Ton matériel</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Tu as un sac à dos de 5 L, une poche à eau de 2 L, une poche à eau de 1 L et tu prévois d'acheter des flasques souples. Les options ci-dessous sont à tester à l'entraînement et à vérifier avec les règles de course 2027.
            </p>
          </div>

          <div className="qmt-plan-gear-options">
            <div className="glass-panel qmt-plan-gear-card">
              <h4 className="qmt-plan-gear-title">
                <AlertTriangle size={16} aria-hidden="true" /> Poche à eau de 2 L dans un sac de 5 L
              </h4>
              <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Une poche 2L pleine pèse <strong>2,0 kg</strong> et compresse <strong>45% du volume interne</strong> d'un sac de 5L.</li>
                <li>Elle bombe le dos, compresse la colonne et ne laisse plus aucune place pour la veste imperméable, la couverture de survie et la trousse de secours.</li>
                <li><strong>Goulot d'étranglement aux ravitos :</strong> pour remplir une poche à eau, tu dois enlever ton sac, débrancher le tuyau, sortir la poche, la refermer et tout réarranger (perte de 4 à 5 minutes par arrêt).</li>
                <li><strong>Conseil :</strong> Conserve la poche de 2L pour tes entraînements d'autonomie pure ou en secours.</li>
              </ul>
            </div>

            <div className="glass-panel qmt-plan-gear-card">
              <h4 className="qmt-plan-gear-title">
                <CheckCircle2 size={16} aria-hidden="true" /> Configuration envisagée
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
            <h4 className="qmt-plan-gear-title">
              Sac de délestage à Saint-Tite-des-Caps · Km 57
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              Le sac de délestage annoncé par l'organisation est disponible à Saint-Tite-des-Caps. Teste à l'entraînement ce que tu peux porter confortablement et confirme les modalités 2027 avant de préparer le sac :
            </p>
            <div className="qmt-plan-drop-bag-notes">
              <div className="qmt-plan-gear-note">
                <strong>Lampe frontale et batterie :</strong> Exigées à partir de Saint-Tite selon la page actuelle de la course ; prépare aussi un plan si la progression est plus lente que prévu.
              </div>
              <div className="qmt-plan-gear-note">
                <strong>Soin des pieds :</strong> Chaussettes ou matériel déjà testés, selon tes besoins et l'état du terrain.
              </div>
              <div className="qmt-plan-gear-note">
                <strong>Alimentation :</strong> Prévois des options que tu as tolérées sur les sorties longues, sans quantité imposée par défaut.
              </div>
            </div>
          </div>

          {/* Mestachibo Pole Stowage Rule */}
          <div className="qmt-plan-pole-note">
            <strong>Bâtons :</strong> L'organisation les autorise sauf dans la section Mestachibo et interdit de les placer dans le sac de délestage. Vérifie la règle 2027 et entraîne-toi à les ranger sans gêner tes mains.
          </div>

          {/* Official Mandatory Gear Interactive Checklist */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <h4 className="qmt-plan-gear-title">
                <ShieldCheck size={16} aria-hidden="true" />
                Matériel obligatoire QMT-80 (liste publiée actuellement)
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <a href="https://ultratrailcanada.com/courses-ultra-trail/qmt-80/" target="_blank" rel="noopener noreferrer">Revérifier la liste officielle avant la course</a>
              </span>
            </div>

            <div className="qmt-plan-checklist-grid">
              {QMT_MANDATORY_GEAR_ITEMS.map(item => {
                const isChecked = Boolean(checkedGear[item]);
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => toggleGear(item)}
                    aria-pressed={isChecked}
                    className={`qmt-plan-checklist-item ${isChecked ? 'checked' : ''}`}
                  >
                    {isChecked ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
