import { bulkArchiveSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, QrOwnerType } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { revokeAllUserSessions } from '../_lib/auth/session';
import { releaseUniqueUsername } from '../_lib/auth/uniqueUsername';
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

export async function handleTeachersBulkDelete(
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
    const teacherCol = repo.collection(CollectionName.TEACHERS);
    const userCol = repo.collection(CollectionName.USERS);
    const qrCol = repo.collection(CollectionName.QR_TOKENS);
    const classCol = repo.collection(CollectionName.CLASSES);
    const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);

    const [teachersRes, usersRes, qrTokensRes, classesRes, schedulesRes] = await Promise.all([
      teacherCol.list(),
      userCol.list(),
      qrCol.list({ filters: [{ field: 'ownerType', op: '==', value: QrOwnerType.TEACHER }] }),
      classCol.list(),
      scheduleCol.list(),
    ]);

    const existingTeachers = teachersRes.items.filter((t) => targetIds.has(t.id));
    for (const teacher of existingTeachers) {
      if (teacher.userId && teacher.userId === auth.user.id) {
        throw ApiError.badRequest(
          `Tidak dapat menghapus data guru "${teacher.fullName}" karena sedang digunakan akun yang aktif login.`,
        );
      }
    }

    const userMap = new Map(usersRes.items.map((u) => [u.id, u]));
    const qrToDelete = qrTokensRes.items.filter((q) => targetIds.has(q.ownerId));
    const classesToUnlink = classesRes.items.filter(
      (c) => c.homeroomTeacherId && targetIds.has(c.homeroomTeacherId),
    );
    const schedulesToDelete = schedulesRes.items.filter((s) => targetIds.has(s.teacherId));
    const usersToDelete = existingTeachers
      .map((t) => (t.userId ? userMap.get(t.userId) : undefined))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));

    const deletedUserIds = new Set(usersToDelete.map((u) => u.id));
    const usersToUnlink = usersRes.items.filter(
      (u) => u.linkedTeacherId && targetIds.has(u.linkedTeacherId) && !deletedUserIds.has(u.id),
    );

    await Promise.all([
      runInChunks(qrToDelete, 25, (qr) => qrCol.delete(qr.id)),
      runInChunks(classesToUnlink, 25, (c) => classCol.update(c.id, { homeroomTeacherId: null })),
      runInChunks(schedulesToDelete, 25, (s) => scheduleCol.delete(s.id)),
      runInChunks(usersToUnlink, 25, (u) => userCol.update(u.id, { linkedTeacherId: null })),
      runInChunks(usersToDelete, 15, async (linkedUser) => {
        await Promise.all([
          revokeAllUserSessions(repo, linkedUser.id),
          releaseUniqueUsername(repo, linkedUser.normalizedUsername),
        ]);
        await userCol.delete(linkedUser.id);
      }),
      runInChunks(existingTeachers, 25, (teacher) => teacherCol.delete(teacher.id)),
    ]);

    const deletedCount = existingTeachers.length;

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'TEACHERS_BULK_DELETED',
      entityType: 'TEACHER',
      entityId: 'bulk',
      after: { requestedCount: parsed.ids.length, deletedCount },
      reason: parsed.reason ?? 'Penghapusan massal data guru oleh admin.',
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
  await handleTeachersBulkDelete(req, res);
}
