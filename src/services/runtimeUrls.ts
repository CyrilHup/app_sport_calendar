import { DEFAULT_PRODUCTION_ORIGIN, resolveProductionOrigin } from './productionOrigin';

export { DEFAULT_PRODUCTION_ORIGIN, resolveProductionOrigin } from './productionOrigin';

/** One deployment origin for OAuth redirects, native API fallback, and CORS. */
export function getProductionOrigin(): string {
  const browserValue = (import.meta as any).env?.VITE_APP_ORIGIN as string | undefined;
  const serverValue = ((globalThis as any).process?.env?.APP_ORIGIN ||
    (globalThis as any).process?.env?.VITE_APP_ORIGIN) as string | undefined;
  return resolveProductionOrigin(browserValue || serverValue);
}
