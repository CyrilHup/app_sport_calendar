import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './apiConfig';

/**
 * Provides smooth tactile feedback on Android/iOS with fallback on Web.
 */
export async function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): Promise<void> {
  try {
    if (isNative()) {
      if (type === 'light') {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (type === 'medium') {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (type === 'heavy') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'warning') {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (type === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      }
    } else if ('vibrate' in navigator) {
      if (type === 'heavy' || type === 'warning' || type === 'error') {
        navigator.vibrate([40, 60, 40]);
      } else if (type === 'medium') {
        navigator.vibrate(30);
      } else {
        navigator.vibrate(15);
      }
    }
  } catch (e) {
    // Haptics not supported or permission denied
  }
}
