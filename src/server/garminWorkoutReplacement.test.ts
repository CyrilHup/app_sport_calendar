import { describe, expect, it, vi } from 'vitest';
import { finishWorkoutReplacement, verifyReplaceableWorkout } from './garminWorkoutReplacement';

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

  it('rolls back the new workout if deleting the previous one fails', async () => {
    const client = {
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn().mockRejectedValueOnce(new Error('Garmin refused')).mockResolvedValueOnce(undefined)
    };
    await expect(finishWorkoutReplacement(client, '123', '456')).rejects.toThrow('la nouvelle a été annulée');
    expect(client.deleteWorkout.mock.calls.map(([value]) => value.workoutId)).toEqual(['123', '456']);
  });

  it('reports both exact IDs if rollback also fails', async () => {
    const client = {
      getWorkoutDetail: vi.fn(),
      deleteWorkout: vi.fn().mockRejectedValue(new Error('Garmin refused'))
    };
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(finishWorkoutReplacement(client, '123', '456')).rejects.toThrow('123 et nouvelle séance 456');
    } finally {
      logSpy.mockRestore();
    }
  });
});
