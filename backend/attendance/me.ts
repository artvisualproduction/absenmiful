import { getDateKeyJakarta, getDayOfWeekJakarta } from '../../src/lib/date';
import {
  resolveTeacherHltDays,
  resolveTeacherWorkingDays,
} from '../../src/lib/teacherWorkingDays';
import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceStatus,
  CollectionName,
  QrOwnerType,
  UserRole,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { resolveTeacherProfileForUser } from '../_lib/auth/resolvePrincipalTeacher';
import { getQueryInt, getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * GET /api/attendance/me
 * Strictly returns attendance records belonging ONLY to the authenticated teacher/principal's
 * resolved teacher profile. Prevents IDOR — ignores any external teacherId query parameter.
 */
export async function handleMyAttendance(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
    });

    const now = new Date();
    const todayDate = getDateKeyJakarta(now);
    const todayDayOfWeek = getDayOfWeekJakarta(now);

    const teacherProfile = await resolveTeacherProfileForUser(repo, auth.user);

    const [locationsRes, rulesRes, settings] = await Promise.all([
      repo.collection(CollectionName.SCHOOL_LOCATIONS).list({
        filters: [{ field: 'isActive', op: '==', value: true }],
      }),
      repo.collection(CollectionName.ATTENDANCE_RULES).list({
        filters: [
          { field: 'audience', op: '==', value: AttendanceAudience.TEACHER },
          { field: 'isActive', op: '==', value: true },
        ],
      }),
      repo.collection(CollectionName.APP_SETTINGS).getById('default'),
    ]);

    const teacherRule =
      rulesRes.items.sort((a, b) => {
        const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
          a.updatedAt ?? a.createdAt ?? '',
        );
        if (timeCmp !== 0) return timeCmp;
        return (b.version ?? 1) - (a.version ?? 1);
      })[0] ?? null;

    if (!teacherProfile) {
      sendOk(res, {
        todayDate,
        todayDayOfWeek,
        linkedTeacherId: null,
        teacherName: null,
        teacherPosition: null,
        teacherWorkingDays: resolveTeacherWorkingDays(null, teacherRule),
        teacherHltDays: [],
        isTodayHlt: false,
        todayCheckIn: null,
        todayCheckOut: null,
        activeLocation: locationsRes.items[0] ?? null,
        teacherRule,
        gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
        teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
        bypassAttendanceTimeWindow: settings?.bypassAttendanceTimeWindow ?? false,
        items: [],
        total: 0,
        nextCursor: null,
        summary: { total: 0, present: 0, late: 0, sick: 0, excused: 0, absent: 0 },
      });
      return;
    }

    const dateFrom = getQueryString(req, 'dateFrom');
    const dateTo = getQueryString(req, 'dateTo');
    const status = getQueryString(req, 'status');
    const cursor = getQueryString(req, 'cursor');
    const limit = getQueryInt(req, 'limit', 20, 1, 1000);

    const recordsRes = await repo.collection(CollectionName.ATTENDANCE_RECORDS).list({
      filters: [
        { field: 'personType', op: '==', value: QrOwnerType.TEACHER },
        { field: 'personId', op: '==', value: teacherProfile.id },
      ],
      sort: { field: 'serverTimestamp', direction: 'desc' },
    });

    const allMine = recordsRes.items;
    const todayCheckIn =
      allMine.find(
        (r) => r.attendanceDate === todayDate && r.eventType === AttendanceEventType.CHECK_IN,
      ) ?? null;
    const todayCheckOut =
      allMine.find(
        (r) => r.attendanceDate === todayDate && r.eventType === AttendanceEventType.CHECK_OUT,
      ) ?? null;

    const filtered = allMine.filter((r) => {
      if (dateFrom && r.attendanceDate < dateFrom) return false;
      if (dateTo && r.attendanceDate > dateTo) return false;
      if (status && r.status !== status) return false;
      return true;
    });

    const summary = {
      total: filtered.length,
      present: filtered.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      late: filtered.filter((r) => r.status === AttendanceStatus.LATE).length,
      sick: filtered.filter((r) => r.status === AttendanceStatus.SICK).length,
      excused: filtered.filter((r) => r.status === AttendanceStatus.EXCUSED).length,
      absent: filtered.filter((r) => r.status === AttendanceStatus.ABSENT).length,
    };

    let startIdx = 0;
    if (cursor) {
      const idx = filtered.findIndex((r) => r.id === cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const pageItems = filtered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + pageItems.length < filtered.length;
    const nextCursor =
      hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1]!.id : null;

    const teacherWorkingDays = resolveTeacherWorkingDays(teacherProfile, teacherRule);
    const teacherHltDays = resolveTeacherHltDays(teacherWorkingDays, teacherRule);
    const isTodayHlt = teacherHltDays.includes(todayDayOfWeek);

    sendOk(res, {
      todayDate,
      todayDayOfWeek,
      linkedTeacherId: teacherProfile.id,
      teacherName: teacherProfile.fullName,
      teacherPosition: teacherProfile.position,
      teacherWorkingDays,
      teacherHltDays,
      isTodayHlt,
      todayCheckIn,
      todayCheckOut,
      activeLocation: locationsRes.items[0] ?? null,
      teacherRule,
      gpsEnabledForTeachers: settings?.gpsEnabledForTeachers ?? true,
      teacherSelfServiceEnabled: settings?.teacherSelfServiceEnabled ?? true,
      bypassAttendanceTimeWindow: settings?.bypassAttendanceTimeWindow ?? false,
      items: pageItems,
      total: filtered.length,
      nextCursor,
      summary,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleMyAttendance(req, res);
}
