// Vercel Serverless Function: Proxy for Academic iCal Feed (ÉTS)
// Allows cross-device (Web, Android Capacitor, iOS) loading without CORS restrictions.

export default async function handler(req: any, res: any) {
  // Polyfill response helpers for Node/Vite connect middleware
  if (!res.status) {
    res.status = (code: number) => { res.statusCode = code; return res; };
  }
  if (!res.json) {
    res.json = (data: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
  }
  if (!res.send) {
    res.send = (data: any) => {
      res.end(data);
    };
  }

  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let requestedUrl = (req.query?.url as string);
    if (!requestedUrl && req.url && req.url.includes('?')) {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        requestedUrl = parsedUrl.searchParams.get('url') || '';
      } catch {}
    }
    if (!requestedUrl) {
      requestedUrl = process.env.ICAL_FEED_URL || process.env.VITE_ICAL_FEED_URL || '';
    }

    if (!requestedUrl) {
      res.status(400).json({
        error: 'Aucune URL iCal spécifiée. Configurez votre flux iCal ÉTS dans votre profil ou via ICAL_FEED_URL.'
      });
      return;
    }

    const response = await fetch(requestedUrl);

    if (!response.ok) {
      res.status(response.status).json({
        error: `Impossible de récupérer le flux iCal ÉTS (Code HTTP ${response.status}: ${response.statusText})`
      });
      return;
    }

    const icsText = await response.text();

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
    res.status(200).send(icsText);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Erreur interne lors du téléchargement du calendrier iCal'
    });
  }
}
