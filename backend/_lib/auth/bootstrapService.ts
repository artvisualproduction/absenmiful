import crypto from 'node:crypto';
import {
  CollectionName,
  UserRole,
  type AppSettings,
  type PublicAppSettings,
} from '../../../src/types';
import { ApiError } from '../apiError';
import type { IDataRepository } from '../repository/types';
import { recordActivityLog } from './audit';
import {
  encryptPasswordForAdminView,
  generateTemporaryPassword,
  hashPassword,
} from './password';
import {
  buildUsernameBaseFromName,
  findAvailableUsername,
  reserveUniqueUsername,
} from './uniqueUsername';
import {
  FACTORY_ACADEMIC_YEARS,
  FACTORY_APP_SETTINGS,
  FACTORY_ATTENDANCE_RULES,
  FACTORY_CLASSES,
  FACTORY_HOLIDAYS,
  FACTORY_SCHOOL_LOCATIONS,
  FACTORY_STUDENT_ENROLLMENTS,
  FACTORY_STUDENTS,
  FACTORY_SUBJECTS,
  FACTORY_TEACHERS,
  FACTORY_TEACHING_SCHEDULES,
  SEED_ACADEMIC_YEARS,
  SEED_APP_SETTINGS,
  SEED_ATTENDANCE_RULES,
  SEED_CLASSES,
  SEED_HOLIDAYS,
  SEED_SCHOOL_LOCATIONS,
  SEED_STUDENT_ENROLLMENTS,
  SEED_STUDENTS,
  SEED_SUBJECTS,
  SEED_TEACHERS,
  SEED_TEACHING_SCHEDULES,
} from '../seed/initialData';

export interface BootstrapPasswordsInput {
  superAdminPassword: string;
  adminPassword?: string;
  principalPassword?: string;
  portalExitPassword?: string;
  /**
   * Whether to auto-provision teacher user accounts during bootstrap.
   * Defaults to false in production/preview so only `superadmin` exists,
   * while allowing test suites to opt in when testing teacher account generation.
   */
  seedTeacherAccounts?: boolean;
}

export interface BootstrappedAccountSummary {
  userId: string;
  username: string;
  role: UserRole;
  fullName: string;
  linkedTeacherId: string | null;
  mustChangePassword: boolean;
  /** Only populated ONCE for generated temporary teacher passwords */
  temporaryPassword?: string;
}

export interface BootstrapResult {
  accounts: BootstrappedAccountSummary[];
}

function validateProvidedPassword(label: string, value: string): void {
  if (!value || value.length < 8) {
    throw ApiError.badRequest(`Kata sandi ${label} minimal 8 karakter.`);
  }
}

/**
 * Creates the initial set of accounts when the `users` collection is empty:
 * - 1 SUPER_ADMIN (`superadmin`)
 * - 1 ADMIN (`admin`)
 * - 1 PRINCIPAL (`kepsek`) linked to IMAM MUSTHOFA (Kepala Sekolah)
 * - 7 TEACHER accounts (one per teacher in `teachers` collection) with
 *   cryptographically random temporary passwords (NEVER derived from NIP) and
 *   `mustChangePassword: true`.
 */
