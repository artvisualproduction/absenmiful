import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceStatus,
  HolidayScope,
  type AttendanceRule,
  type Holiday,
} from '../types';
import {
  getDateKeyJakarta,
  getDayOfWeekJakarta,
  getTimeHHMMJakarta,
  INDONESIAN_DAY_NAMES,
  parseTimeToMinutes,
} from './date';

export interface EvaluateAttendanceOptions {
  holidays?: Holiday[];
  /** When enabled in AppSettings, bypasses effective date, holiday, weekday, and time-window checks */
  bypassTimeWindow?: boolean;
}

export interface AttendanceEvaluationResult {
  status: AttendanceStatus.PRESENT | AttendanceStatus.LATE | AttendanceStatus.REJECTED;
  reason: string;
  lateMinutes: number;
  jakartaDate: string;
  jakartaTime: string;
  dayOfWeek: number;
}

function holidayMatchesAudience(scope: HolidayScope, audience: AttendanceAudience): boolean {
  if (scope === HolidayScope.SCHOOL) return true;
  if (scope === HolidayScope.STUDENT && audience === AttendanceAudience.STUDENT) return true;
  if (scope === HolidayScope.TEACHER && audience === AttendanceAudience.TEACHER) return true;
  return false;
}

/**
 * Pure function evaluating attendance status strictly from server time in Asia/Jakarta
 * against a versioned AttendanceRule and optional school holiday calendar.
 *
 * Boundary semantics:
 * - CHECK_IN:
 *   - `< checkInStart` -> REJECTED
 *   - `> checkInDeadline` -> REJECTED
 *   - `<= lateAfter + lateToleranceMinutes` (exact boundary included) -> PRESENT
 *   - `> lateAfter + lateToleranceMinutes` and `<= checkInDeadline` -> LATE
 * - CHECK_OUT:
 *   - `< checkOutStart` -> REJECTED
 *   - `> checkOutDeadline` -> REJECTED
 *   - within `[checkOutStart, checkOutDeadline]` (inclusive) -> PRESENT
 */
export function evaluateAttendanceStatus(
  rule: AttendanceRule,
  serverTime: Date | string | number,
  eventType: AttendanceEventType,
  options: EvaluateAttendanceOptions = {},
): AttendanceEvaluationResult {
  const jakartaDate = getDateKeyJakarta(serverTime);
  const jakartaTime = getTimeHHMMJakarta(serverTime);
  const dayOfWeek = getDayOfWeekJakarta(serverTime);

  const base = { jakartaDate, jakartaTime, dayOfWeek };

  // 0. Optional bypass mode for testing attendance at any time/day
  if (options.bypassTimeWindow) {
    return {
      ...base,
      status: AttendanceStatus.PRESENT,
      lateMinutes: 0,
      reason:
        eventType === AttendanceEventType.CHECK_IN
          ? 'Absen masuk berhasil dicatat (Bypass Waktu Absensi aktif).'
          : 'Absen pulang berhasil dicatat (Bypass Waktu Absensi aktif).',
    };
  }

  // 1. Check active rule effective date window if specified
  const serverDateMs =
    serverTime instanceof Date ? serverTime.getTime() : new Date(serverTime).getTime();
  if (rule.effectiveFrom) {
    const fromMs = new Date(rule.effectiveFrom).getTime();
    if (Number.isFinite(fromMs) && serverDateMs < fromMs) {
      return {
        ...base,
        status: AttendanceStatus.REJECTED,
        lateMinutes: 0,
        reason: 'Aturan absensi belum mulai berlaku pada tanggal ini.',
      };
    }
  }
  if (rule.effectiveUntil) {
    const untilMs = new Date(rule.effectiveUntil).getTime();
    if (Number.isFinite(untilMs) && serverDateMs > untilMs) {
      return {
        ...base,
        status: AttendanceStatus.REJECTED,
        lateMinutes: 0,
        reason: 'Aturan absensi sudah berakhir masa berlakunya.',
      };
    }
  }

  // 2. Check active holiday calendar matching date & audience scope
  if (options.holidays && options.holidays.length > 0) {
    const activeHoliday = options.holidays.find(
      (h) =>
        h.isActive &&
        h.date === jakartaDate &&
        holidayMatchesAudience(h.scope, rule.audience),
    );
    if (activeHoliday) {
      return {
        ...base,
        status: AttendanceStatus.REJECTED,
        lateMinutes: 0,
        reason: `Absensi tidak aktif karena hari libur: ${activeHoliday.name}.`,
      };
    }
  }

  // 3. Check active weekday (1 = Senin .. 7 = Minggu)
  if (!rule.daysOfWeek.includes(dayOfWeek)) {
    const dayName = INDONESIAN_DAY_NAMES[dayOfWeek] ?? `Hari ${dayOfWeek}`;
    return {
      ...base,
      status: AttendanceStatus.REJECTED,
      lateMinutes: 0,
      reason: `Hari ${dayName} bukan hari aktif absensi sesuai aturan yang berlaku.`,
    };
  }

  const currentMin = parseTimeToMinutes(jakartaTime);

  // 4. Evaluate CHECK_IN window
  if (eventType === AttendanceEventType.CHECK_IN) {
    const startMin = parseTimeToMinutes(rule.checkInStart);
    const deadlineMin = parseTimeToMinutes(rule.checkInDeadline);
    const tolerance = Math.max(0, rule.lateToleranceMinutes ?? 0);
    const lateThresholdMin = parseTimeToMinutes(rule.lateAfter) + tolerance;

    if (currentMin < startMin) {
      return {
        ...base,
        status: AttendanceStatus.REJECTED,
        lateMinutes: 0,
        reason: `Belum memasuki jam absen masuk (mulai pukul ${rule.checkInStart}).`,
      };
    }

    if (currentMin > deadlineMin) {
      return {
        ...base,
        status: AttendanceStatus.REJECTED,
        lateMinutes: 0,
        reason: `Batas akhir absen masuk (pukul ${rule.checkInDeadline}) telah terlewati.`,
      };
    }

    if (currentMin > lateThresholdMin) {
      const lateMinutes = currentMin - lateThresholdMin;
      return {
        ...base,
        status: AttendanceStatus.LATE,
        lateMinutes,
        reason: `Tercatat terlambat ${lateMinutes} menit dari batas pukul ${rule.lateAfter}${
          tolerance > 0 ? ` (+${tolerance} menit toleransi)` : ''
        }.`,
      };
    }

    return {
      ...base,
      status: AttendanceStatus.PRESENT,
      lateMinutes: 0,
      reason: 'Hadir tepat waktu sesuai aturan absen masuk.',
    };
  }

  // 5. Evaluate CHECK_OUT window
  const outStartMin = parseTimeToMinutes(rule.checkOutStart);
  const outDeadlineMin = parseTimeToMinutes(rule.checkOutDeadline);

  if (currentMin < outStartMin) {
    return {
      ...base,
      status: AttendanceStatus.REJECTED,
      lateMinutes: 0,
      reason: `Belum memasuki jam absen pulang (mulai pukul ${rule.checkOutStart}).`,
    };
  }

  if (currentMin > outDeadlineMin) {
    return {
      ...base,
      status: AttendanceStatus.REJECTED,
      lateMinutes: 0,
      reason: `Batas akhir absen pulang (pukul ${rule.checkOutDeadline}) telah terlewati.`,
    };
  }

  return {
    ...base,
    status: AttendanceStatus.PRESENT,
    lateMinutes: 0,
    reason: 'Absen pulang berhasil dicatat tepat waktu.',
  };
}
