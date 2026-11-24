import crypto from 'node:crypto';
import { z } from 'zod';
import { CollectionName, UserRole, type RestorePoint } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { applyBackupSnapshotRestore, restorePayloadSchema } from './restore';

export const FACTORY_BASELINE_ID = 'sys_factory_baseline';

const RESTORE_POINT_VIEW_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];
const RESTORE_POINT_WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const createRestorePointSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nama Restore Point minimal 3 karakter.')
    .max(100, 'Nama Restore Point maksimal 100 karakter.'),
  note: z.string().trim().max(250, 'Catatan maksimal 250 karakter.').optional(),
});

function sanitizeRestorePointSummary(rp: RestorePoint) {
  return {
    id: rp.id,
    name: rp.name,
    note: rp.note ?? null,
    createdAt: rp.createdAt ?? '',
    createdBy: rp.createdBy ?? null,
    createdByName: rp.createdByName,
    counts: rp.counts ?? {},
  };
}

async function buildSanitizedSnapshot(repo: IDataRepository) {
  const [
    settingsRes,
    academicYearsRes,
    classesRes,
    subjectsRes,
    studentsRes,
    teachersRes,
    enrollmentsRes,
    schedulesRes,
    rulesRes,
    locationsRes,
    holidaysRes,
    attendanceRes,
    permissionsRes,
    usersRes,
  ] = await Promise.all([
    repo.collection(CollectionName.APP_SETTINGS).list(),
    repo.collection(CollectionName.ACADEMIC_YEARS).list(),
    repo.collection(CollectionName.CLASSES).list(),
    repo.collection(CollectionName.SUBJECTS).list(),
    repo.collection(CollectionName.STUDENTS).list(),
    repo.collection(CollectionName.TEACHERS).list(),
    repo.collection(CollectionName.STUDENT_ENROLLMENTS).list(),
    repo.collection(CollectionName.TEACHING_SCHEDULES).list(),
    repo.collection(CollectionName.ATTENDANCE_RULES).list(),
    repo.collection(CollectionName.SCHOOL_LOCATIONS).list(),
    repo.collection(CollectionName.HOLIDAYS).list(),
    repo.collection(CollectionName.ATTENDANCE_RECORDS).list(),
    repo.collection(CollectionName.TEACHER_PERMISSIONS).list(),
    repo.collection(CollectionName.USERS).list(),
  ]);

  const safeSettings = settingsRes.items.map(({ portalExitPasswordHash: _o, ...rest }) => rest);
  const safeUsers = usersRes.items.map(
    ({ passwordHash: _p, passwordCipher: _pc, ...rest }) => rest,
  );

  const exportedAt = new Date().toISOString();
  const counts: Record<string, number> = {
    academicYears: academicYearsRes.items.length,
    classes: classesRes.items.length,
    subjects: subjectsRes.items.length,
    students: studentsRes.items.length,
    teachers: teachersRes.items.length,
    enrollments: enrollmentsRes.items.length,
    teachingSchedules: schedulesRes.items.length,
    attendanceRules: rulesRes.items.length,
    schoolLocations: locationsRes.items.length,
    holidays: holidaysRes.items.length,
    attendanceRecords: attendanceRes.items.length,
    teacherPermissions: permissionsRes.items.length,
    users: safeUsers.length,
  };

  return {
    counts,
    snapshot: {
      schemaVersion: '1.0.0',
      exportedAt,
      collections: {
        appSettings: safeSettings,
        academicYears: academicYearsRes.items,
        classes: classesRes.items,
        subjects: subjectsRes.items,
        students: studentsRes.items,
        teachers: teachersRes.items,
        studentEnrollments: enrollmentsRes.items,
        teachingSchedules: schedulesRes.items,
        attendanceRules: rulesRes.items,
        schoolLocations: locationsRes.items,
        holidays: holidaysRes.items,
        attendanceRecords: attendanceRes.items,
        teacherPermissions: permissionsRes.items,
        users: safeUsers,
      },
    },
  };
}

/**
 * GET /api/settings/restore-points
 * POST /api/settings/restore-points
 */
