import { CalendarEvent } from '../types/calendar';

const GCAL_STORAGE_MAP_KEY = 'gcal_synced_events_map_v1';
const GCAL_CLIENT_ID_KEY = 'gcal_oauth_client_id';

export interface GCalSyncProgress {
  total: number;
  current: number;
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  message: string;
}

// Generate RFC 5545 compliant iCalendar string for 1-click import or subscription
export function generateICSContent(events: CalendarEvent[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  const formatICSDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QMT-80 Ultra-Trail Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:QMT-80 & ÉTS Schedule',
    'X-WR-TIMEZONE:America/Toronto',
    'X-WR-CALDESC:Dynamic Ultra-Trail training and ÉTS schedule synced from QMT-80 Performance Hub'
  ];

  const nowStamp = formatICSDate(new Date().toISOString());

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id.replace(/[^a-zA-Z0-9_-]/g, '_')}@qmt80-hub`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${formatICSDate(ev.startDate)}`);
    lines.push(`DTEND:${formatICSDate(ev.endDate)}`);
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);

    let fullDesc = ev.description || '';
    if (ev.metadata?.targetHeartRate) {
      fullDesc += `\nTarget HR: ${ev.metadata.targetHeartRate}`;
    }
    if (ev.metadata?.targetElevationM) {
      fullDesc += `\nTarget Elevation D+: +${ev.metadata.targetElevationM}m`;
    }
    if (ev.metadata?.nutritionAdvice) {
      fullDesc += `\nFueling: ${ev.metadata.nutritionAdvice}`;
    }
    if (ev.metadata?.room) {
      fullDesc += `\nRoom: ${ev.metadata.room}`;
    }

    lines.push(`DESCRIPTION:${escapeICS(fullDesc)}`);
    lines.push(`LOCATION:${escapeICS(ev.location)}`);
    lines.push(`CATEGORIES:${ev.category.toUpperCase()}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
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
  const storedMapRaw = localStorage.getItem(GCAL_STORAGE_MAP_KEY);
  const eventMap: Record<string, string> = storedMapRaw ? JSON.parse(storedMapRaw) : {};

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

    localStorage.setItem(GCAL_STORAGE_MAP_KEY, JSON.stringify(eventMap));

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
  return localStorage.getItem(GCAL_CLIENT_ID_KEY) || '';
}

export function saveGCalClientId(clientId: string): void {
  localStorage.setItem(GCAL_CLIENT_ID_KEY, clientId.trim());
}
