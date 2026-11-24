import type { AttendanceRule, Teacher } from '../types';
import { INDONESIAN_DAY_NAMES } from './date';

export const DEFAULT_TEACHER_WORKING_DAYS: number[] = [1, 2, 3, 4, 5, 6];

/**
 * Normalizes a day-of-week array (1 = Senin .. 7 = Minggu) into sorted unique valid integers.
 */
export function normalizeWorkingDays(days?: number[] | null): number[] {
  if (!Array.isArray(days)) return [];
  const valid = days
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  return Array.from(new Set(valid)).sort((a, b) => a - b);
}

/**
 * Resolves the school's baseline active days for teachers from the active teacher rule.
 */
export function getSchoolTeacherActiveDays(
  teacherRule?: Pick<AttendanceRule, 'daysOfWeek'> | null,
): number[] {
  const fromRule = normalizeWorkingDays(teacherRule?.daysOfWeek);
  return fromRule.length > 0 ? fromRule : [...DEFAULT_TEACHER_WORKING_DAYS];
}

/**
 * Resolves effective mandatory attendance working days for a specific teacher.
 * Falls back to active teacher AttendanceRule.daysOfWeek (or Senin–Sabtu).
 */
export function resolveTeacherWorkingDays(
  teacher?: Pick<Teacher, 'workingDays'> | null,
  teacherRule?: Pick<AttendanceRule, 'daysOfWeek'> | null,
): number[] {
  const custom = normalizeWorkingDays(teacher?.workingDays);
  if (custom.length > 0) return custom;
  return getSchoolTeacherActiveDays(teacherRule);
}

/**
 * Computes which active school days are counted as HLT (Hari Libur Tertentu) for a teacher.
 * Example: if school is active Sen–Sab (1..6) and teacher works 5 days (1..5), Sabtu (6) is HLT.
 */
export function resolveTeacherHltDays(
  workingDays: number[],
  teacherRule?: Pick<AttendanceRule, 'daysOfWeek'> | null,
): number[] {
  const workSet = new Set(normalizeWorkingDays(workingDays));
  const schoolActive = getSchoolTeacherActiveDays(teacherRule);
  return schoolActive.filter((d) => !workSet.has(d));
}

/**
 * Formats an array of ISO day-of-week numbers (1..7) into readable Indonesian labels.
 */
export function formatIndonesianDaysList(days: number[]): string {
  const sorted = normalizeWorkingDays(days);
  if (sorted.length === 0) return '-';
  if (sorted.join(',') === '1,2,3,4,5,6') return 'Senin – Sabtu';
  if (sorted.join(',') === '1,2,3,4,5') return 'Senin – Jumat';
  return sorted.map((d) => INDONESIAN_DAY_NAMES[d] ?? String(d)).join(', ');
}
