import { permissionCreateSchema } from '../../src/lib/permissionValidation';
import {
  CollectionName,
  FileCategory,
  PermissionStatus,
  QrOwnerType,
  TeacherStatus,
  UserRole,
  type TeacherPermission,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryInt, getQueryString, MASTER_READ_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export interface EnrichedTeacherPermission extends TeacherPermission {
  adminReviewerName?: string | null;
  principalReviewerName?: string | null;
}

export async function enrichPermissionsWithActors(
  repo: IDataRepository,
  items: TeacherPermission[],
): Promise<EnrichedTeacherPermission[]> {
  if (items.length === 0) return [];
  const [usersRes, teachersRes] = await Promise.all([
    repo.collection(CollectionName.USERS).list(),
    repo.collection(CollectionName.TEACHERS).list(),
  ]);
  const teacherNameMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
  const userNameMap = new Map(
    usersRes.items.map((u) => [
      u.id,
      (u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : undefined) ?? u.username,
    ]),
  );

  return items.map((item) => ({
    ...item,
    adminReviewerName: item.adminReview.reviewerId
      ? (userNameMap.get(item.adminReview.reviewerId) ?? 'Admin Madrasah')
      : null,
    principalReviewerName: item.principalDecision.reviewerId
      ? (userNameMap.get(item.principalDecision.reviewerId) ?? 'Kepala Sekolah')
      : null,
  }));
}

/**
 * GET /api/permissions — Admin / Operator / Principal list with workflow badge counts.
 *   TEACHER is strictly rejected with 403 (teachers must use GET /api/permissions/me).
 * POST /api/permissions — Teacher submits a new leave permission request (status = SUBMITTED).
 */
export async function handlePermissions(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const permCol = repo.collection(CollectionName.TEACHER_PERMISSIONS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

      const status = getQueryString(req, 'status');
      const leaveType = getQueryString(req, 'leaveType');
      const teacherId = getQueryString(req, 'teacherId');
      const search = getQueryString(req, 'search').toLowerCase();
      const cursor = getQueryString(req, 'cursor');
      const limit = getQueryInt(req, 'limit', 20, 1, 1000);

      const allRes = await permCol.list({ sort: { field: 'createdAt', direction: 'desc' } });
      const all = allRes.items;

      const counts = {
        total: all.length,
        pendingAdmin: all.filter((p) => p.status === PermissionStatus.SUBMITTED).length,
        pendingPrincipal: all.filter((p) => p.status === PermissionStatus.ADMIN_REVIEWED).length,
        returned: all.filter((p) => p.status === PermissionStatus.RETURNED).length,
        approved: all.filter((p) => p.status === PermissionStatus.APPROVED).length,
        rejected: all.filter((p) => p.status === PermissionStatus.REJECTED).length,
        cancelled: all.filter((p) => p.status === PermissionStatus.CANCELLED).length,
      };

      const filtered = all.filter((p) => {
        if (status && p.status !== status) return false;
        if (leaveType && p.leaveType !== leaveType) return false;
        if (teacherId && p.teacherId !== teacherId) return false;
        if (search) {
          const hay = `${p.teacherNameSnapshot} ${p.reason} ${p.leaveType}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

      let startIdx = 0;
      if (cursor) {
        const idx = filtered.findIndex((p) => p.id === cursor);
        if (idx >= 0) startIdx = idx + 1;
      }
      const pageItems = filtered.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + pageItems.length < filtered.length;
      const nextCursor =
        hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1]!.id : null;

      const enriched = await enrichPermissionsWithActors(repo, pageItems);

      sendOk(res, {
        items: enriched,
        total: filtered.length,
        nextCursor,
        counts,
      });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, {
        repo,
        allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
      });

      if (!auth.user.linkedTeacherId) {
        throw ApiError.forbidden('Akun Anda belum tertaut ke profil guru aktif.');
      }

      const teacher = await repo
        .collection(CollectionName.TEACHERS)
        .getById(auth.user.linkedTeacherId);
      if (!teacher || teacher.status !== TeacherStatus.ACTIVE) {
        throw ApiError.forbidden('Profil guru tidak aktif. Hubungi Admin Madrasah.');
      }

      const parsed = permissionCreateSchema.parse(req.body ?? {});

      // Verify all attachmentFileIds belong to THIS teacher & are PERMISSION_ATTACHMENT
      const attachmentPaths: string[] = [];
      if (parsed.attachmentFileIds.length > 0) {
        const fileCol = repo.collection(CollectionName.FILE_METADATA);
        for (const fileId of parsed.attachmentFileIds) {
          const meta = await fileCol.getById(fileId);
          if (
            !meta ||
            meta.category !== FileCategory.PERMISSION_ATTACHMENT ||
            meta.ownerType !== QrOwnerType.TEACHER ||
            meta.ownerId !== teacher.id
          ) {
            throw ApiError.forbidden(
              'Lampiran tidak ditemukan atau bukan milik akun Anda.',
            );
          }
          attachmentPaths.push(meta.storagePath);
        }
      }

      const created = await permCol.create({
        teacherId: teacher.id,
        teacherNameSnapshot: teacher.fullName,
        leaveType: parsed.leaveType,
        startAt: new Date(parsed.startAt).toISOString(),
        endAt: new Date(parsed.endAt).toISOString(),
        reason: parsed.reason,
        attachmentPaths,
        status: PermissionStatus.SUBMITTED,
        adminReview: {
          reviewerId: null,
          decision: null,
          note: null,
          reviewedAt: null,
        },
        principalDecision: {
          reviewerId: null,
          decision: null,
          note: null,
          decidedAt: null,
        },
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'PERMISSION_SUBMITTED',
        entityType: 'TEACHER_PERMISSION',
        entityId: created.id,
        after: {
          teacherId: teacher.id,
          leaveType: created.leaveType,
          startAt: created.startAt,
          endAt: created.endAt,
          status: created.status,
          attachmentCount: attachmentPaths.length,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, created, 201);
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
  await handlePermissions(req, res);
}
