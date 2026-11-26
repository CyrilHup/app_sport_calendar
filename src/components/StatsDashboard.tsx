import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Clock, Footprints, Mountain, CalendarDays } from 'lucide-react';
import type { CalendarEvent } from '../types/calendar';
import type { ActivityComparison, ActivityFeedback, GarminActivity, GarminWellnessData } from '../types/garmin';
import { ActivityFeedbackJournal } from './ActivityFeedbackJournal';
import {
  activityMetrics, activitySport, activitySports, buildActivityWeeks, buildPlanWeeks,
  buildTrainingReview, describeDateRange, formatTrainingDuration as duration, groupActivitiesByDay, measuredTotal, sumActivityMetrics
} from '../services/activityProgress';
import type { ActivityMetric, ActivitySport, PlanWeek } from '../services/activityProgress';
import { addDays, formatDateKey, getGarminLocalDateKey, getMondayOfWeek, parseLocalDate } from '../services/dateUtils';
import { getSyncedWeekWorkoutSignatures } from '../services/garminAutoSyncService';
import './StatsDashboard.css';

interface StatsDashboardProps {
  garminActivities: GarminActivity[];
  comparisons: ActivityComparison[];
  allEvents: CalendarEvent[];
  referenceDate: Date;
  wellness?: GarminWellnessData;
  onSaveActivityFeedback?: (activityId: string, feedback: ActivityFeedback) => void;
}

const shortDate = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' });
const fullDate = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('fr-CA', { month: 'short' });
const decimal = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });
const dayLabels = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const metricThresholds = {
  minutes: { day: [30, 60, 120], week: [60, 180, 360] },
  distance: { day: [3, 8, 16], week: [10, 25, 50] },
  elevation: { day: [100, 300, 600], week: [200, 750, 1500] },
  sessions: { day: [2, 3, 4], week: [2, 4, 6] }
};

function formatMetric(metric: ActivityMetric, value: number): string {
  switch (metric) {
    case 'minutes': return duration(value);
    case 'distance': return `${decimal.format(value)} km`;
    case 'elevation': return `${integer.format(value)} m`;
    case 'sessions': return `${value} séance${value === 1 ? '' : 's'}`;
  }
}

function calendarMeasurement(activities: GarminActivity[], metric: ActivityMetric) {
  if (metric === 'distance' || metric === 'elevation') {
    return measuredTotal(activities, metric === 'distance' ? 'distanceKm' : 'elevationGainM');
  }
  return { total: sumActivityMetrics(activities)[metric], measured: activities.length };
}

function getPlanTotals(week: PlanWeek) {
  const targets = week.planned.flatMap(event => event.metadata?.targetElevationM ?? []);
  return {
    plannedMinutes: week.planned.reduce((total, event) => total + event.durationMinutes, 0),
    plannedElevation: targets.length ? targets.reduce((total, value) => total + value, 0) : undefined,
    recorded: sumActivityMetrics(week.recorded),
    elevation: measuredTotal(week.recorded, 'elevationGainM')
  };
}

