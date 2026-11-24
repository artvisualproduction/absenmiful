import { z } from 'zod';
import {
  CollectionName,
  UserRole,
  type AppSettings,
  type BaseDocument,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { syncPublicSettingsMirror } from '../_lib/auth/bootstrapService';
import { requireAuth, type ApiRequestLike, type AuthContext } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { ICollectionRepository, IDataRepository } from '../_lib/repository/types';

const RESTORE_ALLOWED_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const restoreDocSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .passthrough();

export const restorePayloadSchema = z.object({
  schemaVersion: z.string().optional(),
  exportedAt: z.string().optional(),
  collections: z.object({
    appSettings: z.array(restoreDocSchema).optional(),
    academicYears: z.array(restoreDocSchema).optional(),
    classes: z.array(restoreDocSchema).optional(),
    subjects: z.array(restoreDocSchema).optional(),
    students: z.array(restoreDocSchema).optional(),
    teachers: z.array(restoreDocSchema).optional(),
    studentEnrollments: z.array(restoreDocSchema).optional(),
    teachingSchedules: z.array(restoreDocSchema).optional(),
    attendanceRules: z.array(restoreDocSchema).optional(),
    schoolLocations: z.array(restoreDocSchema).optional(),
    holidays: z.array(restoreDocSchema).optional(),
    attendanceRecords: z.array(restoreDocSchema).optional(),
    teacherPermissions: z.array(restoreDocSchema).optional(),
    users: z.array(restoreDocSchema).optional(),
  }),
});

export type RestorePayload = z.infer<typeof restorePayloadSchema>;

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  worker: (item: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(worker));
  }
}

async function replaceCollectionFromBackup(
  col: ICollectionRepository<BaseDocument>,
  docs: Array<Record<string, unknown> & { id: string }>,
): Promise<number> {
  const existing = await col.list();
  const incomingIds = new Set(docs.map((d) => d.id));

  // Delete obsolete records not present in backup snapshot
  const toDelete = existing.items.filter((item) => !incomingIds.has(item.id));
  await runInChunks(toDelete, 20, (item) => col.delete(item.id));

  const existingIds = new Set(existing.items.map((item) => item.id));
  await runInChunks(docs, 20, async (doc) => {
    const { id, ...rest } = doc;
    if (existingIds.has(id)) {
      await col.update(id, rest as never);
    } else {
      await col.create(doc as never);
    }
  });

  return docs.length;
}

