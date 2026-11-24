import { getDateKeyJakarta, getDayOfWeekJakarta } from '../../../src/lib/date';
import type { ReportDimension, ReportPeriod } from '../../../src/lib/reportValidation';
import { resolveTeacherWorkingDays } from '../../../src/lib/teacherWorkingDays';
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
  type AttendanceRecord,
  type AttendanceRule,
  type Holiday,
  type SchoolClass,
  type Student,
  type Teacher,
  type TeacherPermission,
} from '../../../src/types';
import type { IDataRepository } from '../repository/types';

export interface AttendanceReportPersonRow {
  id: string;
  personType: QrOwnerType;
  personId: string;
  fullName: string;
  identifier: string; // NIS or NIY/NIP
  classId: string | null;
  className: string | null;
  workingDays: number;
  present: number;
  late: number;
  sick: number;
  excused: number;
  absent: number;
  hlt: number;
  missingCheckIn: number;
  missingCheckOut: number;
  attendanceRate: number; // 0..100 integer percentage
}

export interface AttendanceTrendPoint {
  date: string;
  label: string;
  present: number;
  late: number;
  excusedSick: number;
  absent: number;
  totalExpected: number;
}

export interface ClassRecapRow {
  id: string;
  classId: string;
  className: string;
  gradeLevel: number;
  totalStudents: number;
  present: number;
  late: number;
  excusedSick: number;
  absent: number;
  missingCheckIn: number;
  missingCheckOut: number;
  attendanceRate: number;
}

export interface AttendanceReportResult {
  schoolName: string;
  generatedAt: string;
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  dimension: ReportDimension;
  workingDaysCount: number;
  approvedPermissionAffectsRecap: boolean;
  appliedFilters: {
    period: ReportPeriod;
    dateFrom: string;
    dateTo: string;
    dimension: ReportDimension;
    classId: string | null;
    status: string | null;
    search: string | null;
  };
  summary: {
    totalPeople: number;
    totalWorkingPersonDays: number;
    present: number;
    late: number;
    sick: number;
    excused: number;
    absent: number;
    hlt: number;
    missingCheckIn: number;
    missingCheckOut: number;
    attendanceRate: number;
  };
  trend: AttendanceTrendPoint[];
  classBreakdown: ClassRecapRow[];
  items: AttendanceReportPersonRow[];
  total: number;
  nextCursor: string | null;
}

