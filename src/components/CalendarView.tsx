import React, { useState } from 'react';
import { CalendarEvent, DailySchedule } from '../types/calendar';
import { ChevronLeft, ChevronRight, Filter, Clock, MapPin, ListFilter, LayoutGrid, Layers, Bus, CheckCircle2, ArrowRight } from 'lucide-react';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { WeatherWidget } from './WeatherWidget';

interface CalendarViewProps {
  schedules: DailySchedule[];
  allEvents: CalendarEvent[];
  onOpenGoogleCalendar?: () => void;
  referenceDateStr?: string;
}

type FilterCategory = 'all' | 'sport' | 'course' | 'trajet' | 'mobility';

export const CalendarView: React.FC<CalendarViewProps> = ({ schedules, onOpenGoogleCalendar, referenceDateStr }) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFusedMode, setIsFusedMode] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Découpage en blocs de 7 jours
  const currentWeekStartIdx = weekOffset * 7;
  const displayedDays = schedules.slice(
    Math.max(0, currentWeekStartIdx),
    Math.max(7, currentWeekStartIdx + 7)
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Clé du jour courant
  const todayKey = referenceDateStr || new Date().toISOString().slice(0, 10);

  // Compteurs pour la semaine affichée
  const currentWeekEvents = displayedDays.flatMap(d => d.events);
  const countAll = currentWeekEvents.length;
  const countSport = currentWeekEvents.filter(e => e.category === 'sport').length;
  const countCourse = currentWeekEvents.filter(e => e.category === 'course').length;
  const countTrajet = currentWeekEvents.filter(e => e.category === 'trajet').length;
  const countMobility = currentWeekEvents.filter(e => e.category === 'mobility').length;

  return (
    <div className="calendar-layout">
      {/* Contrôles de Vue & Filtres */}
      <div className="view-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            title="Semaine précédente"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            className="btn-secondary"
            onClick={() => setWeekOffset(0)}
            style={{ fontWeight: weekOffset === 0 ? 800 : 500 }}
          >
            Semaine Actuelle
          </button>

          <button
            className="btn-secondary"
            onClick={() => setWeekOffset(prev => prev + 1)}
            disabled={currentWeekStartIdx + 7 >= schedules.length}
            title="Semaine suivante"
          >
            <ChevronRight size={16} />
          </button>

          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
            {displayedDays.length > 0 && `${displayedDays[0].date} — ${displayedDays[displayedDays.length - 1].date}`}
          </span>

          {/* Bascule Mode Cartes Fusionnées */}
          <button
            onClick={() => setIsFusedMode(!isFusedMode)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 'var(--radius-xs)',
              border: isFusedMode ? '1px solid var(--primary-border)' : '1px solid var(--border-color)',
              background: isFusedMode ? 'var(--primary-subtle)' : 'rgba(255, 255, 255, 0.04)',
              color: isFusedMode ? 'var(--primary)' : 'var(--text-secondary)',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 4
            }}
            title="Basculer entre cartes fusionnées (cours + trajets intégrés) ou cartes séparées"
          >
            <Layers size={13} />
            <span>{isFusedMode ? 'Cartes Fusionnées : OUI' : 'Cartes Séparées'}</span>
          </button>

          {/* Bascule Mode d'Affichage (Grille vs Liste) */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-sm)', padding: 2, marginLeft: '6px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--primary-subtle)' : 'transparent',
                border: 'none',
                color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                padding: '5px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.74rem',
                fontWeight: 600
              }}
              title="Affichage en Grille Hebdomadaire"
            >
              <LayoutGrid size={13} /> Grille
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--primary-subtle)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
                padding: '5px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.74rem',
                fontWeight: 600
              }}
              title="Affichage en Liste Détaillée"
            >
              <ListFilter size={13} /> Liste
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
                color: 'var(--accent-blue)'
              }}
              title="Synchroniser avec Google Agenda"
            >
              <span>📅 Google Agenda</span>
            </button>
          )}
        </div>

        {/* Filtres par Catégorie */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={12} /> Filtrer :
          </span>

          <button
            className={`btn-secondary ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
            style={{ padding: '5px 9px', fontSize: '0.75rem', borderColor: filter === 'all' ? 'var(--primary)' : undefined }}
          >
            Tous ({countAll})
          </button>

          <button
            className={`btn-secondary ${filter === 'sport' ? 'active' : ''}`}
            onClick={() => setFilter('sport')}
            style={{ padding: '5px 9px', fontSize: '0.75rem', borderColor: filter === 'sport' ? 'var(--primary)' : undefined }}
          >
            🏔️ Séances ({countSport})
          </button>

          <button
            className={`btn-secondary ${filter === 'course' ? 'active' : ''}`}
            onClick={() => setFilter('course')}
            style={{ padding: '5px 9px', fontSize: '0.75rem', borderColor: filter === 'course' ? '#3b82f6' : undefined }}
          >
            🏛️ Cours ÉTS ({countCourse})
          </button>

          <button
            className={`btn-secondary ${filter === 'trajet' ? 'active' : ''}`}
            onClick={() => setFilter('trajet')}
            style={{ padding: '5px 9px', fontSize: '0.75rem', borderColor: filter === 'trajet' ? '#94a3b8' : undefined }}
          >
            🚌 Trajets ({countTrajet})
          </button>

          <button
            className={`btn-secondary ${filter === 'mobility' ? 'active' : ''}`}
            onClick={() => setFilter('mobility')}
            style={{ padding: '5px 9px', fontSize: '0.75rem', borderColor: filter === 'mobility' ? '#10b981' : undefined }}
          >
            🧘 Mobilité ({countMobility})
          </button>
        </div>
      </div>

      {/* Widget Météo & Sentiers du Mont-Royal */}
      <WeatherWidget />

      {/* Grille Hebdomadaire ou Vue Liste */}
      {viewMode === 'grid' ? (
        <div className="calendar-scroll-wrapper">
          <div className="week-grid">
            {displayedDays.map(day => {
              const dateObj = new Date(day.date + 'T12:00:00');
              const isToday = day.date === todayKey;

              const eventsToDisplay = day.events.filter(e => {
                if (filter !== 'all') return e.category === filter;
                if (isFusedMode) {
                  return e.category === 'sport' || e.category === 'course';
                }
                return true;
              });

              const mobilityEvent = day.events.find(e => e.category === 'mobility');

              return (
                <div key={day.date} className={`day-column ${isToday ? 'today' : ''}`}>
                  <div className="day-header">
                    <div>
                      <div className="day-name">{dayNames[day.dayOfWeek]}</div>
                      <div className="day-number">
                        {dateObj.getDate()}{' '}
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                          {dateObj.toLocaleDateString('fr-CA', { month: 'short' })}
                        </span>
                      </div>
                    </div>
                    {isToday && <span className="today-indicator">Aujourd'hui</span>}
                  </div>

                  {/* Séances et cours du jour */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {eventsToDisplay.length === 0 && (!isFusedMode || !mobilityEvent) ? (
                      <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Repos / Aucun événement
                      </div>
                    ) : (
                      eventsToDisplay.map(ev => {
                        const hasAller = ev.metadata?.commuteAller;
                        const hasRetour = ev.metadata?.commuteRetour;

                        return (
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
                                {formatTime(ev.startDate)} – {formatTime(ev.endDate)}
                              </span>
                              <span>•</span>
                              <span>{ev.durationMinutes}m</span>
                              {ev.metadata?.room && (
                                <span style={{ color: ev.metadata?.isDistanciel ? 'var(--accent-purple)' : 'var(--accent-blue)', fontWeight: 600 }}>
                                  <MapPin size={10} style={{ display: 'inline', marginRight: 2 }} />
                                  {ev.metadata.room}
                                </span>
                              )}
                            </div>

                            {ev.metadata?.targetHeartRate && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>
                                ❤️ {ev.metadata.targetHeartRate}
                              </div>
                            )}

                            {ev.metadata?.targetElevationM && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--accent-orange)', fontWeight: 600 }}>
                                ⛰️ +{ev.metadata.targetElevationM}m D+
                              </div>
                            )}

                            {ev.metadata?.conflictRescheduled && (
                              <div style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span>🔄 Décalé pour cours</span>
                              </div>
                            )}

                            {/* Bandeau de Trajet Intégré (Aller / Retour) */}
                            {isFusedMode && (hasAller || hasRetour) && (
                              <div className="journey-strip">
                                <Bus size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                <span>
                                  {hasAller && `Départ : ${formatTime(hasAller.departureTime)} (${hasAller.durationMinutes}m)`}
                                  {hasAller && hasRetour && ' • '}
                                  {hasRetour && `Retour ~${formatTime(hasRetour.arrivalTime)}`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Indicateur compact de mobilité du soir */}
                  {isFusedMode && mobilityEvent && filter === 'all' && (
                    <div
                      className="mobility-daily-chip"
                      onClick={() => setSelectedEvent(mobilityEvent)}
                      title="20 min d'étirements et de mobilité du soir"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🧘</span>
                        <span>Mobilité 22h00 (20m)</span>
                      </div>
                      <CheckCircle2 size={12} color="#10b981" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Vue Liste Détaillée */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedDays.map(day => {
            const dateObj = new Date(day.date + 'T12:00:00');
            const isToday = day.date === todayKey;
            const filteredEvents = day.events.filter(e => filter === 'all' || e.category === filter);

            return (
              <div
                key={day.date}
                className="glass-panel"
                style={{
                  padding: '14px 18px',
                  borderLeft: isToday ? '4px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isToday ? 'rgba(255, 87, 34, 0.04)' : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1rem' }}>
                      {dayNames[day.dayOfWeek]}, {dateObj.toLocaleDateString('fr-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    {isToday && <span className="today-indicator">Aujourd'hui</span>}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {filteredEvents.length} événement(s)
                  </span>
                </div>

                {filteredEvents.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Repos / Aucun événement prévu.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                    {filteredEvents.map(ev => (
                      <div
                        key={ev.id}
                        className={`event-card ${ev.category}`}
                        onClick={() => setSelectedEvent(ev)}
                        style={{ padding: '10px 12px' }}
                      >
                        <div className="event-title" style={{ fontSize: '0.84rem' }}>
                          <span>{ev.emoji}</span>
                          <span>{ev.title}</span>
                        </div>
                        <div className="event-meta" style={{ fontSize: '0.74rem' }}>
                          <span>
                            <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {formatTime(ev.startDate)} – {formatTime(ev.endDate)} ({ev.durationMinutes}m)
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} /> {ev.location}
                        </div>

                        {ev.metadata?.commuteAller && (
                          <div className="journey-strip">
                            <Bus size={11} />
                            <span>Trajet : {formatTime(ev.metadata.commuteAller.departureTime)} ➔ {formatTime(ev.metadata.commuteAller.arrivalTime)} ({ev.metadata.commuteAller.durationMinutes}m)</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale de Détail de Séance */}
      <WorkoutDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};
