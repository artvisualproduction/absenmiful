import { reportQuerySchema } from '../../src/lib/reportValidation';
import { UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString } from '../_lib/masterDataRoles';
import { buildAttendanceReport } from '../_lib/reports/attendanceReportService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * GET /api/reports/attendance
 * Server-side aggregated attendance report with cursor pagination.
 * RBAC:
 * - SUPER_ADMIN, ADMIN, OPERATOR, PRINCIPAL: full school scope.
 * - TEACHER: strictly restricted to their own `linkedTeacherId`.
 */
export async function handleAttendanceReport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
  options: { now?: Date } = {},
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const auth = await requireAuth(req, { repo });
    const parsed = reportQuerySchema.parse({
      period: getQueryString(req, 'period') || 'monthly',
      referenceDate: getQueryString(req, 'referenceDate') || undefined,
      dateFrom: getQueryString(req, 'dateFrom') || undefined,
      dateTo: getQueryString(req, 'dateTo') || undefined,
      dimension: getQueryString(req, 'dimension') || 'STUDENT',
      classId: getQueryString(req, 'classId') || undefined,
      status: getQueryString(req, 'status') || '',
      search: getQueryString(req, 'search') || '',
      cursor: getQueryString(req, 'cursor') || undefined,
      limit: getQueryString(req, 'limit') || 25,
    });

    const isTeacherOnly = auth.user.role === UserRole.TEACHER;
    if (isTeacherOnly && !auth.user.linkedTeacherId) {
      throw ApiError.forbidden('Akun guru belum tertaut ke profil pendidik.');
    }

    const report = await buildAttendanceReport(repo, {
      ...parsed,
      dimension: isTeacherOnly ? 'TEACHER' : parsed.dimension,
      classId: isTeacherOnly ? undefined : parsed.classId,
      restrictToTeacherId: isTeacherOnly ? auth.user.linkedTeacherId! : undefined,
      now: options.now,
    });

    sendOk(res, report);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleAttendanceReport(req, res);
}
