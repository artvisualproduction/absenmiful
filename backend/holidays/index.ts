import { holidayCreateSchema, holidayUpdateSchema } from '../../src/lib/scheduleRulesValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleHolidays(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.HOLIDAYS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const result = await col.list({ sort: { field: 'date', direction: 'asc' } });
      sendOk(res, { items: result.items, total: result.total });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = holidayCreateSchema.parse(req.body ?? {});

      const dup = await col.findFirst([
        { field: 'date', op: '==', value: parsed.date },
        { field: 'scope', op: '==', value: parsed.scope },
      ]);
      if (dup && dup.isActive) {
        throw ApiError.conflict(
          `Tanggal libur ${parsed.date} untuk cakupan ini sudah terdaftar (${dup.name}).`,
        );
      }

      const created = await col.create({
        date: parsed.date,
        name: parsed.name,
        scope: parsed.scope,
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'HOLIDAY_CREATED',
        entityType: 'HOLIDAY',
        entityId: created.id,
        after: { date: created.date, name: created.name, scope: created.scope },
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

export async function handleHolidayById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID hari libur wajib diisi.');

    const col = repo.collection(CollectionName.HOLIDAYS);

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Hari libur tidak ditemukan.');

      const parsed = holidayUpdateSchema.parse(req.body ?? {});
      const updated = await col.update(id, {
        ...(parsed.date !== undefined ? { date: parsed.date } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.scope !== undefined ? { scope: parsed.scope } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'HOLIDAY_UPDATED',
        entityType: 'HOLIDAY',
        entityId: id,
        before: { date: existing.date, name: existing.name, isActive: existing.isActive },
        after: { date: updated?.date, name: updated?.name, isActive: updated?.isActive },
        clientIp: auth.clientIp,
      });

      sendOk(res, updated);
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Hari libur tidak ditemukan.');

      const archived = await col.update(id, { isActive: false });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'HOLIDAY_ARCHIVED',
        entityType: 'HOLIDAY',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        clientIp: auth.clientIp,
      });

      sendOk(res, { archived: true, holiday: archived });
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
  await handleHolidays(req, res);
}