function PlanProgress({ garminActivities, allEvents, comparisons, referenceDate }: StatsDashboardProps) {
  const [offset, setOffset] = useState(0);
  const [selectedStart, setSelectedStart] = useState<string>();
  const [chartMetric, setChartMetric] = useState<'minutes' | 'elevation'>('minutes');
  const weeks = useMemo(() => buildPlanWeeks(garminActivities, allEvents, comparisons, referenceDate, offset,
    getSyncedWeekWorkoutSignatures()), [garminActivities, allEvents, comparisons, referenceDate, offset]);
  const week = weeks.find(candidate => candidate.start === selectedStart) ?? weeks[weeks.length - 1];
  const totals = weeks.map(getPlanTotals);
  const chartValues = totals.map(total => chartMetric === 'minutes'
    ? [total.plannedMinutes, total.recorded.minutes] as const
    : [total.plannedElevation, total.elevation.total] as const);
  const chartMax = Math.max(1, ...chartValues.flatMap(values => values.map(value => value ?? 0)));
  const { plannedMinutes, plannedElevation, recorded, elevation } = totals[weeks.indexOf(week)];
  const currentWeek = offset === 0 && week === weeks[weeks.length - 1];
  const hasPrevious = allEvents.some(event => event.category === 'sport' &&
    formatDateKey(new Date(event.startDate)) < weeks[0].start) ||
    garminActivities.some(activity => activitySport(activity) === 'running' && getGarminLocalDateKey(activity) < weeks[0].start);

  return (
    <section className="surface-panel progress-panel progress-plan" aria-labelledby="progress-plan-heading">
      <div className="progress-section-head">
        <div>
          <h2 id="progress-plan-heading">Course et trail · prévu / réalisé</h2>
          <p>{describeDateRange(week.start, week.end)}{currentWeek && ' · semaine en cours'}</p>
        </div>
        <div className="progress-chart-controls">
          <div className="progress-legend" aria-label="Légende">
            <span><i className="progress-plan-key" /> Prévu</span>
            <span><i className="progress-actual-key" /> Réalisé</span>
          </div>
          <div className="progress-pager" aria-label="Période du suivi du plan">
            <button type="button" aria-label="Huit semaines précédentes" disabled={!hasPrevious}
              onClick={() => setOffset(offset + 8)}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Huit semaines suivantes" disabled={offset === 0}
              onClick={() => setOffset(offset - 8)}><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
      <div className="progress-view-switch progress-chart-mode" role="group" aria-label="Mesure du graphique">
        <button type="button" aria-pressed={chartMetric === 'minutes'} onClick={() => setChartMetric('minutes')}>Temps</button>
        <button type="button" aria-pressed={chartMetric === 'elevation'} onClick={() => setChartMetric('elevation')}>Dénivelé +</button>
      </div>
      <div className="progress-plan-body">
        <div className="progress-chart" role="group" aria-label={`${activityMetrics[chartMetric]} de course sur huit semaines`}>
          {weeks.map((item, index) => {
            const [target, actual] = chartValues[index];
            const { elevation } = totals[index];
            const coverage = chartMetric === 'elevation' && elevation.measured > 0 && elevation.measured < item.recorded.length
              ? ` · ${elevation.measured}/${item.recorded.length} sorties mesurées` : '';
            const label = `${describeDateRange(item.start, item.end)} · prévu ${target === undefined ? 'sans cible' : formatMetric(chartMetric, target)}, réalisé ${actual === undefined ? 'sans mesure' : formatMetric(chartMetric, actual)}${coverage}`;
            return (
              <button key={item.start} type="button" className="progress-chart-week" aria-pressed={item === week}
                aria-label={label} title={label} onClick={() => setSelectedStart(item.start)}>
                <span className="progress-chart-bars" aria-hidden="true">
                  <i className="progress-plan-key" hidden={!target} style={{ height: `${(target ?? 0) / chartMax * 100}%` }} />
                  <i className="progress-actual-key" hidden={!actual} style={{ height: `${(actual ?? 0) / chartMax * 100}%` }} />
                </span>
                <span>{shortDate.format(parseLocalDate(item.start))}</span>
              </button>
            );
          })}
        </div>
        <dl className="progress-plan-values" aria-live="polite">
          <div>
            <dt>Temps de course</dt>
            <dd>{duration(recorded.minutes)} <span>/ {plannedMinutes ? duration(plannedMinutes) : '—'}</span></dd>
          </div>
          <div>
            <dt>Dénivelé +</dt>
            <dd>{elevation.total === undefined ? '—' : formatMetric('elevation', elevation.total)}
              {' '}<span>/ {plannedElevation === undefined ? '—' : formatMetric('elevation', plannedElevation)}</span>
              {elevation.measured > 0 && elevation.measured < recorded.sessions &&
                <small className="progress-coverage">{elevation.measured}/{recorded.sessions} sorties mesurées</small>}
            </dd>
          </div>
          <div>
            <dt>Séances prévues liées</dt>
            <dd>{week.planned.length ? <>{week.matched.size} <span>/ {week.planned.length}</span></> : '—'}</dd>
          </div>
        </dl>
      </div>
      <p className="progress-note">La semaine en cours compare les cibles jusqu’à aujourd’hui. Le réalisé inclut les sorties libres.</p>
      {week.planned.length > 0 && (
        <details className="progress-disclosure">
          <summary>Voir les séances prévues</summary>
          <ul className="progress-session-list">
            {week.planned.map(event => {
              const comparison = week.matched.get(event.id);
              const actual = comparison?.actualActivity;
              const plannedDay = formatDateKey(new Date(event.startDate));
              const heartRateRange = event.metadata?.targetHeartRateRange;
              return (
                <li key={event.id}>
                  <span><strong>{event.title.replace(/^[^\p{L}\p{N}]+/u, '')}</strong>
                    <small>{shortDate.format(parseLocalDate(plannedDay))}
                      {comparison?.isPostponedCatchup && comparison.executedDate &&
                        ` · réalisée le ${shortDate.format(parseLocalDate(comparison.executedDate))}`}
                    </small>
                    <small>{week.published.has(event.id) ? 'Cible publiée sur Garmin' : 'Cible du plan actuel'}</small>
                  </span>
                  <span className="progress-session-values">
                    <span>{actual ? `${duration(actual.durationMinutes)} / ${duration(event.durationMinutes)}` :
                      `${duration(event.durationMinutes)} prévues · aucune sortie liée`}</span>
                    {heartRateRange && <small>FC moy. {actual?.avgHeartRate ?? '—'} · cible {heartRateRange.join('–')} bpm</small>}
                    {event.metadata?.targetElevationM != null && <small>D+ {actual?.elevationGainM ?? '—'} / {event.metadata.targetElevationM} m</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

function ActivityCalendar({ activities, referenceDate }: { activities: GarminActivity[]; referenceDate: Date }) {
  const [sport, setSport] = useState<ActivitySport>('all');
  const [metric, setMetric] = useState<ActivityMetric>('minutes');
  const [view, setView] = useState<'day' | 'week'>('day');
  const [count, setCount] = useState(12);
  const [offset, setOffset] = useState(0);
  const [activeDate, setActiveDate] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = formatDateKey(referenceDate);
  const currentMonday = formatDateKey(getMondayOfWeek(referenceDate));
  const weeks = useMemo(() => buildActivityWeeks(parseLocalDate(today), count, offset), [today, count, offset]);
  const byDay = useMemo(() => groupActivitiesByDay(
    activities.filter(activity => sport === 'all' || activitySport(activity) === sport)
  ), [activities, sport]);
  const dates = weeks.flat().filter(day => day <= today);
  const allVisible = dates.flatMap(day => byDay.get(day) ?? []);
  const start = dates[0];
  const end = dates[dates.length - 1];
  const latestRecordedDate = dates.reduce((last, day) => byDay.has(day) ? day : last, '');
  const candidate = activeDate && activeDate >= start && activeDate <= end ? activeDate : (latestRecordedDate || end);
  const selected = view === 'day' ? candidate : formatDateKey(getMondayOfWeek(parseLocalDate(candidate)));
  const mostRecent = weeks[weeks.length - 1][0];
  const earliestActivity = [...byDay.keys()].reduce((earliest, day) => day < earliest ? day : earliest, today);
  const canGoBack = earliestActivity < start;
  const cutoffs = metricThresholds[metric][view];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [start, view]);

  const details = (view === 'day' ? byDay.get(selected) ?? [] : Array.from({ length: 7 }, (_, index) =>
    formatDateKey(addDays(parseLocalDate(selected), index)))
    .filter(day => day <= today).flatMap(day => byDay.get(day) ?? []))
    .slice().sort((a, b) => b.startTimeLocal.localeCompare(a.startTimeLocal));
  const selectedMetric = calendarMeasurement(details, metric);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const moves: Record<string, number> = view === 'day'
      ? { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
      : { ArrowLeft: -7, ArrowRight: 7 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = formatDateKey(addDays(parseLocalDate(day), moves[event.key]));
    const button = scrollRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${next}"]`);
    if (button) {
      setActiveDate(next);
      button.focus();
    }
  };

  function cell(day: string, cellEnd = day) {
    if (day > today) return <span className="progress-cell progress-cell-future" key={day} />;
    const entries = view === 'day' ? byDay.get(day) ?? [] :
      Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(parseLocalDate(day), index)))
        .filter(date => date <= today).flatMap(date => byDay.get(date) ?? []);
    const measurement = calendarMeasurement(entries, metric);
    const value = measurement.total ?? 0;
    const missing = entries.length > 0 && measurement.total === undefined;
    const level = value > 0 ? 1 + cutoffs.filter(cutoff => value >= cutoff).length : 0;
    const heading = view === 'day' ? fullDate.format(parseLocalDate(day)) : describeDateRange(day, cellEnd);
    const coverage = measurement.measured < entries.length ? ` · ${measurement.measured}/${entries.length} activités mesurées` : '';
    const label = `${heading} · ${missing ? 'sans mesure' : formatMetric(metric, value)}${coverage}`;
    return (
      <button type="button" className="progress-cell" key={day} data-level={level} data-day={day} data-missing={missing || undefined}
        tabIndex={day === selected ? 0 : -1} aria-pressed={day === selected} aria-label={label}
        title={label} onClick={() => setActiveDate(day)} onKeyDown={event => moveFocus(event, day)} />
    );
  }

  return (
    <section className="surface-panel progress-panel progress-activity" aria-labelledby="progress-activity-heading">
      <div className="progress-section-head">
        <div>
          <h2 id="progress-activity-heading">Calendrier d’activité</h2>
          <p>{describeDateRange(start, end)} · {offset === 0 ? 'période actuelle' : 'historique'}</p>
        </div>
        <div className="progress-pager" aria-label="Période du calendrier">
          <button type="button" title="Période précédente" aria-label="Période précédente" disabled={!canGoBack}
            onClick={() => { setOffset(offset + count); setActiveDate(undefined); }}><ChevronLeft size={18} /></button>
          <button type="button" title="Période suivante" aria-label="Période suivante" disabled={offset === 0}
            onClick={() => { setOffset(Math.max(0, offset - count)); setActiveDate(undefined); }}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="progress-kpis">
        {([
          ['minutes', Clock], ['distance', Footprints], ['elevation', Mountain], ['sessions', CalendarDays]
        ] as const).map(([key, Icon]) => {
          const { total, measured } = calendarMeasurement(allVisible, key);
          const value = total !== undefined && (allVisible.length || key === 'sessions') ? formatMetric(key, total) : '—';
          return <div key={key}>
            <span><Icon aria-hidden="true" size={16} strokeWidth={1.5} /> {activityMetrics[key]}</span>
            <strong>{value}</strong>
            {measured > 0 && measured < allVisible.length &&
              <small className="progress-coverage">{measured}/{allVisible.length} activités mesurées</small>}
          </div>;
        })}
      </div>
      <div className="progress-filter-row">
        <label>Sport<select value={sport} onChange={event => setSport(event.target.value as ActivitySport)}>
          {Object.entries(activitySports).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Mesure<select value={metric} onChange={event => setMetric(event.target.value as ActivityMetric)}>
          {Object.entries(activityMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Période<select value={count} onChange={event => {
          setCount(Number(event.target.value)); setOffset(0); setActiveDate(undefined);
        }}>
          <option value={12}>12 semaines</option><option value={26}>26 semaines</option><option value={52}>52 semaines</option>
        </select></label>
        <div className="progress-view-switch" role="group" aria-label="Regrouper les activités">
          <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>Jours</button>
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Semaines</button>
        </div>
      </div>
      <div className="progress-grid-scroll" ref={scrollRef}>
        <div className="progress-grid" role="group" aria-label={view === 'day' ? 'Activités par jour' : 'Activités par semaine'}>
          {view === 'day' && <div className="progress-grid-labels" aria-hidden="true">
            <span />{dayLabels.map(label => <span key={label}>{label}</span>)}
          </div>}
          {weeks.map((week, index) => {
            const month = parseLocalDate(week[0]).getMonth();
            const showMonth = index === 0 || month !== parseLocalDate(weeks[index - 1][0]).getMonth();
            return (
              <div className="progress-grid-week" key={week[0]} data-current={week[0] === currentMonday}>
                <span className="progress-month" aria-hidden="true">{showMonth && monthLabel.format(parseLocalDate(week[0]))}</span>
                {view === 'day' ? week.map(day => cell(day)) : cell(week[0], week[0] === mostRecent && offset === 0 ? today : week[6])}
              </div>
            );
          })}
        </div>
      </div>
      <div className="progress-grid-footer">
        <p>{allVisible.length ? formatMetric('sessions', allVisible.length) + ' sur la période' : 'Aucune activité pour cette sélection'}</p>
        <div className="progress-legend progress-heat-legend" aria-label={`De zéro à ${formatMetric(metric, cutoffs[2])} ou plus`}>
          <span>0</span>{[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)}
          <span>{formatMetric(metric, cutoffs[2])} et +</span>
        </div>
      </div>
      <div className="progress-selection" aria-live="polite">
        <div className="progress-section-head">
          <h3>{view === 'day' ? fullDate.format(parseLocalDate(selected)) :
            describeDateRange(selected, selected === currentMonday ? today : formatDateKey(addDays(parseLocalDate(selected), 6)))}</h3>
          {details.length > 0 && <p>{selectedMetric.total === undefined ? 'Mesure indisponible' : formatMetric(metric, selectedMetric.total)}
            {selectedMetric.measured > 0 && selectedMetric.measured < details.length &&
              ` · ${selectedMetric.measured}/${details.length} activités mesurées`}</p>}
        </div>
        {details.length ? (
          <ul className="progress-session-list">
            {details.map(activity => (
              <li key={activity.activityId}>
                <span><strong>{activitySport(activity) === 'cardio' && activity.activityName === 'Calisthénie / Renforcement'
                  ? 'Cardio Garmin' : activity.activityName}</strong>
                  <small>{view === 'week' && `${shortDate.format(parseLocalDate(getGarminLocalDateKey(activity)))} · `}
                    {activitySports[activitySport(activity)]} · {activity.source === 'GARMIN_CONNECT' ? 'Garmin' : 'Import GPX'}</small>
                </span>
                <span>{duration(activity.durationMinutes)}
                  {activity.distanceKm != null && ` · ${formatMetric('distance', activity.distanceKm)}`}
                  {activity.elevationGainM != null && ` · +${formatMetric('elevation', activity.elevationGainM)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : <p>Aucune activité enregistrée</p>}
      </div>
    </section>
  );
}

function TrainingReview({ garminActivities, comparisons, referenceDate }: StatsDashboardProps) {
  const review = useMemo(() => buildTrainingReview(garminActivities, comparisons, referenceDate),
    [garminActivities, comparisons, referenceDate]);
  const { recent, previous } = review;
  const comparable = review.spansPreviousPeriod && previous.runs > 0 && recent.runs > 0;
  const volumeChange = recent.minutes - previous.minutes;
  const metrics = [
    { label: 'Temps de course', value: recent.runs ? duration(recent.minutes) : '—',
      note: comparable ? (volumeChange === 0 ? 'Même durée que les 4 semaines précédentes' :
        `${volumeChange > 0 ? '+' : '−'}${duration(Math.abs(volumeChange))} vs les 4 semaines précédentes`) : undefined },
    { label: 'Distance', value: recent.distance.total === undefined ? '—' : formatMetric('distance', recent.distance.total),
      note: recent.distance.measured > 0 && recent.distance.measured < recent.runs
        ? `${recent.distance.measured}/${recent.runs} sorties mesurées` : undefined },
    { label: 'Dénivelé +', value: recent.elevation.total === undefined ? '—' : formatMetric('elevation', recent.elevation.total),
      note: recent.elevation.measured > 0 && recent.elevation.measured < recent.runs
        ? `${recent.elevation.measured}/${recent.runs} sorties mesurées` : undefined }
  ];

  return (
    <section className="surface-panel progress-panel progress-review" aria-labelledby="training-review-title">
      <div className="progress-section-head">
        <div>
          <h2 id="training-review-title">Course et trail · 4 semaines complètes</h2>
          <p>{describeDateRange(review.start, review.end)}</p>
        </div>
      </div>
      <dl className="progress-review-totals">
        {metrics.map(({ label, value, note }) => (
          <div key={label}>
            <dt>{label}</dt><dd>{value}{note && <small className="progress-coverage">{note}</small>}</dd>
          </div>
        ))}
      </dl>
      {!recent.runs && <p className="progress-note">Aucune sortie enregistrée sur ces quatre semaines.</p>}
      <details className="progress-disclosure">
        <summary>Détail par semaine et ressenti</summary>
        <div className="progress-review-details">
          <table className="progress-review-table">
            <caption>Sorties enregistrées par semaine</caption>
            <thead><tr><th scope="col">Semaine</th><th scope="col">Temps</th><th scope="col">Distance</th><th scope="col">D+</th></tr></thead>
            <tbody>{review.weeks.map(week => (
              <tr key={week.start}>
                <th scope="row">{shortDate.format(parseLocalDate(week.start))}<small>{formatMetric('sessions', week.runs)}</small></th>
                <td>{duration(week.minutes)}</td>
                <td>{week.distance.total === undefined ? '—' : formatMetric('distance', week.distance.total)}
                  {week.distance.measured > 0 && week.distance.measured < week.runs && <small>{week.distance.measured}/{week.runs} sorties</small>}</td>
                <td>{week.elevation.total === undefined ? '—' : formatMetric('elevation', week.elevation.total)}
                  {week.elevation.measured > 0 && week.elevation.measured < week.runs && <small>{week.elevation.measured}/{week.runs} sorties</small>}</td>
              </tr>
            ))}</tbody>
          </table>
          <dl className="progress-review-context">
            <div><dt>Plus longue en durée</dt><dd>{recent.longest ? <>
              {duration(recent.longest.durationMinutes)}
              {recent.longest.distanceKm != null && ` · ${formatMetric('distance', recent.longest.distanceKm)}`}
              {recent.longest.elevationGainM != null && ` · +${formatMetric('elevation', recent.longest.elevationGainM)}`}
              <small>{shortDate.format(parseLocalDate(getGarminLocalDateKey(recent.longest)))}</small>
            </> : '—'}</dd></div>
            <div><dt>Régularité</dt><dd>{recent.runs} sorties sur {recent.days} jours<small>{review.strength} activités de renforcement</small></dd></div>
            <div><dt>Fréquence cardiaque moyenne</dt><dd>{review.hr === undefined ? '—' : `${integer.format(review.hr)} bpm`}
              {review.hrCount > 0 && <small>Pondérée par la durée · {review.hrCount}/{recent.runs} sorties</small>}</dd></div>
            <div><dt>Effort ressenti moyen</dt><dd>{review.rpe === undefined ? '—' : `${decimal.format(review.rpe)} / 10`}
              {review.rpeCount > 0 && <small>{review.rpeCount}/{recent.runs} sorties notées</small>}</dd></div>
          </dl>
          {comparable && <p className="progress-note">
            Période précédente · {describeDateRange(review.previousStart, review.previousEnd)} · {duration(previous.minutes)} de course
          </p>}
        </div>
      </details>
    </section>
  );
}

export function StatsDashboard(props: StatsDashboardProps) {
  const { garminActivities, referenceDate, wellness, onSaveActivityFeedback } = props;
  const sleep = wellness?.sleep?.totalMinutes;
  const restingHeartRate = wellness?.restingHeartRate;
  const hrv = wellness?.hrv?.lastNightAvg;
  return (
    <div className="training-progress">
      <PlanProgress {...props} />
      <ActivityCalendar activities={garminActivities} referenceDate={referenceDate} />
      <TrainingReview {...props} />
      {wellness && (sleep || restingHeartRate || hrv) ? (
        <details className="surface-panel progress-panel progress-disclosure progress-recovery">
          <summary>Mesures Garmin · {shortDate.format(parseLocalDate(wellness.date))}</summary>
          <dl className="progress-review-context">
            {sleep ? <div><dt>Sommeil</dt><dd>{duration(sleep)}</dd></div> : null}
            {restingHeartRate ? <div><dt>FC au repos</dt><dd>{integer.format(restingHeartRate)} bpm</dd></div> : null}
            {hrv ? <div><dt>VFC nocturne</dt><dd>{integer.format(hrv)} ms</dd></div> : null}
          </dl>
        </details>
      ) : null}
      {onSaveActivityFeedback && garminActivities.length > 0 && (
        <div className="surface-panel progress-panel progress-journal">
          <ActivityFeedbackJournal activities={garminActivities} onSave={onSaveActivityFeedback} />
        </div>
      )}
    </div>
  );
}
