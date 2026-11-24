import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { getHeaderValue, parseCookies, SESSION_COOKIE_NAME } from '../_lib/auth/cookies';
import type { ApiRequestLike } from '../_lib/auth/middleware';
import { resolveActiveSession } from '../_lib/auth/session';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const PORTAL_AUTHORIZED_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
]);

export async function handlePortalStatus(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const cookies = parseCookies(getHeaderValue(req, 'cookie'));
    const resolved = await resolveActiveSession(repo, cookies[SESSION_COOKIE_NAME]);
    const authorized = Boolean(
      resolved &&
        !resolved.user.mustChangePassword &&
        PORTAL_AUTHORIZED_ROLES.has(resolved.user.role),
    );

    const settings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');

    sendOk(res, {
      authorized,
      operatorUsername: authorized ? resolved!.user.username : null,
      serverTime: new Date().toISOString(),
      schoolName: settings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh',
      schoolAddress:
        settings?.schoolAddress ??
        'Desa Sumberwuluh, Kecamatan Candipuro, Kabupaten Lumajang, Jawa Timur',
      appName: settings?.appName ?? 'Absensi Digital',
      logoPath: settings?.logoPath ?? null,
      gpsEnabledForStudents: settings?.gpsEnabledForStudents ?? true,
      portalScanMethod: settings?.portalScanMethod ?? 'CAMERA_AND_USB',
      bypassAttendanceTimeWindow: settings?.bypassAttendanceTimeWindow ?? false,
      hasExitPassword: Boolean(settings?.portalExitPasswordHash),
      voiceTemplates: {
        success: 'ABSEN BERHASIL',
        failure: 'ABSEN GAGAL',
        namedSuccess: 'ABSEN ATAS NAMA {name} BERHASIL',
        late: 'ABSEN BERHASIL, {name} TERCATAT TERLAMBAT',
        closed: 'MAAF, WAKTU ABSENSI MASIH DITUTUP',
        alreadyRecorded: 'ANDA SUDAH MELAKUKAN ABSENSI HARI INI',
        ...(settings?.voiceTemplates ?? {}),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handlePortalStatus(req, res);
}
