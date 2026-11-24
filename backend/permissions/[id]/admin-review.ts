import {
  permissionAdminReviewSchema,
  validatePermissionTransition,
} from '../../../src/lib/permissionValidation';
import { CollectionName, PermissionStatus, ReviewDecision } from '../../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../../_lib/apiError';
import { recordActivityLog } from '../../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../../_lib/auth/middleware';
import { getQueryString, MASTER_WRITE_ROLES } from '../../_lib/masterDataRoles';
import { getRepository } from '../../_lib/repository';
import type { IDataRepository } from '../../_lib/repository/types';

/**
 * POST /api/permissions/:id/admin-review
 * Strictly for Admin/Operator (`MASTER_WRITE_ROLES`).
 * Transitions SUBMITTED -> ADMIN_REVIEWED (RECOMMEND_APPROVE) or RETURNED (RETURN).
 * Rejects any status jump with 409 Conflict.
 */
export async function handlePermissionAdminReview(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID pengajuan izin wajib diisi.');

    const col = repo.collection(CollectionName.TEACHER_PERMISSIONS);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound('Pengajuan izin tidak ditemukan.');
    }

    const parsed = permissionAdminReviewSchema.parse(req.body ?? {});
    const targetStatus =
      parsed.decision === ReviewDecision.RECOMMEND_APPROVE
        ? PermissionStatus.ADMIN_REVIEWED
        : PermissionStatus.RETURNED;

    const transition = validatePermissionTransition(existing.status, targetStatus);
    if (!transition.allowed) {
      throw ApiError.conflict(transition.reason ?? 'Transisi status izin tidak diizinkan.');
    }

    const reviewedAt = new Date().toISOString();
    const updated = await col.update(id, {
      status: targetStatus,
      adminReview: {
        reviewerId: auth.user.id,
        decision: parsed.decision,
        note: parsed.note || null,
        reviewedAt,
      },
    });

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action:
        targetStatus === PermissionStatus.ADMIN_REVIEWED
          ? 'PERMISSION_ADMIN_RECOMMENDED'
          : 'PERMISSION_ADMIN_RETURNED',
      entityType: 'TEACHER_PERMISSION',
      entityId: id,
      before: { status: existing.status },
      after: {
        status: targetStatus,
        decision: parsed.decision,
        reviewedAt,
      },
      reason: parsed.note || null,
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
  await handlePermissionAdminReview(req, res);
}
