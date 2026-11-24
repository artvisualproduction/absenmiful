import path from 'node:path';
import { getDataMode, getServerFirebaseConfig } from '../config/firebase';
import { FirestoreRestRepository } from './firestoreRestRepository';
import { MockRepository } from './mockRepository';
import { MysqlRepository } from './mysqlRepository';
import type { IDataRepository } from './types';

let singletonRepo: IDataRepository | null = null;
let singletonMode: 'mock' | 'real' | 'mysql' | null = null;

/**
 * Returns the active data repository chosen via DATA_MODE=mock|real|mysql.
 * Defaults to 'real' (Cloud Firestore) or 'mysql' if configured for Laragon.
 */
export function getRepository(): IDataRepository {
  const mode = getDataMode();
  if (!singletonRepo || singletonMode !== mode) {
    singletonMode = mode;
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const persistFilePath =
      mode === 'mock' && !isTestEnv
        ? process.env.VERCEL === '1'
          ? '/tmp/absensi-mock-db.json'
          : path.resolve(process.cwd(), '.local-data/mock-db.json')
        : undefined;

    if (mode === 'mysql') {
      singletonRepo = new MysqlRepository();
    } else if (mode === 'real') {
      singletonRepo = new FirestoreRestRepository(getServerFirebaseConfig());
    } else {
      singletonRepo = new MockRepository(persistFilePath ? { persistFilePath } : {});
    }
  }
  return singletonRepo;
}

export * from './types';
export * from './firestoreConverter';
export { MockRepository } from './mockRepository';
export { FirestoreRestRepository } from './firestoreRestRepository';
export { MysqlRepository } from './mysqlRepository';
