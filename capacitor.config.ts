import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.distribusihub.app',
  appName: 'DistribusiHub',
  webDir: 'dist',
  server: {
    /* Skema http diperlukan agar WebView Android memperlakukan halaman sebagai
       asal jaringan biasa dan mengizinkan panggilan ke server distributor di
       jaringan lokal. */
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
