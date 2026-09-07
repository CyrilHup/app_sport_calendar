import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage for Node test runner
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
(globalThis as any).localStorage = mockLocalStorage;

import { scheduleWorkoutAlarm, getActiveAlarms, cancelWorkoutAlarm } from './mobileAlarmService';

describe('mobileAlarmService', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  it('rejects alarms scheduled in the past', async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const result = await scheduleWorkoutAlarm({
      workoutId: 'workout-123',
      title: 'Course test passé',
      workoutDate: pastDate,
      minutesBefore: 15
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('déjà passée');
  });

  it('schedules future alarms and persists them in local storage', async () => {
    const futureDate = new Date(Date.now() + 2 * 3600 * 1000); // 2 hours in the future
    const result = await scheduleWorkoutAlarm({
      workoutId: 'workout-future',
      title: 'Sortie Longue 20km',
      workoutDate: futureDate,
      minutesBefore: 30
    });

    expect(result.success).toBe(true);

    const active = await getActiveAlarms();
    expect(active.length).toBe(1);
    expect(active[0].workoutId).toBe('workout-future');
    expect(active[0].minutesBefore).toBe(30);
  });

  it('allows cancelling an active scheduled alarm', async () => {
    const futureDate = new Date(Date.now() + 3 * 3600 * 1000);
    await scheduleWorkoutAlarm({
      workoutId: 'workout-cancel',
      title: 'Fractionné',
      workoutDate: futureDate,
      minutesBefore: 15
    });

    let active = await getActiveAlarms();
    expect(active.length).toBe(1);

    await cancelWorkoutAlarm(active[0].id);

    active = await getActiveAlarms();
    expect(active.length).toBe(0);
  });
});