/** Add `deltaDays` to a YYYY-MM-DD date string safely in UTC calendar arithmetic. */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function enumerateDateKeys(dateFrom: string, dateTo: string, maxDays = 370): string[] {
  if (dateTo < dateFrom) return [];
  const result: string[] = [];
  let cursor = dateFrom;
  while (cursor <= dateTo && result.length < maxDays) {
    result.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return result;
}

export function resolveReportDateRange(params: {
  period: ReportPeriod;
  referenceDate?: string;
  dateFrom?: string;
  dateTo?: string;
  now?: Date;
}): { dateFrom: string; dateTo: string } {
  const todayKey = getDateKeyJakarta(params.now ?? new Date());
  const ref = params.referenceDate ?? todayKey;

  if (params.period === 'custom' && params.dateFrom && params.dateTo) {
    return params.dateFrom <= params.dateTo
      ? { dateFrom: params.dateFrom, dateTo: params.dateTo }
      : { dateFrom: params.dateTo, dateTo: params.dateFrom };
  }

  if (params.period === 'daily') {
    return { dateFrom: ref, dateTo: ref };
  }

  if (params.period === 'weekly') {
    const dow = getDayOfWeekJakarta(new Date(`${ref}T12:00:00+07:00`)); // 1=Mon..7=Sun
    const monday = shiftDateKey(ref, -(dow - 1));
    const sunday = shiftDateKey(monday, 6);
    return { dateFrom: monday, dateTo: sunday > todayKey ? todayKey : sunday };
  }

  if (params.period === 'yearly') {
    const year = ref.slice(0, 4);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return { dateFrom: start, dateTo: end > todayKey ? todayKey : end };
  }

  // Default: monthly
  const [yStr, mStr] = ref.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const start = `${yStr}-${mStr}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  return { dateFrom: start, dateTo: end > todayKey ? todayKey : end };
}

function getActiveDaysOfWeek(
  rules: AttendanceRule[],
  audience: AttendanceAudience,
): Set<number> {
  const active = rules
    .filter((r) => r.isActive && r.audience === audience && r.classIds.length === 0)
    .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
  if (active && active.daysOfWeek.length > 0) {
    return new Set(active.daysOfWeek);
  }
  return new Set([1, 2, 3, 4, 5, 6]); // Mon-Sat default for MI
}

function isHolidayForAudience(
  dateKey: string,
  audience: AttendanceAudience,
  holidays: Holiday[],
): boolean {
  return holidays.some((h) => {
    if (!h.isActive || h.date !== dateKey) return false;
    if (h.scope === HolidayScope.SCHOOL) return true;
    if (audience === AttendanceAudience.STUDENT && h.scope === HolidayScope.STUDENT) return true;
    if (audience === AttendanceAudience.TEACHER && h.scope === HolidayScope.TEACHER) return true;
    return false;
  });
}

function getWorkingDatesForAudience(
  allDates: string[],
  audience: AttendanceAudience,
  rules: AttendanceRule[],
  holidays: Holiday[],
): string[] {
  const activeDays = getActiveDaysOfWeek(rules, audience);
  return allDates.filter((dateKey) => {
    const dow = getDayOfWeekJakarta(new Date(`${dateKey}T12:00:00+07:00`));
    if (!activeDays.has(dow)) return false;
    if (isHolidayForAudience(dateKey, audience, holidays)) return false;
    return true;
  });
}

function findApprovedPermissionStatusForDate(
  teacherId: string,
  dateKey: string,
  approvedPermissions: TeacherPermission[],
): AttendanceStatus.SICK | AttendanceStatus.EXCUSED | null {
  for (const perm of approvedPermissions) {
    if (perm.teacherId !== teacherId) continue;
    const startKey = getDateKeyJakarta(perm.startAt);
    const endKey = getDateKeyJakarta(perm.endAt);
    if (dateKey >= startKey && dateKey <= endKey) {
      return perm.leaveType === PermissionLeaveType.SICK
        ? AttendanceStatus.SICK
        : AttendanceStatus.EXCUSED;
    }
  }
  return null;
}

export interface BuildReportOptions {
  period: ReportPeriod;
  referenceDate?: string;
  dateFrom?: string;
  dateTo?: string;
  dimension: ReportDimension;
  classId?: string;
  status?: string;
  search?: string;
  cursor?: string;
  limit?: number;
  /** When set (e.g. for TEACHER role), strictly restricts dataset to this single teacherId */
  restrictToTeacherId?: string;
  /** Disable pagination (used for XLSX/PDF/PRINT exports) */
  unbounded?: boolean;
  /** Deterministic override for unit tests */
  now?: Date;
}

export async function buildAttendanceReport(
  repo: IDataRepository,
  options: BuildReportOptions,
): Promise<AttendanceReportResult> {
  const now = options.now ?? new Date();
  const { dateFrom, dateTo } = resolveReportDateRange({
    period: options.period,
    referenceDate: options.referenceDate,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    now,
  });

  const [
    settings,
    studentsRes,
    teachersRes,
    classesRes,
    rulesRes,
    holidaysRes,
    recordsRes,
    permissionsRes,
  ] = await Promise.all([
    repo.collection(CollectionName.APP_SETTINGS).getById('default'),
    repo.collection(CollectionName.STUDENTS).list(),
    repo.collection(CollectionName.TEACHERS).list(),
    repo.collection(CollectionName.CLASSES).list(),
    repo.collection(CollectionName.ATTENDANCE_RULES).list(),
    repo.collection(CollectionName.HOLIDAYS).list(),
    repo.collection(CollectionName.ATTENDANCE_RECORDS).list(),
    repo.collection(CollectionName.TEACHER_PERMISSIONS).list({
      filters: [{ field: 'status', op: '==', value: PermissionStatus.APPROVED }],
    }),
  ]);

  const schoolName = settings?.schoolName ?? 'MI Miftahul Ulum Sumberwuluh';
  const approvedPermissionAffectsRecap = settings?.approvedPermissionAffectsRecap !== false;

  const classMap = new Map<string, SchoolClass>(classesRes.items.map((c) => [c.id, c]));

  const allDates = enumerateDateKeys(dateFrom, dateTo);
  const studentWorkingDates = getWorkingDatesForAudience(
    allDates,
    AttendanceAudience.STUDENT,
    rulesRes.items,
    holidaysRes.items,
  );
  const teacherWorkingDates = getWorkingDatesForAudience(
    allDates,
    AttendanceAudience.TEACHER,
    rulesRes.items,
    holidaysRes.items,
  );
  const activeTeacherRule =
    rulesRes.items
      .filter((r) => r.isActive && r.audience === AttendanceAudience.TEACHER && r.classIds.length === 0)
      .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ??
    rulesRes.items
      .filter((r) => r.isActive && r.audience === AttendanceAudience.TEACHER)
      .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] ??
    null;

  // Filter attendance records strictly to the date range
  const recordsInRange = recordsRes.items.filter(
    (r) => r.attendanceDate >= dateFrom && r.attendanceDate <= dateTo,
  );

  // Index records by `${personType}:${personId}:${attendanceDate}:${eventType}`
  const recordIndex = new Map<string, AttendanceRecord>();
  for (const r of recordsInRange) {
    recordIndex.set(`${r.personType}:${r.personId}:${r.attendanceDate}:${r.eventType}`, r);
  }

  const effectiveDimension: ReportDimension = options.restrictToTeacherId
    ? 'TEACHER'
    : options.dimension;

  const activeStudents: Student[] =
    effectiveDimension === 'TEACHER'
      ? []
      : studentsRes.items.filter((s) => {
          if (s.status !== StudentStatus.ACTIVE && s.status !== StudentStatus.DEMO_ACTIVE) {
            return false;
          }
          if (options.classId && s.classId !== options.classId) return false;
          return true;
        });

  const activeTeachers: Teacher[] =
    effectiveDimension === 'STUDENT'
      ? []
      : teachersRes.items.filter((t) => {
          if (t.status !== TeacherStatus.ACTIVE) return false;
          if (options.restrictToTeacherId && t.id !== options.restrictToTeacherId) return false;
          return true;
        });

  // Daily trend buckets
  const trendMap = new Map<string, AttendanceTrendPoint>();
  for (const d of allDates) {
    trendMap.set(d, {
      date: d,
      label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
      present: 0,
      late: 0,
      excusedSick: 0,
      absent: 0,
      totalExpected: 0,
    });
  }

  // Per-class recap buckets
  const classBuckets = new Map<string, ClassRecapRow>();
  for (const cls of classesRes.items.filter((c) => c.isActive)) {
    classBuckets.set(cls.id, {
      id: cls.id,
      classId: cls.id,
      className: cls.name,
      gradeLevel: Number(cls.gradeLevel) || 0,
      totalStudents: 0,
      present: 0,
      late: 0,
      excusedSick: 0,
      absent: 0,
      missingCheckIn: 0,
      missingCheckOut: 0,
      attendanceRate: 0,
    });
  }

  const personRows: AttendanceReportPersonRow[] = [];

  // Aggregate Students
  for (const student of activeStudents) {
    const cls = classMap.get(student.classId);
    const bucket = classBuckets.get(student.classId);
    if (bucket) bucket.totalStudents += 1;

    let present = 0;
    let late = 0;
    let sick = 0;
    let excused = 0;
    let absent = 0;
    let missingCheckIn = 0;
    let missingCheckOut = 0;

    for (const dateKey of studentWorkingDates) {
      const checkIn = recordIndex.get(
        `${QrOwnerType.STUDENT}:${student.id}:${dateKey}:${AttendanceEventType.CHECK_IN}`,
      );
      const checkOut = recordIndex.get(
        `${QrOwnerType.STUDENT}:${student.id}:${dateKey}:${AttendanceEventType.CHECK_OUT}`,
      );
      const tPoint = trendMap.get(dateKey);
      if (tPoint) tPoint.totalExpected += 1;

      if (checkIn) {
        if (checkIn.status === AttendanceStatus.PRESENT) {
          present += 1;
          if (tPoint) tPoint.present += 1;
          if (bucket) bucket.present += 1;
        } else if (checkIn.status === AttendanceStatus.LATE) {
          late += 1;
          if (tPoint) tPoint.late += 1;
          if (bucket) bucket.late += 1;
        } else if (checkIn.status === AttendanceStatus.SICK) {
          sick += 1;
          if (tPoint) tPoint.excusedSick += 1;
          if (bucket) bucket.excusedSick += 1;
        } else if (checkIn.status === AttendanceStatus.EXCUSED) {
          excused += 1;
          if (tPoint) tPoint.excusedSick += 1;
          if (bucket) bucket.excusedSick += 1;
        } else {
          absent += 1;
          if (tPoint) tPoint.absent += 1;
          if (bucket) bucket.absent += 1;
        }

        if (
          (checkIn.status === AttendanceStatus.PRESENT ||
            checkIn.status === AttendanceStatus.LATE) &&
          !checkOut
        ) {
          missingCheckOut += 1;
          if (bucket) bucket.missingCheckOut += 1;
        }
      } else {
        missingCheckIn += 1;
        absent += 1;
        if (tPoint) tPoint.absent += 1;
        if (bucket) {
          bucket.missingCheckIn += 1;
          bucket.absent += 1;
        }
      }
    }

    const wd = studentWorkingDates.length;
    const attended = present + late;
    const rate = wd > 0 ? Math.round((attended / wd) * 100) : 0;

    personRows.push({
      id: `STUDENT_${student.id}`,
      personType: QrOwnerType.STUDENT,
      personId: student.id,
      fullName: student.fullName,
      identifier: student.nis,
      classId: student.classId,
      className: cls?.name ?? null,
      workingDays: wd,
      present,
      late,
      sick,
      excused,
      absent,
      hlt: 0,
      missingCheckIn,
      missingCheckOut,
      attendanceRate: rate,
    });
  }

  // Aggregate Teachers (integrating approved teacherPermissions & per-teacher workingDays / HLT)
  for (const teacher of activeTeachers) {
    const teacherWorkingSet = new Set(resolveTeacherWorkingDays(teacher, activeTeacherRule));
    let teacherExpectedDays = 0;
    let present = 0;
    let late = 0;
    let sick = 0;
    let excused = 0;
    let absent = 0;
    let hlt = 0;
    let missingCheckIn = 0;
    let missingCheckOut = 0;

    for (const dateKey of teacherWorkingDates) {
      const dow = getDayOfWeekJakarta(new Date(`${dateKey}T12:00:00+07:00`));
      const isRequiredDay = teacherWorkingSet.has(dow);
      const checkIn = recordIndex.get(
        `${QrOwnerType.TEACHER}:${teacher.id}:${dateKey}:${AttendanceEventType.CHECK_IN}`,
      );
      const checkOut = recordIndex.get(
        `${QrOwnerType.TEACHER}:${teacher.id}:${dateKey}:${AttendanceEventType.CHECK_OUT}`,
      );
      const tPoint = trendMap.get(dateKey);

      if (!isRequiredDay) {
        if (!checkIn) {
          hlt += 1;
          continue;
        }
        teacherExpectedDays += 1;
        if (tPoint) tPoint.totalExpected += 1;
      } else {
        teacherExpectedDays += 1;
        if (tPoint) tPoint.totalExpected += 1;
      }

      if (checkIn) {
        if (checkIn.status === AttendanceStatus.PRESENT) {
          present += 1;
          if (tPoint) tPoint.present += 1;
        } else if (checkIn.status === AttendanceStatus.LATE) {
          late += 1;
          if (tPoint) tPoint.late += 1;
        } else if (checkIn.status === AttendanceStatus.SICK) {
          sick += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else if (checkIn.status === AttendanceStatus.EXCUSED) {
          excused += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else {
          absent += 1;
          if (tPoint) tPoint.absent += 1;
        }

        if (
          (checkIn.status === AttendanceStatus.PRESENT ||
            checkIn.status === AttendanceStatus.LATE) &&
          !checkOut
        ) {
          missingCheckOut += 1;
        }
      } else {
        const permStatus = approvedPermissionAffectsRecap
          ? findApprovedPermissionStatusForDate(teacher.id, dateKey, permissionsRes.items)
          : null;

        if (permStatus === AttendanceStatus.SICK) {
          sick += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else if (permStatus === AttendanceStatus.EXCUSED) {
          excused += 1;
          if (tPoint) tPoint.excusedSick += 1;
        } else {
          missingCheckIn += 1;
          absent += 1;
          if (tPoint) tPoint.absent += 1;
        }
      }
    }

    const wd = teacherExpectedDays;
    const attended = present + late;
    const rate = wd > 0 ? Math.round((attended / wd) * 100) : 0;

    personRows.push({
      id: `TEACHER_${teacher.id}`,
      personType: QrOwnerType.TEACHER,
      personId: teacher.id,
      fullName: teacher.fullName,
      identifier: teacher.niyNip,
      classId: null,
      className: teacher.position,
      workingDays: wd,
      present,
      late,
      sick,
      excused,
      absent,
      hlt,
      missingCheckIn,
      missingCheckOut,
      attendanceRate: rate,
    });
  }

  // Apply search & status filters on aggregated rows
  const q = (options.search ?? '').trim().toLowerCase();
  const statusFilter = options.status ?? '';
  const filteredRows = personRows
    .filter((row) => {
      if (q) {
        const hay = `${row.fullName} ${row.identifier} ${row.className ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === AttendanceStatus.PRESENT && row.present === 0) return false;
      if (statusFilter === AttendanceStatus.LATE && row.late === 0) return false;
      if (statusFilter === AttendanceStatus.SICK && row.sick === 0) return false;
      if (statusFilter === AttendanceStatus.EXCUSED && row.excused === 0) return false;
      if (statusFilter === AttendanceStatus.ABSENT && row.absent === 0) return false;
      if (statusFilter === 'MISSING_CHECK_IN' && row.missingCheckIn === 0) return false;
      if (statusFilter === 'MISSING_CHECK_OUT' && row.missingCheckOut === 0) return false;
      return true;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));

  // Aggregate summary from filteredRows
  const summary = filteredRows.reduce(
    (acc, r) => {
      acc.totalPeople += 1;
      acc.totalWorkingPersonDays += r.workingDays;
      acc.present += r.present;
      acc.late += r.late;
      acc.sick += r.sick;
      acc.excused += r.excused;
      acc.absent += r.absent;
      acc.hlt += r.hlt;
      acc.missingCheckIn += r.missingCheckIn;
      acc.missingCheckOut += r.missingCheckOut;
      return acc;
    },
    {
      totalPeople: 0,
      totalWorkingPersonDays: 0,
      present: 0,
      late: 0,
      sick: 0,
      excused: 0,
      absent: 0,
      hlt: 0,
      missingCheckIn: 0,
      missingCheckOut: 0,
      attendanceRate: 0,
    },
  );

  summary.attendanceRate =
    summary.totalWorkingPersonDays > 0
      ? Math.round(((summary.present + summary.late) / summary.totalWorkingPersonDays) * 100)
      : 0;

  // Finalize class breakdown attendance rates
  const classBreakdown = Array.from(classBuckets.values())
    .filter((c) => !options.classId || c.classId === options.classId)
    .map((c) => {
      const denom = c.totalStudents * studentWorkingDates.length;
      return {
        ...c,
        attendanceRate: denom > 0 ? Math.round(((c.present + c.late) / denom) * 100) : 0,
      };
    })
    .sort((a, b) => a.gradeLevel - b.gradeLevel || a.className.localeCompare(b.className, 'id'));

  // Cursor pagination
  let pageItems = filteredRows;
  let nextCursor: string | null = null;
  if (!options.unbounded) {
    const limit = options.limit ?? 25;
    let startIdx = 0;
    if (options.cursor) {
      const idx = filteredRows.findIndex((r) => r.id === options.cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    pageItems = filteredRows.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + pageItems.length < filteredRows.length;
    nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1]!.id : null;
  }

  // Only include dates that had expected attendance or all dates if range <= 31 days
  const trend = Array.from(trendMap.values()).filter((p) => p.totalExpected > 0 || allDates.length <= 14);

  const workingDaysCount =
    effectiveDimension === 'TEACHER' ? teacherWorkingDates.length : studentWorkingDates.length;

  return {
    schoolName,
    generatedAt: now.toISOString(),
    period: options.period,
    dateFrom,
    dateTo,
    dimension: effectiveDimension,
    workingDaysCount,
    approvedPermissionAffectsRecap,
    appliedFilters: {
      period: options.period,
      dateFrom,
      dateTo,
      dimension: effectiveDimension,
      classId: options.classId || null,
      status: statusFilter || null,
      search: options.search || null,
    },
    summary,
    trend,
    classBreakdown,
    items: pageItems,
    total: filteredRows.length,
    nextCursor,
  };
}
