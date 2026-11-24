import { CollectionName, PermissionStatus, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryInt, getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { enrichPermissionsWithActors } from './index';

/**
 * GET /api/permissions/me
 * Strictly returns ONLY permissions belonging to `auth.user.linkedTeacherId`.
 * Ignores any external `teacherId` query parameter to prevent IDOR.
 */
export async function handleMyPermissions(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
    });

    if (!auth.user.linkedTeacherId) {
      sendOk(res, {
        items: [],
        total: 0,
        nextCursor: null,
        counts: { total: 0, active: 0, approved: 0, rejected: 0, returned: 0 },
      });
      return;
    }

    const status = getQueryString(req, 'status');
    const cursor = getQueryString(req, 'cursor');
    const limit = getQueryInt(req, 'limit', 20, 1, 1000);

    const allMineRes = await repo.collection(CollectionName.TEACHER_PERMISSIONS).list({
      filters: [{ field: 'teacherId', op: '==', value: auth.user.linkedTeacherId }],
      sort: { field: 'createdAt', direction: 'desc' },
    });

    const allMine = allMineRes.items;
    const counts = {
      total: allMine.length,
      active: allMine.filter(
        (p) =>
          p.status === PermissionStatus.SUBMITTED ||
          p.status === PermissionStatus.ADMIN_REVIEWED ||
          p.status === PermissionStatus.RETURNED,
      ).length,
      approved: allMine.filter((p) => p.status === PermissionStatus.APPROVED).length,
      rejected: allMine.filter((p) => p.status === PermissionStatus.REJECTED).length,
      returned: allMine.filter((p) => p.status === PermissionStatus.RETURNED).length,
    };

    const filtered = status ? allMine.filter((p) => p.status === status) : allMine;

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
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleMyPermissions(req, res);
}
