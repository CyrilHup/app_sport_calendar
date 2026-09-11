/**
 * Utilitaires unifiés pour la manipulation des dates et des heures.
 * Évite les dérives de fuseaux horaires et centralise les calculs de microcycles (semaines débutant le lundi).
 */

/**
 * Formate un objet Date en clé locale 'YYYY-MM-DD'.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Analyse une clé 'YYYY-MM-DD' et retourne un objet Date local calé à minuit (00:00:00.000).
 * Évite l'écueil du constructeur `new Date("YYYY-MM-DD")` qui interprète la date en UTC minuit.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(dateStr);
}

/**
 * Additionne ou soustrait des jours civils de manière sécurisée (immunisée contre les changements d'heure DST).
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Extrait la clé 'YYYY-MM-DD' strictement locale à partir d'une Date ou d'une chaîne ISO / locale.
 * Corrige le bug où `startDate.slice(0, 10)` sur une chaîne UTC du soir (ex: 20h30 EDT = 00h30 UTC)
 * renvoyait le lendemain.
 */
export function toLocalDateKey(input?: Date | string | null): string {
  if (!input) return formatDateKey(new Date());

  if (input instanceof Date) {
    return formatDateKey(input);
  }

  if (typeof input === 'string') {
    // Si la chaîne est déjà exactement 'YYYY-MM-DD'
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }

    // Si c'est une chaîne ISO contenant 'Z' ou un offset (+/-)
    // On instancie la Date et on extrait ses composantes locales
    if (input.includes('Z') || input.includes('+') || (input.includes('T') && input.length > 19)) {
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) {
        return formatDateKey(parsed);
      }
    }

    // Si c'est un format Garmin local avec espace (ex: "2026-09-09 18:30:00")
    if (input.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(input)) {
      return input.slice(0, 10);
    }

    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return formatDateKey(parsed);
    }
  }

  return formatDateKey(new Date());
}

/**
 * Retourne la date du lundi (00:00:00.000) pour une date donnée.
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Lundi, ..., 6=Dimanche
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calcule la clé de début de semaine (Lundi 'YYYY-MM-DD') pour une date 'YYYY-MM-DD'.
 */
export function getMondayWeekKey(dateStr: string): string {
  if (!dateStr) return '';
  const localDate = parseLocalDate(dateStr);
  const monday = getMondayOfWeek(localDate);
  return formatDateKey(monday);
}

/**
 * Extrait la clé de date locale 'YYYY-MM-DD' d'une activité Garmin sans dérive de fuseau horaire.
 */
export function getGarminLocalDateKey(act?: { startTimeLocal?: string; date?: string } | null): string {
  if (!act) return formatDateKey(new Date());
  return toLocalDateKey(act.startTimeLocal || act.date);
}

/**
 * Formate une date 'YYYY-MM-DD' en texte court et convivial (ex: "sam. 5 sept.").
 */
export function formatFriendlyDay(dateKey: string): string {
  try {
    const d = parseLocalDate(dateKey);
    return d.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateKey;
  }
}

/**
 * Formate une date ou chaîne ISO en heure lisible 'HH:mm' (24h).
 */
export function formatTime(dateOrIso: Date | string): string {
  try {
    const d = typeof dateOrIso === 'string'
      ? (dateOrIso.includes(' ') ? new Date(dateOrIso.replace(' ', 'T')) : new Date(dateOrIso))
      : dateOrIso;
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}
