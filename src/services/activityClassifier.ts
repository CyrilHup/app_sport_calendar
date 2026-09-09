import { GarminActivity, GarminActivityType } from '../types/garmin';
import { CalendarEvent } from '../types/calendar';

export interface ActivityPredicateInput {
  activityType?: string;
  garminTypeKey?: string;
  activityName?: string;
  sportType?: string;
  title?: string;
}

/**
 * Normalise les arguments pour les fonctions de prédicat de discipline.
 * Supporte un objet partiel (GarminActivity, CalendarEvent) ou des arguments directs.
 */
function normalizePredicateTokens(
  inputOrType?: string | ActivityPredicateInput | null,
  nameOrTitle?: string,
  rawKey?: string
): { typeKey: string; text: string } {
  let typeKey = '';
  let text = '';

  if (inputOrType && typeof inputOrType === 'object') {
    typeKey = String(inputOrType.activityType || inputOrType.sportType || inputOrType.garminTypeKey || '').toLowerCase();
    text = [
      inputOrType.activityName,
      inputOrType.title,
      inputOrType.garminTypeKey,
      inputOrType.activityType,
      inputOrType.sportType
    ].filter(Boolean).join(' ').toLowerCase();
  } else {
    typeKey = String(inputOrType || rawKey || '').toLowerCase();
    text = [inputOrType, nameOrTitle, rawKey].filter(Boolean).join(' ').toLowerCase();
  }

  return { typeKey, text };
}

/**
 * Détecte si une activité ou un plan correspond à de la calisthénie, musculation ou renforcement.
 */
export function isStrengthOrCalisthenics(
  inputOrType?: string | ActivityPredicateInput | null,
  nameOrTitle?: string,
  rawKey?: string
): boolean {
  const { typeKey, text } = normalizePredicateTokens(inputOrType, nameOrTitle, rawKey);

  if (
    typeKey === 'strength_training' ||
    typeKey === 'fitness_equipment' ||
    typeKey === 'calisthenics' ||
    typeKey === 'gym_force'
  ) {
    return true;
  }

  return (
    text.includes('calisth') ||
    text.includes('poids du corps') ||
    text.includes('muscu') ||
    text.includes('force') ||
    text.includes('renfo') ||
    text.includes('gainage') ||
    text.includes('pompe') ||
    text.includes('traction') ||
    text.includes('dips') ||
    text.includes('strength') ||
    text.includes('weight') ||
    text.includes('gym') ||
    text.includes('crossfit') ||
    text.includes('fitness') ||
    text.includes('cardio') ||
    text.includes('hiit')
  );
}

/**
 * Détecte si une activité ou un plan correspond à de la course à pied ou du trail.
 */
export function isTrailOrRunning(
  inputOrType?: string | ActivityPredicateInput | null,
  nameOrTitle?: string,
  rawKey?: string
): boolean {
  const { typeKey, text } = normalizePredicateTokens(inputOrType, nameOrTitle, rawKey);

  if (
    typeKey === 'trail_running' ||
    typeKey === 'trail_intense' ||
    typeKey === 'trail_long' ||
    typeKey === 'running' ||
    typeKey === 'run_easy' ||
    typeKey === 'run_tempo'
  ) {
    return true;
  }

  if (
    text.includes('trail') ||
    text.includes('côtes') ||
    text.includes('footing') ||
    text.includes('jog') ||
    text.includes('fartlek')
  ) {
    return true;
  }

  // "course" mais pas "cours" scolaire / étudiant ni "calisthénie"
  if (
    text.includes('course') &&
    !text.includes('cours ') &&
    !text.includes('cours d') &&
    !text.includes('calisth')
  ) {
    return true;
  }

  return false;
}

/**
 * Détecte si une activité ou un plan correspond au cyclisme ou au vélo.
 */
export function isCycling(
  inputOrType?: string | ActivityPredicateInput | null,
  nameOrTitle?: string,
  rawKey?: string
): boolean {
  const { typeKey, text } = normalizePredicateTokens(inputOrType, nameOrTitle, rawKey);
  if (typeKey === 'cycling' || typeKey.includes('cycl') || typeKey.includes('bike')) return true;
  return text.includes('cycl') || text.includes('vélo') || text.includes('bike');
}

/**
 * Détecte si une activité ou un plan correspond à l'escalade ou au bloc.
 */
export function isClimbing(
  inputOrType?: string | ActivityPredicateInput | null,
  nameOrTitle?: string,
  rawKey?: string
): boolean {
  const { typeKey, text } = normalizePredicateTokens(inputOrType, nameOrTitle, rawKey);
  if (typeKey === 'climbing' || typeKey.includes('climb') || typeKey.includes('boulder')) return true;
  return text.includes('climb') || text.includes('boulder') || text.includes('escalade') || text.includes('bloc') || text.includes('grimp');
}

/**
 * Détecte si une activité ou un plan correspond à la marche ou à la randonnée.
 */
export function isWalking(
  inputOrType?: string | ActivityPredicateInput | null,
  nameOrTitle?: string,
  rawKey?: string
): boolean {
  const { typeKey, text } = normalizePredicateTokens(inputOrType, nameOrTitle, rawKey);
  if (typeKey === 'walking' || typeKey.includes('walk') || typeKey.includes('hike')) return true;
  return text.includes('marche') || text.includes('walk') || text.includes('rando') || text.includes('randonnée');
}

/**
 * Normalizes an activity type from Garmin Connect typeKey and/or user-facing title.
 */
