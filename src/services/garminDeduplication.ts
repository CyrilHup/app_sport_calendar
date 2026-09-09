/**
 * Utilitaires de déduplication et normalisation des séances d'entraînement Garmin.
 * Permet de détecter les équivalences entre séances (avant/après suppression des émojis,
 * troncatures 36 caractères de la Forerunner 55, variations d'accents ou de casse).
 */

export function hasGarminEmojiOrSpecialSymbols(text: string): boolean {
  if (!text) return false;
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}➔➜➝➞•●▪–—]/u.test(text);
}

/**
 * Normalise un titre de séance pour comparaison tolérante :
 * - Suppression des émojis et caractères spéciaux
 * - Suppression des accents (NFD)
 * - Minuscules
 * - Remplacement de la ponctuation par des espaces
 * - Fusion des espaces multiples
 */
export function normalizeWorkoutTitleForMatching(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[➔➜➝➞•●▪–—\-_/\\|:;,()[\]{}"'`~*+?&!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Détermine si deux titres de séances représentent la même séance d'entraînement.
 * Prend en compte :
 * 1. Égalité stricte normalisée
 * 2. Troncature due à la limite 36 caractères de la Forerunner 55
 * 3. Chevauchement important des mots-clés significatifs
 */
export function areWorkoutsEquivalent(title1: string, title2: string): boolean {
  const norm1 = normalizeWorkoutTitleForMatching(title1);
  const norm2 = normalizeWorkoutTitleForMatching(title2);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Vérification de préfixe (gestion de la troncature 36 car. sur montre)
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen >= 10 && (norm1.startsWith(norm2.slice(0, minLen)) || norm2.startsWith(norm1.slice(0, minLen)))) {
    return true;
  }

  // Chevauchement des mots-clés significatifs (longueur >= 3)
  const tokens1 = norm1.split(' ').filter(t => t.length >= 3);
  const tokens2 = norm2.split(' ').filter(t => t.length >= 3);
  if (tokens1.length > 0 && tokens2.length > 0) {
    const intersection = tokens1.filter(t => tokens2.includes(t));
    const overlap1 = intersection.length / tokens1.length;
    const overlap2 = intersection.length / tokens2.length;
    if (overlap1 >= 0.8 || overlap2 >= 0.8) {
      return true;
    }
  }

  return false;
}

export interface GarminWorkoutItem {
  workoutId: number | string;
  workoutName: string;
  createdDate?: string | Date;
  updateDate?: string | Date;
  description?: string;
  sportType?: any;
}

export interface DuplicateGroup {
  canonicalTitle: string;
  keepWorkout: GarminWorkoutItem;
  duplicatesToDelete: GarminWorkoutItem[];
}

/**
 * Analyse une liste d'entraînements Garmin et identifie les doublons à supprimer.
 * Conserve la version la plus propre (sans émojis, puis la plus récente).
 */
export function identifyGarminDuplicates(workouts: GarminWorkoutItem[]): DuplicateGroup[] {
  const groups: Array<{ canonicalTitle: string; workouts: GarminWorkoutItem[] }> = [];

  for (const w of workouts) {
    const title = w.workoutName || '';
    const matchGroup = groups.find(g => areWorkoutsEquivalent(g.canonicalTitle, title));
    if (matchGroup) {
      matchGroup.workouts.push(w);
    } else {
      groups.push({ canonicalTitle: title, workouts: [w] });
    }
  }

  const result: DuplicateGroup[] = [];

  for (const group of groups) {
    if (group.workouts.length <= 1) continue;

    // Trier les séances pour déterminer celle à CONSERVER en premier:
    // 1. Sans émojis en priorité
    // 2. Date de mise à jour / création la plus récente
    // 3. workoutId le plus élevé
    const sorted = [...group.workouts].sort((a, b) => {
      const aEmoji = hasGarminEmojiOrSpecialSymbols(a.workoutName);
      const bEmoji = hasGarminEmojiOrSpecialSymbols(b.workoutName);
      if (aEmoji !== bEmoji) {
        return aEmoji ? 1 : -1; // Le sans émojis est en tête
      }

      const aTime = a.updateDate ? new Date(a.updateDate).getTime() : 0;
      const bTime = b.updateDate ? new Date(b.updateDate).getTime() : 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }

      const aId = typeof a.workoutId === 'number' ? a.workoutId : parseInt(String(a.workoutId) || '0', 10);
      const bId = typeof b.workoutId === 'number' ? b.workoutId : parseInt(String(b.workoutId) || '0', 10);
      return bId - aId;
    });

    const keepWorkout = sorted[0];
    const duplicatesToDelete = sorted.slice(1);

    result.push({
      canonicalTitle: keepWorkout.workoutName,
      keepWorkout,
      duplicatesToDelete
    });
  }

  return result;
}
