import { z } from 'zod';
import { CollectionName, UserRole, type BaseDocument } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { syncPublicSettingsMirror } from '../_lib/auth/bootstrapService';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { hashPassword } from '../_lib/auth/password';
import { getRepository } from '../_lib/repository';
import type { ICollectionRepository, IDataRepository } from '../_lib/repository/types';
import {
  FACTORY_ACADEMIC_YEARS,
  FACTORY_APP_SETTINGS,
  FACTORY_ATTENDANCE_RULES,
  FACTORY_CLASSES,
  FACTORY_HOLIDAYS,
  FACTORY_SCHOOL_LOCATIONS,
  FACTORY_SUBJECTS,
  FACTORY_TEACHERS,
  FACTORY_TEACHING_SCHEDULES,
} from '../_lib/seed/initialData';
import { applyBackupSnapshotRestore, restorePayloadSchema } from './restore';
import { FACTORY_BASELINE_ID } from './restore-points';

const FACTORY_RESET_ALLOWED_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const factoryResetSchema = z.object({
  confirmationText: z.string().trim(),
});

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

async function clearCollection(
  col: ICollectionRepository<BaseDocument>,
  preserveIds?: Set<string>,
): Promise<number> {
  const existing = await col.list();
  const toDelete = preserveIds
    ? existing.items.filter((item) => !preserveIds.has(item.id))
    : existing.items;
  if (toDelete.length === 0) return 0;
  await runInChunks(toDelete, 20, (item) => col.delete(item.id));
  return toDelete.length;
}

function extractBrandingAssetIds(settingsDoc: Record<string, unknown> | undefined): Set<string> {
  const ids = new Set<string>();
  if (!settingsDoc) return ids;
  for (const field of [
    'logoPath',
    'faviconPath',
    'pwaIcon192Path',
    'pwaIcon512Path',
    'loginBackgroundPath',
  ]) {
    const val = settingsDoc[field];
    if (typeof val !== 'string') continue;
    const match = val.match(/[?&]id=([^&]+)/);
    if (match?.[1]) {
      ids.add(decodeURIComponent(match[1]));
    }
  }
  return ids;
}

/**
 * POST /api/settings/factory-reset
 * Resets operational & master data to the active Factory Baseline:
 * - If Admin saved a custom Factory Baseline (`sys_factory_baseline`), restores it completely.
 * - Otherwise restores embedded MI MIFTAHUL ULUM factory baseline (`FACTORY_*`: 0 teachers,
 *   0 classes, 0 students, 0 subjects, 0 teaching schedules, 2 general attendance rules,
 *   1 location, 2 holidays, academic year 2026/2027, and MiFUL PWA config).
 * - Requires exact confirmationText === 'RESET PABRIK'
 * - Preserves SUPER_ADMIN, ADMIN, OPERATOR, PRINCIPAL accounts & current admin login session
 * - Keeps `initialSeedCompleted: true` so sample demo students never reappear automatically
 */
