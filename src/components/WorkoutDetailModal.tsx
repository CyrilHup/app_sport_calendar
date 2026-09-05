import React, { useState } from 'react';
import { CalendarEvent } from '../types/calendar';
import { CheckSquare, Clock, Compass, Heart, MapPin, ShieldCheck, Square, X, Zap } from 'lucide-react';

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
    d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Calculateur Nutrition & Hydratation Ultra-Trail
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
    mandatoryGearList.push(`${Math.ceil(totalWaterMl / 500)}x 500 mL Flasques souples avec électrolytes`);
    mandatoryGearList.push(`Nutrition énergétique : ~${totalCarbsG}g de glucides (${gelsEquivalent} gels / barres)`);
    mandatoryGearList.push('Téléphone cellulaire chargé avec trace GPX téléchargée');
  }
  if (isLongTrail || event.durationMinutes >= 90) {
    mandatoryGearList.push('Couverture de survie (1,4m x 2m) + sifflet de sécurité (obligatoire QMT-80)');
    mandatoryGearList.push('Veste imperméable respirante à coutures étanches (10 000 Schmerber min)');
    mandatoryGearList.push('Gobelet réutilisable / Ecocup (aucun gobelet jetable aux ravitaillements)');
    mandatoryGearList.push('Bâtons pliables carbone (rangement sur le sac obligatoire pour le Mestachibo)');
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
          {/* Barre Horaires & Lieu */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> Horaires
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {formatTime(startDate)} – {formatTime(endDate)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)' }}>
                {event.durationMinutes} minutes
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> Lieu
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {event.location}
              </div>
              {event.metadata?.room && (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                  Local : {event.metadata.room}
                </span>
              )}
            </div>

            {event.metadata?.targetElevationM && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Compass size={11} /> Objectif D+
                </span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', marginTop: 3 }}>
                  +{event.metadata.targetElevationM} m
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Dénivelé Ultra-Trail
                </span>
              </div>
            )}
          </div>

          {/* Bandeau de Conflit d'Horaire Résolu */}
          {event.metadata?.conflictRescheduled && event.metadata.conflictReason && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', fontSize: '0.78rem', color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>🔄</span>
              <div>
                <strong>Décalage Intelligent :</strong> {event.metadata.conflictReason}
              </div>
            </div>
          )}

          {/* Cibles Cardiaques & Physiologiques */}
          {event.metadata?.targetHeartRate && (
            <div style={{ background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, marginBottom: '4px', fontSize: '0.82rem' }}>
                <Heart size={14} />
                <span>Zone Cardiaque Cible (FCmax = 203 bpm)</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {event.metadata.targetHeartRate}
              </p>
              {event.metadata.targetCadence && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  ⚡ Cadence recommandée : <strong>{event.metadata.targetCadence}</strong>
                </p>
              )}
            </div>
          )}

          {/* Description & Protocole */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Protocole & Consignes de Séance
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

          {/* Calculateur de Ravitaillement & Hydratation QMT-80 */}
          {isSport && event.durationMinutes >= 35 && (
            <div
              style={{
                background: 'rgba(255, 87, 34, 0.05)',
                border: '1px solid rgba(255, 87, 34, 0.25)',
                borderRadius: 'var(--radius-xs)',
                padding: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <Zap size={14} />
                  <span>Calculateur Nutrition & Hydratation Ultra-Trail (QMT-80)</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Cible : {carbsPerHour}g de glucides/heure
                </span>
              </div>

              {/* Métriques nutritionnelles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>{totalCarbsG}g</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Glucides ({gelsEquivalent} gels)</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>{totalWaterMl} mL</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Volume d'Eau</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 4px', borderRadius: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{totalSodiumMg} mg</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Sodium (Électrolytes)</div>
                </div>
              </div>

              {/* Checklist Matériel */}
              {mandatoryGearList.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={12} color="#10b981" /> Checklist Matériel Recommandé :
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
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
