import { z } from 'zod';
import { getDateKeyJakarta } from '../../src/lib/date';
import { resolveTeacherWorkingDays } from '../../src/lib/teacherWorkingDays';
import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceStatus,
  CollectionName,
  HolidayScope,
  PermissionLeaveType,
  PermissionStatus,
  QrOwnerType,
  StudentStatus,
  TeacherStatus,
  UserRole,
  type AttendanceRecord,
  type Holiday,
  type TeacherPermission,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export type MatrixCellCode = 'H' | 'T' | 'S' | 'I' | 'A' | 'L' | 'HLT' | '-';

export interface MatrixDateColumn {
  date: string;
  dayLabel: string;
  dayNum: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
}

export interface MatrixPersonRow {
  id: string;
  personType: QrOwnerType;
  identifier: string;
  fullName: string;
  groupLabel: string;
  cells: Record<string, MatrixCellCode>;
  summary: {
    present: number;
    late: number;
    sick: number;
    excused: number;
    absent: number;
    hlt: number;
    workingDays: number;
    ratePercent: number;
  };
}

export interface AttendanceMatrixResponse {
  schoolName: string;
  generatedAt: string;
  period: 'weekly' | 'monthly' | 'custom';
  dateFrom: string;
  dateTo: string;
  dimension: 'STUDENT' | 'TEACHER';
  classId: string | null;
  dates: MatrixDateColumn[];
  rows: MatrixPersonRow[];
}

const matrixQuerySchema = z.object({
  period: z.enum(['weekly', 'monthly', 'custom']).default('weekly'),
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dimension: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
  classId: z.string().trim().optional(),
  search: z.string().trim().max(120).optional().default(''),
});

