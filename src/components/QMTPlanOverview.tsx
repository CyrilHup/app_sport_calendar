import React, { useState } from 'react';
import { PeriodizationContext } from '../types/calendar';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Heart,
  Info,
  Layers,
  MapPin,
  Mountain,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';

interface QMTPlanOverviewProps {
  currentContext: PeriodizationContext;
}

interface TrainingPhaseDetail {
  id: string;
  name: string;
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
      name: '1. Foundation & Ramp-Up (Post-Break Resumption)',
      period: 'Sept 1 – Sept 20, 2026',
      weeks: '3 Weeks (Weeks -18 to -16)',
      volumePct: '55% ➔ 75% ➔ 90%',
      focus: 'Tendon Adaptation & Aerobic Wake-up',
      location: 'Mont-Royal & Local Trails / Gym',
      why: 'Prevent tendonitis and patellofemoral pain after summer hiatus. Tendons and collagen structures take 3x longer to adapt than cardiovascular mitochondria. Zero maximal anaerobic spikes.',
      whatHappens: [
        'Week 1 (55%): Controlled 45 min hill run, 1h15 trail long run, full Sunday rest.',
        'Week 2 (75%): Volume progressive step, introducing 40 min aerobic Sunday run.',
        'Week 3 (90%): 1h50 weekend trail, 5 sessions stabilized with calisthenics upper-body conditioning.'
      ],
      keyWorkouts: [
        {
          title: 'Hill Repeats D+ (Mont-Royal)',
          desc: 'Smooth controlled hill climbs in Zone 3/4 with easy walking descents to minimize eccentric muscle tears.',
          metrics: '45-55 min • +300-380m D+ • HR 165-175 bpm'
        },
        {
          title: 'Weekend Long Run (Mont-Royal Loops)',
          desc: 'Continuous aerobic trail run on dirt tracks. Testing baseline hydration packs and shoes.',
          metrics: '1h15 - 1h50 • +400-500m D+ • HR < 155 bpm'
        },
        {
          title: 'Calisthenics & Core (ÉTS Gym)',
          desc: 'Pull-ups, dips, push-ups and isometric hollow body holds for spine stabilization under pack weight.',
          metrics: '45-60 min • Neuromuscular tone'
        }
      ],
      nutritionStrategy: 'Baseline hydration: 500 ml water/hour. 30g carbs/hour on weekend runs to maintain gastric tolerance.',
      badge: 'Current Phase'
    },
    {
      id: 'autumn_consolidation',
      name: '2. Autumn Aerobic Consolidation & Strength Baseline',
      period: 'Sept 21 – Dec 20, 2026',
      weeks: 'Autumn Semester (13 Weeks)',
      volumePct: '85% Steady Volume',
      focus: 'Aerobic Base (Zone 2) & Structural Strength',
      location: 'Mont-Royal Trails, Outdoor Stairs & ÉTS Gym',
      why: 'Build a solid aerobic base (mitochondrial density in slow-twitch fibers) while balancing university semester exams. Fat oxidation efficiency is maximized below 155 bpm.',
      whatHappens: [
        'Stable weekly rhythm of 5 workouts tailored around university courses.',
        'Stair climbing repeats at Mont-Royal (200-step stairs) to develop ankle and knee resilience.',
        'Progressive long runs capped at 2h15 to avoid systemic immunosuppression during exam periods.'
      ],
      keyWorkouts: [
        {
          title: 'Stair & Steep Grade Climbs (Mont-Royal)',
          desc: 'Climbing tempo on stairs with hands-on-knees ultra technique, power-hiking simulation.',
          metrics: '60 min • +500m D+ • HR 168-180 bpm'
        },
        {
          title: 'Zone 2 Aerobic Foundation Run',
          desc: 'Pure nasal breathing run. Teaches muscles to utilize fatty acids as primary fuel source.',
          metrics: '50-60 min • Flat/rolling • HR < 148 bpm'
        },
        {
          title: 'Eccentric Quad & Calves Strength',
          desc: 'Bulgarian split squats, slow tempo goblet squats, weighted calf raises.',
          metrics: '45 min • Quad bulletproofing'
        }
      ],
      nutritionStrategy: '40-50g carbs/hour on runs over 90 min. High protein intake post-strength sessions (1.6g/kg).',
      badge: 'Autumn Base'
    },
    {
      id: 'winter_power',
      name: '3. Winter Power & Hills (Incline Treadmill & Heavy Strength)',
      period: 'Jan 11 – Feb 21, 2027',
      weeks: 'Weeks 1 to 6 (Winter)',
      volumePct: '80% ➔ 95% (W4 Deload 70%)',
      focus: 'Specific Incline Power & Zero Winter Slips',
      location: 'ÉTS Gym (Treadmill 15% D+) & Indoor Track',
      why: 'Montreal winter snow and ice make outdoor mountain intervals dangerous. Incline treadmill sessions (12-15% grade) eliminate slip hazards while building massive aerobic power and VAM.',
      whatHappens: [
        'Incline treadmill threshold repeats: 12-15% incline at 5.5 to 6.5 km/h.',
        'Heavy posterior chain work: Romanian deadlifts, step-ups, walking lunges.',
        'Week 4 is mandatory Deload: volume cut to 70% to absorb structural muscle trauma.'
      ],
      keyWorkouts: [
        {
          title: 'Incline Treadmill Hill Intervals (ÉTS Gym)',
          desc: '15 min warm-up + 6x 3 min @ 15% incline (Z4 HR 172-185 bpm) + 2 min recovery.',
          metrics: '55 min • +450m D+ simulated • High VAM'
        },
        {
          title: 'Heavy Strength & Posterior Chain Bulletproofing',
          desc: 'Trap bar deadlifts, weighted box step-ups (40cm), eccentric single-leg drops.',
          metrics: '60 min • Maximum force recruitment'
        },
        {
          title: 'Weekend Plowed Aerobic Long Run',
          desc: 'Steady footing on plowed urban park loops (Maisonneuve).',
          metrics: '1h45 - 2h15 • HR < 152 bpm'
        }
      ],
      nutritionStrategy: 'Electrolytes mandatory even indoors due to high sweat rates on gym treadmills. 50g carbs/h.',
      badge: 'Winter Power'
    },
    {
      id: 'volume_wec',
      name: '4. Volume & Back-to-Back Mountain Shocks (WEC)',
      period: 'Feb 22 – May 2, 2027',
      weeks: 'Weeks 7 to 16 (10 Weeks)',
      volumePct: '95% ➔ 115% (W8, W12, W16 Deload)',
      focus: 'Neuromuscular Fatigue Resistance & Back-to-Back Volume',
      location: 'Mont-Royal & Regional Mountain Trails',
      why: 'Ultra-trail running is won by legs that can keep moving efficiently after 10 hours of fatigue. Back-to-back weekend runs (long run Saturday + medium fatigued run Sunday) train this exact state.',
      whatHappens: [
        'Progressive Saturday trail runs: 2h30 pushing to 4h30 on technical terrain.',
        'Sunday fatigued runs: 60 to 80 min running strictly in Zone 2 on pre-fatigued quads.',
        'Testing 5L pack with front flasks and mandatory gear under realistic race weight.'
      ],
      keyWorkouts: [
        {
          title: 'Saturday Mountain Shock (Back-to-Back 1)',
          desc: 'Continuous technical trail running with power hiking on steep slopes. Mandatory 5L race vest test.',
          metrics: '3h00 - 4h30 • +800-1100m D+ • HR < 155 bpm'
        },
        {
          title: 'Sunday Fatigued Aerobic Run (Back-to-Back 2)',
          desc: 'Aerobic running on tired legs. Simulates the psychological feel of KM 50 of QMT.',
          metrics: '60-80 min • Rolling dirt tracks • HR < 148 bpm'
        },
        {
          title: 'Midweek Mont-Royal Hill Repeats',
          desc: 'Hill climbs with hands-on-knees power hike technique.',
          metrics: '60 min • +500m D+ • Zone 4 threshold'
        }
      ],
      nutritionStrategy: 'Strict race simulation: 60g carbs/hour + 500-600 mL fluid/hour with 450 mg sodium.',
      badge: 'Volume Block'
    },
    {
      id: 'mestachibo_peak',
      name: '5. Specific Peak & Mestachibo Canyon Conditioning',
      period: 'May 3 – June 6, 2027',
      weeks: 'Weeks 17 to 21 (5 Weeks)',
      volumePct: '110% ➔ 125% Peak Volume',
      focus: 'Extreme Technical Scrambling, Pole Stowage & Race Day Pace',
      location: 'Technical Mountain Trails & Stair Loops',
      why: 'The Sentier Mestachibo (KM 57 to 67 of QMT) is famous for its granite boulder hopping, chains, and suspension bridges where poles are forbidden. This block conditions lateral ankle stability and upper-body rock scrambling.',
      whatHappens: [
        'Technical trail runs with frequent transition drills (stowing/unstowing poles on 5L vest).',
        'Single-leg stability and proprioception drills to bulletproof ankles against rolling on wet granite.',
        'Peak long run: 5h00 with full mandatory gear in 5L backpack.'
      ],
      keyWorkouts: [
        {
          title: 'Technical Rocky Terrain & Boulder Simulation',
          desc: 'Running over roots, rocky river beds, and steep technical switchbacks. Practicing running with poles stowed.',
          metrics: '4h00 - 5h00 • +1200m D+ • Full race vest'
        },
        {
          title: 'Ankle Stability & Agility Drills',
          desc: 'Single-leg balance, lateral plyometrics, calf eccentric drops, and core anti-rotation.',
          metrics: '45 min • Injury prevention'
        },
        {
          title: 'Mestachibo Specific Pace Practice',
          desc: 'High cadence, short stride turnover over irregular terrain.',
          metrics: '75 min • +400m D+'
        }
      ],
      nutritionStrategy: '60-70g carbs/hour tested under digestive stress. Solid food digestion testing (bars, waffles, salted potatoes).',
      badge: 'Peak Specific'
    },
    {
      id: 'tapering',
      name: '6. Tapering, Freshness & Race Day Execution (QMT-80)',
      period: 'June 7 – July 3, 2027',
      weeks: 'Weeks 22 to 24 (3 Weeks)',
      volumePct: '60% ➔ 40% ➔ 25%',
      focus: 'Peak Glycogen Supercompensation & Mental Freshness',
      location: 'Gentle Park Trails & Active Recovery',
      why: 'Reduce systemic fatigue by 80% while retaining 100% of neuromuscular fitness. Arrive at the Petite-Rivière-Saint-François start line with full muscle glycogen stores and undamaged muscle fibers.',
      whatHappens: [
        'Volume cut by 40% in W22, 60% in W23, and 75% on race week.',
        'Short sharp 20-second strides maintained to keep fast-twitch neuromuscular pathways primed.',
        'High-carbohydrate loading protocol (8-10g carbs/kg bodyweight in the final 48 hours).'
      ],
      keyWorkouts: [
        {
          title: 'Taper Maintenance Run with Strides',
          desc: '35 min very easy aerobic flush + 4x 20s progressive accelerations on flat turf.',
          metrics: '35 min • Pure freshness'
        },
        {
          title: 'Race Pack Shakeout & Mandatory Gear Final Check',
          desc: '20 min jog with 5L vest packed with all mandatory gear, checking zero bounce.',
          metrics: '20 min • Gear verification'
        },
        {
          title: '🏁 QMT-80 RACE DAY (Saturday July 3, 2027)',
          desc: '77 km • +3,370m D+ • Petite-Rivière ➔ Massif ➔ Caps ➔ Saint-Tite ➔ Mestachibo ➔ Mont-Sainte-Anne.',
          metrics: '77 km • 19h Cut-off • Finish line glory'
        }
      ],
      nutritionStrategy: 'Carb-loading D-3 to D-1. Race day: 60g carbs/h, 500-750 mL fluid/h, salt tabs.',
      badge: 'Race Week'
    }
  ];

  const currentPhase = phases[selectedPhaseIndex];

  // Official QMT-80 Aid Stations Data
  const aidStations = [
    {
      name: 'Start — Quai Petite-Rivière',
      km: 'KM 0',
      elevation: '0 m',
      elevationGain: '0 m',
      crew: 'Allowed',
      dropBag: 'No',
      notes: 'Depart along St. Lawrence River. Shuttle leaves Mont-Sainte-Anne at 3:30 AM.'
    },
    {
      name: 'R1 — Le Massif de Charlevoix',
      km: 'KM 14.5',
      elevation: '721 m',
      elevationGain: '+750 m',
      crew: 'Crew Allowed',
      dropBag: 'No',
      notes: 'Initial brutal sea-to-summit climb completed. First hydration & food refill.'
    },
    {
      name: 'R2 — Cap du Salut',
      km: 'KM 30.0',
      elevation: '573 m',
      elevationGain: '+1,350 m',
      crew: 'NO Crew (Isolated)',
      dropBag: 'No',
      notes: 'Sentier des Caps coastal cliff section. 100% self-sufficient runner zone.'
    },
    {
      name: 'R3 — Cap Gribane',
      km: 'KM 44.0',
      elevation: '568 m',
      elevationGain: '+1,950 m',
      crew: 'NO Crew (Isolated)',
      dropBag: 'No',
      notes: 'Technical granite slabs & continuous roots. Fill water before the 14km stretch to Saint-Tite.'
    },
    {
      name: 'R4 — Saint-Tite-des-Caps',
      km: 'KM 57.0',
      elevation: '327 m',
      elevationGain: '+2,400 m',
      crew: 'Crew Allowed',
      dropBag: 'DROP BAG ACCESS',
      notes: 'MAJOR AID STATION. Mandatory headlamp inspection. Eat solid food and stow poles before Mestachibo.'
    },
    {
      name: 'R5 — Sentier Mestachibo',
      km: 'KM 67.0',
      elevation: '137 m',
      elevationGain: '+2,750 m',
      crew: 'NO Crew (Isolated)',
      dropBag: 'No',
      notes: 'Canyon floor, suspended bridges & boulder scrambling. ⚠️ POLES FORBIDDEN (must be stowed).'
    },
    {
      name: 'Finish — Mont-Sainte-Anne',
      km: 'KM 77.0',
      elevation: '177 m',
      elevationGain: '+3,370 m',
      crew: 'Finish Corral',
      dropBag: 'Drop Bag Return',
      notes: 'Final climb & descent to the base station. Official cut-off: 19 hours.'
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
          <Layers size={14} /> 6-Phase Periodization Matrix
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
          <Calendar size={14} /> Weekly Microcycle Schedule
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
          <Mountain size={14} /> Course Profile & Aid Stations (Ravitos)
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
          <ShieldCheck size={14} /> 5L Backpack Strategy & Mandatory Gear
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
                      {p.weeks}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: 3, color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                    {p.name.split('. ')[1] || p.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Vol: {p.volumePct}
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
                    Phase {selectedPhaseIndex + 1} of 6
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                    {currentPhase.name}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span>📅 <strong>Timeline:</strong> {currentPhase.period} ({currentPhase.weeks})</span>
                  <span>📍 <strong>Location:</strong> {currentPhase.location}</span>
                  <span>📈 <strong>Volume Factor:</strong> {currentPhase.volumePct}</span>
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
                Focus: {currentPhase.focus}
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
              <strong style={{ color: 'var(--primary)' }}>🎯 Physiological Purpose & Adaptation:</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{currentPhase.why}</p>
            </div>

            {/* Benchmark Sessions Grid */}
            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Benchmark Workouts in this Block:
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
                <strong style={{ color: 'var(--primary)' }}>Fueling & Hydration Guidance:</strong> {currentPhase.nutritionStrategy}
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
                  <th style={{ width: '120px' }}>Day & Duration</th>
                  <th>Session Protocol & Focus</th>
                  <th>Location</th>
                  <th style={{ width: '140px' }}>Target Zone</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Monday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 45 – 65 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🤸 Calisthenics 1 (Push & Core Strength)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Dips, Pike push-ups (handstand progression), gymnastics ring push-ups, hollow body holds. Zero leg impact post-weekend trail.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 ÉTS Gym</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>❤️ Recovery (Z1)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Tuesday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 65 – 85 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>⚡ Hill Repeats D+ & Leg Bulletproofing</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Mont-Royal short hill repeats (172-190 bpm) or winter incline treadmill (15% @ 6 km/h) chained with Bulgarian split squats and tempo squats for quad descent resistance.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Mont-Royal / Gym</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 87, 34, 0.15)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}>❤️ Zone 4/5 (172-190)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Wednesday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 45 – 65 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏋️ Calisthenics 2 (Pull & Core - Zero Leg Impact)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Strict pull-ups, muscle-up progressions, horizontal rows, front lever work. Allows complete leg flushing post-Tuesday hills.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 ÉTS Gym</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>❤️ Zone 1 (Strength)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Thursday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 35 – 50 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏃 Easy Aerobic Base Run Z2</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Pure conversational pace. HR strictly below 148 bpm. Dynamic cadence 170-175 spm with short light steps under the hips.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Neighborhood / Maisonneuve</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>❤️ Zone 1/2 (&lt; 148)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Friday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 40 – 60 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🤸 Calisthenics 3 (Handstand, Shoulder Mobility & Skills)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Handstand balance, shoulder active mobility, L-sit/V-sit. Chained straight after class at ÉTS Gym. Rest day for quads before the weekend shock.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 ÉTS Gym</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>❤️ Zone 1 (Mobility)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Saturday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 1h45 – 4h30</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏔️ Main Mountain Shock Long Run (Back-to-Back 1)</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>The cornerstone workout for QMT-80. Continuous D+ climbs, run-hike technique (power hike whenever slope &gt; 8-10%), downhill quad resilience. Fueling: 60g carbs/h.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Mont-Royal Trails</td>
                  <td><span className="badge-tag" style={{ background: 'rgba(255, 87, 34, 0.15)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}>❤️ Zone 2 (&lt; 155)</span></td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>Sunday</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ 40 – 75 min</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🏃 Fatigued Aerobic Run (Back-to-Back 2) + Mobility</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Executed directly on muscular fatigue from Saturday to train the nervous system to handle late-race fatigue (simulating KM 50-77 of QMT). Followed by full 20 min evening stretch routine.</div>
                  </td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Mont-Royal / Home</td>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Official Distance</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>77.0 KM</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Petite-Rivière ➔ Mont-Sainte-Anne</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elevation D+ / D-</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>+3,370 m / -3,200 m</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Technical Rating: 5/5</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Maximum Cut-Off</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>19 Hours</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Shuttle 3:30 AM from Mont-Sainte-Anne</div>
            </div>

            <div className="glass-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Drop Bag Service</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>KM 57</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Saint-Tite-des-Caps Aid Station</div>
            </div>
          </div>

          {/* Aid Stations Breakdown Table */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mountain size={16} color="var(--primary)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  Official Aid Stations & Section Breakdown (Ravitaillements)
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Products: XACT Nutrition & Electrolytes at all aid stations
              </span>
            </div>

            <div className="pro-table-wrapper">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Checkpoint / Aid Station</th>
                    <th>Distance & Elevation</th>
                    <th>Crew & Drop Bag</th>
                    <th>Course Notes & Specific Strategy</th>
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
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Alt: {station.elevation} • Cum: {station.elevationGain}</div>
                      </td>
                      <td>
                        <span
                          className="badge-tag"
                          style={{
                            background: station.dropBag.includes('DROP') ? 'rgba(16, 185, 129, 0.15)' : (station.crew.includes('NO') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)'),
                            color: station.dropBag.includes('DROP') ? '#10b981' : (station.crew.includes('NO') ? '#f87171' : '#38bdf8'),
                            border: '1px solid var(--border-color)',
                            fontSize: '0.68rem'
                          }}
                        >
                          {station.dropBag.includes('DROP') ? '🎒 DROP BAG + Crew' : station.crew}
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
                1. KM 0 to 15: The Massif Wall
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Starting at sea level (0m) along the St. Lawrence river, the first 14 km climb 720m directly up Le Massif. Do NOT run the steep grades; power hike with high cadence to keep HR &lt; 155 bpm. Arrive at Le Massif aid station fresh.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#38bdf8', marginBottom: 6 }}>
                2. KM 15 to 57: Sentier des Caps
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                42 km of relentless technical roots, muddy hollows, and granite cliffs (Cap du Salut, Cap Gribane). Completely isolated with zero crew access. Pace steadily and refill fluid to 1.0L minimum at Cap Gribane.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f59e0b', marginBottom: 6 }}>
                3. KM 57 to 67: The Infamous Mestachibo
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong>BÂTONS INTERDITS :</strong> You MUST stow your poles securely on your 5L vest at Saint-Tite. Speed drops to 3-4 km/h over suspended bridges, wet boulders and steel ladders. Focus on 100% footwork accuracy.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#10b981', marginBottom: 6 }}>
                4. KM 67 to 77: Mont-Sainte-Anne Final Climb
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Exit the canyon and begin the final push up the flank of Mont-Sainte-Anne. Deploy poles again. Dig into glycogen reserves and power hike to the summit ridge before descending to the finish corral!
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
                <li><strong>À l'Arrière (Sac 5L) :</strong> Place ta <strong>poche de 1L vide ou remplie à 500 mL max</strong> uniquement sur le tronçon chaud de 14 km (Cap Gribane ➔ Saint-Tite). Le reste du temps, elle ne prend aucune place.</li>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#10b981" />
                Matériel Obligatoire Officiel QMT-80 (Checklist de Contrôle)
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Vérifications aléatoires sur le parcours par les commissaires
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6 }}>
              {[
                'Capacité minimale d’eau de 1,0 Litre (2 flasques 500 mL)',
                'Couverture de survie officielle (1,4 m x 2,0 m minimum)',
                'Sifflet de sécurité intégré au sac ou attaché',
                'Téléphone cellulaire chargé (enregistrer le numéro d’urgence QMT)',
                'Bandage de compression auto-adhésif (3 pouces x 48 pouces / 7.5cm x 1.2m)',
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
