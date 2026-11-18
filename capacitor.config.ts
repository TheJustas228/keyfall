import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.keyfall.piano',
  appName: 'Keyfall',
  webDir: 'dist',
  backgroundColor: '#050307',
  // keep console output in release builds so the CI simulator run can check audio loads
  loggingBehavior: 'production',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#050307',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
  },
  plugins: {
    // full screen: no status bar, no home indicator
    SystemBars: { hidden: true },
  },
};

export default config;
