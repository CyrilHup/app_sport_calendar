import { describe, expect, it, vi } from 'vitest';
import {
  assertNoConflictingScheduledQmtRun,
  cancelExactScheduledQmtRun,
  cancelRegisteredGarminRun,
  findScheduledQmtWorkoutReplacementIds,
  findScheduledQmtRunIds,
  finishWorkoutReplacement,
  finishWorkoutReplacements,
  isExactWorkoutScheduledOnDate,
  scheduleAndReplacePreviousWorkouts,
  scheduleWorkoutWithReadback,
  verifyReplaceableWorkout
} from './garminWorkoutReplacement';

describe('exact Garmin workout replacement', () => {
  it('cancels only the exact scheduled QMT run, not another workout or activity', async () => {
    let scheduled = true;
    const client = {
      getMonthCalendarEvents: vi.fn().mockImplementation(async () => ({ calendarItems: [
        ...(scheduled ? [{ date: '2026-09-24', workoutId: 123 }] : []),
        { date: '2026-09-24', workoutId: 456 }
      ] })),
      getWorkoutDetail: vi.fn().mockImplementation(async ({ workoutId }) => ({
        workoutId,
        workoutName: workoutId === '123' ? '[QMT] Easy run' : 'Personal run',
        sportType: { sportTypeKey: 'running' }
      })),
      deleteWorkout: vi.fn().mockImplementation(async () => { scheduled = false; })
    };

    await cancelExactScheduledQmtRun(client, '2026-09-24', '123');
    expect(client.deleteWorkout).toHaveBeenCalledOnce();
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });

  it('accepts a lost delete response only after the exact ID disappears', async () => {
    let scheduled = true;
    const client = {
      getMonthCalendarEvents: vi.fn().mockImplementation(async () => ({ calendarItems:
        scheduled ? [{ date: '2026-09-24', workoutId: 123 }] : []
      })),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 123, workoutName: '[QMT] Easy run', sportType: { sportTypeKey: 'running' }
      }),
      deleteWorkout: vi.fn().mockImplementation(async () => { scheduled = false; throw new Error('timeout'); })
    };

    await expect(cancelExactScheduledQmtRun(client, '2026-09-24', '123')).resolves.toBeUndefined();
    await expect(cancelExactScheduledQmtRun(client, '2026-09-24', '123')).resolves.toBeUndefined();
    expect(client.deleteWorkout).toHaveBeenCalledOnce();
  });

  it('refuses an exact ID that is not a verified QMT run on that date', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [{ date: '2026-09-24', workoutId: 123 }] }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 123, workoutName: 'Personal run', sportType: { sportTypeKey: 'running' }
      }),
      deleteWorkout: vi.fn()
    };

    await expect(cancelExactScheduledQmtRun(client, '2026-09-24', '123')).rejects.toThrow('pas une course [QMT]');
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('does not claim cancellation when Garmin still schedules the run after a delete error', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [{ date: '2026-09-24', workoutId: 123 }] }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 123, workoutName: '[QMT] Easy run', sportType: { sportTypeKey: 'running' }
      }),
      deleteWorkout: vi.fn().mockRejectedValue(new Error('Garmin refused'))
    };

    await expect(cancelExactScheduledQmtRun(client, '2026-09-24', '123'))
      .rejects.toThrow('reste programmée');
  });

  it('never deletes a scheduled workout without an exact account registry row', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [{ date: '2026-09-24', workoutId: 123 }] }),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn()
    };
    const registry = { contains: vi.fn().mockResolvedValue(false), markCancelled: vi.fn() };

    await expect(cancelRegisteredGarminRun(client, '2026-09-24', '123', registry))
      .rejects.toThrow('non confirmé dans le registre');
    expect(client.deleteWorkout).not.toHaveBeenCalled();
    expect(registry.markCancelled).not.toHaveBeenCalled();
  });

  it('clears the registry only after Garmin confirms the exact run is gone', async () => {
    let scheduled = true;
    const client = {
      getMonthCalendarEvents: vi.fn().mockImplementation(async () => ({ calendarItems:
        scheduled ? [{ date: '2026-09-24', workoutId: 123 }] : []
      })),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: 123, workoutName: '[QMT] Easy run', sportType: { sportTypeKey: 'running' }
      }),
      deleteWorkout: vi.fn().mockImplementation(async () => { scheduled = false; })
    };
    const registry = { contains: vi.fn().mockResolvedValue(true), markCancelled: vi.fn().mockResolvedValue(undefined) };

    await cancelRegisteredGarminRun(client, '2026-09-24', '123', registry);
    expect(registry.markCancelled).toHaveBeenCalledOnce();
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });
  it('recognizes a schedule accepted despite Garmin losing its response', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [
        { date: '2026-09-24', workoutId: 456 },
        { date: '2026-09-25', workoutId: 789 }
      ] }),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn()
    };
    await expect(isExactWorkoutScheduledOnDate(client, '2026-09-24', '456')).resolves.toBe(true);
    await expect(isExactWorkoutScheduledOnDate(client, '2026-09-24', '789')).resolves.toBe(false);
    expect(client.getMonthCalendarEvents).toHaveBeenCalledWith(2026, 8);
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('refuses to infer scheduling from an incomplete Garmin calendar', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({}),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn()
    };
    await expect(isExactWorkoutScheduledOnDate(client, '2026-09-24', '456'))
      .rejects.toThrow('incomplet');
  });

  it('continues replacement when Garmin scheduled the exact new ID before timing out', async () => {
    const client = {
      scheduleWorkout: vi.fn().mockRejectedValue(new Error('response timeout')),
      getMonthCalendarEvents: vi.fn().mockResolvedValue({
        calendarItems: [{ date: '2026-09-24', workoutId: 456 }]
      }),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn().mockResolvedValue(undefined)
    };
    await expect(scheduleWorkoutWithReadback(client, '456', '2026-09-24')).resolves.toBeUndefined();
    await finishWorkoutReplacement(client, '123', '456');
    expect(client.deleteWorkout).toHaveBeenCalledOnce();
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });

  it('requires manual review when scheduling and exact-ID cleanup are both uncertain', async () => {
    const client = {
      scheduleWorkout: vi.fn().mockRejectedValue(new Error('response timeout')),
      getMonthCalendarEvents: vi.fn().mockRejectedValue(new Error('calendar timeout')),
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn().mockRejectedValue(new Error('delete timeout'))
    };
    await expect(scheduleWorkoutWithReadback(client, '456', '2026-09-24'))
      .rejects.toThrow('Programmation Garmin à vérifier');
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '456' });
  });

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

  it('retries only the exact old ID when readback is unavailable after a lost delete response', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockRejectedValue({ response: { status: 503 } }),
      deleteWorkout: vi.fn().mockRejectedValueOnce(new Error('Connection closed')).mockResolvedValueOnce(undefined)
    };

    await expect(finishWorkoutReplacement(client, '123', '456')).resolves.toBeUndefined();

    expect(client.deleteWorkout).toHaveBeenCalledTimes(2);
    expect(client.deleteWorkout).toHaveBeenNthCalledWith(1, { workoutId: '123' });
    expect(client.deleteWorkout).toHaveBeenNthCalledWith(2, { workoutId: '123' });
  });

  it('treats an exact old-ID 404 on the retry as already removed', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockRejectedValue({ response: { status: 503 } }),
      deleteWorkout: vi.fn()
        .mockRejectedValueOnce(new Error('Connection closed'))
        .mockRejectedValueOnce({ response: { status: 404 } })
    };

    await expect(finishWorkoutReplacement(client, '123', '456')).resolves.toBeUndefined();
    expect(client.deleteWorkout).toHaveBeenCalledTimes(2);
    expect(client.deleteWorkout).toHaveBeenLastCalledWith({ workoutId: '123' });
  });

  it('preserves the new workout and asks for manual review when the old-ID lookup is ambiguous', async () => {
    const client = {
      getWorkoutDetail: vi.fn().mockRejectedValue({ response: { status: 503 } }),
      deleteWorkout: vi.fn().mockRejectedValue(new Error('Connection closed'))
    };
    await expect(finishWorkoutReplacement(client, '123', '456'))
      .rejects.toThrow('suppression exacte n’a pas pu être confirmée après une relance');
    expect(client.deleteWorkout).toHaveBeenCalledTimes(2);
    expect(client.deleteWorkout).toHaveBeenCalledWith({ workoutId: '123' });
  });
});

