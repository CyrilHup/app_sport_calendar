import { CalendarEvent } from '../types/calendar';

const pad = (value: number) => String(value).padStart(2, '0');

function formatIcsDate(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Pure RFC 5545 serialization shared by browser downloads and the API feed. */
export function generateICSContent(events: CalendarEvent[], generatedAt: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sport Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Training & Academic Schedule',
    'X-WR-TIMEZONE:America/Toronto'
  ];

  const nowStamp = formatIcsDate(generatedAt.toISOString());
  for (const event of events) {
    const descriptionParts = [event.description || ''];
    if (event.metadata?.targetHeartRate) descriptionParts.push(`Target HR: ${event.metadata.targetHeartRate}`);
    if (event.metadata?.targetElevationM) descriptionParts.push(`Target Elevation D+: +${event.metadata.targetElevationM}m`);
    if (event.metadata?.nutritionAdvice) descriptionParts.push(`Fueling: ${event.metadata.nutritionAdvice}`);
    if (event.metadata?.room) descriptionParts.push(`Room: ${event.metadata.room}`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id.replace(/[^a-zA-Z0-9_-]/g, '_')}@sport-calendar`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${formatIcsDate(event.startDate)}`,
      `DTEND:${formatIcsDate(event.endDate)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.filter(Boolean).join('\n'))}`,
      `LOCATION:${escapeIcsText(event.location || '')}`,
      `CATEGORIES:${event.category.toUpperCase()}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
