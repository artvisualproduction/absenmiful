import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const BACKUP_ALLOWED_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/**
 * POST /api/settings/backup
 * Exports a sanitized JSON snapshot of institutional data for Admin/SuperAdmin backup.
 * STRICTLY excludes all secrets & hashes (`passwordHash`, `portalExitPasswordHash`,
 * `sessionTokenHash`, `tokenHash`, `userSessions`). Writes `SYSTEM_BACKUP_EXPORTED` to audit log.
 */
export async function handleSettingsBackup(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: BACKUP_ALLOWED_ROLES });

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
    const counts = {
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

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'SYSTEM_BACKUP_EXPORTED',
      entityType: 'SYSTEM_BACKUP',
      entityId: exportedAt,
      after: { counts },
      clientIp: auth.clientIp,
    });

    sendOk(res, {
      schemaVersion: '1.0.0',
      exportedAt,
      exportedBy: auth.user.username,
      counts,
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
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleSettingsBackup(req, res);
}
