import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNative } from './apiConfig';
import { initializeNotificationChannels } from './mobileAlarmService';

/**
 * Initializes mobile native plugins (Status bar, Splash screen, Notification channels).
 * Safely no-ops when running in the browser.
 */
export async function initializeNativeMobile(): Promise<void> {
  if (!isNative()) return;

  try {
    // 1. Theme Android status bar to match dark sports theme
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#090d16' });
  } catch (e) {
    console.warn('Status bar styling unavailable:', e);
  }

  try {
    // 2. Configure Android high-importance notification channels
    await initializeNotificationChannels();
  } catch (e) {
    console.warn('Notification channel init unavailable:', e);
  }

  try {
    // 3. Hide native splash screen once DOM is ready
    await SplashScreen.hide();
  } catch (e) {
    console.warn('Splash screen hide unavailable:', e);
  }
}
