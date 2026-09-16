import { CalendarEvent } from '../types/calendar';
import { STORAGE_KEYS, storageGet, storageGetRaw, storageSet, storageSetRaw } from './storageService';
import { generateICSContent } from './icsSerializer';

export { generateICSContent } from './icsSerializer';

const GCAL_STORAGE_MAP_KEY = STORAGE_KEYS.GCAL_EVENT_MAP;
const GCAL_CLIENT_ID_KEY = STORAGE_KEYS.GCAL_CLIENT_ID;

export interface GCalSyncProgress {
  total: number;
  current: number;
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  message: string;
}

// 1-Click download of .ics file
export function downloadICSFile(events: CalendarEvent[], filename = 'qmt80_calendar.ics'): void {
  const content = generateICSContent(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Google Calendar API direct sync
export async function syncDirectToGoogleCalendar(
  events: CalendarEvent[],
  accessToken: string,
  calendarId: string = 'primary',
  onProgress?: (p: GCalSyncProgress) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  // Load existing mapped event IDs to update instead of duplicating
  const eventMap = storageGet<Record<string, string>>(GCAL_STORAGE_MAP_KEY, {});

  const total = events.length;
  let synced = 0;

  try {
    for (const ev of events) {
      const gcalEventPayload = {
        summary: ev.title,
        description: `${ev.description}\n\n[Synced from QMT-80 Hub]`,
        location: ev.location,
        start: {
          dateTime: new Date(ev.startDate).toISOString(),
          timeZone: 'America/Toronto'
        },
        end: {
          dateTime: new Date(ev.endDate).toISOString(),
          timeZone: 'America/Toronto'
        },
        colorId: ev.colorId || '1'
      };

      const existingGcalId = eventMap[ev.id];

      if (existingGcalId) {
        // Update existing event (PUT)
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingGcalId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(gcalEventPayload)
          }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `Google Calendar API error (${res.status}): ${res.statusText}`);
        }
      } else {
        // Create new event (POST)
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(gcalEventPayload)
          }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `Google Calendar API error (${res.status}): ${res.statusText}`);
        }

        const created = await res.json();
        if (created.id) {
          eventMap[ev.id] = created.id;
        }
      }

      // Small throttling delay (40ms) to respect Google API quotas
      await new Promise(r => setTimeout(r, 40));

      synced++;
      if (onProgress) {
        onProgress({
          total,
          current: synced,
          status: 'SYNCING',
          message: `Syncing event ${synced}/${total}: ${ev.title}`
        });
      }
    }

    storageSet(GCAL_STORAGE_MAP_KEY, eventMap);

    if (onProgress) {
      onProgress({
        total,
        current: synced,
        status: 'SUCCESS',
        message: `Successfully synchronized ${synced} events directly to Google Calendar!`
      });
    }

    return { success: true, count: synced };
  } catch (err: any) {
    if (onProgress) {
      onProgress({
        total,
        current: synced,
        status: 'ERROR',
        message: `Google Calendar sync error: ${err.message}`
      });
    }
    return { success: false, count: synced, error: err.message };
  }
}

export function getStoredGCalClientId(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (globalThis as any).process?.env?.VITE_GOOGLE_CLIENT_ID || '';
  return storageGetRaw(GCAL_CLIENT_ID_KEY) || envKey;
}

export function saveGCalClientId(clientId: string): void {
  storageSetRaw(GCAL_CLIENT_ID_KEY, clientId.trim());
}

/**
 * 1-Click Direct Google Calendar Sync without requiring manual client ID input.
 */
export async function triggerGoogleCalendarOAuthSync(
  calendarEvents: CalendarEvent[],
  onProgress?: (p: GCalSyncProgress) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  const clientId = getStoredGCalClientId();
  if (!clientId) {
    return { success: false, count: 0, error: 'Identifiant Google Client ID manquant.' };
  }

  if (onProgress) {
    onProgress({
      total: calendarEvents.length,
      current: 0,
      status: 'SYNCING',
      message: 'Demande d\'autorisation auprès de Google Agenda...'
    });
  }

  return new Promise(resolve => {
    try {
      const runClient = () => {
        const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              const err = `Autorisation refusée : ${tokenResponse.error}`;
              if (onProgress) onProgress({ total: calendarEvents.length, current: 0, status: 'ERROR', message: err });
              resolve({ success: false, count: 0, error: err });
              return;
            }
            const res = await syncDirectToGoogleCalendar(calendarEvents, tokenResponse.access_token, 'primary', onProgress);
            resolve(res);
          }
        });

        if (!client) {
          const err = 'Impossible d\'initialiser le client Google Identity Services';
          if (onProgress) onProgress({ total: calendarEvents.length, current: 0, status: 'ERROR', message: err });
          resolve({ success: false, count: 0, error: err });
          return;
        }

        client.requestAccessToken();
      };

      if (!(window as any).google?.accounts?.oauth2) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => runClient();
        script.onerror = () => {
          const err = 'Échec du chargement du module Google Identity';
          if (onProgress) onProgress({ total: calendarEvents.length, current: 0, status: 'ERROR', message: err });
          resolve({ success: false, count: 0, error: err });
        };
        document.body.appendChild(script);
      } else {
        runClient();
      }
    } catch (err: any) {
      const msg = err.message || 'Erreur OAuth';
      if (onProgress) onProgress({ total: calendarEvents.length, current: 0, status: 'ERROR', message: msg });
      resolve({ success: false, count: 0, error: msg });
    }
  });
}
