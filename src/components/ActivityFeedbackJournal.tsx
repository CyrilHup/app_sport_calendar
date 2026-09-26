import React, { useMemo, useState } from 'react';
import { ActivityFeedback, GarminActivity } from '../types/garmin';
import { effectiveActivityFeedback } from '../services/activityFeedback';
import { ActivityFeedbackEditor } from './ActivityFeedbackEditor';

export function ActivityFeedbackJournal({ activities, onSave }: {
  activities: GarminActivity[];
  onSave: (activityId: string, feedback: ActivityFeedback) => void;
}) {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return [...activities]
      .filter(activity => !term || `${activity.activityName} ${activity.activityType} ${activity.startTimeLocal}`
        .toLocaleLowerCase().includes(term))
      .sort((a, b) => Date.parse(b.startTimeLocal) - Date.parse(a.startTimeLocal));
  }, [activities, search]);
  const selected = activities.find(activity => activity.activityId === selectedId);

  return <details className="glass-panel" style={{ padding: 16 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Journal du ressenti · toutes les activités</summary>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
      Note aussi les séances de salle, de vélo ou non appariées au calendrier. Le RPE, la forme, la douleur et les notes sont privés.
    </p>
    <input aria-label="Rechercher une activité" type="search" placeholder="Chercher une activité ou une date"
      value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(20); }}
      style={{ width: '100%', boxSizing: 'border-box', margin: '8px 0', padding: 8,
        color: 'var(--text-primary)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 6 }} />
    <div style={{ display: 'grid', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
      {filtered.slice(0, visibleCount).map(activity => {
        const feedback = effectiveActivityFeedback(activity);
        return <button type="button" key={activity.activityId} onClick={() => setSelectedId(activity.activityId)}
          aria-pressed={selectedId === activity.activityId}
          style={{ textAlign: 'left', padding: 8, borderRadius: 6, cursor: 'pointer',
            color: 'var(--text-primary)', background: selectedId === activity.activityId ? 'rgba(59,130,246,0.15)' : 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)' }}>
          {new Date(activity.startTimeLocal).toLocaleDateString('fr-CA')} · {activity.activityName || activity.activityType}
          {' · '}{Math.round(activity.durationMinutes)} min
          {feedback.perceivedEffort !== undefined ? ` · RPE ${feedback.perceivedEffort}` : ' · RPE à noter'}
        </button>;
      })}
    </div>
    {filtered.length > visibleCount && <button type="button" className="btn-secondary" style={{ marginTop: 8 }}
      onClick={() => setVisibleCount(count => count + 20)}>Afficher 20 activités de plus</button>}
    {filtered.length === 0 && <p>Aucune activité trouvée.</p>}
    {selected && <div style={{ marginTop: 12 }}>
      <strong>{selected.activityName || selected.activityType} · {new Date(selected.startTimeLocal).toLocaleDateString('fr-CA')}</strong>
      <ActivityFeedbackEditor key={selected.activityId} activity={selected} onSave={onSave} />
    </div>}
  </details>;
}
