import {
  permissionCancelSchema,
  permissionCreateSchema,
  validatePermissionTransition,
} from '../../../src/lib/permissionValidation';
import {
  CollectionName,
  FileCategory,
  PermissionStatus,
  QrOwnerType,
  UserRole,
} from '../../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../../_lib/apiError';
import { recordActivityLog } from '../../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../../_lib/auth/middleware';
import { getQueryString } from '../../_lib/masterDataRoles';
import { getRepository } from '../../_lib/repository';
import type { IDataRepository } from '../../_lib/repository/types';

/**
 * POST /api/permissions/:id/cancel — Owner teacher cancels an undecided permission.
 */
export async function handlePermissionCancel(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
    });
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID pengajuan izin wajib diisi.');

    const col = repo.collection(CollectionName.TEACHER_PERMISSIONS);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound('Pengajuan izin tidak ditemukan.');
    }

    // Strict ownership enforcement (IDOR protection)
    if (!auth.user.linkedTeacherId || existing.teacherId !== auth.user.linkedTeacherId) {
      throw ApiError.forbidden('Anda tidak berwenang membatalkan pengajuan izin milik guru lain.');
    }

    const parsed = permissionCancelSchema.parse(req.body ?? {});
    const transition = validatePermissionTransition(existing.status, PermissionStatus.CANCELLED);
    if (!transition.allowed) {
      throw ApiError.conflict(transition.reason ?? 'Pengajuan izin yang sudah diputuskan tidak dapat dibatalkan.');
    }

    const updated = await col.update(id, {
      status: PermissionStatus.CANCELLED,
    });

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'PERMISSION_CANCELLED',
      entityType: 'TEACHER_PERMISSION',
      entityId: id,
      before: { status: existing.status },
      after: { status: PermissionStatus.CANCELLED },
      reason: parsed.reason || 'Dibatalkan oleh guru pengaju',
      clientIp: auth.clientIp,
    });

    sendOk(res, updated);
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * PATCH /api/permissions/:id — Owner teacher revises & resubmits a RETURNED permission back to SUBMITTED.
 * GET /api/permissions/:id — Single permission lookup with strict RBAC/ownership check.
 */
export async function handlePermissionById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID pengajuan izin wajib diisi.');

    const col = repo.collection(CollectionName.TEACHER_PERMISSIONS);

    if (req.method === 'GET') {
      const auth = await requireAuth(req, { repo });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Pengajuan izin tidak ditemukan.');

      if (
        auth.user.role === UserRole.TEACHER &&
        existing.teacherId !== auth.user.linkedTeacherId
      ) {
        throw ApiError.forbidden('Anda tidak berwenang melihat pengajuan izin guru lain.');
      }

      sendOk(res, existing);
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, {
        repo,
        allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
      });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Pengajuan izin tidak ditemukan.');

      if (!auth.user.linkedTeacherId || existing.teacherId !== auth.user.linkedTeacherId) {
        throw ApiError.forbidden('Anda tidak berwenang mengubah pengajuan izin guru lain.');
      }

      const transition = validatePermissionTransition(existing.status, PermissionStatus.SUBMITTED);
      if (!transition.allowed) {
        throw ApiError.conflict(
          'Hanya pengajuan izin yang dikembalikan Admin (RETURNED) yang dapat diperbaiki dan diajukan ulang.',
        );
      }

      const parsed = permissionCreateSchema.parse(req.body ?? {});
      const attachmentPaths = [...existing.attachmentPaths];
      if (parsed.attachmentFileIds.length > 0) {
        const fileCol = repo.collection(CollectionName.FILE_METADATA);
        for (const fileId of parsed.attachmentFileIds) {
          const meta = await fileCol.getById(fileId);
          if (
            !meta ||
            meta.category !== FileCategory.PERMISSION_ATTACHMENT ||
            meta.ownerType !== QrOwnerType.TEACHER ||
            meta.ownerId !== auth.user.linkedTeacherId
          ) {
            throw ApiError.forbidden('Lampiran tidak ditemukan atau bukan milik akun Anda.');
          }
          if (!attachmentPaths.includes(meta.storagePath)) {
            attachmentPaths.push(meta.storagePath);
          }
        }
      }

      const updated = await col.update(id, {
        leaveType: parsed.leaveType,
        startAt: new Date(parsed.startAt).toISOString(),
        endAt: new Date(parsed.endAt).toISOString(),
        reason: parsed.reason,
        attachmentPaths,
        status: PermissionStatus.SUBMITTED,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'PERMISSION_RESUBMITTED',
        entityType: 'TEACHER_PERMISSION',
        entityId: id,
        before: { status: existing.status },
        after: { status: PermissionStatus.SUBMITTED, leaveType: parsed.leaveType },
        clientIp: auth.clientIp,
      });

      sendOk(res, updated);
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
  await handlePermissionCancel(req, res);
}
