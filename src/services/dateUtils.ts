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
  const d = new Date(dateStr + 'T12:00:00');
  const day = (d.getDay() + 6) % 7; // 0=Lundi, ..., 6=Dimanche
  const mon = new Date(d);
  mon.setDate(d.getDate() - day);
  return formatDateKey(mon);
}

/**
 * Extrait la clé de date locale 'YYYY-MM-DD' d'une activité Garmin sans dérive de fuseau horaire.
 */
export function getGarminLocalDateKey(act?: { startTimeLocal?: string; date?: string } | null): string {
  if (!act) return formatDateKey(new Date());
  if (act.startTimeLocal) {
    return act.startTimeLocal.slice(0, 10);
  }
  if (act.date) {
    return act.date.slice(0, 10);
  }
  return formatDateKey(new Date());
}

/**
 * Formate une date 'YYYY-MM-DD' en texte court et convivial (ex: "sam. 5 sept.").
 */
export function formatFriendlyDay(dateKey: string): string {
  try {
    const d = new Date(dateKey + 'T12:00:00');
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
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}
