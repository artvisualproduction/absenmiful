import { bulkArchiveSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, StudentStatus } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleStudentsBulkArchive(
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

    const studentCol = repo.collection(CollectionName.STUDENTS);
    let archivedCount = 0;

    for (const id of parsed.ids) {
      const existing = await studentCol.getById(id);
      if (existing && existing.status !== StudentStatus.INACTIVE) {
        await studentCol.update(id, { status: StudentStatus.INACTIVE });
        archivedCount++;
      }
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'STUDENTS_BULK_ARCHIVED',
      entityType: 'STUDENT',
      entityId: 'bulk',
      after: { requestedCount: parsed.ids.length, archivedCount },
      reason: parsed.reason ?? 'Pengarsipan massal siswa.',
      clientIp: auth.clientIp,
    });

    sendOk(res, { archivedCount });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleStudentsBulkArchive(req, res);
}
