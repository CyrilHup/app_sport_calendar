// Authenticated proxy for the user's academic iCal feed.
import { fetchRemoteIcalText, IcalFeedError, resolveRequestedIcalUrl } from '../src/server/icalFeedClient';
import { applyApiCors, ensureResponseHelpers, requireAuthenticatedUser } from '../src/server/requestSecurity';

export default async function handler(req: any, res: any) {
  ensureResponseHelpers(res);
  if (!applyApiCors(req, res, 'GET,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const requestedUrl = resolveRequestedIcalUrl(req);
  if (!requestedUrl) {
    res.status(400).json({
      error: 'Aucune URL iCal spécifiée. Configurez votre flux iCal ÉTS dans votre profil ou via ICAL_FEED_URL.'
    });
    return;
  }

  try {
    const icsText = await fetchRemoteIcalText(requestedUrl);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(icsText);
  } catch (error) {
    const status = error instanceof IcalFeedError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Erreur interne lors du téléchargement du calendrier iCal.';
    res.status(status).json({ error: message });
  }
}
