import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class IcalFeedError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'IcalFeedError';
  }
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;

  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

function allowedHostnames(): string[] {
  return String(process.env.ICAL_ALLOWED_HOSTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

async function validateRemoteUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new IcalFeedError('URL iCal invalide.');
  }

  if (url.protocol !== 'https:') {
    throw new IcalFeedError('Le flux iCal doit utiliser HTTPS.');
  }
  if (url.username || url.password) {
    throw new IcalFeedError("Les identifiants intégrés dans l'URL iCal ne sont pas autorisés.");
  }
  if (url.port && url.port !== '443') {
    throw new IcalFeedError('Le flux iCal doit utiliser le port HTTPS standard.');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new IcalFeedError('Hôte iCal non autorisé.');
  }

  const allowlist = allowedHostnames();
  if (allowlist.length > 0 && !allowlist.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`))) {
    throw new IcalFeedError("L'hôte du flux iCal n'est pas dans ICAL_ALLOWED_HOSTS.", 403);
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new IcalFeedError('Le flux iCal résout vers une adresse réseau non publique.', 403);
  }

  return url;
}

export function resolveRequestedIcalUrl(req: any): string {
  let requestedUrl = typeof req?.query?.url === 'string' ? req.query.url : '';
  if (!requestedUrl && req?.url?.includes('?')) {
    try {
      requestedUrl = new URL(req.url, 'http://localhost').searchParams.get('url') || '';
    } catch {}
  }
  return requestedUrl || process.env.ICAL_FEED_URL || '';
}

/** Fetches an iCal document while validating every redirect target. */
export async function fetchRemoteIcalText(rawUrl: string): Promise<string> {
  let currentUrl = await validateRemoteUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= 4; redirectCount++) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: { Accept: 'text/calendar, text/plain;q=0.9' },
      signal: AbortSignal.timeout(15_000)
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new IcalFeedError('Redirection iCal sans destination.', 502);
      currentUrl = await validateRemoteUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new IcalFeedError(
        `Impossible de récupérer le flux iCal (HTTP ${response.status}: ${response.statusText}).`,
        response.status >= 400 && response.status < 500 ? response.status : 502
      );
    }

    const content = await response.text();
    if (!content.includes('BEGIN:VCALENDAR')) {
      throw new IcalFeedError("La ressource distante n'est pas un calendrier iCal valide.", 422);
    }
    return content;
  }

  throw new IcalFeedError('Trop de redirections lors du chargement du flux iCal.', 502);
}
