import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { isNative } from './apiConfig';
import { triggerHapticFeedback } from './hapticsService';

export interface WorkoutAlarmRequest {
  workoutId: string;
  title: string;
  workoutDate: Date | string;
  minutesBefore: number;
  notes?: string;
}

export interface ScheduledAlarmItem {
  id: number;
  workoutId: string;
  title: string;
  scheduledTime: string;
  minutesBefore: number;
}

import { STORAGE_KEYS, storageGet, storageSet } from './storageService';

const STORAGE_KEY_ALARMS = STORAGE_KEYS.ALARMS;

function getStoredAlarms(): ScheduledAlarmItem[] {
  return storageGet<ScheduledAlarmItem[]>(STORAGE_KEY_ALARMS, []);
}

function saveStoredAlarms(alarms: ScheduledAlarmItem[]): void {
  storageSet(STORAGE_KEY_ALARMS, alarms);
}

/**
 * Initializes notification channels on Android for maximum priority and sound.
 */
export async function initializeNotificationChannels(): Promise<void> {
  if (!isNative()) return;

  try {
    await LocalNotifications.createChannel({
      id: 'workout_reminders',
      name: 'Rappels & Alarmes Entraînement',
      description: 'Notifications prioritaires avant les séances de course et de musculation',
      importance: 5, // High importance (heads-up notification + sound)
      visibility: 1, // Public on lockscreen
      vibration: true,
      lights: true,
      lightColor: '#3b82f6'
    });
  } catch (err) {
    console.warn('Could not create notification channel:', err);
  }
}

/**
 * Requests Android 13+ notification permissions if not already granted.
 */
export async function requestAlarmPermissions(): Promise<boolean> {
  if (isNative()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        return true;
      }
      const requested = await LocalNotifications.requestPermissions();
      return requested.display === 'granted';
    } catch (err) {
      console.error('Error requesting local notification permission:', err);
      return false;
    }
  }

  // Web Browser fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  return true;
}

/**
 * Schedules a local alarm/notification for a specific workout session.
 */
export async function scheduleWorkoutAlarm(req: WorkoutAlarmRequest): Promise<{ success: boolean; message: string }> {
  await triggerHapticFeedback('medium');

  const workoutDate = new Date(req.workoutDate);
  if (isNaN(workoutDate.getTime())) {
    return { success: false, message: 'Date de séance invalide.' };
  }

  const triggerTime = new Date(workoutDate.getTime() - req.minutesBefore * 60 * 1000);
  const now = new Date();

  if (triggerTime.getTime() <= now.getTime()) {
    return {
      success: false,
      message: `L'heure du rappel (${triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) est déjà passée!`
    };
  }

  const hasPermission = await requestAlarmPermissions();
  if (!hasPermission) {
    return { success: false, message: 'Permission de notification refusée par le système Android.' };
  }

  // Generate a unique 31-bit integer ID for Android NotificationManager
  const notificationId = Math.abs(
    (req.workoutId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 1000 + req.minutesBefore) % 2147483647
  );

  const formattedRunTime = workoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bodyText = req.minutesBefore === 0
    ? `C'est l'heure! Votre séance "${req.title}" démarre maintenant (${formattedRunTime}).`
    : `Départ dans ${req.minutesBefore} min pour "${req.title}" (prévu à ${formattedRunTime}). Enfilez vos chaussures!`;

  if (isNative()) {
    try {
      await initializeNotificationChannels();

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: `🏃 Rappel Séance: ${req.title}`,
            body: bodyText,
            schedule: {
              at: triggerTime,
              allowWhileIdle: true // Wakes Android phone even in Doze power-saving mode
            },
            channelId: 'workout_reminders',
            extra: {
              workoutId: req.workoutId,
              minutesBefore: req.minutesBefore
            }
          }
        ]
      });

      // Save into local list for UI display
      const current = getStoredAlarms().filter(a => a.id !== notificationId);
      current.push({
        id: notificationId,
        workoutId: req.workoutId,
        title: req.title,
        scheduledTime: triggerTime.toISOString(),
        minutesBefore: req.minutesBefore
      });
      saveStoredAlarms(current);

      await triggerHapticFeedback('success');
      return {
        success: true,
        message: `Alarme programmée pour ${triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${req.minutesBefore}m avant)!`
      };
    } catch (err: any) {
      console.error('Failed to schedule Android local notification:', err);
      return { success: false, message: `Erreur: ${err.message || 'Impossible de planifier la notification'}` };
    }
  }

  // Web Browser fallback simulation
  const current = getStoredAlarms().filter(a => a.id !== notificationId);
  current.push({
    id: notificationId,
    workoutId: req.workoutId,
    title: req.title,
    scheduledTime: triggerTime.toISOString(),
    minutesBefore: req.minutesBefore
  });
  saveStoredAlarms(current);

  await triggerHapticFeedback('success');
  return {
    success: true,
    message: `Rappel programmé à ${triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Navigateur Web).`
  };
}

/**
 * Returns all active scheduled alarms.
 */
export async function getActiveAlarms(): Promise<ScheduledAlarmItem[]> {
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending();
      const stored = getStoredAlarms();
      const pendingIds = new Set(pending.notifications.map(n => n.id));
      const active = stored.filter(s => pendingIds.has(s.id));
      saveStoredAlarms(active);
      return active;
    } catch {
      return getStoredAlarms();
    }
  }
  return getStoredAlarms();
}

/**
 * Cancels a scheduled alarm.
 */
export async function cancelWorkoutAlarm(alarmId: number): Promise<void> {
  await triggerHapticFeedback('light');
  if (isNative()) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: alarmId }] });
    } catch (e) {
      console.warn('Error cancelling native notification:', e);
    }
  }
  const stored = getStoredAlarms().filter(a => a.id !== alarmId);
  saveStoredAlarms(stored);
}
