import React, { useState } from 'react';
import { PeriodizationContext } from '../types/calendar';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Heart,
  Layers,
  MapPin,
  Mountain,
  ShieldCheck,
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
  const [activeSubTab, setActiveSubTab] = useState<'roadmap' | 'weekly' | 'raceStrategy'>('roadmap');

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
          metrics: '50-60 min • Flat/rolling • HR < 145 bpm'
        }
      ],
      nutritionStrategy: '40g carbs/hour on runs > 90 min. High antioxidant meals post-training for cellular recovery.',
      badge: 'Base Engine'
    },
    {
      id: 'winter_power',
      name: '3. Winter Power & Incline Treadmill Armor',
      period: 'Jan 11 – Feb 21, 2027',
      weeks: 'Weeks 1 to 6 (Official Plan Start)',
      volumePct: '80% ➔ 95% (Deload W4: 70%)',
      focus: 'High-Incline VO2max & Eccentric Quad Bulletproofing',
      location: 'ÉTS Gym (Treadmills 15% incline & Weight Room)',
      why: 'Montreal sub-zero winter weather and icy trails create high fall and groin strain risks. The incline treadmill allows steep 15% power climbing at 6 km/h with zero downhill joint stress, paired with heavy eccentric quad exercises in the gym.',
      whatHappens: [
        'Tuesday sessions move indoors: 12-15% incline power hiking & uphill intervals.',
        'Dedicated eccentric strength: slow 4-second descent tempo squats, heavy Bulgarian split squats, and Nordic curls.',
        'Week 4 Deload: 30% volume reduction for supercompensation before the volume shock block.'
      ],
      keyWorkouts: [
        {
          title: 'Incline Treadmill Hill Intervals (15% Incline)',
          desc: '5x 4-min steep uphill climbs at 15% grade, 6.0 km/h with 2 min recovery.',
          metrics: '70 min • +600m simulated D+ • HR 175-190 bpm'
        },
        {
          title: 'Eccentric Quad Armor (Weight Room)',
          desc: 'Tempo front squats, single-leg step-downs, calf raises to prevent quad blowout at QMT-80.',
          metrics: '50 min • Heavy structural load'
        }
      ],
      nutritionStrategy: 'Increased vitamin D3 and zinc intake. 50g carbs/hour on treadmill long sessions.',
      badge: 'Power Block'
    },
    {
      id: 'volume_shock',
      name: '4. Ultra Volume & Back-to-Back Shock Weekends (WEC)',
      period: 'Feb 22 – May 9, 2027',
      weeks: 'Weeks 7 to 16 (10 Weeks)',
      volumePct: '95% ➔ 115% (Peak Volume, Deload W8 & W12)',
      focus: 'Cumulative Fatigue Tolerance & Gut Training',
      location: 'Mont-Royal & Regional Mountain Trail Camps',
      why: 'In an 80 km race with 4,000m D+, neuromuscular fatigue sets in around km 45. Back-to-Back weekends (e.g. 4h Saturday + 1h15 Sunday on heavy legs) simulate this exact second-half physical and mental exhaustion without needing 8h single training runs.',
      whatHappens: [
        'Shock Weekends: Saturday 3h30 - 5h00 long mountain trail run + Sunday 1h15 recovery run on fatigued legs.',
        'Weekly volume peaks between 9h30 and 12h00 with +1,200m to +1,800m vertical gain.',
        'Strict race vest testing: Poles, hydration bladders, headlamp, mandatory survival blanket.'
      ],
      keyWorkouts: [
        {
          title: 'Saturday Shock Trail Run (Mont-Royal / Saint-Hilaire)',
          desc: 'Continuous mountain loops with poles. Mandatory 60g carbohydrates consumed every 60 minutes.',
          metrics: '3h30 - 4h30 • +1,000-1,400m D+ • HR 148-162 bpm'
        },
        {
          title: 'Sunday Fatigued Back-to-Back Run',
          desc: 'Executed within 18 hours of Saturday run. Teaches running economy with pre-depleted glycogen.',
          metrics: '1h15 - 1h30 • Rolling hills • HR < 150 bpm'
        }
      ],
      nutritionStrategy: 'Target race fueling: 60 to 75g carbs/hour (isotonic mix + real food). 600-800 ml fluid + 400 mg sodium/hour.',
      badge: 'Peak Volume'
    },
    {
      id: 'mestashibo_peak',
      name: '5. Mestashibo Peak Specificity & Technical Terrain',
      period: 'May 10 – June 13, 2027',
      weeks: 'Weeks 17 to 21 (5 Weeks)',
      volumePct: '110% Specificity (Deload W20: 75%)',
      focus: 'Mestashibo Technical Trails, Boulders & Night Running',
      location: 'Massif de Charlevoix / Sentier des Caps / Mont-Sainte-Anne',
      why: 'The Mestashibo river gorge in QMT-80 is known as the "rocky meat grinder": wet roots, huge granite boulders, wooden ladders, and suspension bridges. Nimble foot placement, pole agility, and mental toughness are critical.',
      whatHappens: [
        'Reconnaissance camp on actual QMT-80 terrain (Massif de Charlevoix ➔ Mont-Sainte-Anne).',
        'Night running practice with headlamp to adapt eyesight to trail shadows.',
        'Downhill pounding adaptation: controlled high-cadence descents to test quad resistance.'
      ],
      keyWorkouts: [
        {
          title: 'Mestashibo Simulation Camp',
          desc: 'Extreme technical rocky singletrack, boulder hopping, pole rhythm transitions.',
          metrics: '5h00 • +1,500m D+ • High technical focus'
        },
        {
          title: 'Night Trail Simulation',
          desc: 'Departing 2 hours before sunrise with headlamp to master dark trail navigation.',
          metrics: '2h00 • Night trail • Foot strike accuracy'
        }
      ],
      nutritionStrategy: 'Simulation of aid station foods (broth, watermelon, salty chips) alongside personal nutrition pack.',
      badge: 'Specificity'
    },
    {
      id: 'tapering',
      name: '6. Tapering, Glycogen Loading & Race Day',
      period: 'June 14 – July 3, 2027',
      weeks: 'Weeks 22 to 24 (3 Weeks)',
      volumePct: '65% ➔ 45% ➔ 30% (Sharp Drop)',
      focus: 'Peak Freshening, Glycogen Storage & Race Execution',
      location: 'Easy Local Trails & QMT-80 Course (Petite-Rivière-St-François)',
      why: 'Fitness is already built. Fatigue masks fitness. A 50% volume drop cuts systemic inflammation, restores muscle glycogen stores to maximum capacity, and brings neuromuscular sharpness to peak levels on race morning.',
      whatHappens: [
        'Week 22 (D-19 to D-13): 35% volume reduction, retaining short 20-second strides for leg turnover.',
        'Week 23 (D-12 to D-6): 55% volume reduction, sleep optimization, daily hydration loading.',
        'Race Week (D-5 to D-Day): 20 min easy shakeouts, mandatory gear inspection, final carbohydrate loading (8-10g carbs/kg body weight).'
      ],
      keyWorkouts: [
        {
          title: 'Pre-Race Shakeout Run + 4 Strides',
          desc: 'Short, effortless jog to activate neuromuscular junctions and stay relaxed.',
          metrics: '25 min • Flat turf • 4x 15s smooth accelerations'
        },
        {
          title: '🏁 QMT-80 RACE DAY (Saturday, July 3, 2027)',
          desc: '80 km from Petite-Rivière-Saint-François across the Mestashibo trail to Mont-Sainte-Anne.',
          metrics: '80 KM • +4,000m D+ • Cut-off: 18 hours'
        }
      ],
      nutritionStrategy: 'Carb load D-3 to D-1 (white rice, oats, sweet potatoes). Race day: 65-80g carbs/hr from minute 30 onwards.',
      badge: 'Race Day 🏁'
    }
  ];

  const weeklyScheduleTemplate = [
    {
      day: 'Monday',
      title: '🤸 Calisthenics 1 (Push & Core Armor)',
      duration: '45 – 65 min',
      location: 'ÉTS Gym / Home',
      focus: 'Upper Body & Spinal Core',
      details: 'Dips, Pike push-ups / HSPU progression, gymnastic ring push-ups, hollow body holds (3x45s), hanging leg raises. Protects posture under race backpack weight.',
      hrZone: 'Zone 1-2 (Neuromuscular)'
    },
    {
      day: 'Tuesday',
      title: '⚡ Trail Incline Repeats (D+) + Leg Strength',
      duration: '70 – 85 min',
      location: 'Mont-Royal (Winter: ÉTS Gym Incline Treadmill)',
      focus: 'Uphill VO2max & Quad Resilience',
      details: '15 min warm-up, 4-6 hill repeats at 12-15% incline (Target HR: 172-190 bpm). Followed immediately by 20 min leg strength: tempo squats (3s descent), Bulgarian split squats, and calf raises.',
      hrZone: 'Zone 4/5 (172 – 190 bpm)'
    },
    {
      day: 'Wednesday',
      title: '🧘 Active Recovery & Deep Mobility',
      duration: '30 – 40 min',
      location: 'Home',
      focus: 'Tissue Regeneration & Joint ROM',
      details: 'Couch stretch (quads & hip flexors), pigeon pose, 90/90 hip mobility, foam rolling IT bands and thoracic spine decompression. Zero cardio stress.',
      hrZone: 'Recovery (Zone 1)'
    },
    {
      day: 'Thursday',
      title: '🏃 Aerobic Base Running + Calisthenics 2 (Pull & Grip)',
      duration: '75 – 90 min',
      location: 'Parc Maisonneuve / ÉTS Gym',
      focus: 'Mitochondrial Density & Climbing Grip',
      details: '45-50 min continuous Zone 2 aerobic run (<155 bpm) chained with 30 min pull workout: strict pull-ups, horizontal ring rows, dead hangs, and wrist curls for trekking pole endurance.',
      hrZone: 'Zone 2 (< 155 bpm)'
    },
    {
      day: 'Friday',
      title: '🛌 Rest Day or Evening Mobility',
      duration: '20 min optional',
      location: 'Home',
      focus: 'Full Glycogen Replenishment',
      details: 'Complete physical rest to prime muscles for the weekend mountain shock block. Light evening stretching and hydration preparation.',
      hrZone: 'Rest'
    },
    {
      day: 'Saturday',
      title: '🏔️ Main Mountain Shock Long Run (Back-to-Back 1)',
      duration: '1h50 to 4h30 (Progressive by Phase)',
      location: 'Mont-Royal Trails or Regional Peaks',
      focus: 'Endurance, Technical D+ & Nutrition Testing',
      details: 'The cornerstone workout. Steep trail ascents, power hiking with poles, technical singletrack descents. Rigorous testing of race pack, gels, electrolytes, and footwear.',
      hrZone: 'Zone 2-3 (145 – 165 bpm)'
    },
    {
      day: 'Sunday',
      title: '🏃 Fatigued Aerobic Run (Back-to-Back 2) + Mobility',
      duration: '50 – 75 min',
      location: 'Local Rolling Trails',
      focus: 'Neuromuscular Fatigue Resistance',
      details: 'Run executed on tired legs from Saturday. Simulates km 50-80 of QMT. Kept at relaxed conversational pace, followed by 15 min hip and ankle stretching.',
      hrZone: 'Strict Zone 2 (< 150 bpm)'
    }
  ];

  const currentPhase = phases[selectedPhaseIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
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
          <Layers size={14} /> Interactive Season Stepper (All 6 Phases)
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
          <Calendar size={14} /> 7-Day Microcycle Routine (Mon – Sun)
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
          <Compass size={14} /> QMT-80 Race Profile & Fueling Matrix
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
                    <span style={{ fontSize: '0.74rem', fontWeight: 800 }}>Phase {idx + 1}</span>
                    <span style={{ fontSize: '0.65rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {p.volumePct.split(' ')[0]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name.replace(/^[0-9.]*\s*/, '').split('(')[0]}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                    {p.period.split('–')[0]}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Single Fused Active Phase Detail Panel */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              borderLeft: '4px solid var(--primary)',
              background: 'var(--bg-surface)'
            }}
          >
            {/* Phase Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '12px',
                marginBottom: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 4 }}>
                  <span
                    className="badge-tag"
                    style={{
                      background: 'var(--primary-subtle)',
                      color: 'var(--primary)',
                      border: '1px solid var(--primary-border)'
                    }}
                  >
                    {currentPhase.badge}
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
                {weeklyScheduleTemplate.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>{item.day}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱️ {item.duration}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.details}</div>
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      📍 {item.location}
                    </td>
                    <td>
                      <span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        ❤️ {item.hrZone}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RACE PROFILE & STRATEGY */}
      {activeSubTab === 'raceStrategy' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
          {/* Key Course Metrics */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, marginBottom: '10px', color: 'var(--primary)' }}>
              🏔️ QMT-80 Race Profile
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Distance:</span>
                <strong>80.0 KM</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Elevation Gain (D+):</span>
                <strong style={{ color: 'var(--primary)' }}>+4,000 M</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Maximum Cut-Off Time:</span>
                <strong>18 Hours</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Start Point:</span>
                <span>Petite-Rivière-Saint-François</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Finish Line:</span>
                <span>Mont-Sainte-Anne</span>
              </div>
            </div>
          </div>

          {/* Pacing & Cardio */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, marginBottom: '10px', color: 'var(--accent-blue)' }}>
              ❤️ Physiological Pacing (FCmax = 203 bpm)
            </h3>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong>KM 0 to 45 (Massif & Coastal Hills):</strong> Strict aerobic ceiling of 155-160 bpm on climbs. Power-hike early.</li>
              <li><strong>KM 45 to 65 (Mestashibo Canyon):</strong> Extremely technical river gorge. Focus on foot placement and pole agility.</li>
              <li><strong>KM 65 to 80 (Mont-Sainte-Anne Final Climb):</strong> Continuous +800m push. Rely on stored glycogen and mental resilience.</li>
            </ul>
          </div>

          {/* Fueling Protocol */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, marginBottom: '10px', color: '#10b981' }}>
              🍌 Hourly Fueling & Electrolytes
            </h3>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong>Carbohydrates:</strong> 60 to 75g carbs per hour (maltodextrin mix + real food). Start taking carbs at min 25.</li>
              <li><strong>Fluids:</strong> 500 to 750 ml water/electrolyte solution per hour depending on ambient heat.</li>
              <li><strong>Sodium & Salts:</strong> 350 to 500 mg sodium per hour to prevent hyponatremia and quad cramping.</li>
            </ul>
          </div>

          {/* Mandatory Gear */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, marginBottom: '10px', color: 'var(--accent-amber)' }}>
              🎒 Mandatory Gear Checklist
            </h3>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong>Running Vest:</strong> 12L capacity with 1.5L minimum fluid capacity.</li>
              <li><strong>Trekking Poles:</strong> Carbon folding poles (tested in Mestashibo block).</li>
              <li><strong>Headlamp:</strong> 300+ lumens with backup battery.</li>
              <li><strong>Survival Kit:</strong> Survival blanket, whistle, waterproof taped seam jacket (10,000 Schmerber).</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
