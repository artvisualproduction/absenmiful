import { schoolLocationCreateSchema } from '../../src/lib/teacherAttendanceValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleSchoolLocations(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.SCHOOL_LOCATIONS);

    if (req.method === 'GET') {
      // Any authenticated user may read school geofence config (teachers & portal need it for display)
      await requireAuth(req, { repo });
      const [locRes, settings] = await Promise.all([
        col.list({ sort: { field: 'createdAt', direction: 'desc' } }),
        repo.collection(CollectionName.APP_SETTINGS).getById('default'),
      ]);

      sendOk(res, {
        items: locRes.items,
        total: locRes.total,
        gpsSettings: {
          gpsEnabledForStudents: settings?.gpsEnabledForStudents ?? true,
          gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
          teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = schoolLocationCreateSchema.parse(req.body ?? {});

      if (parsed.isActive) {
        const existing = await col.list({
          filters: [{ field: 'isActive', op: '==', value: true }],
        });
        await Promise.all(existing.items.map((loc) => col.update(loc.id, { isActive: false })));
      }

      const created = await col.create({
        name: parsed.name,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        radiusMeters: parsed.radiusMeters,
        maxGpsAccuracyMeters: parsed.maxGpsAccuracyMeters,
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHOOL_LOCATION_CREATED',
        entityType: 'SCHOOL_LOCATION',
        entityId: created.id,
        after: {
          name: created.name,
          latitude: created.latitude,
          longitude: created.longitude,
          radiusMeters: created.radiusMeters,
          maxGpsAccuracyMeters: created.maxGpsAccuracyMeters,
          isActive: created.isActive,
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
  await handleSchoolLocations(req, res);
}
