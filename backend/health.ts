import { getDateKeyJakarta, getTimeHHMMJakarta, ASIA_JAKARTA_TZ } from '../src/lib/date';
import { CollectionName } from '../src/types';
import { sendError, sendOk, type MinimalApiResponse } from './_lib/apiError';
import { getServerFirebaseConfig } from './_lib/config/firebase';
import { getRepository } from './_lib/repository';

export default async function handler(
  req: { method?: string },
  res: MinimalApiResponse,
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak diizinkan.' },
        serverTime: new Date().toISOString(),
      });
      return;
    }

    const now = new Date();
    const firebaseConfig = getServerFirebaseConfig();
    const dataMode = firebaseConfig.dataMode;
    const repo = getRepository();
    const startedAt = Date.now();

    let databaseConnected = false;
    let databaseError: string | null = null;
    try {
      await repo.collection(CollectionName.APP_SETTINGS).getById('default');
      databaseConnected = true;
    } catch (err) {
      databaseConnected = false;
      databaseError =
        err instanceof Error ? err.message : 'Koneksi ke database tidak dapat dijangkau.';
    }

    const latencyMs = Math.max(1, Date.now() - startedAt);
    const persistent = dataMode === 'real' || dataMode === 'mysql';
    const databaseLabel =
      dataMode === 'real'
        ? `Cloud Firestore (${firebaseConfig.projectId})`
        : dataMode === 'mysql'
          ? `MySQL Database Lokal (Laragon)`
          : 'Database Lokal (Testing)';

    sendOk(res, {
      status: databaseConnected ? 'ok' : 'degraded',
      dataMode,
      databaseConnected,
      databaseLabel,
      persistent,
      latencyMs,
      databaseError,
      timezone: ASIA_JAKARTA_TZ,
      jakartaDate: getDateKeyJakarta(now),
      jakartaTime: getTimeHHMMJakarta(now),
    });
  } catch (err) {
    sendError(res, err);
  }
}
