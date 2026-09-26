import { describe, expect, it } from 'vitest';
import { validateGarminRequest } from './garminRequest';

describe('validateGarminRequest', () => {
  it('normalizes a bounded incremental sync request', () => {
    expect(validateGarminRequest({ email: '  athlete@example.com ', limit: 500, offset: 200 })).toMatchObject({
      email: 'athlete@example.com',
      action: 'sync',
      syncMode: 'incremental',
      limit: 100,
      offset: 200
    });
  });

  it('rejects unknown actions and sync modes', () => {
    expect(() => validateGarminRequest({ action: 'erase-account' })).toThrow('Action Garmin');
    expect(() => validateGarminRequest({ syncMode: 'everything' })).toThrow('Mode de synchronisation');
  });

  it('requires a scheduled, structurally valid workout before it can be pushed', () => {
    const request = {
      action: 'push-workout',
      workout: {
        title: 'Easy run',
        scheduledDate: '2026-09-16',
        sportType: 'RUNNING',
        steps: [{ stepType: 'INTERVAL', durationSeconds: 1800 }]
      }
    };
    expect(validateGarminRequest(request).workout?.title).toBe('Easy run');
    expect(() => validateGarminRequest({ ...request, workout: { ...request.workout, steps: [] } })).toThrow('Étapes');
    expect(() => validateGarminRequest({ ...request, workout: { ...request.workout, scheduledDate: 'tomorrow' } })).toThrow('Date');
    expect(validateGarminRequest({ ...request, workout: { ...request.workout, replaceWorkoutId: '123' } }).workout?.replaceWorkoutId).toBe('123');
    expect(() => validateGarminRequest({ ...request, workout: { ...request.workout, replaceWorkoutId: 'old-workout' } })).toThrow('Identifiant');
  });

  it('rejects the retired fuzzy duplicate-cleanup action', () => {
    expect(() => validateGarminRequest({ action: 'clean-duplicates' })).toThrow('Action Garmin');
  });

  it('requires an exact date and numeric ID for cancelling a planned workout', () => {
    expect(validateGarminRequest({ action: 'cancel-workout', cancellation: {
      scheduledDate: '2026-09-24', workoutId: '123'
    } }).cancellation).toEqual({ scheduledDate: '2026-09-24', workoutId: '123' });
    expect(() => validateGarminRequest({ action: 'cancel-workout', cancellation: {
      scheduledDate: '2026-09-24', workoutId: 'unknown'
    } })).toThrow('identifiant exact');
  });

  it('bounds subjective-detail reads to five exact activity IDs', () => {
    expect(validateGarminRequest({ action: 'get-activity-feedback', activityIds: ['123', '456'] }).activityIds)
      .toEqual(['123', '456']);
    expect(() => validateGarminRequest({ action: 'get-activity-feedback', activityIds: ['../../secrets'] }))
      .toThrow('Identifiants');
    expect(() => validateGarminRequest({ action: 'get-activity-feedback', activityIds: Array(6).fill('123') }))
      .toThrow('Identifiants');
  });
});