const DAY_LABELS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function resolveMatrixDateRange(
  period: 'weekly' | 'monthly' | 'custom',
  referenceDate: string | undefined,
  dateFromInput: string | undefined,
  dateToInput: string | undefined,
  todayKey: string,
): { dateFrom: string; dateTo: string } {
  const ref = referenceDate || todayKey;
  if (period === 'custom') {
    const start = dateFromInput || ref;
    const end = dateToInput || start;
    return { dateFrom: start, dateTo: end };
  }
  const refDt = new Date(`${ref}T12:00:00+07:00`);
  if (period === 'weekly') {
    // Monday to Saturday (school week) or Monday to Sunday covering referenceDate
    const dow = refDt.getUTCDay(); // 0=Sun..6=Sat
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(refDt.getTime());
    mon.setUTCDate(mon.getUTCDate() + diffToMon);
    const sun = new Date(mon.getTime());
    sun.setUTCDate(sun.getUTCDate() + 6);
    return { dateFrom: getDateKeyJakarta(mon), dateTo: getDateKeyJakarta(sun) };
  }
  // monthly
  const [yStr, mStr] = ref.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const firstDay = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const lastDt = new Date(Date.UTC(year, month, 0, 5, 0, 0));
  const lastDay = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    lastDt.getUTCDate(),
  ).padStart(2, '0')}`;
  return { dateFrom: firstDay, dateTo: lastDay };
}

function enumerateDates(dateFrom: string, dateTo: string): string[] {
  const start = new Date(`${dateFrom}T12:00:00+07:00`);
  const end = new Date(`${dateTo}T12:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const list: string[] = [];
  const cur = new Date(start.getTime());
  // Cap matrix range to 62 days so tables remain responsive
  while (cur <= end && list.length < 62) {
    list.push(getDateKeyJakarta(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return list;
}

function getIsoDayOfWeek(dateKey: string): number {
  const dt = new Date(`${dateKey}T12:00:00+07:00`);
  return dt.getUTCDay(); // 0 = Sun, 6 = Sat
}

function holidayApplies(holiday: Holiday, dimension: 'STUDENT' | 'TEACHER'): boolean {
  if (!holiday.isActive) return false;
  if (holiday.scope === HolidayScope.SCHOOL) return true;
  if (dimension === 'STUDENT' && holiday.scope === HolidayScope.STUDENT) return true;
  if (dimension === 'TEACHER' && holiday.scope === HolidayScope.TEACHER) return true;
  return false;
}

function findApprovedPermissionOnDate(
  permissions: TeacherPermission[],
  teacherId: string,
  dateKey: string,
): TeacherPermission | null {
  for (const p of permissions) {
    if (p.teacherId !== teacherId || p.status !== PermissionStatus.APPROVED) continue;
    const pStart = getDateKeyJakarta(new Date(p.startAt));
    const pEnd = getDateKeyJakarta(new Date(p.endAt));
    if (dateKey >= pStart && dateKey <= pEnd) return p;
  }
  return null;
}

function pickDayCodeFromRecords(records: AttendanceRecord[]): MatrixCellCode | null {
  if (records.length === 0) return null;
  // Prioritize CHECK_IN record, otherwise take any record on that date
  const checkIn = records.find((r) => r.eventType === AttendanceEventType.CHECK_IN);
  const chosen = checkIn ?? records[0];

  switch (chosen.status) {
    case AttendanceStatus.PRESENT:
      return 'H';
    case AttendanceStatus.LATE:
      return 'T';
    case AttendanceStatus.SICK:
      return 'S';
    case AttendanceStatus.EXCUSED:
      return 'I';
    case AttendanceStatus.ABSENT:
      return 'A';
    default:
      return null;
  }
}

/**
 * GET /api/reports/matrix
 * Returns a date-by-person attendance matrix for Weekly, Monthly, or Custom date ranges.
 */
export async function handleAttendanceMatrix(
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
    const parsed = matrixQuerySchema.parse({
      period: getQueryString(req, 'period') || 'weekly',
      referenceDate: getQueryString(req, 'referenceDate') || undefined,
      dateFrom: getQueryString(req, 'dateFrom') || undefined,
      dateTo: getQueryString(req, 'dateTo') || undefined,
      dimension: getQueryString(req, 'dimension') || 'STUDENT',
      classId: getQueryString(req, 'classId') || undefined,
      search: getQueryString(req, 'search') || '',
    });

    const isTeacherOnly = auth.user.role === UserRole.TEACHER;
    if (isTeacherOnly && !auth.user.linkedTeacherId) {
      throw ApiError.forbidden('Akun guru belum tertaut ke profil pendidik.');
    }

    const effectiveDimension: 'STUDENT' | 'TEACHER' = isTeacherOnly ? 'TEACHER' : parsed.dimension;
    const effectiveClassId = effectiveDimension === 'TEACHER' ? null : parsed.classId || null;

    const now = options.now ?? new Date();
    const todayKey = getDateKeyJakarta(now);
    const { dateFrom, dateTo } = resolveMatrixDateRange(
      parsed.period,
      parsed.referenceDate,
      parsed.dateFrom,
      parsed.dateTo,
      todayKey,
    );

    const dateKeys = enumerateDates(dateFrom, dateTo);
    if (dateKeys.length === 0) {
      throw ApiError.badRequest('Rentang tanggal tidak valid. Pastikan tanggal awal <= tanggal akhir.');
    }

    const [
      settings,
      holidaysRes,
      recordsRes,
      permissionsRes,
      classesRes,
      rulesRes,
      studentsRes,
      teachersRes,
    ] = await Promise.all([
      repo.collection(CollectionName.APP_SETTINGS).getById('default'),
      repo.collection(CollectionName.HOLIDAYS).list(),
      repo.collection(CollectionName.ATTENDANCE_RECORDS).list(),
      repo.collection(CollectionName.TEACHER_PERMISSIONS).list(),
      repo.collection(CollectionName.CLASSES).list(),
      repo.collection(CollectionName.ATTENDANCE_RULES).list(),
      effectiveDimension === 'STUDENT'
        ? repo.collection(CollectionName.STUDENTS).list({ sort: { field: 'fullName', direction: 'asc' } })
        : Promise.resolve({ items: [] }),
      effectiveDimension === 'TEACHER'
        ? repo.collection(CollectionName.TEACHERS).list({ sort: { field: 'fullName', direction: 'asc' } })
        : Promise.resolve({ items: [] }),
    ]);

    const activeTeacherRule =
      rulesRes.items
        .filter((r) => r.isActive && r.audience === AttendanceAudience.TEACHER && r.classIds.length === 0)
        .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ??
      rulesRes.items
        .filter((r) => r.isActive && r.audience === AttendanceAudience.TEACHER)
        .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ??
      null;

    const approvedPermissionAffectsRecap = settings?.approvedPermissionAffectsRecap ?? true;
    const holidayByDate = new Map<string, string>();
    for (const h of holidaysRes.items) {
      if (holidayApplies(h, effectiveDimension)) {
        holidayByDate.set(h.date, h.name);
      }
    }

    const dates: MatrixDateColumn[] = dateKeys.map((date) => {
      const dow = getIsoDayOfWeek(date);
      const isWeekend = dow === 0; // Minggu libur sekolah (MI masuk Senin–Sabtu)
      const holidayName = holidayByDate.get(date) ?? null;
      return {
        date,
        dayLabel: DAY_LABELS_ID[dow] ?? '',
        dayNum: date.slice(8, 10),
        isWeekend,
        isHoliday: Boolean(holidayName),
        holidayName,
      };
    });

    // Index records by `${personId}|${attendanceDate}` within range
    const recordsByPersonDate = new Map<string, AttendanceRecord[]>();
    const targetPersonType =
      effectiveDimension === 'STUDENT' ? QrOwnerType.STUDENT : QrOwnerType.TEACHER;

    for (const r of recordsRes.items) {
      if (r.personType !== targetPersonType) continue;
      if (r.attendanceDate < dateFrom || r.attendanceDate > dateTo) continue;
      const key = `${r.personId}|${r.attendanceDate}`;
      const arr = recordsByPersonDate.get(key) ?? [];
      arr.push(r);
      recordsByPersonDate.set(key, arr);
    }

    const classNameById = new Map(classesRes.items.map((c) => [c.id, c.name]));
    const searchLower = parsed.search.toLowerCase();

    const people: Array<{
      id: string;
      personType: QrOwnerType;
      identifier: string;
      fullName: string;
      groupLabel: string;
      workingDays?: number[] | null;
    }> = [];

    if (effectiveDimension === 'STUDENT') {
      const sortedStudents = studentsRes.items
        .filter((s) => s.status === StudentStatus.ACTIVE || s.status === StudentStatus.DEMO_ACTIVE)
        .filter((s) => !effectiveClassId || s.classId === effectiveClassId)
        .filter((s) => {
          if (!searchLower) return true;
          return (
            s.fullName.toLowerCase().includes(searchLower) ||
            s.nis.toLowerCase().includes(searchLower)
          );
        })
        .sort((a, b) => {
          const ca = classNameById.get(a.classId) ?? '';
          const cb = classNameById.get(b.classId) ?? '';
          const cmpClass = ca.localeCompare(cb, 'id');
          if (cmpClass !== 0) return cmpClass;
          return a.fullName.localeCompare(b.fullName, 'id');
        });

      for (const s of sortedStudents) {
        people.push({
          id: s.id,
          personType: QrOwnerType.STUDENT,
          identifier: s.nis,
          fullName: s.fullName,
          groupLabel: `Kelas ${classNameById.get(s.classId) ?? '-'}`,
        });
      }
    } else {
      const sortedTeachers = teachersRes.items
        .filter((t) => t.status === TeacherStatus.ACTIVE)
        .filter((t) => !isTeacherOnly || t.id === auth.user.linkedTeacherId)
        .filter((t) => {
          if (!searchLower) return true;
          return (
            t.fullName.toLowerCase().includes(searchLower) ||
            t.niyNip.toLowerCase().includes(searchLower) ||
            t.position.toLowerCase().includes(searchLower)
          );
        })
        .sort((a, b) => {
          const ap = a.position.toLowerCase().includes('kepala sekolah') ? 0 : 1;
          const bp = b.position.toLowerCase().includes('kepala sekolah') ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return a.fullName.localeCompare(b.fullName, 'id');
        });

      for (const t of sortedTeachers) {
        people.push({
          id: t.id,
          personType: QrOwnerType.TEACHER,
          identifier: t.niyNip,
          fullName: t.fullName,
          groupLabel: t.position,
          workingDays: t.workingDays ?? null,
        });
      }
    }

    const rows: MatrixPersonRow[] = people.map((person) => {
      const cells: Record<string, MatrixCellCode> = {};
      let present = 0;
      let late = 0;
      let sick = 0;
      let excused = 0;
      let absent = 0;
      let hlt = 0;
      let workingDays = 0;

      const teacherWorkingSet =
        person.personType === QrOwnerType.TEACHER
          ? new Set(resolveTeacherWorkingDays({ workingDays: person.workingDays }, activeTeacherRule))
          : null;

      for (const col of dates) {
        if (col.isWeekend || col.isHoliday) {
          cells[col.date] = 'L';
          continue;
        }

        // Future dates beyond today stay '-' (not yet happened)
        if (col.date > todayKey) {
          cells[col.date] = '-';
          continue;
        }

        const recs = recordsByPersonDate.get(`${person.id}|${col.date}`) ?? [];
        let code = pickDayCodeFromRecords(recs);

        if (teacherWorkingSet) {
          const jsDow = getIsoDayOfWeek(col.date);
          const isoDow = jsDow === 0 ? 7 : jsDow;
          if (!teacherWorkingSet.has(isoDow)) {
            if (!code) {
              cells[col.date] = 'HLT';
              hlt += 1;
              continue;
            }
          }
        }

        workingDays += 1;

        if (!code && person.personType === QrOwnerType.TEACHER && approvedPermissionAffectsRecap) {
          const perm = findApprovedPermissionOnDate(permissionsRes.items, person.id, col.date);
          if (perm) {
            code = perm.leaveType === PermissionLeaveType.SICK ? 'S' : 'I';
          }
        }

        if (!code) {
          code = 'A';
        }

        cells[col.date] = code;
        if (code === 'H') present += 1;
        else if (code === 'T') late += 1;
        else if (code === 'S') sick += 1;
        else if (code === 'I') excused += 1;
        else if (code === 'A') absent += 1;
      }

      const attended = present + late;
      const ratePercent = workingDays > 0 ? Math.round((attended / workingDays) * 100) : 0;

      return {
        id: person.id,
        personType: person.personType,
        identifier: person.identifier,
        fullName: person.fullName,
        groupLabel: person.groupLabel,
        cells,
        summary: {
          present,
          late,
          sick,
          excused,
          absent,
          hlt,
          workingDays,
          ratePercent,
        },
      };
    });

    const payload: AttendanceMatrixResponse = {
      schoolName: settings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh',
      generatedAt: now.toISOString(),
      period: parsed.period,
      dateFrom,
      dateTo,
      dimension: effectiveDimension,
      classId: effectiveClassId,
      dates,
      rows,
    };

    sendOk(res, payload);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleAttendanceMatrix(req, res);
}
