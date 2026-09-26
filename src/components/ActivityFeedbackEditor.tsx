import React, { useEffect, useState } from 'react';
import { ActivityFeedback, GarminActivity, SubjectiveFeeling } from '../types/garmin';
import { effectiveActivityFeedback } from '../services/activityFeedback';

const feelings: { value: SubjectiveFeeling; label: string }[] = [
  { value: 'VERY_WEAK', label: 'Très faible' },
  { value: 'WEAK', label: 'Faible' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'STRONG', label: 'Fort' },
  { value: 'VERY_STRONG', label: 'Très fort' }
];

export function ActivityFeedbackEditor({ activity, onSave }: {
  activity: GarminActivity;
  onSave?: (activityId: string, feedback: ActivityFeedback) => void;
}) {
  const feedback = effectiveActivityFeedback(activity);
  const [rpe, setRpe] = useState(feedback.perceivedEffort?.toString() || '');
  const [feeling, setFeeling] = useState(feedback.feeling || '');
  const [pain, setPain] = useState(feedback.pain?.toString() || '');
  const [notes, setNotes] = useState(feedback.notes || '');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const latest = effectiveActivityFeedback(activity);
    setRpe(latest.perceivedEffort?.toString() || '');
    setFeeling(latest.feeling || '');
    setPain(latest.pain?.toString() || '');
    setNotes(latest.notes || '');
    setSaved(false);
  }, [activity.activityId]);

  const inputStyle: React.CSSProperties = { color: 'var(--text-primary)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '5px 7px' };
  const canSave = (!rpe || (Number(rpe) >= 1 && Number(rpe) <= 10)) &&
    (!pain || (Number.isInteger(Number(pain)) && Number(pain) >= 0 && Number(pain) <= 10));
  return <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
    <strong>Ressenti après séance</strong>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      <label>RPE (1–10) <input aria-label="RPE de la séance" style={{ ...inputStyle, width: 65 }} type="number" min="1" max="10" step="1" value={rpe} onChange={e => { setRpe(e.target.value); setSaved(false); }} /></label>
      <label>Forme ressentie <select aria-label="Forme ressentie" style={inputStyle} value={feeling} onChange={e => { setFeeling(e.target.value as SubjectiveFeeling | ''); setSaved(false); }}>
        <option value="">Non renseignée</option>{feelings.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
      <label>Douleur (0–10) <input aria-label="Douleur ressentie" style={{ ...inputStyle, width: 65 }} type="number" min="0" max="10" step="1" value={pain} onChange={e => { setPain(e.target.value); setSaved(false); }} /></label>
    </div>
    <label style={{ display: 'block', marginTop: 8 }}>Notes personnelles
      <textarea aria-label="Notes personnelles de la séance" style={{ ...inputStyle, display: 'block', width: '100%', boxSizing: 'border-box' }} maxLength={2000} rows={2} value={notes} onChange={e => { setNotes(e.target.value); setSaved(false); }} />
    </label>
    {rpe && canSave && <small>Charge ressentie : {Math.round(activity.durationMinutes * Number(rpe))} unités (durée × RPE), distincte du TRIMP.</small>}
    {onSave && <button type="button" disabled={!canSave} onClick={() => { onSave(activity.activityId, {
      perceivedEffort: rpe ? Number(rpe) : undefined,
      feeling: feeling as SubjectiveFeeling || undefined,
      pain: pain ? Number(pain) : undefined,
      notes
    }); setSaved(true); }} style={{ display: 'block', marginTop: 8 }}>Enregistrer le ressenti</button>}
    {saved && <small role="status">Ressenti enregistré sur cet appareil ; synchronisation privée en cours si vous êtes connecté.</small>}
  </div>;
}
