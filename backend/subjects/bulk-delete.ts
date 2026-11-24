import { z } from 'zod';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const subjectBulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Pilih minimal 1 mata pelajaran untuk dihapus.'),
});

/**
 * POST /api/subjects/bulk-delete
 * Permanently deletes selected subjects after verifying no active teaching schedules depend on them.
 */
export async function handleSubjectsBulkDelete(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = subjectBulkDeleteSchema.parse(req.body ?? {});

    const subjectCol = repo.collection(CollectionName.SUBJECTS);
    const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);

    const schedulesRes = await scheduleCol.list();
    const activeSubjectIds = new Set(
      schedulesRes.items.filter((s) => s.isActive).map((s) => s.subjectId),
    );

    let deletedCount = 0;
    const deletedIds: string[] = [];
    const failedIds: Array<{ id: string; reason: string }> = [];

    for (const id of parsed.ids) {
      const subject = await subjectCol.getById(id);
      if (!subject) {
        continue;
      }
      if (activeSubjectIds.has(id)) {
        failedIds.push({
          id,
          reason: `Mata pelajaran "${subject.name}" masih memiliki jadwal mengajar aktif dan tidak dapat dihapus.`,
        });
        continue;
      }

      await subjectCol.delete(id);
      deletedCount++;
      deletedIds.push(id);
    }

    if (deletedCount > 0) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SUBJECTS_BULK_DELETED',
        entityType: 'SUBJECT',
        entityId: 'bulk_delete',
        after: { deletedCount, deletedIds },
        clientIp: auth.clientIp,
      });
    }

    sendOk(res, {
      deletedCount,
      deletedIds,
      failedIds,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleSubjectsBulkDelete(req, res);
}
