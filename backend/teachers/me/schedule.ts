import { getDateKeyJakarta, getDayOfWeekJakarta } from '../../../src/lib/date';
import {
  resolveTeacherHltDays,
  resolveTeacherWorkingDays,
} from '../../../src/lib/teacherWorkingDays';
import { AttendanceAudience, CollectionName, UserRole } from '../../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../../_lib/auth/middleware';
import { resolveTeacherProfileForUser } from '../../_lib/auth/resolvePrincipalTeacher';
import { getRepository } from '../../_lib/repository';
import type { IDataRepository } from '../../_lib/repository/types';

/**
 * GET /api/teachers/me/schedule
 * Strictly returns teaching schedules and working-day / HLT obligations belonging ONLY
 * to the authenticated teacher's (or principal's) linked teacher profile (IDOR safe).
 */
export async function handleMyTeacherSchedule(
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
    const nowMs = now.getTime();
    const todayDate = getDateKeyJakarta(now);
    const todayDayOfWeek = getDayOfWeekJakarta(now);

    const [teacherProfile, rulesRes] = await Promise.all([
      resolveTeacherProfileForUser(repo, auth.user),
      repo.collection(CollectionName.ATTENDANCE_RULES).list({
        filters: [
          { field: 'audience', op: '==', value: AttendanceAudience.TEACHER },
          { field: 'isActive', op: '==', value: true },
        ],
      }),
    ]);

    const teacherRule =
      rulesRes.items.sort((a, b) => {
        const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
          a.updatedAt ?? a.createdAt ?? '',
        );
        if (timeCmp !== 0) return timeCmp;
        return (b.version ?? 1) - (a.version ?? 1);
      })[0] ?? null;

    const teacherWorkingDays = resolveTeacherWorkingDays(teacherProfile, teacherRule);
    const teacherHltDays = resolveTeacherHltDays(teacherWorkingDays, teacherRule);
    const isTodayHlt = teacherHltDays.includes(todayDayOfWeek);

    if (!teacherProfile) {
      sendOk(res, {
        todayDate,
        todayDayOfWeek,
        teacherWorkingDays,
        teacherHltDays,
        isTodayHlt,
        teacherRule,
        todaySchedules: [],
        upcomingSchedules: [],
        weeklySchedules: [],
      });
      return;
    }

    const [schedulesRes, subjectsRes, classesRes] = await Promise.all([
      repo.collection(CollectionName.TEACHING_SCHEDULES).list({
        filters: [
          { field: 'teacherId', op: '==', value: teacherProfile.id },
          { field: 'isActive', op: '==', value: true },
        ],
      }),
      repo.collection(CollectionName.SUBJECTS).list(),
      repo.collection(CollectionName.CLASSES).list(),
    ]);

    const subjectMap = new Map(subjectsRes.items.map((s) => [s.id, { name: s.name, code: s.code }]));
    const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));

    const activeEffective = schedulesRes.items
      .filter((s) => {
        const fromMs = new Date(s.effectiveFrom).getTime();
        const untilMs = s.effectiveUntil ? new Date(s.effectiveUntil).getTime() : Number.POSITIVE_INFINITY;
        return fromMs <= nowMs && nowMs <= untilMs;
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
      .map((s) => ({
        ...s,
        subjectName: subjectMap.get(s.subjectId)?.name ?? '-',
        subjectCode: subjectMap.get(s.subjectId)?.code ?? '-',
        className: classMap.get(s.classId) ?? '-',
      }));

    const todaySchedules = activeEffective.filter((s) => s.dayOfWeek === todayDayOfWeek);

    // Upcoming schedules ordered cyclically starting from tomorrow (day+1 .. wrap around)
    const upcomingSchedules = activeEffective
      .filter((s) => s.dayOfWeek !== todayDayOfWeek)
      .sort((a, b) => {
        const offsetA = (a.dayOfWeek - todayDayOfWeek + 7) % 7;
        const offsetB = (b.dayOfWeek - todayDayOfWeek + 7) % 7;
        return offsetA - offsetB || a.startTime.localeCompare(b.startTime);
      });

    sendOk(res, {
      todayDate,
      todayDayOfWeek,
      teacherWorkingDays,
      teacherHltDays,
      isTodayHlt,
      teacherRule,
      todaySchedules,
      upcomingSchedules,
      weeklySchedules: activeEffective,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleMyTeacherSchedule(req, res);
}