export async function handleRestorePoints(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_VIEW_ROLES });
      const list = await repo.collection(CollectionName.RESTORE_POINTS).list({
        sort: { field: 'createdAt', direction: 'desc' },
      });
      const items = list.items
        .filter((rp) => rp.id !== FACTORY_BASELINE_ID && rp.id !== '__factory_baseline__')
        .map(sanitizeRestorePointSummary);
      sendOk(res, { items, total: items.length });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
      const parsed = createRestorePointSchema.parse(req.body ?? {});

      const { counts, snapshot } = await buildSanitizedSnapshot(repo);
      const id = `rp_${crypto.randomBytes(6).toString('hex')}`;
      const created = await repo.collection(CollectionName.RESTORE_POINTS).create({
        id,
        name: parsed.name,
        note: parsed.note && parsed.note.length > 0 ? parsed.note : null,
        createdBy: auth.user.id,
        createdByName: auth.user.username,
        counts,
        snapshot,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SYSTEM_RESTORE_POINT_CREATED',
        entityType: 'RESTORE_POINT',
        entityId: created.id,
        after: { name: created.name, counts },
        clientIp: auth.clientIp,
      });

      sendOk(res, sanitizeRestorePointSummary(created), 201);
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * POST /api/settings/restore-points/:id/restore
 */
export async function handleRestorePointApply(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  id: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
    if (id === FACTORY_BASELINE_ID) {
      throw ApiError.notFound('Restore Point tidak ditemukan.');
    }
    const rp = await repo.collection(CollectionName.RESTORE_POINTS).getById(id);
    if (!rp) {
      throw ApiError.notFound('Restore Point tidak ditemukan.');
    }

    const validatedSnapshot = restorePayloadSchema.parse(rp.snapshot);
    const result = await applyBackupSnapshotRestore(repo, validatedSnapshot, auth, {
      auditAction: 'SYSTEM_RESTORE_POINT_APPLIED',
      entityType: 'RESTORE_POINT',
      entityId: rp.id,
      extraAudit: { restorePointName: rp.name },
    });

    sendOk(res, {
      restored: true,
      restorePointId: rp.id,
      restorePointName: rp.name,
      restoredCounts: result.restoredCounts,
      restoredAt: result.restoredAt,
    });
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * DELETE /api/settings/restore-points/:id
 */
export async function handleRestorePointById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  id: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'DELETE') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus DELETE.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
    if (id === FACTORY_BASELINE_ID) {
      throw ApiError.notFound('Restore Point tidak ditemukan.');
    }
    const col = repo.collection(CollectionName.RESTORE_POINTS);
    const existing = await col.getById(id);
    if (!existing) {
      throw ApiError.notFound('Restore Point tidak ditemukan.');
    }

    await col.delete(id);

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'SYSTEM_RESTORE_POINT_DELETED',
      entityType: 'RESTORE_POINT',
      entityId: id,
      before: { name: existing.name, createdAt: existing.createdAt ?? null },
      clientIp: auth.clientIp,
    });

    sendOk(res, { deleted: true, id });
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * GET /api/settings/factory-baseline
 * POST /api/settings/factory-baseline
 * DELETE /api/settings/factory-baseline
 * Captures, inspects, or clears the custom Factory Baseline used whenever Format Factory is executed.
 */
export async function handleFactoryBaseline(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_VIEW_ROLES });
      const doc = await repo
        .collection(CollectionName.RESTORE_POINTS)
        .getById(FACTORY_BASELINE_ID);
      sendOk(res, {
        configured: Boolean(doc),
        baseline: doc ? sanitizeRestorePointSummary(doc) : null,
      });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
      const { counts, snapshot } = await buildSanitizedSnapshot(repo);
      const col = repo.collection(CollectionName.RESTORE_POINTS);
      const existing = await col.getById(FACTORY_BASELINE_ID);

      const payload = {
        name: 'Setelan & Database Pabrik Kustom',
        note: 'Baseline setelan aplikasi dan database sekolah yang dijadikan acuan Format Factory.',
        createdBy: auth.user.id,
        createdByName: auth.user.username,
        counts,
        snapshot,
      };

      const saved = existing
        ? await col.update(FACTORY_BASELINE_ID, payload)
        : await col.create({
            id: FACTORY_BASELINE_ID,
            ...payload,
          });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SYSTEM_FACTORY_BASELINE_SAVED',
        entityType: 'SYSTEM_SETTINGS',
        entityId: FACTORY_BASELINE_ID,
        after: { counts },
        clientIp: auth.clientIp,
      });

      sendOk(res, {
        configured: true,
        baseline: saved ? sanitizeRestorePointSummary(saved) : null,
      });
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_POINT_WRITE_ROLES });
      const col = repo.collection(CollectionName.RESTORE_POINTS);
      const existing = await col.getById(FACTORY_BASELINE_ID);
      if (existing) {
        await col.delete(FACTORY_BASELINE_ID);
        await recordActivityLog(repo, {
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          action: 'SYSTEM_FACTORY_BASELINE_CLEARED',
          entityType: 'SYSTEM_SETTINGS',
          entityId: FACTORY_BASELINE_ID,
          before: { counts: existing.counts ?? {} },
          clientIp: auth.clientIp,
        });
      }
      sendOk(res, { configured: false, baseline: null });
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleRestorePoints(req, res);
}
