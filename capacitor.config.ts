import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cyrilhup.sportcalendar',
  appName: 'Sport Calendar',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
    // SELF-UPDATING APK (Over-The-Air via Vercel):
    // To have your APK update automatically on your phone every time you push to Vercel,
    // uncomment the line below and set your live Vercel URL:
    // url: 'https://app-sport-calendar.vercel.app'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3b82f6',
      sound: 'beep.wav'
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#080c14',
      showSpinner: false
    }
  }
};

export default config;