export async function handleFactoryReset(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: FACTORY_RESET_ALLOWED_ROLES });
    const parsed = factoryResetSchema.parse(req.body ?? {});

    if (parsed.confirmationText !== 'RESET PABRIK') {
      throw ApiError.badRequest(
        'Konfirmasi tidak cocok. Ketik tepat RESET PABRIK untuk melanjutkan format pabrik.',
      );
    }

    const customBaseline = await repo
      .collection(CollectionName.RESTORE_POINTS)
      .getById(FACTORY_BASELINE_ID);

    const validatedCustomSnapshot = customBaseline
      ? restorePayloadSchema.parse(customBaseline.snapshot)
      : null;

    const preservedBrandingIds = validatedCustomSnapshot
      ? extractBrandingAssetIds(validatedCustomSnapshot.collections.appSettings?.[0])
      : new Set<string>();

    const collectionsToClear: Array<{
      key: string;
      name: CollectionName;
      preserveIds?: Set<string>;
    }> = [
      { key: 'students', name: CollectionName.STUDENTS },
      { key: 'teachers', name: CollectionName.TEACHERS },
      { key: 'classes', name: CollectionName.CLASSES },
      { key: 'subjects', name: CollectionName.SUBJECTS },
      { key: 'academicYears', name: CollectionName.ACADEMIC_YEARS },
      { key: 'studentEnrollments', name: CollectionName.STUDENT_ENROLLMENTS },
      { key: 'teachingSchedules', name: CollectionName.TEACHING_SCHEDULES },
      { key: 'attendanceRules', name: CollectionName.ATTENDANCE_RULES },
      { key: 'schoolLocations', name: CollectionName.SCHOOL_LOCATIONS },
      { key: 'holidays', name: CollectionName.HOLIDAYS },
      { key: 'qrTokens', name: CollectionName.QR_TOKENS },
      { key: 'attendanceRecords', name: CollectionName.ATTENDANCE_RECORDS },
      { key: 'teacherPermissions', name: CollectionName.TEACHER_PERMISSIONS },
      {
        key: 'fileMetadata',
        name: CollectionName.FILE_METADATA,
        preserveIds: preservedBrandingIds,
      },
      {
        key: 'publicBrandingAssets',
        name: CollectionName.PUBLIC_BRANDING_ASSETS,
        preserveIds: preservedBrandingIds,
      },
    ];

    const clearedCounts: Record<string, number> = {};
    for (const item of collectionsToClear) {
      const col = repo.collection(item.name);
      clearedCounts[item.key] = await clearCollection(
        col as unknown as ICollectionRepository<BaseDocument>,
        item.preserveIds,
      );
    }

    let restoredTeacherIds: Set<string>;

    if (validatedCustomSnapshot) {
      const result = await applyBackupSnapshotRestore(repo, validatedCustomSnapshot, auth, {
        auditAction: 'SYSTEM_FACTORY_RESET',
        entityType: 'SYSTEM_SETTINGS',
        entityId: 'default',
        extraAudit: { usedCustomBaseline: true, clearedCounts },
      });
      restoredTeacherIds = new Set(
        (validatedCustomSnapshot.collections.teachers ?? []).map((t) => t.id),
      );

      // Ensure portalExitPasswordHash & initialSeedCompleted are normalized cleanly
      const defaultPortalExitHash = await hashPassword(
        process.env.PORTAL_DEFAULT_EXIT_PASSWORD || '123',
      );
      const updatedSettings = await repo
        .collection(CollectionName.APP_SETTINGS)
        .update('default', {
          portalExitPasswordHash: defaultPortalExitHash,
          initialSeedCompleted: true,
        });
      if (updatedSettings) {
        await syncPublicSettingsMirror(repo, updatedSettings);
      }
      clearedCounts.restoredCollections = Object.keys(result.restoredCounts).length;
    } else {
      // Restore embedded MI MIFTAHUL ULUM factory baseline structure (0 demo students)
      const now = new Date().toISOString();
      await Promise.all([
        ...FACTORY_ACADEMIC_YEARS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.ACADEMIC_YEARS).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_TEACHERS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.TEACHERS).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_CLASSES.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.CLASSES).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_SUBJECTS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.SUBJECTS).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_TEACHING_SCHEDULES.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.TEACHING_SCHEDULES).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_ATTENDANCE_RULES.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.ATTENDANCE_RULES).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_SCHOOL_LOCATIONS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.SCHOOL_LOCATIONS).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
        ...FACTORY_HOLIDAYS.map((item) => {
          const { id, ...rest } = item;
          return repo.collection(CollectionName.HOLIDAYS).createIfNotExists(id, {
            ...rest,
            createdAt: now,
            updatedAt: now,
          });
        }),
      ]);

      restoredTeacherIds = new Set(FACTORY_TEACHERS.map((t) => t.id));

      // Reset appSettings/default to MI MIFTAHUL ULUM factory defaults with initialSeedCompleted: true
      const settingsCol = repo.collection(CollectionName.APP_SETTINGS);
      const defaultPortalExitHash = await hashPassword(
        process.env.PORTAL_DEFAULT_EXIT_PASSWORD || '123',
      );
      const { id: _omitId, ...factorySettingsRest } = FACTORY_APP_SETTINGS;
      const existingSettings = await settingsCol.getById('default');
      const updatedSettings = existingSettings
        ? await settingsCol.update('default', {
            ...factorySettingsRest,
            portalExitPasswordHash: defaultPortalExitHash,
            initialSeedCompleted: true,
          })
        : await settingsCol.create({
            ...factorySettingsRest,
            id: 'default',
            portalExitPasswordHash: defaultPortalExitHash,
            initialSeedCompleted: true,
          });

      if (updatedSettings) {
        await syncPublicSettingsMirror(repo, updatedSettings);
      }
    }

    // Preserve SUPER_ADMIN and current actor; clean up ADMIN/OPERATOR and orphan PRINCIPAL/TEACHER accounts
    const usersCol = repo.collection(CollectionName.USERS);
    const uniqueUsernamesCol = repo.collection(CollectionName.UNIQUE_USERNAMES);
    const allUsers = await usersCol.list();
    let removedTeacherUsers = 0;

    await runInChunks(allUsers.items, 20, async (u) => {
      if (u.id === auth.user.id || u.role === UserRole.SUPER_ADMIN) {
        if (u.linkedTeacherId && !restoredTeacherIds.has(u.linkedTeacherId)) {
          await usersCol.update(u.id, { linkedTeacherId: null });
        }
        return;
      }
      if (
        u.role === UserRole.ADMIN ||
        u.role === UserRole.OPERATOR ||
        u.role === UserRole.TEACHER ||
        u.role === UserRole.PRINCIPAL
      ) {
        const hasValidRestoredTeacher =
          (u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL) &&
          Boolean(u.linkedTeacherId && restoredTeacherIds.has(u.linkedTeacherId));
        if (!hasValidRestoredTeacher) {
          await usersCol.delete(u.id);
          await uniqueUsernamesCol.delete(u.normalizedUsername).catch(() => undefined);
          removedTeacherUsers++;
        }
        return;
      }
    });
    clearedCounts.teacherUsers = removedTeacherUsers;

    const resetAt = new Date().toISOString();

    if (!validatedCustomSnapshot) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SYSTEM_FACTORY_RESET',
        entityType: 'SYSTEM_SETTINGS',
        entityId: 'default',
        after: { usedCustomBaseline: false, clearedCounts, resetAt },
        clientIp: auth.clientIp,
      });
    }

    sendOk(res, {
      reset: true,
      usedCustomBaseline: Boolean(validatedCustomSnapshot),
      clearedCounts,
      resetAt,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleFactoryReset(req, res);
}