export async function applyBackupSnapshotRestore(
  repo: IDataRepository,
  parsed: RestorePayload,
  auth: AuthContext,
  options?: {
    auditAction?: string;
    entityType?: string;
    entityId?: string;
    extraAudit?: Record<string, unknown>;
  },
): Promise<{ restoredCounts: Record<string, number>; restoredAt: string }> {
  const collections = parsed.collections;
  const restoredCounts: Record<string, number> = {};

  const collectionMappings: Array<{
    key: keyof typeof collections;
    collectionName: CollectionName;
  }> = [
    { key: 'academicYears', collectionName: CollectionName.ACADEMIC_YEARS },
    { key: 'classes', collectionName: CollectionName.CLASSES },
    { key: 'subjects', collectionName: CollectionName.SUBJECTS },
    { key: 'students', collectionName: CollectionName.STUDENTS },
    { key: 'teachers', collectionName: CollectionName.TEACHERS },
    { key: 'studentEnrollments', collectionName: CollectionName.STUDENT_ENROLLMENTS },
    { key: 'teachingSchedules', collectionName: CollectionName.TEACHING_SCHEDULES },
    { key: 'attendanceRules', collectionName: CollectionName.ATTENDANCE_RULES },
    { key: 'schoolLocations', collectionName: CollectionName.SCHOOL_LOCATIONS },
    { key: 'holidays', collectionName: CollectionName.HOLIDAYS },
    { key: 'attendanceRecords', collectionName: CollectionName.ATTENDANCE_RECORDS },
    { key: 'teacherPermissions', collectionName: CollectionName.TEACHER_PERMISSIONS },
  ];

  for (const mapping of collectionMappings) {
    const docs = collections[mapping.key];
    if (!docs) continue;
    const col = repo.collection(mapping.collectionName);
    restoredCounts[mapping.key] = await replaceCollectionFromBackup(
      col as unknown as ICollectionRepository<BaseDocument>,
      docs,
    );
  }

  // Safely restore appSettings while preserving portalExitPasswordHash
  if (collections.appSettings && collections.appSettings.length > 0) {
    const settingsCol = repo.collection(CollectionName.APP_SETTINGS);
    const source =
      collections.appSettings.find((s) => s.id === 'default') ?? collections.appSettings[0]!;
    const existing = await settingsCol.getById('default');
    const {
      id: _omitId,
      portalExitPasswordHash: _omitSecret,
      ...safeSettingsFields
    } = source as Record<string, unknown>;

    let updatedSettings: AppSettings | null = null;
    if (existing) {
      updatedSettings = await settingsCol.update('default', {
        ...(safeSettingsFields as Partial<AppSettings>),
        initialSeedCompleted: true,
      });
    } else {
      updatedSettings = await settingsCol.create({
        ...(safeSettingsFields as Omit<AppSettings, 'id'>),
        id: 'default',
        initialSeedCompleted: true,
        portalExitPasswordHash: '',
      });
    }

    if (updatedSettings) {
      await syncPublicSettingsMirror(repo, updatedSettings);
    }
    restoredCounts.appSettings = 1;
  }

  // Safely update existing users metadata (role, isActive, linkedTeacherId) without wiping credentials
  if (collections.users && collections.users.length > 0) {
    const userCol = repo.collection(CollectionName.USERS);
    const existingUsers = await userCol.list();
    const existingMap = new Map(existingUsers.items.map((u) => [u.id, u]));
    let updatedUserCount = 0;

    await runInChunks(collections.users, 20, async (backupUser) => {
      const current = existingMap.get(backupUser.id);
      if (!current) return;
      // Never disable or overwrite the active admin performing the restore
      if (current.id === auth.user.id) return;

      const patch: Record<string, unknown> = {};
      if (typeof backupUser.isActive === 'boolean') patch.isActive = backupUser.isActive;
      if ('linkedTeacherId' in backupUser) {
        patch.linkedTeacherId = (backupUser.linkedTeacherId as string | null) ?? null;
      }
      if (
        typeof backupUser.role === 'string' &&
        (auth.user.role === UserRole.SUPER_ADMIN || backupUser.role !== UserRole.SUPER_ADMIN)
      ) {
        patch.role = backupUser.role;
      }
      if (Object.keys(patch).length > 0) {
        await userCol.update(current.id, patch);
        updatedUserCount++;
      }
    });
    restoredCounts.users = updatedUserCount;
  }

  const restoredAt = new Date().toISOString();

  await recordActivityLog(repo, {
    actorUserId: auth.user.id,
    actorRole: auth.user.role,
    action: options?.auditAction ?? 'SYSTEM_BACKUP_RESTORED',
    entityType: options?.entityType ?? 'SYSTEM_BACKUP',
    entityId: options?.entityId ?? restoredAt,
    after: {
      sourceExportedAt: parsed.exportedAt ?? null,
      restoredCounts,
      ...(options?.extraAudit ?? {}),
    },
    clientIp: auth.clientIp,
  });

  return { restoredCounts, restoredAt };
}

/**
 * POST /api/settings/restore
 * Restores operational & master data collections from an exported JSON backup snapshot.
 * Strictly preserves `portalExitPasswordHash` and existing active user credentials/hashes.
 */
export async function handleSettingsRestore(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: RESTORE_ALLOWED_ROLES });
    const parsed = restorePayloadSchema.parse(req.body ?? {});
    const result = await applyBackupSnapshotRestore(repo, parsed, auth);

    sendOk(res, {
      restored: true,
      restoredCounts: result.restoredCounts,
      restoredAt: result.restoredAt,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleSettingsRestore(req, res);
}
