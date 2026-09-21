export const DEFAULT_PRODUCTION_ORIGIN = 'https://appsportcalendar.vercel.app';

/** Validates and normalizes an HTTPS deployment origin in browser- and Node-safe code. */
export function resolveProductionOrigin(configured?: string): string {
  if (!configured) return DEFAULT_PRODUCTION_ORIGIN;
  try {
    const parsed = new URL(configured);
    return parsed.protocol === 'https:' ? parsed.origin : DEFAULT_PRODUCTION_ORIGIN;
  } catch {
    return DEFAULT_PRODUCTION_ORIGIN;
  }
}

/** Resolves the deployment origin without referencing browser-only import.meta.env. */
export function getServerProductionOrigin(): string {
  const env = (globalThis as any).process?.env as Record<string, string | undefined> | undefined;
  return resolveProductionOrigin(env?.APP_ORIGIN || env?.VITE_APP_ORIGIN);
}
