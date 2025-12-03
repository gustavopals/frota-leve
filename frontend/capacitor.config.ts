import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.frotaleve.app',
  appName: 'Frota Leve',
  webDir: 'dist/frontend/browser',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e293b",
      showSpinner: true,
      spinnerColor: "#3b82f6"
    }
  }
};

export default config;
