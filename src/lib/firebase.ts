import { type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import { db, firebaseApp } from './firebaseClient';
import { firebaseWebConfig } from './firebaseConfig';

export { firebaseWebConfig };

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseWebApp(): FirebaseApp {
  return firebaseApp;
}

/**
 * Instance Cloud Firestore Web SDK langsung dari firebaseClient
 * menggunakan named databaseId & force long polling.
 */
export function getFirestoreDb(): Firestore {
  return db;
}

/**
 * Verifikasi langsung koneksi frontend ke Cloud Firestore dari browser.
 */
export async function testFrontendFirestoreConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  error: string | null;
}> {
  const startedAt = Date.now();
  try {
    const firestore = getFirestoreDb();
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    return {
      connected: true,
      latencyMs: Math.max(1, Date.now() - startedAt),
      error: null,
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: Math.max(1, Date.now() - startedAt),
      error: err instanceof Error ? err.message : 'Gagal terhubung ke Cloud Firestore.',
    };
  }
}

export function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !firebaseWebConfig.measurementId) {
    return Promise.resolve(null);
  }
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(getFirebaseWebApp()) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}
