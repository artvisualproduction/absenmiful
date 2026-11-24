import { attendanceCorrectionSchema } from '../../../src/lib/attendanceScanValidation';
import { CollectionName } from '../../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../../_lib/apiError';
import { recordActivityLog } from '../../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../../_lib/auth/middleware';
import { getQueryString, MASTER_WRITE_ROLES } from '../../_lib/masterDataRoles';
import { getRepository } from '../../_lib/repository';
import type { IDataRepository } from '../../_lib/repository/types';

/**
 * PATCH /api/attendance/:id/correction
 * Admin-only manual correction with mandatory reason and immutable audit logging.
 */
export async function handleAttendanceCorrection(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'PATCH') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus PATCH.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID catatan kehadiran wajib diisi.');

    const col = repo.collection(CollectionName.ATTENDANCE_RECORDS);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound('Catatan kehadiran tidak ditemukan.');
    }

    const parsed = attendanceCorrectionSchema.parse(req.body ?? {});

    const updated = await col.update(id, {
      status: parsed.status,
      corrected: true,
      correctionReason: parsed.reason,
    });

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'ATTENDANCE_RECORD',
      entityId: id,
      before: {
        status: existing.status,
        corrected: existing.corrected,
        correctionReason: existing.correctionReason,
      },
      after: {
        status: updated?.status,
        corrected: true,
        correctionReason: parsed.reason,
      },
      reason: parsed.reason,
      clientIp: auth.clientIp,
    });

    sendOk(res, updated);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleAttendanceCorrection(req, res);
}
