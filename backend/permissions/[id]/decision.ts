import {
  permissionPrincipalDecisionSchema,
  validatePermissionTransition,
} from '../../../src/lib/permissionValidation';
import { CollectionName, PermissionStatus, ReviewDecision, UserRole } from '../../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../../_lib/apiError';
import { recordActivityLog } from '../../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../../_lib/auth/middleware';
import { getQueryString } from '../../_lib/masterDataRoles';
import { getRepository } from '../../_lib/repository';
import type { IDataRepository } from '../../_lib/repository/types';

/**
 * POST /api/permissions/:id/decision
 * Strictly for PRINCIPAL (Kepala Sekolah).
 * Enforces mandatory sequential workflow: ONLY `ADMIN_REVIEWED` can transition to
 * `APPROVED` or `REJECTED`. Attempting to decide on `SUBMITTED` or `RETURNED` is
 * rejected with 409 Conflict (`WORKFLOW_ORDER_VIOLATION`).
 */
export async function handlePermissionPrincipalDecision(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: [UserRole.PRINCIPAL] });
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID pengajuan izin wajib diisi.');

    const col = repo.collection(CollectionName.TEACHER_PERMISSIONS);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound('Pengajuan izin tidak ditemukan.');
    }

    const parsed = permissionPrincipalDecisionSchema.parse(req.body ?? {});
    const targetStatus =
      parsed.decision === ReviewDecision.APPROVE
        ? PermissionStatus.APPROVED
        : PermissionStatus.REJECTED;

    const transition = validatePermissionTransition(existing.status, targetStatus);
    if (!transition.allowed) {
      throw new ApiError(
        409,
        'WORKFLOW_ORDER_VIOLATION',
        transition.reason ??
          'Kepala Sekolah tidak dapat memutuskan sebelum pengajuan diverifikasi oleh Admin.',
      );
    }

    const decidedAt = new Date().toISOString();
    const updated = await col.update(id, {
      status: targetStatus,
      principalDecision: {
        reviewerId: auth.user.id,
        decision: parsed.decision,
        note: parsed.note || null,
        decidedAt,
      },
    });

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action:
        targetStatus === PermissionStatus.APPROVED
          ? 'PERMISSION_PRINCIPAL_APPROVED'
          : 'PERMISSION_PRINCIPAL_REJECTED',
      entityType: 'TEACHER_PERMISSION',
      entityId: id,
      before: { status: existing.status },
      after: {
        status: targetStatus,
        decision: parsed.decision,
        decidedAt,
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
  await handlePermissionPrincipalDecision(req, res);
}
