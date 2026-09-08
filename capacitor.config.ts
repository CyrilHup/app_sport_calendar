import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cyrilhup.sportcalendar',
  appName: 'Sport Calendar',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: 'https://appsportcalendar.vercel.app',
    allowNavigation: [
      'appsportcalendar.vercel.app',
      'iolvxwvjasawlnsxlmpi.supabase.co',
      '*.supabase.co',
      'accounts.google.com',
      '*.google.com',
      '*.googleusercontent.com',
      'appleid.apple.com'
    ]
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
