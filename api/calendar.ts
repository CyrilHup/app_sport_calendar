// Vercel Serverless Function: Consolidated iCal Subscription Feed (/api/calendar.ics)
import { parseICSString, buildCompleteCalendar, RawIcsEvent } from '../src/services/icsParser';
import { generateICSContent } from '../src/services/googleCalendarService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const requestedUrl =
      (req.query?.url as string) ||
      process.env.ICAL_FEED_URL ||
      process.env.VITE_ICAL_FEED_URL ||
      '';

    let rawCourses: RawIcsEvent[] = [];
    if (requestedUrl) {
      try {
        const resp = await fetch(requestedUrl);
        if (resp.ok) {
          const rawIcs = await resp.text();
          rawCourses = parseICSString(rawIcs);
        }
      } catch (e) {
        console.warn('Could not fetch remote iCal in serverless function:', e);
      }
    }

    // Compute start from Monday of current week
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const startMonday = new Date(now);
    startMonday.setDate(now.getDate() - day);
    startMonday.setHours(0, 0, 0, 0);

    const { allEvents } = buildCompleteCalendar(rawCourses, startMonday, 90);
    const fullIcsContent = generateICSContent(allEvents);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="qmt80_training_schedule.ics"');
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
    res.status(200).send(fullIcsContent);
  } catch (err: any) {
    res.status(500).send(`Erreur: ${err.message || 'Unknown error'}`);
  }
}
