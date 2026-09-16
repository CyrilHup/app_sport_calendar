export interface AuthenticatedRequestUser {
  id: string;
  email?: string;
}

type HeaderValue = string | string[] | undefined;

export function ensureResponseHelpers(res: any): void {
  if (!res.status) {
    res.status = (code: number) => { res.statusCode = code; return res; };
  }
  if (!res.json) {
    res.json = (data: unknown) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
  }
  if (!res.send) {
    res.send = (data: unknown) => res.end(data);
  }
}

function readHeader(req: any, name: string): string {
  const headers = req?.headers || {};
  const raw: HeaderValue = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(raw) ? raw[0] || '' : raw || '';
}

function configuredAllowedOrigins(): Set<string> {
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  return new Set([
    'https://appsportcalendar.vercel.app',
    'capacitor://localhost',
    'http://localhost',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...configured
  ]);
}

/** Apply CORS only for explicitly trusted browser/native origins. */
export function applyApiCors(req: any, res: any, methods: string): boolean {
  const origin = readHeader(req, 'origin');
  if (origin) {
    if (!configuredAllowedOrigins().has(origin)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Origin not allowed.' }));
      return false;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return true;
}

function isLocalDevelopmentRequest(req: any): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return false;
  const host = readHeader(req, 'host').split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
}

/**
 * Verifies the caller's Supabase access token. Local Vite development is the
 * only bypass, and only when the request itself targets a loopback host.
 */
export async function requireAuthenticatedUser(
  req: any,
  res: any
): Promise<AuthenticatedRequestUser | null> {
  const authHeader = readHeader(req, 'authorization');
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token && isLocalDevelopmentRequest(req)) {
    return { id: 'local-development' };
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: 'Server authentication is not configured.' });
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) {
      res.status(401).json({ error: 'Invalid or expired authentication.' });
      return null;
    }

    const user = await response.json() as { id?: string; email?: string };
    if (!user.id) {
      res.status(401).json({ error: 'Authenticated user is missing an identifier.' });
      return null;
    }
    return { id: user.id, email: user.email };
  } catch (error) {
    console.warn('Unable to verify API authentication:', error);
    res.status(503).json({ error: 'Authentication service unavailable.' });
    return null;
  }
}
