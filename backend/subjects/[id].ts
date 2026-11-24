import { subjectUpdateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleSubjectById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID mata pelajaran wajib diisi.');

    const col = repo.collection(CollectionName.SUBJECTS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await col.getById(id);
      if (!item) throw ApiError.notFound('Mata pelajaran tidak ditemukan.');
      sendOk(res, item);
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Mata pelajaran tidak ditemukan.');

      const parsed = subjectUpdateSchema.parse(req.body ?? {});
      const normalizedCode = parsed.code ? parsed.code.toUpperCase() : undefined;

      if (normalizedCode && normalizedCode !== existing.code) {
        const dup = await col.findFirst([{ field: 'code', op: '==', value: normalizedCode }]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`Kode mata pelajaran "${normalizedCode}" sudah digunakan.`);
        }
      }

      const updated = await col.update(id, {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(normalizedCode !== undefined ? { code: normalizedCode } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SUBJECT_UPDATED',
        entityType: 'SUBJECT',
        entityId: id,
        before: { code: existing.code, name: existing.name, isActive: existing.isActive },
        after: { code: updated?.code, name: updated?.name, isActive: updated?.isActive },
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
  await handleSubjectById(req, res);
}
