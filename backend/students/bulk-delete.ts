import { bulkArchiveSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, QrOwnerType } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  worker: (item: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    await Promise.all(items.slice(i, i + chunkSize).map(worker));
  }
}

export async function handleStudentsBulkDelete(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = bulkArchiveSchema.parse(req.body ?? {});

    const targetIds = new Set(parsed.ids);
    const studentCol = repo.collection(CollectionName.STUDENTS);
    const enrollmentCol = repo.collection(CollectionName.STUDENT_ENROLLMENTS);
    const qrCol = repo.collection(CollectionName.QR_TOKENS);

    // Batch-fetch all affected collections once instead of N*3 sequential roundtrips
    const [studentsRes, enrollmentsRes, qrTokensRes] = await Promise.all([
      studentCol.list(),
      enrollmentCol.list(),
      qrCol.list({ filters: [{ field: 'ownerType', op: '==', value: QrOwnerType.STUDENT }] }),
    ]);

    const existingStudents = studentsRes.items.filter((s) => targetIds.has(s.id));
    const enrollmentsToDelete = enrollmentsRes.items.filter((e) => targetIds.has(e.studentId));
    const qrTokensToDelete = qrTokensRes.items.filter((q) => targetIds.has(q.ownerId));

    await Promise.all([
      runInChunks(enrollmentsToDelete, 25, (enr) => enrollmentCol.delete(enr.id)),
      runInChunks(qrTokensToDelete, 25, (qr) => qrCol.delete(qr.id)),
      runInChunks(existingStudents, 25, (student) => studentCol.delete(student.id)),
    ]);

    const deletedCount = existingStudents.length;

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'STUDENTS_BULK_DELETED',
      entityType: 'STUDENT',
      entityId: 'bulk',
      after: { requestedCount: parsed.ids.length, deletedCount },
      reason: parsed.reason ?? 'Penghapusan massal data siswa oleh admin.',
      clientIp: auth.clientIp,
    });

    sendOk(res, { deletedCount });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleStudentsBulkDelete(req, res);
}
