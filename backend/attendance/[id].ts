import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * DELETE /api/attendance/:id
 * Allows SUPER_ADMIN, ADMIN, or OPERATOR to delete incorrect or duplicate attendance records.
 */
export async function handleAttendanceById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID catatan kehadiran wajib diisi.');

    const col = repo.collection(CollectionName.ATTENDANCE_RECORDS);

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) {
        throw ApiError.notFound('Catatan kehadiran tidak ditemukan.');
      }

      await col.delete(id);

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'ATTENDANCE_RECORD_DELETED',
        entityType: 'ATTENDANCE_RECORD',
        entityId: id,
        before: {
          personName: existing.personNameSnapshot,
          attendanceDate: existing.attendanceDate,
          eventType: existing.eventType,
          status: existing.status,
        },
        reason: 'Dihapus oleh admin/super admin.',
        clientIp: auth.clientIp,
      });

      sendOk(res, { deleted: true, id });
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
  await handleAttendanceById(req, res);
}
