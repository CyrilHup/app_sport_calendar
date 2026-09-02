import React, { useState } from 'react';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { ChevronLeft, ChevronRight, Filter, Clock, MapPin, ListFilter, LayoutGrid } from 'lucide-react';
import { WorkoutDetailModal } from './WorkoutDetailModal';

interface CalendarViewProps {
  schedules: DailySchedule[];
  allEvents: CalendarEvent[];
  onOpenGoogleCalendar?: () => void;
}

type FilterCategory = 'all' | 'sport' | 'course' | 'trajet' | 'mobility';

export const CalendarView: React.FC<CalendarViewProps> = ({ schedules, onOpenGoogleCalendar }) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Group schedules into weeks of 7 days
  const currentWeekStartIdx = weekOffset * 7;
  const displayedDays = schedules.slice(
    Math.max(0, currentWeekStartIdx),
    Math.max(7, currentWeekStartIdx + 7)
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Event counts for current displayed week
  const currentWeekEvents = displayedDays.flatMap(d => d.events);
  const countAll = currentWeekEvents.length;
  const countSport = currentWeekEvents.filter(e => e.category === 'sport').length;
  const countCourse = currentWeekEvents.filter(e => e.category === 'course').length;
  const countTrajet = currentWeekEvents.filter(e => e.category === 'trajet').length;
  const countMobility = currentWeekEvents.filter(e => e.category === 'mobility').length;

  return (
    <div className="calendar-layout">
      {/* View & Filter Controls */}
      <div className="view-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            title="Previous week"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn-secondary"
            onClick={() => setWeekOffset(0)}
            style={{ fontWeight: weekOffset === 0 ? 800 : 500 }}
          >
            Current Week
          </button>

          <button
            className="btn-secondary"
            onClick={() => setWeekOffset(prev => prev + 1)}
            disabled={currentWeekStartIdx + 7 >= schedules.length}
            title="Next week"
          >
            <ChevronRight size={16} />
          </button>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
            {displayedDays.length > 0 && `${displayedDays[0].date} to ${displayedDays[displayedDays.length - 1].date}`}
          </span>

          {/* View mode toggle (Grid vs List) */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-sm)', padding: 2, marginLeft: '8px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                border: 'none',
                color: viewMode === 'grid' ? 'var(--cyan)' : 'var(--text-secondary)',
                padding: '5px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="7-Day Grid View"
            >
              <LayoutGrid size={13} /> Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? 'var(--cyan)' : 'var(--text-secondary)',
                padding: '5px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="Detailed List View"
            >
              <ListFilter size={13} /> List
            </button>
          </div>

          {onOpenGoogleCalendar && (
            <button
              className="btn-secondary"
              onClick={onOpenGoogleCalendar}
              style={{
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: 'rgba(66, 133, 244, 0.4)',
                background: 'rgba(66, 133, 244, 0.08)',
                color: '#60a5fa'
              }}
              title="Sync with Google Calendar"
            >
              <span>📅 Google Calendar Sync</span>
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={13} /> Filter:
          </span>

          <button
            className={`btn-secondary ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', borderColor: filter === 'all' ? '#00f2fe' : undefined }}
          >
            ✨ All ({countAll})
          </button>

          <button
            className={`btn-secondary ${filter === 'sport' ? 'active' : ''}`}
            onClick={() => setFilter('sport')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', borderColor: filter === 'sport' ? '#ff6b35' : undefined }}
          >
            🏔️ Sport ({countSport})
          </button>

          <button
            className={`btn-secondary ${filter === 'course' ? 'active' : ''}`}
            onClick={() => setFilter('course')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', borderColor: filter === 'course' ? '#3b82f6' : undefined }}
          >
            🏛️ ÉTS Classes ({countCourse})
          </button>

          <button
            className={`btn-secondary ${filter === 'trajet' ? 'active' : ''}`}
            onClick={() => setFilter('trajet')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', borderColor: filter === 'trajet' ? '#94a3b8' : undefined }}
          >
            🚌 Commutes ({countTrajet})
          </button>

          <button
            className={`btn-secondary ${filter === 'mobility' ? 'active' : ''}`}
            onClick={() => setFilter('mobility')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', borderColor: filter === 'mobility' ? '#06d6a0' : undefined }}
          >
            🧘 Mobility ({countMobility})
          </button>
        </div>
      </div>

      {/* Week Grid or List View */}
      {viewMode === 'grid' ? (
        <div className="calendar-scroll-wrapper">
          <div className="week-grid">
            {displayedDays.map(day => {
              const dateObj = new Date(day.date + 'T12:00:00');
              const isToday = day.date === '2026-09-02'; // Reference day
              const filteredEvents = day.events.filter(e => filter === 'all' || e.category === filter);

              return (
                <div key={day.date} className={`day-column ${isToday ? 'today' : ''}`}>
                  <div className="day-header">
                    <div>
                      <div className="day-name">{dayNames[day.dayOfWeek]}</div>
                      <div className="day-number">
                        {dateObj.getDate()}{' '}
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                          {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                      </div>
                    </div>
                    {isToday && <span className="today-indicator">Today</span>}
                  </div>

                  {/* Day workouts / courses / commutes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {filteredEvents.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No events
                      </div>
                    ) : (
                      filteredEvents.map(ev => (
                        <div
                          key={ev.id}
                          className={`event-card ${ev.category}`}
                          onClick={() => setSelectedEvent(ev)}
                          title={`${ev.title}\n${ev.location}\n${ev.durationMinutes} min`}
                        >
                          <div className="event-title">
                            <span>{ev.emoji}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.title.replace(/^[^a-zA-Z0-9\[]*/, '')}
                            </span>
                          </div>

                          <div className="event-meta">
                            <span>
                              <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                              {formatTime(ev.startDate)} - {formatTime(ev.endDate)}
                            </span>
                            <span>•</span>
                            <span>{ev.durationMinutes}m</span>
                          </div>

                          {ev.metadata?.targetHeartRate && (
                            <div style={{ fontSize: '0.68rem', color: '#f72585', fontWeight: 600 }}>
                              HR: {ev.metadata.targetHeartRate}
                            </div>
                          )}

                          {ev.metadata?.targetElevationM && (
                            <div style={{ fontSize: '0.68rem', color: '#ff6b35', fontWeight: 600 }}>
                              +{ev.metadata.targetElevationM} m D+
                            </div>
                          )}

                          {ev.metadata?.room && (
                            <div style={{ fontSize: '0.68rem', color: ev.metadata?.isDistanciel ? '#a855f7' : '#60a5fa', fontWeight: 600 }}>
                              <MapPin size={10} style={{ display: 'inline', marginRight: 2 }} />
                              {ev.metadata.room}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detailed List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayedDays.map(day => {
            const dateObj = new Date(day.date + 'T12:00:00');
            const isToday = day.date === '2026-09-02';
            const filteredEvents = day.events.filter(e => filter === 'all' || e.category === filter);

            return (
              <div
                key={day.date}
                className="glass-panel"
                style={{
                  padding: '14px 18px',
                  borderLeft: isToday ? '4px solid var(--cyan)' : '1px solid var(--border-color)',
                  background: isToday ? 'rgba(0, 242, 254, 0.04)' : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.05rem' }}>
                      {dayNames[day.dayOfWeek]}, {dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    {isToday && <span className="today-indicator">Today</span>}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {filteredEvents.length} event(s)
                  </span>
                </div>

                {filteredEvents.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No events matching current filter.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
                    {filteredEvents.map(ev => (
                      <div
                        key={ev.id}
                        className={`event-card ${ev.category}`}
                        onClick={() => setSelectedEvent(ev)}
                        style={{ padding: '10px 12px' }}
                      >
                        <div className="event-title" style={{ fontSize: '0.85rem' }}>
                          <span>{ev.emoji}</span>
                          <span>{ev.title}</span>
                        </div>
                        <div className="event-meta" style={{ fontSize: '0.75rem' }}>
                          <span>
                            <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {formatTime(ev.startDate)} - {formatTime(ev.endDate)} ({ev.durationMinutes} min)
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} /> {ev.location}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <WorkoutDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};
