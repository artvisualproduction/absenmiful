import { z } from 'zod';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export const bulkWorkingDaysSchema = z.object({
  teacherIds: z.array(z.string().trim().min(1)).min(1, 'Pilih minimal 1 guru.'),
  workingDays: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'Pilih minimal 1 hari kerja aktif.'),
});

/**
 * POST /api/teachers/bulk-working-days
 * Sets the mandatory working days for multiple teachers at once.
 */
export async function handleTeachersBulkWorkingDays(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = bulkWorkingDaysSchema.parse(req.body ?? {});

    const teacherCol = repo.collection(CollectionName.TEACHERS);
    const sortedDays = Array.from(new Set(parsed.workingDays)).sort((a, b) => a - b);
    let updatedCount = 0;

    for (const teacherId of parsed.teacherIds) {
      const existing = await teacherCol.getById(teacherId);
      if (existing) {
        await teacherCol.update(teacherId, { workingDays: sortedDays });
        updatedCount++;
      }
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'TEACHERS_BULK_WORKING_DAYS_UPDATED',
      entityType: 'TEACHER',
      entityId: 'bulk',
      after: {
        requestedCount: parsed.teacherIds.length,
        updatedCount,
        workingDays: sortedDays,
      },
      clientIp: auth.clientIp,
    });

    sendOk(res, {
      success: true,
      updatedCount,
      workingDays: sortedDays,
    });
  } catch (err) {
    sendError(res, err);
  }
}