export function classifyGarminActivityType(
  rawTypeKey?: string,
  activityName?: string
): GarminActivityType {
  const input = { garminTypeKey: rawTypeKey, activityName };

  if (isClimbing(input)) {
    return 'CLIMBING';
  }

  if (String(rawTypeKey || '').toLowerCase().includes('trail')) {
    return 'TRAIL_RUNNING';
  }

  if (isTrailOrRunning(input)) {
    return 'RUNNING';
  }

  if (isStrengthOrCalisthenics(input)) {
    return 'STRENGTH_TRAINING';
  }

  if (isCycling(input)) {
    return 'CYCLING';
  }

  if (isWalking(input)) {
    return 'WALKING';
  }

  return 'OTHER';
}

/**
 * Infers human-readable category for activities recorded under the generic 'OTHER' profile,
 * based strictly on objective watch telemetry (elevation, distance, cadence, duration).
 */
export function inferOtherProfileCategory(act: GarminActivity): string | undefined {
  const key = String(act.garminTypeKey || '').toLowerCase();
  const dPlus = act.elevationGainM || 0;
  const dist = act.distanceKm || 0;
  const cad = act.avgCadence || 0;

  if (key.includes('climb') || key.includes('boulder')) {
    return 'Escalade / Bloc';
  }
  if (key.includes('cycl') || key.includes('bike')) {
    return 'Cyclisme';
  }
  if (key.includes('walk') || key.includes('hike')) {
    return 'Marche / Randonnée';
  }
  if (dist >= 1.5 && (cad >= 130 || act.avgPaceMinKm !== undefined)) {
    return dPlus > 80 ? 'Trail / Dénivelé' : 'Course à pied';
  }
  if (
    dist < 0.2 &&
    act.durationMinutes >= 15 &&
    (key.includes('strength') || key.includes('gym') || key.includes('fitness') || key.includes('cardio') || key.includes('hiit') || key.includes('other') || act.activityType === 'OTHER')
  ) {
    return 'Renforcement musculaire';
  }

  return undefined;
}

/**
 * Unifies the display title of a Garmin activity.
 * On Garmin Forerunner 55 (which has no native Strength profile), workouts pushed as
 * or logged under the default 'Cardio' profile represent Calisthenics / Strength workouts.
 * If matched with a planned workout, displays the planned workout title.
 * Otherwise, unifies generic 'Cardio' to 'Calisthénie / Renforcement'.
 */
export function formatGarminActivityName(
  rawName?: string,
  plannedTitle?: string,
  activityType?: GarminActivityType
): string {
  const name = String(rawName || '').trim();
  const lower = name.toLowerCase();
  const normalized = lower.replace(/_/g, ' ').trim();

  const isGenericCardio =
    normalized === 'cardio' ||
    normalized === 'cardio training' ||
    normalized === 'indoor cardio' ||
    normalized === 'entrainement cardio' ||
    normalized === 'entraînement cardio';

  const isGenericOther =
    normalized === 'autre' ||
    normalized === 'other' ||
    normalized === 'garmin activity' ||
    normalized === 'seance' ||
    normalized === 'séance';

  if (isGenericCardio) {
    if (plannedTitle) {
      return plannedTitle.replace(/^[^a-zA-Z0-9\[]*/, '').trim();
    }
    return 'Calisthénie / Renforcement';
  }

  if (isGenericOther) {
    if (plannedTitle) {
      return plannedTitle.replace(/^[^a-zA-Z0-9\[]*/, '').trim();
    }
    return 'Séance Garmin';
  }

  if (name) {
    return name;
  }

  if (plannedTitle) {
    return plannedTitle.replace(/^[^a-zA-Z0-9\[]*/, '').trim();
  }

  return 'Séance Garmin';
}

export interface GarminExecutionBadge {
  label: string;
  icon: string;
}

/**
 * Returns a contextual badge label and icon for a completed / caught-up Garmin activity.
 * Adapts dynamically to calisthenics/strength, trail, running, cycling, climbing, etc.,
 * avoiding generic hardcoded 'Course Réalisée' when the activity was calisthenics or cardio.
 */
export function getGarminExecutionBadge(
  act?: Partial<GarminActivity>,
  plannedEvent?: CalendarEvent
): GarminExecutionBadge {
  const merged = {
    activityType: act?.activityType,
    garminTypeKey: act?.garminTypeKey,
    activityName: act?.activityName,
    sportType: plannedEvent?.sportType,
    title: plannedEvent?.title
  };

  if (isStrengthOrCalisthenics(merged)) {
    return {
      label: 'Calisthénie Réalisée (Garmin)',
      icon: '💪'
    };
  }

  const rawKey = String(act?.garminTypeKey || '').toLowerCase();
  const actName = String(act?.activityName || '').toLowerCase();
  const planTitle = String(plannedEvent?.title || '').toLowerCase();
  const planSportType = String(plannedEvent?.sportType || '').toLowerCase();

  const isTrail =
    act?.activityType === 'TRAIL_RUNNING' ||
    actName.includes('trail') ||
    rawKey.includes('trail') ||
    planTitle.includes('trail') ||
    planSportType.includes('trail');

  if (isTrail) {
    return {
      label: 'Trail Réalisé (Garmin)',
      icon: '⛰️'
    };
  }

  if (isCycling(merged)) {
    return {
      label: 'Sortie Vélo Réalisée (Garmin)',
      icon: '🚴'
    };
  }

  if (isClimbing(merged)) {
    return {
      label: 'Escalade Réalisée (Garmin)',
      icon: '🧗'
    };
  }

  if (isWalking(merged)) {
    return {
      label: 'Marche Réalisée (Garmin)',
      icon: '🥾'
    };
  }

  if (isTrailOrRunning(merged)) {
    return {
      label: 'Course Réalisée (Garmin)',
      icon: '🏃'
    };
  }

  return {
    label: 'Séance Réalisée (Garmin)',
    icon: '⚡'
  };
}