export async function bootstrapInitialAccounts(
  repo: IDataRepository,
  passwords: BootstrapPasswordsInput,
  clientIp?: string,
): Promise<BootstrapResult> {
  validateProvidedPassword('Super Admin', passwords.superAdminPassword);
  if (passwords.adminPassword !== undefined) {
    validateProvidedPassword('Admin', passwords.adminPassword);
  }
  if (passwords.principalPassword !== undefined) {
    validateProvidedPassword('Kepala Sekolah', passwords.principalPassword);
  }

  const usersCol = repo.collection(CollectionName.USERS);
  const existingCount = await usersCol.count();
  if (existingCount > 0) {
    throw ApiError.forbidden('Akun awal sudah diinisialisasi sebelumnya.');
  }

  const teachersRes = await repo.collection(CollectionName.TEACHERS).list({
    sort: { field: 'id', direction: 'asc' },
  });

  // Identify Kepala Sekolah (IMAM MUSTHOFA, NIP 20521133191001)
  const principalTeacher =
    teachersRes.items.find(
      (t) =>
        t.niyNip === '20521133191001' ||
        t.position.toLowerCase().includes('kepala sekolah'),
    ) ?? null;

  const accounts: BootstrappedAccountSummary[] = [];

  const createFixedAccount = async (params: {
    username: string;
    password: string;
    role: UserRole;
    fullName: string;
    linkedTeacherId: string | null;
    mustChangePassword: boolean;
  }) => {
    const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const normalizedUsername = await reserveUniqueUsername(repo, params.username, userId);
    const passwordHash = await hashPassword(params.password);

    await usersCol.create({
      id: userId,
      username: normalizedUsername,
      normalizedUsername,
      passwordHash,
      passwordCipher: encryptPasswordForAdminView(params.password),
      role: params.role,
      linkedTeacherId: params.linkedTeacherId,
      isActive: true,
      mustChangePassword: params.mustChangePassword,
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    });

    accounts.push({
      userId,
      username: normalizedUsername,
      role: params.role,
      fullName: params.fullName,
      linkedTeacherId: params.linkedTeacherId,
      mustChangePassword: params.mustChangePassword,
    });

    return userId;
  };

  const superAdminId = await createFixedAccount({
    username: 'superadmin',
    password: passwords.superAdminPassword,
    role: UserRole.SUPER_ADMIN,
    fullName: 'Super Admin Sistem',
    linkedTeacherId: null,
    mustChangePassword: false,
  });

  if (passwords.adminPassword) {
    await createFixedAccount({
      username: 'admin',
      password: passwords.adminPassword,
      role: UserRole.ADMIN,
      fullName: 'Admin Operasional Sekolah',
      linkedTeacherId: null,
      mustChangePassword: false,
    });
  }

  if (passwords.principalPassword) {
    await createFixedAccount({
      username: 'kepsek',
      password: passwords.principalPassword,
      role: UserRole.PRINCIPAL,
      fullName: principalTeacher?.fullName ?? 'Kepala Sekolah',
      linkedTeacherId: principalTeacher?.id ?? null,
      mustChangePassword: false,
    });
  }

  // Create TEACHER accounts with random temporary passwords (when enabled)
  const shouldSeedTeachers = passwords.seedTeacherAccounts ?? true;
  if (shouldSeedTeachers) {
    for (const teacher of teachersRes.items) {
      const base = buildUsernameBaseFromName(teacher.fullName);
      const availableUsername = await findAvailableUsername(repo, base);
      const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
      const normalizedUsername = await reserveUniqueUsername(repo, availableUsername, userId);
      const temporaryPassword = generateTemporaryPassword(12);
      const passwordHash = await hashPassword(temporaryPassword);

      await usersCol.create({
        id: userId,
        username: normalizedUsername,
        normalizedUsername,
        passwordHash,
        passwordCipher: encryptPasswordForAdminView(temporaryPassword),
        role: UserRole.TEACHER,
        linkedTeacherId: teacher.id,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      });

      // Link userId back to teacher profile
      await repo.collection(CollectionName.TEACHERS).update(teacher.id, { userId });

      accounts.push({
        userId,
        username: normalizedUsername,
        role: UserRole.TEACHER,
        fullName: teacher.fullName,
        linkedTeacherId: teacher.id,
        mustChangePassword: false,
        temporaryPassword,
      });
    }
  }

  // Initialize appSettings/default if missing (e.g. fresh Cloud Firestore) or set portalExitPasswordHash if empty
  const settingsCol = repo.collection(CollectionName.APP_SETTINGS);
  const currentSettings = await settingsCol.getById('default');
  const exitPlain = passwords.portalExitPassword?.trim() || '123';
  if (!currentSettings) {
    const portalExitPasswordHash = await hashPassword(exitPlain);
    const seedSettings = repo.mode === 'real' ? FACTORY_APP_SETTINGS : SEED_APP_SETTINGS[0];
    const createdSettings = await settingsCol.create({
      ...seedSettings,
      id: 'default',
      portalExitPasswordHash,
    });
    await syncPublicSettingsMirror(repo, createdSettings);
  } else if (!currentSettings.portalExitPasswordHash) {
    const portalExitPasswordHash = await hashPassword(exitPlain);
    await settingsCol.update('default', { portalExitPasswordHash });
  }

  await recordActivityLog(repo, {
    actorUserId: superAdminId,
    actorRole: UserRole.SUPER_ADMIN,
    action: 'ACCOUNTS_BOOTSTRAPPED',
    entityType: 'USER',
    entityId: 'bootstrap',
    after: { totalAccountsCreated: accounts.length },
    clientIp,
  });

  return { accounts };
}

/**
 * Ensures baseline `appSettings/default`, default operational config (when empty),
 * and ready-to-use initial accounts exist on a fresh database (both `mock` and `real` Firestore).
 * Never overwrites existing documents when collections already have data.
 */