describe('same-date Garmin running workout guard', () => {
  const scheduledDate = '2026-09-22';

  it('collects every exact old app-created running ID, excluding unrelated workouts', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [
        { date: scheduledDate, workoutId: 123 },
        { date: scheduledDate, workoutId: 456 },
        { date: scheduledDate, workoutId: 789 },
        { date: '2026-09-23', workoutId: 999 }
      ] }),
      getWorkoutDetail: vi.fn().mockImplementation(async ({ workoutId }) => ({
        workoutId,
        workoutName: workoutId === '789' ? 'Personal run' : '[QMT] Running workout',
        sportType: { sportTypeKey: 'running' }
      })),
      deleteWorkout: vi.fn().mockResolvedValue(undefined)
    };
    const oldIds = await findScheduledQmtRunIds(client, scheduledDate);
    expect(oldIds).toEqual(['123', '456']);
    await finishWorkoutReplacements(client, oldIds, '999');
    expect(client.deleteWorkout).toHaveBeenCalledTimes(2);
    expect(client.deleteWorkout).toHaveBeenNthCalledWith(1, { workoutId: '123' });
    expect(client.deleteWorkout).toHaveBeenNthCalledWith(2, { workoutId: '456' });
  });

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

describe('exact replacement IDs for every Garmin workout type', () => {
  const scheduledDate = '2026-09-25';

  it('returns only the exact registered QMT strength ID when it is still scheduled that day', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [
        { date: scheduledDate, workoutId: 123 },
        { date: scheduledDate, workoutId: 456 }
      ] }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: '123',
        workoutName: '[QMT] Entraînement Calisthénie',
        sportType: { sportTypeKey: 'cardio_training' }
      }),
      deleteWorkout: vi.fn()
    };

    const previousIds = await findScheduledQmtWorkoutReplacementIds(
      client, scheduledDate, 'STRENGTH', '123'
    );

    expect(previousIds).toEqual(['123']);
    expect(client.getWorkoutDetail).toHaveBeenCalledWith({ workoutId: '123' });
    expect(client.getMonthCalendarEvents).toHaveBeenCalledWith(2026, 8);
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('refuses a stale non-running ID that no longer appears on the scheduled date', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [
        { date: scheduledDate, workoutId: 456 }
      ] }),
      getWorkoutDetail: vi.fn().mockResolvedValue({
        workoutId: '123',
        workoutName: '[QMT] Entraînement Calisthénie',
        sportType: { sportTypeKey: 'cardio_training' }
      }),
      deleteWorkout: vi.fn()
    };

    await expect(findScheduledQmtWorkoutReplacementIds(
      client, scheduledDate, 'STRENGTH', '123'
    )).rejects.toThrow('n\'est plus programmée le 2026-09-25');
    expect(client.deleteWorkout).not.toHaveBeenCalled();
  });

  it('keeps run replacement cleanup broad enough to retire same-day legacy QMT runs', async () => {
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [
        { date: scheduledDate, workoutId: 123 },
        { date: scheduledDate, workoutId: 456 },
        { date: scheduledDate, workoutId: 789 }
      ] }),
      getWorkoutDetail: vi.fn().mockImplementation(async ({ workoutId }) => ({
        workoutId,
        workoutName: '[QMT] Easy run',
        sportType: { sportTypeKey: 'running' }
      })),
      deleteWorkout: vi.fn()
    };

    const previousIds = await findScheduledQmtWorkoutReplacementIds(
      client, scheduledDate, 'RUNNING', '123'
    );

    expect(previousIds).toEqual(['123', '456', '789']);
  });

  it('confirms the new schedule before deleting an exact previous ID', async () => {
    const operations: string[] = [];
    const client = {
      getMonthCalendarEvents: vi.fn(),
      getWorkoutDetail: vi.fn(),
      scheduleWorkout: vi.fn().mockImplementation(async ({ workoutId }, date) => {
        operations.push(`schedule:${workoutId}:${date}`);
      }),
      deleteWorkout: vi.fn().mockImplementation(async ({ workoutId }) => {
        operations.push(`delete:${workoutId}`);
      })
    };

    await scheduleAndReplacePreviousWorkouts(client, '999', scheduledDate, ['123']);

    expect(operations).toEqual([
      `schedule:999:${scheduledDate}`,
      'delete:123'
    ]);
  });

  it('preserves the old scheduled workout when the new schedule cannot be confirmed', async () => {
    const operations: string[] = [];
    const client = {
      getMonthCalendarEvents: vi.fn().mockResolvedValue({ calendarItems: [] }),
      getWorkoutDetail: vi.fn(),
      scheduleWorkout: vi.fn().mockImplementation(async ({ workoutId }) => {
        operations.push(`schedule:${workoutId}`);
        throw new Error('Garmin unavailable');
      }),
      deleteWorkout: vi.fn().mockImplementation(async ({ workoutId }) => {
        operations.push(`delete:${workoutId}`);
      })
    };

    await expect(scheduleAndReplacePreviousWorkouts(client, '999', scheduledDate, ['123']))
      .rejects.toThrow('Séance créée mais non programmée');

    expect(operations).toEqual(['schedule:999', 'delete:999']);
  });
});
