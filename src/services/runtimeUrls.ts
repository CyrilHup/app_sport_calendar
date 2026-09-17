export const DEFAULT_PRODUCTION_ORIGIN = 'https://appsportcalendar.vercel.app';

/** One deployment origin for OAuth redirects, native API fallback, and CORS. */
export function resolveProductionOrigin(configured?: string): string {
  if (!configured) return DEFAULT_PRODUCTION_ORIGIN;
  try {
    const parsed = new URL(configured);
    return parsed.protocol === 'https:' ? parsed.origin : DEFAULT_PRODUCTION_ORIGIN;
  } catch {
    return DEFAULT_PRODUCTION_ORIGIN;
  }
}

export function getProductionOrigin(): string {
  const browserValue = (import.meta as any).env?.VITE_APP_ORIGIN as string | undefined;
  const serverValue = ((globalThis as any).process?.env?.APP_ORIGIN ||
    (globalThis as any).process?.env?.VITE_APP_ORIGIN) as string | undefined;
  return resolveProductionOrigin(browserValue || serverValue);
}