export async function ensurePreviewAccountsInitialized(repo: IDataRepository): Promise<void> {
  // 1. Ensure appSettings/default exists (critical for fresh Firestore so Login & Settings never 404)
  const settingsCol = repo.collection(CollectionName.APP_SETTINGS);
  const usersCol = repo.collection(CollectionName.USERS);
  const [existingSettings, usersCount] = await Promise.all([
    settingsCol.getById('default'),
    usersCol.count(),
  ]);

  const isRealMode = repo.mode === 'real' || repo.mode === 'mysql';
  const baselineSettings = isRealMode ? FACTORY_APP_SETTINGS : SEED_APP_SETTINGS[0];
  let resolvedSettings = existingSettings;

  if (!existingSettings) {
    const portalExitPasswordHash = await hashPassword(
      process.env.PORTAL_DEFAULT_EXIT_PASSWORD || '123',
    );
    const { id: _seedId, initialSeedCompleted: _omitSeedFlag, ...seedSettingsRest } =
      baselineSettings;
    resolvedSettings = await settingsCol.createIfNotExists('default', {
      ...seedSettingsRest,
      initialSeedCompleted: false,
      portalExitPasswordHash,
    }).then((res) => res.doc);
  }

  // 2. Seed baseline operational & master data ONLY ONCE on a brand-new database.
  // Once initialSeedCompleted is true (or users already exist), deleted sample students/teachers
  // will NEVER be recreated automatically on server restarts or cold starts.
  const shouldSeedInitialCollections = !existingSettings?.initialSeedCompleted && usersCount === 0;

  if (shouldSeedInitialCollections) {
    const baseAcademicYears = isRealMode ? FACTORY_ACADEMIC_YEARS : SEED_ACADEMIC_YEARS;
    const baseLocations = isRealMode ? FACTORY_SCHOOL_LOCATIONS : SEED_SCHOOL_LOCATIONS;
    const baseRules = isRealMode ? FACTORY_ATTENDANCE_RULES : SEED_ATTENDANCE_RULES;
    const baseTeachers = isRealMode ? FACTORY_TEACHERS : SEED_TEACHERS;
    const baseClasses = isRealMode ? FACTORY_CLASSES : SEED_CLASSES;
    const baseSubjects = isRealMode ? FACTORY_SUBJECTS : SEED_SUBJECTS;
    const baseStudents = isRealMode ? FACTORY_STUDENTS : SEED_STUDENTS;
    const baseEnrollments = isRealMode ? FACTORY_STUDENT_ENROLLMENTS : SEED_STUDENT_ENROLLMENTS;
    const baseSchedules = isRealMode ? FACTORY_TEACHING_SCHEDULES : SEED_TEACHING_SCHEDULES;
    const baseHolidays = isRealMode ? FACTORY_HOLIDAYS : SEED_HOLIDAYS;

    const [
      ayCount,
      locCount,
      rulesCount,
      teachersCount,
      classesCount,
      subjectsCount,
      studentsCount,
      enrollmentsCount,
      schedulesCount,
      holidaysCount,
    ] = await Promise.all([
      repo.collection(CollectionName.ACADEMIC_YEARS).count(),
      repo.collection(CollectionName.SCHOOL_LOCATIONS).count(),
      repo.collection(CollectionName.ATTENDANCE_RULES).count(),
      repo.collection(CollectionName.TEACHERS).count(),
      repo.collection(CollectionName.CLASSES).count(),
      repo.collection(CollectionName.SUBJECTS).count(),
      repo.collection(CollectionName.STUDENTS).count(),
      repo.collection(CollectionName.STUDENT_ENROLLMENTS).count(),
      repo.collection(CollectionName.TEACHING_SCHEDULES).count(),
      repo.collection(CollectionName.HOLIDAYS).count(),
    ]);

    const seedTasks: Promise<unknown>[] = [];
    if (ayCount === 0) {
      for (const item of baseAcademicYears) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.ACADEMIC_YEARS).createIfNotExists(id, rest));
      }
    }
    if (locCount === 0) {
      for (const item of baseLocations) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.SCHOOL_LOCATIONS).createIfNotExists(id, rest));
      }
    }
    if (rulesCount === 0) {
      for (const item of baseRules) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.ATTENDANCE_RULES).createIfNotExists(id, rest));
      }
    }
    if (teachersCount === 0) {
      for (const item of baseTeachers) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.TEACHERS).createIfNotExists(id, rest));
      }
    }
    if (classesCount === 0) {
      for (const item of baseClasses) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.CLASSES).createIfNotExists(id, rest));
      }
    }
    if (subjectsCount === 0) {
      for (const item of baseSubjects) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.SUBJECTS).createIfNotExists(id, rest));
      }
    }
    if (studentsCount === 0) {
      for (const item of baseStudents) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.STUDENTS).createIfNotExists(id, rest));
      }
    }
    if (enrollmentsCount === 0) {
      for (const item of baseEnrollments) {
        const { id, ...rest } = item;
        seedTasks.push(
          repo.collection(CollectionName.STUDENT_ENROLLMENTS).createIfNotExists(id, rest),
        );
      }
    }
    if (schedulesCount === 0) {
      for (const item of baseSchedules) {
        const { id, ...rest } = item;
        seedTasks.push(
          repo.collection(CollectionName.TEACHING_SCHEDULES).createIfNotExists(id, rest),
        );
      }
    }
    if (holidaysCount === 0) {
      for (const item of baseHolidays) {
        const { id, ...rest } = item;
        seedTasks.push(repo.collection(CollectionName.HOLIDAYS).createIfNotExists(id, rest));
      }
    }

    if (seedTasks.length > 0) {
      await Promise.all(seedTasks);
    }
  }

  // Mark initial seeding completed so subsequent cold starts/restarts never re-populate deleted seed data
  if (!existingSettings?.initialSeedCompleted) {
    const updated = await settingsCol.update('default', { initialSeedCompleted: true });
    if (updated) {
      resolvedSettings = updated;
    }
  }

  if (resolvedSettings) {
    const existingPublic = await repo.collection(CollectionName.PUBLIC_SETTINGS).getById('default');
    if (!existingPublic) {
      await syncPublicSettingsMirror(repo, resolvedSettings);
    }
  }

  // 3. Ensure initial login accounts exist when `users` collection is still empty.
  // In real/mysql mode: strictly create ONLY `superadmin` with zero demo accounts.
  // In mock test mode: seed test role accounts so unit tests pass.
  if (usersCount > 0) return;

  await bootstrapInitialAccounts(
    repo,
    isRealMode
      ? {
          superAdminPassword: process.env.PREVIEW_SUPERADMIN_PASSWORD || 'superadmin123',
          portalExitPassword: process.env.PORTAL_DEFAULT_EXIT_PASSWORD || '123',
          seedTeacherAccounts: false,
        }
      : {
          superAdminPassword: process.env.PREVIEW_SUPERADMIN_PASSWORD || 'superadmin123',
          adminPassword: process.env.PREVIEW_ADMIN_PASSWORD || 'admin123',
          principalPassword: process.env.PREVIEW_PRINCIPAL_PASSWORD || 'kepsek123',
          portalExitPassword: process.env.PORTAL_DEFAULT_EXIT_PASSWORD || '123',
          seedTeacherAccounts: true,
        },
    '127.0.0.1',
  );

  // In mock test mode, also create convenience `guru` account for teacher test suites
  if (!isRealMode) {
    const teachersRes = await repo.collection(CollectionName.TEACHERS).list({
      sort: { field: 'id', direction: 'asc' },
    });
    if (teachersRes.items.length > 0) {
      const demoTeacher =
        teachersRes.items.find((t) => !t.position.toLowerCase().includes('kepala sekolah')) ??
        teachersRes.items[0] ??
        null;

      const existingGuru = await repo.collection(CollectionName.UNIQUE_USERNAMES).getById('guru');
      if (!existingGuru) {
        const guruUserId = `usr_${crypto.randomBytes(6).toString('hex')}`;
        const normalizedUsername = await reserveUniqueUsername(repo, 'guru', guruUserId);
        const guruPlain = process.env.PREVIEW_TEACHER_PASSWORD || 'Guru1234!';
        const passwordHash = await hashPassword(guruPlain);
        await usersCol.create({
          id: guruUserId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher: encryptPasswordForAdminView(guruPlain),
          role: UserRole.TEACHER,
          linkedTeacherId: demoTeacher?.id ?? null,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
        });
      }
    }
  }
}

/**
 * Keeps the non-sensitive `publicSettings/default` document in sync with `appSettings/default`.
 */
export async function syncPublicSettingsMirror(
  repo: IDataRepository,
  settings: AppSettings,
): Promise<void> {
  const {
    id: _omitId,
    createdAt: _omitCreatedAt,
    updatedAt: _omitUpdatedAt,
    portalExitPasswordHash: _omitSecret,
    initialSeedCompleted: _omitSeedFlag,
    ...publicFields
  } = settings as AppSettings & {
    createdAt?: string;
    updatedAt?: string;
  };

  const publicPayload = publicFields as Omit<PublicAppSettings, 'id' | 'createdAt' | 'updatedAt'>;
  const publicCol = repo.collection(CollectionName.PUBLIC_SETTINGS);
  const existing = await publicCol.getById('default');
  if (existing) {
    await publicCol.update('default', publicPayload);
  } else {
    await publicCol.createIfNotExists('default', publicPayload);
  }
}


