import { z } from 'zod';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const classBulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Pilih minimal 1 kelas untuk dihapus.'),
});

/**
 * POST /api/classes/bulk-delete
 * Permanently deletes selected classes after ensuring no students are enrolled in them.
 */
export async function handleClassesBulkDelete(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = classBulkDeleteSchema.parse(req.body ?? {});

    const classCol = repo.collection(CollectionName.CLASSES);
    const studentCol = repo.collection(CollectionName.STUDENTS);
    const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);
    const enrollmentCol = repo.collection(CollectionName.STUDENT_ENROLLMENTS);

    let deletedCount = 0;
    const deletedIds: string[] = [];
    const failedIds: Array<{ id: string; reason: string }> = [];

    for (const id of parsed.ids) {
      const cls = await classCol.getById(id);
      if (!cls) continue;

      const studentsInClass = await studentCol.list({
        filters: [{ field: 'classId', op: '==', value: id }],
      });

      if (studentsInClass.items.length > 0) {
        failedIds.push({
          id,
          reason: `Kelas "${cls.name}" masih memiliki ${studentsInClass.items.length} siswa terdaftar.`,
        });
        continue;
      }

      const [schedulesRes, enrollmentsRes] = await Promise.all([
        scheduleCol.list({ filters: [{ field: 'classId', op: '==', value: id }] }),
        enrollmentCol.list({ filters: [{ field: 'classId', op: '==', value: id }] }),
      ]);

      await Promise.all([
        ...schedulesRes.items.map((s) => scheduleCol.delete(s.id)),
        ...enrollmentsRes.items.map((enr) => enrollmentCol.delete(enr.id)),
      ]);

      await classCol.delete(id);
      deletedCount++;
      deletedIds.push(id);
    }

    if (deletedCount > 0) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'CLASSES_BULK_DELETED',
        entityType: 'CLASS',
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
  await handleClassesBulkDelete(req, res);
}
