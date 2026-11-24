import { gpsSettingsUpdateSchema } from '../../src/lib/teacherAttendanceValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * GET / PATCH /api/settings/gps
 * Manages per-audience GPS toggles (`gpsEnabledForStudents`, `gpsEnabledForTeachers`,
 * `teacherSelfServiceEnabled`) in `appSettings/default`.
 */
export async function handleGpsSettings(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.APP_SETTINGS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const settings = await col.getById('default');
      sendOk(res, {
        gpsEnabledForStudents: settings?.gpsEnabledForStudents ?? true,
        gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
        teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
        approvedPermissionAffectsRecap: settings?.approvedPermissionAffectsRecap ?? true,
      });
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById('default');
      if (!existing) throw ApiError.notFound('Pengaturan aplikasi belum tersedia.');

      const parsed = gpsSettingsUpdateSchema.parse(req.body ?? {});
      const updated = await col.update('default', {
        ...(parsed.gpsEnabledForStudents !== undefined
          ? { gpsEnabledForStudents: parsed.gpsEnabledForStudents }
          : {}),
        ...(parsed.gpsEnabledForTeachers !== undefined
          ? { gpsEnabledForTeachers: parsed.gpsEnabledForTeachers }
          : {}),
        ...(parsed.teacherSelfServiceEnabled !== undefined
          ? { teacherSelfServiceEnabled: parsed.teacherSelfServiceEnabled }
          : {}),
        ...(parsed.approvedPermissionAffectsRecap !== undefined
          ? { approvedPermissionAffectsRecap: parsed.approvedPermissionAffectsRecap }
          : {}),
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'GPS_SETTINGS_UPDATED',
        entityType: 'APP_SETTINGS',
        entityId: 'default',
        before: {
          gpsEnabledForStudents: existing.gpsEnabledForStudents,
          gpsEnabledForTeachers: existing.gpsEnabledForTeachers,
          teacherSelfServiceEnabled: existing.teacherSelfServiceEnabled,
          approvedPermissionAffectsRecap: existing.approvedPermissionAffectsRecap ?? true,
        },
        after: {
          gpsEnabledForStudents: updated?.gpsEnabledForStudents,
          gpsEnabledForTeachers: updated?.gpsEnabledForTeachers,
          teacherSelfServiceEnabled: updated?.teacherSelfServiceEnabled,
          approvedPermissionAffectsRecap: updated?.approvedPermissionAffectsRecap ?? true,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, {
        gpsEnabledForStudents: updated?.gpsEnabledForStudents ?? true,
        gpsEnabledForTeachers: updated?.gpsEnabledForTeachers ?? true,
        teacherSelfServiceEnabled: updated?.teacherSelfServiceEnabled ?? true,
        approvedPermissionAffectsRecap: updated?.approvedPermissionAffectsRecap ?? true,
      });
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleGpsSettings(req, res);
}
