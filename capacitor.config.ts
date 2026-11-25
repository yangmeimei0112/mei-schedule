import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'studio.meicreative.schedule',
  appName: '咩時光 MeiSchedule',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_mei_schedule',
      iconColor: '#38BDF8'
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT'
    }
  }
};

export default config;
