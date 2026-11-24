import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(app: FirebaseApp): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId?.trim() || '(default)';
  if (typeof window === 'undefined') {
    return getFirestore(app, databaseId);
  }
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      databaseId,
    );
  } catch {
    return getFirestore(app, databaseId);
  }
}

export const db: Firestore = createFirestoreInstance(firebaseApp);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return {
        ok: false,
        error: 'Klien Cloud Firestore sedang offline atau konfigurasi belum tepat.',
      };
    }
    return { ok: true };
  }
}

if (typeof window !== 'undefined' && !connectionTested) {
  connectionTested = true;
  void testConnection();
}
