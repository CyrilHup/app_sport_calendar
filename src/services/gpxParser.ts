import { GarminActivity, GarminActivityType } from '../types/garmin';

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function contentId(content: string): string {
  // Two independent 32-bit hashes keep the synchronous browser import stable
  // across repeated imports without relying on wall-clock time.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `gpx-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
}

function readValidDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parses a GPX track without requiring a particular attribute or child order. */
export function parseGPXString(gpxText: string, fileName: string): GarminActivity {
  const name = gpxText.match(/<name\b[^>]*>([^<]+)<\/name>/i)?.[1]?.trim()
    || fileName.replace(/\.[^/.]+$/, '');
  const trackpointPattern = /<trkpt\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/trkpt>)/gi;
  let match: RegExpExecArray | null;
  let distanceMeters = 0;
  let elevationGainMeters = 0;
  let previous: { latitude: number; longitude: number; elevation: number | null } | null = null;
  let firstTime: Date | null = null;
  let lastTime: Date | null = null;
  let validTrackpoints = 0;

  while ((match = trackpointPattern.exec(gpxText)) !== null) {
    const attributes = match[1];
    const body = match[2] || '';
    const latitude = Number(attributes.match(/\blat\s*=\s*["']([^"']+)["']/i)?.[1]);
    const longitude = Number(attributes.match(/\blon\s*=\s*["']([^"']+)["']/i)?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;

    const rawElevation = body.match(/<ele\b[^>]*>([^<]+)<\/ele>/i)?.[1];
    const parsedElevation = rawElevation === undefined ? NaN : Number(rawElevation);
    const elevation = Number.isFinite(parsedElevation) ? parsedElevation : null;
    const pointTime = readValidDate(body.match(/<time\b[^>]*>([^<]+)<\/time>/i)?.[1]);
    if (pointTime) {
      if (!firstTime) firstTime = pointTime;
      lastTime = pointTime;
    }

    if (previous) {
      distanceMeters += haversineMeters(previous.latitude, previous.longitude, latitude, longitude);
      if (previous.elevation !== null && elevation !== null && elevation > previous.elevation) {
        elevationGainMeters += elevation - previous.elevation;
      }
    }
    previous = { latitude, longitude, elevation };
    validTrackpoints++;
  }

  if (validTrackpoints === 0) throw new Error('Le fichier GPX ne contient aucun point de parcours valide.');

  const topLevelTime = readValidDate(gpxText.match(/<time\b[^>]*>([^<]+)<\/time>/i)?.[1]);
  const startTime = firstTime || topLevelTime || new Date();
  const durationMinutes = firstTime && lastTime
    ? Math.max(1, Math.round((lastTime.getTime() - firstTime.getTime()) / 60_000))
    : 45;
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const elevationGainM = Math.round(elevationGainMeters);

  let activityType: GarminActivityType = 'TRAIL_RUNNING';
  if (/stairs|escalier/i.test(name)) activityType = 'OTHER';
  else if (/gym|calisth/i.test(name)) activityType = 'STRENGTH_TRAINING';
  else if (elevationGainM < 50 && distanceKm > 3) activityType = 'RUNNING';

  return {
    activityId: contentId(gpxText),
    activityName: name,
    activityType,
    startTimeLocal: startTime.toISOString(),
    durationMinutes,
    distanceKm: distanceKm > 0 ? distanceKm : undefined,
    elevationGainM: elevationGainM > 0 ? elevationGainM : undefined,
    garminElevationGainM: elevationGainM > 0 ? elevationGainM : undefined,
    elevationSource: 'GPX_IMPORT',
    calories: Math.round(durationMinutes * 8.5),
    source: 'GPX_IMPORT'
  };
}
