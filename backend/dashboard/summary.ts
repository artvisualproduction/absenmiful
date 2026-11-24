import { getDateKeyJakarta } from '../../src/lib/date';
import {
  CollectionName,
  PermissionStatus,
  StudentStatus,
  TeacherStatus,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES } from '../_lib/masterDataRoles';
import { buildAttendanceReport, shiftDateKey } from '../_lib/reports/attendanceReportService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { enrichPermissionsWithActors } from '../permissions/index';

/**
 * GET /api/dashboard/summary
 * Unified operational summary for Admin (PRD 5.2) and Principal (PRD 5.3) dashboards.
 */
export async function handleDashboardSummary(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
  options: { now?: Date } = {},
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

    const now = options.now ?? new Date();
    const selectedDate = getQueryString(req, 'date') || getDateKeyJakarta(now);
    const classId = getQueryString(req, 'classId') || undefined;
    const dimensionParam = getQueryString(req, 'dimension') || 'ALL';
    const dimension =
      dimensionParam === 'STUDENT' || dimensionParam === 'TEACHER' ? dimensionParam : 'ALL';
    const status = getQueryString(req, 'status') || '';

    const [
      settings,
      studentsRes,
      teachersRes,
      classesRes,
      permissionsRes,
      logsRes,
      usersRes,
      dailyReport,
      trendReport,
    ] = await Promise.all([
      repo.collection(CollectionName.APP_SETTINGS).getById('default'),
      repo.collection(CollectionName.STUDENTS).list(),
      repo.collection(CollectionName.TEACHERS).list(),
      repo.collection(CollectionName.CLASSES).list(),
      repo.collection(CollectionName.TEACHER_PERMISSIONS).list({
        sort: { field: 'createdAt', direction: 'desc' },
      }),
      repo.collection(CollectionName.ACTIVITY_LOGS).list({
        sort: { field: 'createdAt', direction: 'desc' },
        limit: 12,
      }),
      repo.collection(CollectionName.USERS).list(),
      buildAttendanceReport(repo, {
        period: 'daily',
        referenceDate: selectedDate,
        dimension,
        classId,
        status,
        unbounded: true,
        now,
      }),
      buildAttendanceReport(repo, {
        period: 'custom',
        dateFrom: shiftDateKey(selectedDate, -6),
        dateTo: selectedDate,
        dimension,
        classId,
        unbounded: true,
        now,
      }),
    ]);

    const activeStudents = studentsRes.items.filter(
      (s) => s.status === StudentStatus.ACTIVE || s.status === StudentStatus.DEMO_ACTIVE,
    );
    const activeTeachers = teachersRes.items.filter((t) => t.status === TeacherStatus.ACTIVE);
    const activeClasses = classesRes.items.filter((c) => c.isActive);

    const allPermissions = permissionsRes.items;
    const pendingAdminPermissions = allPermissions.filter(
      (p) => p.status === PermissionStatus.SUBMITTED,
    );
    const pendingPrincipalPermissions = allPermissions.filter(
      (p) => p.status === PermissionStatus.ADMIN_REVIEWED,
    );
    const decidedPermissions = allPermissions
      .filter(
        (p) => p.status === PermissionStatus.APPROVED || p.status === PermissionStatus.REJECTED,
      )
      .slice(0, 6);

    const [enrichedPendingPrincipal, enrichedRecentDecisions] = await Promise.all([
      enrichPermissionsWithActors(repo, pendingPrincipalPermissions.slice(0, 6)),
      enrichPermissionsWithActors(repo, decidedPermissions),
    ]);

    const teacherNameMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
    const userMap = new Map(
      usersRes.items.map((u) => [
        u.id,
        (u.linkedTeacherId ? teacherNameMap.get(u.linkedTeacherId) : undefined) ?? u.username,
      ]),
    );
    const recentActivities = logsRes.items.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName: userMap.get(log.actorUserId) ?? log.actorRole,
      actorRole: log.actorRole,
      reason: log.reason,
      createdAt: log.createdAt,
    }));

    sendOk(res, {
      schoolName: settings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh',
      selectedDate,
      dimension,
      kpis: {
        activeStudents: activeStudents.length,
        demoStudents: activeStudents.filter((s) => s.isDemo).length,
        activeTeachers: activeTeachers.length,
        activeClasses: activeClasses.length,
        presentToday: dailyReport.summary.present,
        lateToday: dailyReport.summary.late,
        excusedSickToday: dailyReport.summary.sick + dailyReport.summary.excused,
        absentToday: dailyReport.summary.absent,
        missingCheckInToday: dailyReport.summary.missingCheckIn,
        missingCheckOutToday: dailyReport.summary.missingCheckOut,
        attendanceRateToday: dailyReport.summary.attendanceRate,
        pendingAdminPermissions: pendingAdminPermissions.length,
        pendingPrincipalPermissions: pendingPrincipalPermissions.length,
      },
      trend: trendReport.trend,
      classBreakdown: dailyReport.classBreakdown,
      pendingPrincipalList: enrichedPendingPrincipal,
      recentDecisions: enrichedRecentDecisions,
      recentActivities,
      classes: activeClasses.map((c) => ({ id: c.id, name: c.name, gradeLevel: c.gradeLevel })),
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleDashboardSummary(req, res);
}
