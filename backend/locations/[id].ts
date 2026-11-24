import { schoolLocationUpdateSchema } from '../../src/lib/teacherAttendanceValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleSchoolLocationById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID lokasi sekolah wajib diisi.');

    const col = repo.collection(CollectionName.SCHOOL_LOCATIONS);

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Lokasi sekolah tidak ditemukan.');

      const parsed = schoolLocationUpdateSchema.parse(req.body ?? {});

      if (parsed.isActive === true) {
        const others = await col.list({
          filters: [{ field: 'isActive', op: '==', value: true }],
        });
        await Promise.all(
          others.items
            .filter((loc) => loc.id !== id)
            .map((loc) => col.update(loc.id, { isActive: false })),
        );
      }

      const updated = await col.update(id, {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.latitude !== undefined ? { latitude: parsed.latitude } : {}),
        ...(parsed.longitude !== undefined ? { longitude: parsed.longitude } : {}),
        ...(parsed.radiusMeters !== undefined ? { radiusMeters: parsed.radiusMeters } : {}),
        ...(parsed.maxGpsAccuracyMeters !== undefined
          ? { maxGpsAccuracyMeters: parsed.maxGpsAccuracyMeters }
          : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHOOL_LOCATION_UPDATED',
        entityType: 'SCHOOL_LOCATION',
        entityId: id,
        before: {
          name: existing.name,
          latitude: existing.latitude,
          longitude: existing.longitude,
          radiusMeters: existing.radiusMeters,
          isActive: existing.isActive,
        },
        after: {
          name: updated?.name,
          latitude: updated?.latitude,
          longitude: updated?.longitude,
          radiusMeters: updated?.radiusMeters,
          isActive: updated?.isActive,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, updated);
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Lokasi sekolah tidak ditemukan.');

      const archived = await col.update(id, { isActive: false });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHOOL_LOCATION_ARCHIVED',
        entityType: 'SCHOOL_LOCATION',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        clientIp: auth.clientIp,
      });

      sendOk(res, { archived: true, location: archived });
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
  await handleSchoolLocationById(req, res);
}
