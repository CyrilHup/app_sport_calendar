import React from 'react';
import { CalendarEvent } from '../types/calendar';
import { Clock, Compass, Heart, MapPin, X, Zap } from 'lucide-react';

interface WorkoutDetailModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
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

        <div className="modal-body">
          {/* Timing & Location Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> Schedule
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 3 }}>
                {formatTime(startDate)} - {formatTime(endDate)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--cyan)' }}>
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
                <span style={{ fontSize: '0.72rem', color: '#ff6b35' }}>
                  Room: {event.metadata.room}
                </span>
              )}
            </div>

            {event.metadata?.targetElevationM && (
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Compass size={11} /> Target D+
                </span>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ff6b35', marginTop: 3 }}>
                  +{event.metadata.targetElevationM} m
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Ultra-Trail Climbing
                </span>
              </div>
            )}
          </div>

          {/* Cardio & Physiological Targets */}
          {event.metadata?.targetHeartRate && (
            <div style={{ background: 'rgba(247, 37, 133, 0.08)', border: '1px solid rgba(247, 37, 133, 0.25)', padding: '12px', borderRadius: 'var(--radius-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f72585', fontWeight: 700, marginBottom: '4px', fontSize: '0.82rem' }}>
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

          {/* Nutrition Advice */}
          {event.metadata?.nutritionAdvice && (
            <div style={{ background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', padding: '10px', borderRadius: 'var(--radius-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cyan)', fontWeight: 700, fontSize: '0.8rem' }}>
                <Zap size={14} />
                <span>Ultra-Trail Nutrition Strategy</span>
              </div>
              <p style={{ fontSize: '0.78rem', marginTop: '3px' }}>
                {event.metadata.nutritionAdvice}
              </p>
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
