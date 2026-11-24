import { CollectionName, type PublicAppSettings } from '../../src/types';
import { sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export interface PublicSettingsPayload {
  settings: PublicAppSettings;
  needsBootstrap: boolean;
  dataMode: 'mock' | 'real' | 'mysql';
}

const DEFAULT_PUBLIC_SETTINGS: PublicAppSettings = {
  id: 'default',
  appName: 'Absensi Digital',
  pwaAppName: 'MiFUL',
  schoolName: 'MI MIFTAHUL ULUM',
  schoolAddress: 'Sumberwuluh - Candipuro - Lumajang',
  schoolBio: 'Madrasah Ibtidaiyah Miftahul Ulum Sumberwuluh — Sistem Kehadiran Digital Terpadu.',
  logoPath: '/images/school-logo.png',
  faviconPath: '/favicon.png',
  pwaIcon192Path: '/icons/pwa-192x192.png',
  pwaIcon512Path: '/icons/pwa-512x512.png',
  loginBackgroundPath: '/images/school-backdrop.jpg',
  theme: { primary: '#10264D', accent: '#C69B3C', background: '#FFFFFF' },
  timezone: 'Asia/Jakarta',
  gpsEnabledForStudents: true,
  gpsEnabledForTeachers: true,
  teacherSelfServiceEnabled: true,
  portalScanMethod: 'CAMERA_AND_USB',
  quickLoginEnabled: false,
  bypassAttendanceTimeWindow: false,
  requireUserLinkedToTeacher: true,
  voiceTemplates: {
    success: 'ABSEN BERHASIL',
    failure: 'ABSEN GAGAL',
    namedSuccess: 'ABSEN ATAS NAMA {name} BERHASIL',
  },
};

export async function handlePublicSettings(
  req: { method?: string },
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
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

    let raw: Partial<PublicAppSettings> | null = null;
    let needsBootstrap = false;

    const [settingsRes, userCount] = await Promise.all([
      repo.collection(CollectionName.APP_SETTINGS).list({ limit: 1 }),
      repo.collection(CollectionName.USERS).count(),
    ]);
    const first = settingsRes.items[0];
    if (first) {
      const { portalExitPasswordHash: _omit, ...safe } = first;
      raw = safe;
    } else if (repo.mode === 'real') {
      try {
        raw = await repo.collection(CollectionName.PUBLIC_SETTINGS).getById('default');
      } catch {
        raw = null;
      }
    }
    needsBootstrap = userCount === 0;

    const normalizeAssetPath = (val: string | null | undefined, fallback: string): string => {
      if (!val || val.startsWith('/src/assets/images/')) return fallback;
      return val;
    };

    const settings: PublicAppSettings = raw
      ? {
          ...DEFAULT_PUBLIC_SETTINGS,
          ...raw,
          id: 'default',
          pwaAppName: raw.pwaAppName?.trim() || 'MiFUL',
          quickLoginEnabled: raw.quickLoginEnabled ?? false,
          bypassAttendanceTimeWindow: raw.bypassAttendanceTimeWindow ?? false,
          requireUserLinkedToTeacher: raw.requireUserLinkedToTeacher ?? true,
          logoPath: normalizeAssetPath(raw.logoPath, '/images/school-logo.png'),
          loginBackgroundPath: normalizeAssetPath(
            raw.loginBackgroundPath,
            '/images/school-backdrop.jpg',
          ),
        }
      : DEFAULT_PUBLIC_SETTINGS;

    sendOk<PublicSettingsPayload>(res, {
      settings,
      needsBootstrap,
      dataMode: repo.mode,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: { method?: string },
  res: MinimalApiResponse,
): Promise<void> {
  await handlePublicSettings(req, res);
}
