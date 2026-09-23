import { describe, expect, it, vi } from 'vitest';
import {
  assertNoConflictingScheduledQmtRun,
  finishWorkoutReplacement,
  verifyReplaceableWorkout
} from './garminWorkoutReplacement';

describe('exact Garmin workout replacement', () => {
  it('requires the exact stored ID and app prefix before allowing a replacement', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockResolvedValue({ workoutId: 123, workoutName: '[QMT] Easy run' }),
      deleteWorkout: vi.fn()
    };
    await expect(verifyReplaceableWorkout(client, '123')).resolves.toBeUndefined();
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '123' });

    client.getWorkoutDetail.mockResolvedValueOnce({ workoutId: 124, workoutName: '[QMT] Easy run' });
    await expect(verifyReplaceableWorkout(client, '123')).rejects.toThrow('ne peut pas être vérifiée');
    client.getWorkoutDetail.mockResolvedValueOnce({ workoutId: 123, workoutName: 'Personal run' });
    await expect(verifyReplaceableWorkout(client, '123')).rejects.toThrow('ne peut pas être vérifiée');
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('deletes only the previous exact ID after a new workout is scheduled', async () => {
    const client = { getWorkoutDetail: vi.fn(), deleteWorkout: vi.fn().mockResolvedValue(undefined) };
    await finishWorkoutReplacement(client, '123', '456');
    expect(client.deleteWorkout).toHaveBeenCalledTimes(1);
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });

  it('rolls back only the new workout if the old ID is still present after delete fails', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockResolvedValue({ workoutId: 123, workoutName: '[QMT] Easy run' }),
      deleteWorkout: vi.fn().mockRejectedValueOnce(new Error('Garmin refused')).mockResolvedValueOnce(undefined)
    };
    await expect(finishWorkoutReplacement(client, '123', '456'))
      .rejects.toThrow('Ancienne séance Garmin 123 toujours présente ; la nouvelle 456 a été annulée');
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '123' });
    expect(client.deleteWorkout.mock.calls.map(([value]) => value.workoutId)).toEqual(['123', '456']);
  });

  it('reports both exact IDs if rollback also fails', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockResolvedValue({ workoutId: 123, workoutName: '[QMT] Easy run' }),
      deleteWorkout: vi.fn().mockRejectedValue(new Error('Garmin refused'))
    };
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(finishWorkoutReplacement(client, '123', '456'))
        .rejects.toThrow('ancienne séance 123 et nouvelle séance 456');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('treats an old-ID 404 as success if delete returned an error', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockRejectedValue({ response: { status: 404 } }),
      deleteWorkout: vi.fn().mockRejectedValueOnce(new Error('Connection closed'))
    };
    await expect(finishWorkoutReplacement(client, '123', '456')).resolves.toBeUndefined();
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '123' });
    expect(client.deleteWorkout).toHaveBeenCalledTimes(1);
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });

  it('preserves the new workout and asks for manual review when the old-ID lookup is ambiguous', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockRejectedValue({ response: { status: 503 } }),
      deleteWorkout: vi.fn().mockRejectedValueOnce(new Error('Connection closed'))
    };
    await expect(finishWorkoutReplacement(client, '123', '456'))
      .rejects.toThrow('ancienne séance 123 et nouvelle séance 456');
    expect(client.deleteWorkout).toHaveBeenCalledTimes(1);
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });
});

describe('same-date Garmin running workout guard', () => {
  const scheduledDate = '2026-09-22';

  it('refuses creation when another app-created running workout is already scheduled that date', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({
        calendarItems: [
          { date: '2026-09-21', workoutId: 321 },
          { date: scheduledDate, workoutId: 123 },
          { date: scheduledDate, workoutId: null, title: 'Other calendar event' }
        ]
      }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 123,
        workoutName: '[QMT] Easy run',
        sportType: { sportTypeKey: 'running' }
      }),
      deleteWorkout: vi.fn()
    };

    await expect(assertNoConflictingScheduledQmtRun(client, scheduledDate))
      .rejects.toThrow('(ID 123) est déjà programmée sur Garmin le 2026-09-22');
    expect(client.getMonthCalendarEvents).toHaveBeenCalledWith(2026, 8);
    expect(client.getWorkoutDetail).toHaveBeenCalledTimes(1);
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '123' });
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('allows an app-created workout of another sport on the same date', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({
        calendarItems: [{ date: scheduledDate, workoutId: 789 }]
      }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 789,
        workoutName: '[QMT] Strength session',
        sportType: { sportTypeKey: 'strength_training' }
      }),
      deleteWorkout: vi.fn()
    };
    await expect(assertNoConflictingScheduledQmtRun(client, scheduledDate)).resolves.toBeUndefined();
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '789' });
  });

  it('allows the exact verified replacement ID but refuses a different QMT run', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({
        calendarItems: [
          { date: scheduledDate, workoutId: 123 },
          { date: scheduledDate, workoutId: 124 }
        ]
      }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 124,
        workoutName: '[QMT] Tempo run',
        sportType: { sportTypeKey: 'running' }
      }),
      deleteWorkout: vi.fn()
    };
    await expect(assertNoConflictingScheduledQmtRun(client, scheduledDate, '123'))
      .rejects.toThrow('(ID 124) est déjà programmée sur Garmin le 2026-09-22');
    expect(client.getWorkoutDetail).toHaveBeenCalledTimes(1);
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '124' });
  });

  it('allows the exact verified replacement ID when it is the only QMT run that date', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({
        calendarItems: [{ date: scheduledDate, workoutId: 123 }]
      }),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn()
    };
    await expect(assertNoConflictingScheduledQmtRun(client, scheduledDate, '123')).resolves.toBeUndefined();
    expect(client.getWorkoutDetail).not.toHaveBeenCalled();
  });

  it('fails closed when the Garmin calendar cannot be read', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockRejectedValue(new Error('Garmin unavailable')),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn()
    };
    await expect(assertNoConflictingScheduledQmtRun(client, scheduledDate))
      .rejects.toThrow('Impossible de lire le calendrier Garmin du 2026-09-22; création refusée');
    expect(client.getWorkoutDetail).not.toHaveBeenCalled();
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('fails closed when same-date workout details cannot be verified', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({
        calendarItems: [{ date: scheduledDate, workoutId: 123 }]
      }),
      getWorkoutDetail: vi.fn().mockRejectedValue(new Error('Garmin unavailable')),
      deleteWorkout: vi.fn()
    };
    await expect(assertNoConflictingScheduledQmtRun(client, scheduledDate))
      .rejects.toThrow("Impossible de vérifier l'entraînement Garmin 123 du 2026-09-22; création refusée");
  });
});
