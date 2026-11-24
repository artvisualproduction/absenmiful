import { z } from 'zod';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const scheduleBulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Pilih minimal 1 jadwal mengajar untuk dihapus.'),
});

/**
 * POST /api/schedules/bulk-delete
 * Permanently deletes selected teaching schedules.
 */
export async function handleSchedulesBulkDelete(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = scheduleBulkDeleteSchema.parse(req.body ?? {});

    const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);
    let deletedCount = 0;
    const deletedIds: string[] = [];

    for (const id of parsed.ids) {
      const existing = await scheduleCol.getById(id);
      if (existing) {
        await scheduleCol.delete(id);
        deletedCount++;
        deletedIds.push(id);
      }
    }

    if (deletedCount > 0) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHEDULES_BULK_DELETED',
        entityType: 'TEACHING_SCHEDULE',
        entityId: 'bulk_delete',
        after: { deletedCount, deletedIds },
        clientIp: auth.clientIp,
      });
    }

    sendOk(res, {
      deletedCount,
      deletedIds,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleSchedulesBulkDelete(req, res);
}
