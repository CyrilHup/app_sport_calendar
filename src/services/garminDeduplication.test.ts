import { describe, it, expect } from 'vitest';
import {
  hasGarminEmojiOrSpecialSymbols,
  normalizeWorkoutTitleForMatching,
  areWorkoutsEquivalent,
  identifyGarminDuplicates,
  GarminWorkoutItem
} from './garminDeduplication';

describe('garminDeduplication', () => {
  it('detects emojis and special symbols', () => {
    expect(hasGarminEmojiOrSpecialSymbols('🏃 Footing Z2')).toBe(true);
    expect(hasGarminEmojiOrSpecialSymbols('⚡ Côtes courtes')).toBe(true);
    expect(hasGarminEmojiOrSpecialSymbols('Footing Z2 / Endurance')).toBe(false);
    expect(hasGarminEmojiOrSpecialSymbols('Renforcement & Calisthenie')).toBe(false);
  });

  it('normalizes titles identically before and after emoji sanitization', () => {
    const rawWithEmoji = '🏃 Footing Z2 / Endurance fondamentale';
    const clean = 'Footing Z2 / Endurance fondamentale';
    expect(normalizeWorkoutTitleForMatching(rawWithEmoji)).toBe('footing z2 endurance fondamentale');
    expect(normalizeWorkoutTitleForMatching(clean)).toBe('footing z2 endurance fondamentale');
  });

  it('recognizes equivalence between emoji and sanitized versions', () => {
    expect(
      areWorkoutsEquivalent('🏃 Footing Z2 / Endurance fondamentale', 'Footing Z2 / Endurance fondamentale')
    ).toBe(true);

    expect(
      areWorkoutsEquivalent('⚡ Côtes courtes & PMA', 'Cotes courtes & PMA')
    ).toBe(true);

    expect(
      areWorkoutsEquivalent('🏋️ Renforcement & Calisthénie', 'Renforcement & Calisthenie')
    ).toBe(true);

    expect(
      areWorkoutsEquivalent('🧘 Evening Mobility & Stretching', 'Evening Mobility & Stretching')
    ).toBe(true);
  });

  it('handles FR55 truncation (36 characters limit)', () => {
    const full = 'Footing Z2 / Endurance fondamentale';
    const truncated = 'Footing Z2 / Endurance fondamen'; // 31 chars
    expect(areWorkoutsEquivalent(full, truncated)).toBe(true);
    expect(areWorkoutsEquivalent('🏃 Footing Z2 / Endurance fondamentale', truncated)).toBe(true);
  });

  it('differentiates truly different workouts', () => {
    expect(areWorkoutsEquivalent('Footing Z2', 'Sortie Longue D+ / Trail')).toBe(false);
    expect(areWorkoutsEquivalent('Côtes courtes & PMA', 'Evening Mobility & Stretching')).toBe(false);
    expect(areWorkoutsEquivalent('Footing Z2', 'Seuil / Tempo Z3')).toBe(false);
  });

  it('identifies duplicates in Garmin workouts list and selects the cleanest to keep', () => {
    const workouts: GarminWorkoutItem[] = [
      {
        workoutId: 101,
        workoutName: '🏃 Footing Z2 / Endurance fondamentale',
        createdDate: '2026-09-08T10:00:00Z',
        updateDate: '2026-09-08T10:00:00Z'
      },
      {
        workoutId: 102,
        workoutName: 'Footing Z2 / Endurance fondamentale',
        createdDate: '2026-09-09T03:00:00Z',
        updateDate: '2026-09-09T03:00:00Z'
      },
      {
        workoutId: 201,
        workoutName: 'Sortie Longue D+ / Trail',
        createdDate: '2026-09-09T03:00:00Z'
      }
    ];

    const dupGroups = identifyGarminDuplicates(workouts);
    expect(dupGroups.length).toBe(1);
    expect(dupGroups[0].keepWorkout.workoutId).toBe(102);
    expect(dupGroups[0].duplicatesToDelete.length).toBe(1);
    expect(dupGroups[0].duplicatesToDelete[0].workoutId).toBe(101);
  });
});
