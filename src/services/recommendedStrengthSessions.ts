import { CalendarEvent, DailySchedule, SportType } from '../types/calendar';
import { parseLocalDate } from './dateUtils';

type StrengthSlot = {
  key: string;
  title: string;
  sportType: SportType;
  preferredDay: number;
  minutes: number;
  description: string;
  optional?: boolean;
};

const SLOTS: StrengthSlot[] = [
  {
    key: 'upper', title: 'Calisthénie · haut du corps', sportType: 'CALISTHENICS', preferredDay: 0, minutes: 30,
    description: 'Poussée, tirage et gainage. Garder des répétitions en réserve et adapter aux sensations du jour.'
  },
  {
    key: 'control', title: 'Calisthénie · tronc et contrôle', sportType: 'CALISTHENICS', preferredDay: 2, minutes: 25,
    description: 'Gainage anti-rotation, équilibre, pied et contrôle unilatéral. Réduire amplitude ou volume en cas de douleur.'
  },
  {
    key: 'lower', title: 'Renforcement · jambes et mollets', sportType: 'GYM_FORCE', preferredDay: 3, minutes: 35,
    description: 'Squat ou presse, charnière de hanche, fente ou step-up et mollets. Commencer avec 1–2 séries maîtrisées ; progresser selon la récupération réelle.'
  },
  {
    key: 'optional', title: 'Calisthénie · bonus facultatif', sportType: 'CALISTHENICS', preferredDay: 4, minutes: 20,
    description: 'Courte séance haut du corps ou technique seulement si la récupération et les jambes restent bonnes. La sauter sans rattrapage si fatigue ou douleur.',
    optional: true
  }
];

const KEY_RUNS = new Set<SportType>(['TRAIL_LONG', 'TRAIL_INTENSE', 'RACE_DAY']);

function dayScore(day: DailySchedule, slot: StrengthSlot, week: DailySchedule[], usedDates: Set<string>): number {
  const dayRuns = day.events.filter(event => event.category === 'sport' && event.sportType !== 'CALISTHENICS' && event.sportType !== 'GYM_FORCE');
  const courseMinutes = day.events.filter(event => event.category === 'course').reduce((sum, event) => sum + event.durationMinutes, 0);
  let score = Math.abs(day.dayOfWeek - slot.preferredDay) * 8 + courseMinutes / 45;
  if (usedDates.has(day.date)) score += 100;
  if (dayRuns.some(event => event.sportType === 'RACE_DAY')) score += 1000;
  if (slot.key === 'lower') {
    if (dayRuns.some(event => KEY_RUNS.has(event.sportType!))) score += 100;
    else if (dayRuns.length > 0) score += 10;
    for (const other of week) {
      if (!other.events.some(event => event.category === 'sport' && KEY_RUNS.has(event.sportType!))) continue;
      const distance = Math.abs(other.dayOfWeek - day.dayOfWeek);
      if (distance === 1) score += 55;
      else if (distance === 2) score += 12;
    }
  } else if (dayRuns.some(event => KEY_RUNS.has(event.sportType!))) score += 18;
  return score;
}

function recommendedStart(day: DailySchedule, minutes: number): Date {
  const busy = day.events.filter(event => event.category === 'course' || event.category === 'sport');
  for (const [hour, minute] of [[18, 30], [7, 30], [12, 30], [20, 0]]) {
    const start = parseLocalDate(day.date);
    start.setHours(hour, minute, 0, 0);
    const end = start.getTime() + minutes * 60000;
    if (busy.every(event => end <= new Date(event.startDate).getTime() || start.getTime() >= new Date(event.endDate).getTime())) return start;
  }
  const fallback = parseLocalDate(day.date);
  fallback.setHours(18, 30, 0, 0);
  return fallback;
}

/** Visible initial suggestions, selected around the generated run and course calendar. */
export function addRecommendedStrengthSessions(
  schedules: DailySchedule[],
  allEvents: CalendarEvent[],
  strengthSessionsLast28d?: number
): { schedules: DailySchedule[]; allEvents: CalendarEvent[] } {
  const weeks = new Map<string, DailySchedule[]>();
  for (const day of schedules) {
    const monday = parseLocalDate(day.date);
    monday.setDate(monday.getDate() - day.dayOfWeek);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    weeks.set(weekKey, [...(weeks.get(weekKey) || []), day]);
  }

  const additions = new Map<string, CalendarEvent[]>();
  for (const [weekKey, week] of weeks) {
    const usedDates = new Set<string>();
    const raceWeek = week.some(day => day.periodContext.daysToRace >= 0 && day.periodContext.daysToRace <= 6);
    const afterRace = week.every(day => day.periodContext.daysToRace < 0);
    // Keep only light maintenance early in race week; no new leg loading near the start.
    const slots = afterRace ? [] : raceWeek ? SLOTS.slice(0, 1) : SLOTS;
    for (const slot of slots) {
      const candidates = week.filter(day => day.periodContext.daysToRace > (slot.key === 'lower' ? 6 : 1));
      if (candidates.length === 0) continue;
      const day = [...candidates].sort((a, b) => dayScore(a, slot, week, usedDates) - dayScore(b, slot, week, usedDates) || a.dayOfWeek - b.dayOfWeek)[0];
      usedDates.add(day.date);
      const baselineCap = strengthSessionsLast28d !== undefined && strengthSessionsLast28d < 4
        ? (slot.optional ? 15 : 20)
        : strengthSessionsLast28d !== undefined && strengthSessionsLast28d < 8 ? 25 : slot.minutes;
      const minutes = day.periodContext.isDeload ? Math.min(baselineCap, 20) : Math.min(slot.minutes, baselineCap);
      const start = recommendedStart(day, minutes);
      const event: CalendarEvent = {
        id: `STRENGTH_${weekKey}_${slot.key}`,
        category: 'sport',
        sportType: slot.sportType,
        title: slot.title,
        startDate: start.toISOString(),
        endDate: new Date(start.getTime() + minutes * 60000).toISOString(),
        location: slot.sportType === 'GYM_FORCE' ? 'Salle ou domicile' : 'Domicile ou salle',
        description: `${slot.description}\nJour et horaire recommandés, déplaçables selon cours, course, fatigue et douleurs.${strengthSessionsLast28d !== undefined && strengthSessionsLast28d < 4 ? '\nHistorique de renforcement récent faible : format court conseillé, sans rechercher l’échec musculaire.' : ''}${day.periodContext.isDeload ? '\nSemaine allégée : éviter toute nouvelle charge lourde.' : ''}`,
        emoji: slot.sportType === 'GYM_FORCE' ? '💪' : '🤸',
        colorId: '4',
        colorHex: slot.sportType === 'GYM_FORCE' ? '#a78bfa' : '#c084fc',
        durationMinutes: minutes,
        metadata: { isRecommendedStrength: true, isOptional: slot.optional }
      };
      additions.set(day.date, [...(additions.get(day.date) || []), event]);
    }
  }

  const nextSchedules = schedules.map(day => {
    const events = additions.get(day.date);
    return events ? { ...day, events: [...day.events, ...events].sort((a, b) => a.startDate.localeCompare(b.startDate)) } : day;
  });
  const addedEvents = [...additions.values()].flat();
  return { schedules: nextSchedules, allEvents: [...allEvents, ...addedEvents].sort((a, b) => a.startDate.localeCompare(b.startDate)) };
}
