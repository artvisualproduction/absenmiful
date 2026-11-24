import { reportExportSchema } from '../../src/lib/reportValidation';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { buildAttendanceReport } from '../_lib/reports/attendanceReportService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * POST /api/reports/export
 * Returns complete authoritative export payload (schoolName, generatedAt, generatedBy,
 * appliedFilters, summary, rows) for XLSX/PDF/PRINT rendering and records an audit log entry.
 * RBAC: TEACHER can strictly export ONLY their own attendance history.
 */
export async function handleReportExport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
  options: { now?: Date } = {},
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo });
    const parsed = reportExportSchema.parse(req.body ?? {});

    const isTeacherOnly = auth.user.role === UserRole.TEACHER;
    if (isTeacherOnly && !auth.user.linkedTeacherId) {
      throw ApiError.forbidden('Akun guru belum tertaut ke profil pendidik.');
    }

    const report = await buildAttendanceReport(repo, {
      ...parsed,
      dimension: isTeacherOnly ? 'TEACHER' : parsed.dimension,
      classId: isTeacherOnly ? undefined : parsed.classId,
      restrictToTeacherId: isTeacherOnly ? auth.user.linkedTeacherId! : undefined,
      unbounded: true,
      now: options.now,
    });

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'REPORT_EXPORTED',
      entityType: 'ATTENDANCE_REPORT',
      entityId: `${report.dimension}_${report.dateFrom}_${report.dateTo}`,
      after: {
        format: parsed.format,
        period: report.period,
        dimension: report.dimension,
        dateFrom: report.dateFrom,
        dateTo: report.dateTo,
        classId: report.appliedFilters.classId,
        rowCount: report.items.length,
      },
      clientIp: auth.clientIp,
    });

    let generatedBy = auth.user.username;
    if (auth.user.linkedTeacherId) {
      const teacher = await repo
        .collection(CollectionName.TEACHERS)
        .getById(auth.user.linkedTeacherId);
      if (teacher?.fullName) {
        generatedBy = teacher.fullName;
      }
    }

    sendOk(res, {
      format: parsed.format,
      generatedBy,
      generatedByRole: auth.user.role,
      ...report,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleReportExport(req, res);
}
