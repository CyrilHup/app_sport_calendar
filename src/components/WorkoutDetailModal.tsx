import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import { CheckSquare, Clock, Compass, Flame, Heart, MapPin, ShieldCheck, Square, Utensils, X, Zap } from 'lucide-react';

interface WorkoutDetailModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});

  const toggleGear = (item: string) => {
    setCheckedGear(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Ultra-Trail Fueling & Hydration Calculator
  const isSport = event.category === 'sport';
  const durationHours = event.durationMinutes / 60;
  const isLongTrail = event.sportType === 'TRAIL_LONG';
  const isIntenseTrail = event.sportType === 'TRAIL_INTENSE';

  const carbsPerHour = (isLongTrail || isIntenseTrail) ? 60 : 35;
  const totalCarbsG = Math.round(durationHours * carbsPerHour);
  const totalWaterMl = Math.round(durationHours * 550);
  const totalSodiumMg = Math.round(durationHours * 450);
  const gelsEquivalent = Math.max(1, Math.round(totalCarbsG / 25));

  const mandatoryGearList: string[] = [];
  if (isSport && event.durationMinutes >= 45) {
    mandatoryGearList.push(`${Math.ceil(totalWaterMl / 500)}x 500 mL Soft flasks with electrolytes`);
    mandatoryGearList.push(`Energy nutrition: ~${totalCarbsG}g carbs (${gelsEquivalent} gels / bars)`);
    mandatoryGearList.push('Charged smartphone with downloaded trail GPX track');
  }
  if (isLongTrail || event.durationMinutes >= 90) {
    mandatoryGearList.push('Emergency survival blanket + safety whistle (QMT-80 mandatory)');
    mandatoryGearList.push('Waterproof breathable jacket (10,000 Schmerber minimum)');
    mandatoryGearList.push('Collapsible silicone reusable eco-cup (no cups at aid stations)');
    mandatoryGearList.push('Trail running poles (folding carbon)');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>{event.emoji}</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                {event.title}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {formatDate(startDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '12px' }}>
          {/* Timing & Location Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> Schedule
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {formatTime(startDate)} - {formatTime(endDate)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)' }}>
                {event.durationMinutes} minutes
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> Location
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {event.location}
              </div>
              {event.metadata?.room && (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                  Room: {event.metadata.room}
                </span>
              )}
            </div>

            {event.metadata?.targetElevationM && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Compass size={11} /> Target D+
                </span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', marginTop: 3 }}>
                  +{event.metadata.targetElevationM} m
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Ultra-Trail Climbing
                </span>
              </div>
            )}
          </div>

          {/* Smart Schedule Conflict Banner */}
          {event.metadata?.conflictRescheduled && event.metadata.conflictReason && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', fontSize: '0.78rem', color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>🔄</span>
              <div>
                <strong>Smart Rescheduled:</strong> {event.metadata.conflictReason}
              </div>
            </div>
          )}

          {/* Cardio & Physiological Targets */}
          {event.metadata?.targetHeartRate && (
            <div style={{ background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, marginBottom: '4px', fontSize: '0.82rem' }}>
                <Heart size={14} />
                <span>Cardio Target Zone (HRmax = 203 bpm)</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {event.metadata.targetHeartRate}
              </p>
              {event.metadata.targetCadence && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  ⚡ Recommended cadence: <strong>{event.metadata.targetCadence}</strong>
                </p>
              )}
            </div>
          )}

          {/* Description & Protocol */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Protocol & Instructions
            </h4>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                padding: '12px',
                borderRadius: 'var(--radius-xs)',
                whiteSpace: 'pre-wrap',
                fontSize: '0.82rem',
                lineHeight: 1.55
              }}
            >
              {event.description}
            </div>
          </div>

          {/* Ultra-Trail Fueling & Hydration Calculator (Interactive) */}
          {isSport && event.durationMinutes >= 35 && (
            <div
              style={{
                background: 'rgba(255, 87, 34, 0.05)',
                border: '1px solid rgba(255, 87, 34, 0.25)',
                borderRadius: 'var(--radius-xs)',
                padding: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <Zap size={14} />
                  <span>QMT-80 Race Fueling & Hydration Calculator</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Target: {carbsPerHour}g carbs/hour
                </span>
              </div>

              {/* Fueling metrics strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>{totalCarbsG}g</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Total Carbs ({gelsEquivalent} gels)</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>{totalWaterMl} mL</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Hydration Fluid</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{totalSodiumMg} mg</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Sodium (Electrolytes)</div>
                </div>
              </div>

              {/* Mandatory Gear Checklist */}
              {mandatoryGearList.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={12} color="#10b981" /> Recommended Trail Gear Checklist:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {mandatoryGearList.map((item, idx) => {
                      const isChecked = Boolean(checkedGear[item]);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleGear(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            color: isChecked ? '#34d399' : 'var(--text-secondary)',
                            textDecoration: isChecked ? 'line-through' : 'none'
                          }}
                        >
                          {isChecked ? <CheckSquare size={13} color="#10b981" /> : <Square size={13} color="var(--text-muted)" />}
                          <span>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
