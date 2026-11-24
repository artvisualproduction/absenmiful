import { academicYearCreateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleAcademicYears(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.ACADEMIC_YEARS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const result = await col.list({ sort: { field: 'label', direction: 'desc' } });
      sendOk(res, { items: result.items, total: result.total });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = academicYearCreateSchema.parse(req.body ?? {});

      if (new Date(parsed.endDate).getTime() <= new Date(parsed.startDate).getTime()) {
        throw ApiError.badRequest('Tanggal selesai harus setelah tanggal mulai.');
      }

      const duplicate = await col.findFirst([
        { field: 'label', op: '==', value: parsed.label },
      ]);
      if (duplicate) {
        throw ApiError.conflict(`Tahun ajaran "${parsed.label}" sudah terdaftar.`);
      }

      // Enforce only one active academic year
      if (parsed.isActive) {
        const activeList = await col.list({
          filters: [{ field: 'isActive', op: '==', value: true }],
        });
        await Promise.all(
          activeList.items.map((ay) => col.update(ay.id, { isActive: false })),
        );
      }

      const created = await col.create({
        label: parsed.label,
        semester: parsed.semester,
        startDate: new Date(parsed.startDate).toISOString(),
        endDate: new Date(parsed.endDate).toISOString(),
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'ACADEMIC_YEAR_CREATED',
        entityType: 'ACADEMIC_YEAR',
        entityId: created.id,
        after: { label: created.label, isActive: created.isActive },
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
  await handleAcademicYears(req, res);
}
