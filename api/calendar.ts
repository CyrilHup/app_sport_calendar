// Public consolidated iCal subscription feed (/api/calendar.ics).
import { buildCompleteCalendar, parseICSString, RawIcsEvent } from '../src/services/icsParser';
import { generateICSContent } from '../src/services/icsSerializer';
import { getCalendarBuildWindow } from '../src/services/calendarWindow';
import { GLOBAL_APP_CONFIG } from '../src/services/periodizationEngine';
import { fetchRemoteIcalText, IcalFeedError } from '../src/server/icalFeedClient';
import { applyApiCors, ensureResponseHelpers } from '../src/server/requestSecurity';

export default async function handler(req: any, res: any) {
  ensureResponseHelpers(res);
  if (!applyApiCors(req, res, 'GET,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed.');
    return;
  }

  try {
    const configuredUrl = process.env.ICAL_FEED_URL || '';
    let rawCourses: RawIcsEvent[] = [];
    if (configuredUrl) {
      rawCourses = parseICSString(await fetchRemoteIcalText(configuredUrl));
    }

    const now = new Date();
    const window = getCalendarBuildWindow(now, GLOBAL_APP_CONFIG.SPORT_START_DATE);
    const { allEvents } = buildCompleteCalendar(rawCourses, window.startMonday, window.daysCount);
    const fullIcsContent = generateICSContent(allEvents, now);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="training_schedule.ics"');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.status(200).send(fullIcsContent);
  } catch (error) {
    const status = error instanceof IcalFeedError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unknown calendar error';
    res.status(status).send(`Erreur: ${message}`);
  }
}
