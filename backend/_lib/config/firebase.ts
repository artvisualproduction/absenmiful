import { firebaseWebConfig } from '../../../src/lib/firebaseConfig';

/**
 * Konfigurasi koneksi Cloud Firestore menggunakan firebaseWebConfig publik proyek Firebase
 * (tanpa Firebase Authentication, tanpa Firebase Admin SDK, dan tanpa setting env di Vercel).
 */

export const BOOTSTRAPPED_ADMIN_EMAIL =
  process.env.BOOTSTRAPPED_ADMIN_EMAIL?.trim() || 'pondokdarulmukhlisin@gmail.com';

export type DataMode = 'mock' | 'real' | 'mysql';
export type FirestoreAuthMode = 'web_api_key' | 'service_account';

export interface ServerFirebaseConfig {
  dataMode: DataMode;
  authMode: FirestoreAuthMode;
  projectId: string;
  databaseId?: string;
  storageBucket: string;
  apiKey: string;
  clientEmail: string;
  privateKey: string;
}

export function getDataMode(): DataMode {
  // Keep automated unit tests isolated in-memory
  if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) {
    return 'mock';
  }
  // On Vercel deployments, ALWAYS connect directly to live Cloud Firestore via firebaseWebConfig
  // even if a stale DATA_MODE=mock environment variable was previously configured.
  if (process.env.VERCEL === '1') {
    return 'real';
  }
  const raw = (process.env.DATA_MODE ?? '').trim().toLowerCase();
  if (raw === 'mysql') return 'mysql';
  if (raw === 'mock') return 'mock';
  // Default to live Cloud Firestore via public firebaseWebConfig (zero Vercel env setup needed)
  return 'real';
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getServerFirebaseConfig(): ServerFirebaseConfig {
  const dataMode = getDataMode();
  const projectId = stripWrappingQuotes(
    process.env.FIREBASE_PROJECT_ID ?? firebaseWebConfig.projectId,
  );
  const databaseId =
    stripWrappingQuotes(
      process.env.FIREBASE_DATABASE_ID ?? firebaseWebConfig.firestoreDatabaseId ?? '(default)',
    ) || '(default)';
  const storageBucket = stripWrappingQuotes(
    process.env.FIREBASE_STORAGE_BUCKET ?? firebaseWebConfig.storageBucket,
  );
  const apiKey = stripWrappingQuotes(
    process.env.FIREBASE_WEB_API_KEY ?? firebaseWebConfig.apiKey,
  );
  const clientEmail = stripWrappingQuotes(process.env.FIREBASE_CLIENT_EMAIL ?? '');
  const privateKey = stripWrappingQuotes(process.env.FIREBASE_PRIVATE_KEY ?? '').replace(
    /\\n/g,
    '\n',
  );
  const authMode: FirestoreAuthMode =
    clientEmail && privateKey ? 'service_account' : 'web_api_key';

  return {
    dataMode,
    authMode,
    projectId,
    databaseId,
    storageBucket,
    apiKey,
    clientEmail,
    privateKey,
  };
}

export function assertRealFirestoreCredentials(config: ServerFirebaseConfig): void {
  if (!config.projectId) {
    throw new Error('FIREBASE_PROJECT_ID tidak tersedia pada konfigurasi Firebase.');
  }
  if (config.authMode === 'web_api_key' && !config.apiKey) {
    throw new Error('Web API Key Firebase tidak tersedia pada firebaseWebConfig.');
  }
  if (config.authMode === 'service_account' && (!config.clientEmail || !config.privateKey)) {
    throw new Error(
      'Konfigurasi Service Account Firestore belum lengkap.',
    );
  }
}
