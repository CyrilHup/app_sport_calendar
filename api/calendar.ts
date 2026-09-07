// Vercel Serverless Function: Consolidated iCal Subscription Feed (/api/calendar.ics)

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

    let rawIcs = '';
    if (requestedUrl) {
      try {
        const resp = await fetch(requestedUrl);
        if (resp.ok) {
          rawIcs = await resp.text();
        }
      } catch (e) {
        console.warn('Could not fetch remote iCal in serverless function:', e);
      }
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="qmt80_training_schedule.ics"');
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');

    if (rawIcs) {
      res.status(200).send(rawIcs);
    } else {
      res.status(200).send('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QMT80//EN\r\nEND:VCALENDAR\r\n');
    }
  } catch (err: any) {
    res.status(500).send(`Erreur: ${err.message || 'Unknown error'}`);
  }
}
