import { academicYearUpdateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleAcademicYearById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID tahun ajaran wajib diisi.');

    const col = repo.collection(CollectionName.ACADEMIC_YEARS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await col.getById(id);
      if (!item) throw ApiError.notFound('Tahun ajaran tidak ditemukan.');
      sendOk(res, item);
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Tahun ajaran tidak ditemukan.');

      const parsed = academicYearUpdateSchema.parse(req.body ?? {});

      if (parsed.label && parsed.label !== existing.label) {
        const dup = await col.findFirst([{ field: 'label', op: '==', value: parsed.label }]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`Tahun ajaran "${parsed.label}" sudah terdaftar.`);
        }
      }

      const nextStart = parsed.startDate
        ? new Date(parsed.startDate).toISOString()
        : existing.startDate;
      const nextEnd = parsed.endDate
        ? new Date(parsed.endDate).toISOString()
        : existing.endDate;

      if (new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) {
        throw ApiError.badRequest('Tanggal selesai harus setelah tanggal mulai.');
      }

      if (parsed.isActive === true) {
        const activeList = await col.list({
          filters: [{ field: 'isActive', op: '==', value: true }],
        });
        await Promise.all(
          activeList.items
            .filter((ay) => ay.id !== id)
            .map((ay) => col.update(ay.id, { isActive: false })),
        );
      }

      const updated = await col.update(id, {
        ...(parsed.label !== undefined ? { label: parsed.label } : {}),
        ...(parsed.semester !== undefined ? { semester: parsed.semester } : {}),
        ...(parsed.startDate !== undefined ? { startDate: nextStart } : {}),
        ...(parsed.endDate !== undefined ? { endDate: nextEnd } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'ACADEMIC_YEAR_UPDATED',
        entityType: 'ACADEMIC_YEAR',
        entityId: id,
        before: { label: existing.label, isActive: existing.isActive },
        after: { label: updated?.label, isActive: updated?.isActive },
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
  await handleAcademicYearById(req, res);
}
