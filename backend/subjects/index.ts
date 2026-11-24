import { subjectCreateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleSubjects(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.SUBJECTS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const search = getQueryString(req, 'search').toLowerCase();
      const activeParam = getQueryString(req, 'isActive');

      const result = await col.list({ sort: { field: 'name', direction: 'asc' } });
      const filtered = result.items.filter((item) => {
        if (activeParam === 'true' && !item.isActive) return false;
        if (activeParam === 'false' && item.isActive) return false;
        if (
          search &&
          !item.name.toLowerCase().includes(search) &&
          !item.code.toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      });

      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = subjectCreateSchema.parse(req.body ?? {});
      const normalizedCode = parsed.code.toUpperCase();

      const duplicate = await col.findFirst([
        { field: 'code', op: '==', value: normalizedCode },
      ]);
      if (duplicate) {
        throw ApiError.conflict(`Kode mata pelajaran "${normalizedCode}" sudah digunakan.`);
      }

      const created = await col.create({
        name: parsed.name,
        code: normalizedCode,
        defaultToHomeroomTeacher: Boolean(parsed.defaultToHomeroomTeacher),
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SUBJECT_CREATED',
        entityType: 'SUBJECT',
        entityId: created.id,
        after: {
          code: created.code,
          name: created.name,
          defaultToHomeroomTeacher: created.defaultToHomeroomTeacher ?? false,
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
  await handleSubjects(req, res);
}
