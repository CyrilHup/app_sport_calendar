import { Capacitor } from '@capacitor/core';

/**
 * Returns whether the application is currently running as a native app (Android / iOS).
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform name ('android', 'ios', or 'web').
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
}

/**
 * Resolves an API endpoint depending on whether the app runs in the browser or natively on Android.
 * On mobile, if a remote backend URL is provided via VITE_BACKEND_URL or VITE_API_BASE_URL,
 * it prepends it to avoid attempting to hit the local WebView root (http://localhost).
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (isNative()) {
    const metaEnv = (import.meta as any).env || {};
    const backendUrl = metaEnv.VITE_BACKEND_URL || metaEnv.VITE_API_BASE_URL || '';
    if (backendUrl) {
      const cleanBase = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
      return `${cleanBase}${cleanEndpoint}`;
    }
  }

  return cleanEndpoint;
}
