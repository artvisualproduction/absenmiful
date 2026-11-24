import firebaseAppletConfig from '../../firebase-applet-config.json';

/**
 * Konfigurasi publik Firebase Web App yang disinkronkan dari firebase-applet-config.json.
 * Dipisahkan sebagai modul murni (tanpa import SDK browser) agar dapat dipakai bersama
 * oleh frontend (Firebase Web SDK) maupun API server secara ringan dan aman.
 */
export const firebaseWebConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
  measurementId: firebaseAppletConfig.measurementId,
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId,
} as const;
