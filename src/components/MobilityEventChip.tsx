import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CalendarEvent } from '../types/calendar';
import { formatTime } from '../services/dateUtils';

interface MobilityEventChipProps {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
  variant?: 'grid' | 'day' | 'list';
}

export function getMobilityEventLabel(event: CalendarEvent): string {
  const time = formatTime(event.startDate);
  const duration = Number.isFinite(event.durationMinutes) && event.durationMinutes > 0
    ? ` (${event.durationMinutes}m)`
    : '';
  return `${event.title}${time ? ` ${time}` : ''}${duration}`;
}

export const MobilityEventChip: React.FC<MobilityEventChipProps> = ({ event, onSelect, variant = 'grid' }) => (
  <button
    type="button"
    className="mobility-daily-chip"
    onClick={() => onSelect(event)}
    title={event.description || event.title}
    style={variant === 'list'
      ? { padding: '10px 12px', fontSize: '0.78rem' }
      : variant === 'day'
        ? { padding: '8px 12px', fontSize: '0.75rem' }
        : undefined}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{getMobilityEventLabel(event)}</span>
    </span>
    <CheckCircle2 size={13} color="#10b981" />
  </button>
);
