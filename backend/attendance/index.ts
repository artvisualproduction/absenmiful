import { AttendanceStatus, CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryInt, getQueryString, MASTER_READ_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * GET /api/attendance
 * Server-side filtered and cursor-paginated attendance records.
 * Allowed for SUPER_ADMIN, ADMIN, OPERATOR, and PRINCIPAL (read-only).
 * TEACHER is rejected with 403 (teachers use their own personal history endpoint).
 */
export async function handleAttendanceList(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

    const date = getQueryString(req, 'date');
    const dateFrom = getQueryString(req, 'dateFrom');
    const dateTo = getQueryString(req, 'dateTo');
    const personType = getQueryString(req, 'personType');
    const classId = getQueryString(req, 'classId');
    const status = getQueryString(req, 'status');
    const eventType = getQueryString(req, 'eventType');
    const search = getQueryString(req, 'search').toLowerCase();
    const cursor = getQueryString(req, 'cursor');
    const limit = getQueryInt(req, 'limit', 20, 1, 2000);

    const allRes = await repo.collection(CollectionName.ATTENDANCE_RECORDS).list({
      sort: { field: 'serverTimestamp', direction: 'desc' },
    });

    const filtered = allRes.items.filter((rec) => {
      if (date && rec.attendanceDate !== date) return false;
      if (dateFrom && rec.attendanceDate < dateFrom) return false;
      if (dateTo && rec.attendanceDate > dateTo) return false;
      if (personType && rec.personType !== personType) return false;
      if (classId && rec.classIdSnapshot !== classId) return false;
      if (status && rec.status !== status) return false;
      if (eventType && rec.eventType !== eventType) return false;
      if (search) {
        const hay = `${rec.personNameSnapshot} ${rec.nisSnapshot ?? ''} ${rec.niyNipSnapshot ?? ''} ${rec.classNameSnapshot ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
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
      hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;

    sendOk(res, {
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
  await handleAttendanceList(req, res);
}
