import { GarminActivity, GarminActivityType } from '../types/garmin';

/**
 * Normalizes an activity type from Garmin Connect typeKey and/or user-facing title.
 */
export function classifyGarminActivityType(
  rawTypeKey?: string,
  activityName?: string
): GarminActivityType {
  const key = String(rawTypeKey || '').toLowerCase();
  const name = String(activityName || '').toLowerCase();

  if (
    key.includes('climb') ||
    key.includes('boulder') ||
    name.includes('grimp') ||
    name.includes('climb') ||
    name.includes('boulder') ||
    name.includes('escalade') ||
    name.includes('bloc')
  ) {
    return 'CLIMBING';
  }

  if (key.includes('trail')) {
    return 'TRAIL_RUNNING';
  }

  if (
    key.includes('run') ||
    name.includes('course') ||
    name.includes('footing') ||
    name.includes('jog')
  ) {
    return 'RUNNING';
  }

  if (
    key.includes('strength') ||
    key.includes('weight') ||
    key.includes('gym') ||
    key.includes('fitness') ||
    name.includes('muscu') ||
    name.includes('calisth') ||
    name.includes('force')
  ) {
    return 'STRENGTH_TRAINING';
  }

  if (
    key.includes('cycl') ||
    key.includes('bike') ||
    name.includes('vélo') ||
    name.includes('bike')
  ) {
    return 'CYCLING';
  }

  if (
    key.includes('walk') ||
    key.includes('hike') ||
    name.includes('marche') ||
    name.includes('walk') ||
    name.includes('randonnée')
  ) {
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
    dist === 0 &&
    act.durationMinutes >= 20 &&
    (key.includes('strength') || key.includes('gym') || key.includes('fitness'))
  ) {
    return 'Renforcement musculaire';
  }

  return undefined;
}
