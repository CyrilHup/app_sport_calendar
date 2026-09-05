import React, { useState } from 'react';
import { PeriodizationContext } from '../types/calendar';
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

interface QMTPlanOverviewProps {
  currentContext: PeriodizationContext;
}

interface TrainingPhaseDetail {
  id: string;
  name: string;
  shortTitle: string;
  period: string;
  weeks: string;
  volumePct: string;
  focus: string;
  location: string;
  why: string;
  whatHappens: string[];
  keyWorkouts: { title: string; desc: string; metrics: string }[];
  nutritionStrategy: string;
  badge: string;
}

export const QMTPlanOverview: React.FC<QMTPlanOverviewProps> = ({ currentContext }) => {
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);
  const [activeSubTab, setActiveSubTab] = useState<'roadmap' | 'weekly' | 'raceStrategy' | 'gearSetup'>('roadmap');
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});

  const toggleGear = (item: string) => {
    setCheckedGear(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const phases: TrainingPhaseDetail[] = [
    {
      id: 'ramp_up',
      name: '1. Reprise & Fondations (Post-Coupure Estivale)',
      shortTitle: 'Reprise & Tendons',
      period: '1er sept. – 20 sept. 2026',
      weeks: '3 Semaines (Semaines -18 à -16)',
      volumePct: '55% ➔ 75% ➔ 90%',
      focus: 'Adaptation tendineuse & réveil aérobie',
      location: 'Mont-Royal, Parc Maisonneuve & Gym ÉTS',
      why: 'Éviter impérativement les périostites et tendinopathies après la coupure. Les tendons et le collagène mettent 3 fois plus de temps à s\'adapter que le système cardiovasculaire. Aucun pic d\'intensité maximale.',
      whatHappens: [
        'Semaine 1 (55%) : Sortie de côte contrôlée 45 min, sortie longue trail 1h15, repos complet le dimanche.',
        'Semaine 2 (75%) : Progression graduelle du volume avec ajout d\'un footing aérobie le dimanche (40 min).',
        'Semaine 3 (90%) : Sortie trail weekend 1h50, 5 séances stabilisées avec renforcement calisthénie au Gym ÉTS.'
      ],
      keyWorkouts: [
        {
          title: 'Répétitions de Côtes D+ (Mont-Royal)',
          desc: 'Montées régulières en Zone 3/4 avec descentes marchées pour limiter les micro-lésions musculaires excentriques.',
          metrics: '45-55 min • +300-380m D+ • FC 165-175 bpm'
        },
        {
          title: 'Sortie Longue Weekend (Boucles Mont-Royal)',
          desc: 'Course aérobie continue sur sentiers terreux. Test de base du sac et des chaussures.',
          metrics: '1h15 - 1h50 • +400-500m D+ • FC < 155 bpm'
        },
        {
          title: 'Calisthénie & Gainage (Gym ÉTS)',
          desc: 'Tractions, dips, pompes et gainage hollow body pour stabiliser la colonne sous le portage du sac.',
          metrics: '45-60 min • Tonus postural'
        }
      ],
      nutritionStrategy: 'Hydratation de base : 500 mL d\'eau/heure. 30g de glucides/h sur les sorties du weekend pour habituer l\'estomac.',
      badge: 'Phase Actuelle'
    },
    {
      id: 'autumn_consolidation',
      name: '2. Consolidation Aérobie & Force Automnale',
      shortTitle: 'Base Aérobie & Force',
      period: '21 sept. – 20 déc. 2026',
      weeks: 'Session d\'automne ÉTS (13 Semaines)',
      volumePct: '85% Volume Régulier',
      focus: 'Endurance de base (Zone 2) & Robustesse articulaire',
      location: 'Mont-Royal, Escaliers & Gym ÉTS',
      why: 'Développer la densité mitochondriale dans les fibres lentes tout en gérant les examens de l\'ÉTS. L\'oxydation des lipides est optimale sous 155 bpm.',
      whatHappens: [
        'Rythme hebdomadaire stable de 5 séances calées autour des cours universitaires.',
        'Montées d\'escaliers au Mont-Royal (escalier de 200 marches) pour blinder les chevilles et les genoux.',
        'Sorties longues plafonnées à 2h15 pour éviter l\'immunosuppression pendant les périodes de mi-session.'
      ],
      keyWorkouts: [
        {
          title: 'Montées d\'Escaliers & Pente Forte (Mont-Royal)',
          desc: 'Tempo régulier en escaliers avec technique ultra (mains sur les cuisses), simulation de marche active en pente.',
          metrics: '60 min • +500m D+ • FC 168-180 bpm'
        },
        {
          title: 'Sortie Aérobie Fondamentale Zone 2',
          desc: 'Course en aisance respiratoire totale (respiration nasale). Enseigne aux muscles à brûler les graisses.',
          metrics: '50-60 min • Plat/vallonné • FC < 148 bpm'
        },
        {
          title: 'Renforcement Excentrique Quadriceps & Mollets',
          desc: 'Fentes bulgares, squats tempo lents, montées sur pointes de pieds avec charge.',
          metrics: '45 min • Résistance aux descentes'
        }
      ],
      nutritionStrategy: '40-50g de glucides/heure sur les sorties de plus de 90 min. Apport protéique élevé post-renforcement (1,6g/kg).',
      badge: 'Base Automne'
    },
    {
      id: 'winter_power',
      name: '3. Puissance Hivernale & Pente (Tapis & Musculation)',
      shortTitle: 'Puissance & D+ Hiver',
      period: '11 janv. – 21 févr. 2027',
      weeks: 'Semaines 1 à 6 (Hiver)',
      volumePct: '80% ➔ 95% (S4 Décharge 70%)',
      focus: 'Puissance ascensionnelle spécifique & Zéro risque de chute',
      location: 'Gym ÉTS (Tapis Incliné 15% D+) & Piste',
      why: 'La neige et le verglas montréalais rendent les intervalles de côte extérieurs risqués. Le tapis incliné à 12-15% supprime tout risque de glissade tout en développant la VAM et le souffle.',
      whatHappens: [
        'Intervalles au seuil sur tapis incliné : 12-15% de pente à 5,5 - 6,5 km/h.',
        'Travail lourd de la chaîne postérieure : soulevés de terre roumains, step-ups sur banc, fentes marchées.',
        'Semaine 4 en décharge obligatoire : volume réduit à 70% pour assimiler la charge musculaire.'
      ],
      keyWorkouts: [
        {
          title: 'Intervalles en Pente sur Tapis (Gym ÉTS)',
          desc: '15 min échauffement + 6x 3 min @ 15% de pente (Z4 FC 172-185 bpm) avec 2 min de récupération.',
          metrics: '55 min • +450m D+ simulé • VAM élevée'
        },
        {
          title: 'Musculation Lourde & Chaîne Postérieure',
          desc: 'Trap bar deadlifts, montées sur box lestées (40cm), descentes lentes sur une jambe.',
          metrics: '60 min • Recrutement de force max'
        },
        {
          title: 'Footing Long Aérobie Déneigé',
          desc: 'Appuis sûrs sur boucles plates déneigées au Parc Maisonneuve.',
          metrics: '1h45 - 2h15 • FC < 152 bpm'
        }
      ],
      nutritionStrategy: 'Électrolytes obligatoires même en intérieur en raison de la forte transpiration sur tapis. 50g glucides/h.',
      badge: 'Bloc Hiver'
    },
    {
      id: 'volume_wec',
      name: '4. Volume & Week-ends Chocs (WEC)',
      shortTitle: 'Volume & Chocs WEC',
      period: '22 févr. – 2 mai 2027',
      weeks: 'Semaines 7 à 16 (10 Semaines)',
      volumePct: '95% ➔ 115% (S8, S12, S16 Décharges)',
      focus: 'Résistance à la fatigue neuromusculaire & Cumul WEC',
      location: 'Mont-Royal & Massifs Régionaux',
      why: 'En ultra-trail, la victoire appartient aux jambes capables de continuer à avancer efficacement après 10 heures d\'effort. Les week-ends chocs (grosse sortie samedi + sortie sur fatigue dimanche) créent cette adaptation.',
      whatHappens: [
        'Sorties longues du samedi : de 2h30 jusqu\'à 4h30 sur terrain accidenté.',
        'Sorties du dimanche : 60 à 80 min courues strictement en Zone 2 sur des quadriceps déjà entamés.',
        'Test réel du sac de 5L avec flasques avant et matériel obligatoire au poids de course.'
      ],
      keyWorkouts: [
        {
          title: 'Choc Montagne du Samedi (WEC 1)',
          desc: 'Course continue en sentier technique avec marche active dans les fortes pentes. Test obligatoire du sac de 5L.',
          metrics: '3h00 - 4h30 • +800-1100m D+ • FC < 155 bpm'
        },
        {
          title: 'Footing Aérobie sur Fatigue (WEC 2)',
          desc: 'Course sur jambes lourdes. Reproduit fidèlement les sensations musculaires du 50e kilomètre du QMT.',
          metrics: '60-80 min • Sentiers roulants • FC < 148 bpm'
        },
        {
          title: 'Répétitions de Côtes au Mont-Royal',
          desc: 'Ascensions dynamiques avec technique des mains sur les genoux.',
          metrics: '60 min • +500m D+ • Zone 4 au seuil'
        }
      ],
      nutritionStrategy: 'Simulation stricte des conditions de course : 60g de glucides/h + 500-600 mL de liquide/h avec 450 mg de sodium.',
      badge: 'Volume WEC'
    },
    {
      id: 'mestachibo_peak',
      name: '5. Pic Spécifique & Canyon du Mestachibo',
      shortTitle: 'Spécifique Mestachibo',
      period: '3 mai – 6 juin 2027',
      weeks: 'Semaines 17 à 21 (5 Semaines)',
      volumePct: '110% ➔ 125% Volume Pic',
      focus: 'Passages rocheux extrêmes, rangement des bâtons & allure course',
      location: 'Sentiers Techniques de Montagne & Escaliers',
      why: 'Le sentier Mestachibo (KM 57 à 67 du QMT) est réputé pour ses dalles de granit glissantes, ses passerelles suspendues et ses échelles où les bâtons sont interdits. Ce bloc renforce la proprioception de cheville et le franchissement rocheux.',
      whatHappens: [
        'Sorties techniques avec transitions rapides (plier et ranger ses bâtons sur le sac 5L tout en courant).',
        'Exercices de proprioception sur une jambe pour prévenir toute entorse sur roche humide.',
        'Sortie longue pic : 5h00 avec sac de 5L rempli de tout le matériel obligatoire.'
      ],
      keyWorkouts: [
        {
          title: 'Terrain Rocheux Technique & Simulation Blocs',
          desc: 'Franchissement de racines, lits de rivières asséchés et lacets raides. Entraînement au portage des bâtons pliés.',
          metrics: '4h00 - 5h00 • +1200m D+ • Sac complet'
        },
        {
          title: 'Stabilité de Cheville & Agilité Dynamique',
          desc: 'Équilibre monopodal, pliométrie latérale, descentes lentes sur mollets et gainage anti-rotation.',
          metrics: '45 min • Prévention des blessures'
        },
        {
          title: 'Allure Spécifique Sentier Mestachibo',
          desc: 'Cadence élevée, foulée courte et vive sur terrain chaotique.',
          metrics: '75 min • +400m D+'
        }
      ],
      nutritionStrategy: '60 à 70g de glucides/h testés sous stress gastrique. Test d\'aliments solides (barres, gaufres, purées salées).',
      badge: 'Pic Spécifique'
    },
    {
      id: 'tapering',
      name: '6. Affûtage, Fraîcheur & Semaine de Course (QMT-80)',
      shortTitle: 'Affûtage & Course QMT',
      period: '7 juin – 3 juil. 2027',
      weeks: 'Semaines 22 à 24 (3 Semaines)',
      volumePct: '60% ➔ 40% ➔ 25%',
      focus: 'Surcompensation glycogénique & Fraîcheur neuromusculaire',
      location: 'Sentiers Souples & Récupération Active',
      why: 'Éliminer 80% de la fatigue accumulée tout en conservant 100% de la capacité aérobie et de la force. Arriver au Quai de Petite-Rivière avec des stocks de glycogène saturés et des fibres musculaires intactes.',
      whatHappens: [
        'Réduction drastique du volume : -40% en S22, -60% en S23 et -75% en semaine de course.',
        'Maintien de lignes droites vives de 20 secondes pour préserver la réactivité nerveuse.',
        'Protocole de recharge glucidique dans les 48 heures précédant le départ (8 à 10g de glucides/kg).'
      ],
      keyWorkouts: [
        {
          title: 'Footing d\'Affûtage avec Lignes Droites',
          desc: '35 min de footing très lent de décrassage + 4x 20s d\'accélérations progressives sur herbe plate.',
          metrics: '35 min • Pure fraîcheur'
        },
        {
          title: 'Dernière Vérification Sac de Course & Matériel',
          desc: 'Footing de 20 min avec le sac de 5L chargé de tout le matériel obligatoire pour valider l\'absence totale de ballotement.',
          metrics: '20 min • Validation matériel'
        },
        {
          title: '🏁 JOUR DE COURSE QMT-80 (Samedi 3 Juillet 2027)',
          desc: '77 km • +3 370m D+ • Petite-Rivière ➔ Massif ➔ Caps ➔ Saint-Tite ➔ Mestachibo ➔ Mont-Sainte-Anne.',
          metrics: '77 km • Limite 19h • Ligne d\'arrivée'
        }
      ],
      nutritionStrategy: 'Recharge glucidique de J-3 à J-1. Jour de course : 60g de glucides/h, 500-750 mL de liquide/h, capsules de sels.',
      badge: 'Semaine de Course'
    }
  ];

  const currentPhase = phases[selectedPhaseIndex];

  // Ravitaillements officiels du QMT-80
  const aidStations = [
    {
      name: 'Départ — Quai de Petite-Rivière',
      km: 'KM 0',
      elevation: '0 m',
      elevationGain: '0 m',
      crew: 'Assistance autorisée',
      dropBag: 'Non',
      notes: 'Départ au bord du fleuve Saint-Laurent. Navette obligatoire à 3h30 AM au Mont-Sainte-Anne.'
    },
    {
      name: 'R1 — Le Massif de Charlevoix',
      km: 'KM 14,5',
      elevation: '721 m',
      elevationGain: '+750 m',
      crew: 'Assistance autorisée',
      dropBag: 'Non',
      notes: 'Fin de la terrible ascension initiale mer-sommet. Premier plein d\'eau et de ravitaillement.'
    },
    {
      name: 'R2 — Cap du Salut',
      km: 'KM 30,0',
      elevation: '573 m',
      elevationGain: '+1 350 m',
      crew: 'Isolé (Aucune assistance)',
      dropBag: 'Non',
      notes: 'Sentier des Caps, falaises côtières. Zone 100% sauvage en autonomie complète.'
    },
    {
      name: 'R3 — Cap Gribane',
      km: 'KM 44,0',
      elevation: '568 m',
      elevationGain: '+1 950 m',
      crew: 'Isolé (Aucune assistance)',
      dropBag: 'Non',
      notes: 'Dalles de granit glissantes et racines denses. Bien faire le plein d\'eau avant les 13 km vers Saint-Tite.'
    },
    {
      name: 'R4 — Saint-Tite-des-Caps',
      km: 'KM 57,0',
      elevation: '327 m',
      elevationGain: '+2 400 m',
      crew: 'Assistance autorisée',
      dropBag: 'SAC DE DÉLESTAGE (Drop Bag)',
      notes: 'POSTE CHARNIÈRE. Contrôle obligatoire de la lampe frontale. Manger solide, changer de chaussettes et plier ses bâtons.'
    },
    {
      name: 'R5 — Sentier Mestachibo',
      km: 'KM 67,0',
      elevation: '137 m',
      elevationGain: '+2 750 m',
      crew: 'Isolé (Aucune assistance)',
      dropBag: 'Non',
      notes: 'Gorges de la rivière, ponts suspendus, chaos rocheux. ⚠️ BÂTONS STRICTEMENT INTERDITS (doivent être rangés).'
    },
    {
      name: 'Arrivée — Mont-Sainte-Anne',
      km: 'KM 77,0',
      elevation: '177 m',
      elevationGain: '+3 370 m',
      crew: 'Arche d\'Arrivée',
      dropBag: 'Retour des sacs',
      notes: 'Montée finale sur les flancs du MSA, passage sur la crête et descente vers l\'arche d\'arrivée. Barrière : 19h.'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          className={`btn-secondary ${activeSubTab === 'roadmap' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('roadmap')}
          style={{
            borderColor: activeSubTab === 'roadmap' ? 'var(--primary)' : undefined,
            color: activeSubTab === 'roadmap' ? 'var(--primary)' : undefined,
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <Layers size={14} /> Matrice de Périodisation (6 Phases)
        </button>

        <button
          className={`btn-secondary ${activeSubTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('weekly')}
          style={{
            borderColor: activeSubTab === 'weekly' ? 'var(--primary)' : undefined,
            color: activeSubTab === 'weekly' ? 'var(--primary)' : undefined,
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <Calendar size={14} /> Planning Hebdo Type (Lun – Dim)
        </button>

        <button
          className={`btn-secondary ${activeSubTab === 'raceStrategy' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('raceStrategy')}
          style={{
            borderColor: activeSubTab === 'raceStrategy' ? 'var(--primary)' : undefined,
            color: activeSubTab === 'raceStrategy' ? 'var(--primary)' : undefined,
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <Mountain size={14} /> Profil & Ravitaillements (77 km)
        </button>

        <button
          className={`btn-secondary ${activeSubTab === 'gearSetup' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('gearSetup')}
          style={{
            borderColor: activeSubTab === 'gearSetup' ? '#38bdf8' : undefined,
            color: activeSubTab === 'gearSetup' ? '#38bdf8' : undefined,
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <ShieldCheck size={14} /> Stratégie Sac 5L & Matériel Obligatoire
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

            <div className="pro-table-wrapper">
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
              {[
                'Capacité minimale d’eau de 1,0 Litre (2 flasques 500 mL)',
                'Couverture de survie officielle (1,4 m x 2,0 m minimum)',
                'Sifflet de sécurité intégré au sac ou attaché',
                'Téléphone cellulaire chargé (enregistrer le numéro d’urgence QMT)',
                'Bandage de compression auto-adhésif (3 pouces x 48 pouces / 7,5cm x 1,2m)',
                'Lampe frontale (300+ lm) + batterie de rechange (exigée dès Saint-Tite)',
                'Gobelet réutilisable ou Ecocup (aucun verre jetable aux ravitos)',
                'Casquette, bandeau ou buff pour protection solaire',
                'Réserve alimentaire énergétique (gels, barres pour 3-4h d’autonomie)',
                'Épipen (obligatoire seulement si allergies connues guêpes/aliments)'
              ].map((item, idx) => {
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
