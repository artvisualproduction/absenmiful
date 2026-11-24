import { z } from 'zod';
import { AttendanceAudience, HolidayScope } from '../types/enums';
import { dateYYYYMMDDSchema, timeHHMMSchema } from './validation';

export interface DayOfWeekOption {
  value: number;
  label: string;
  short: string;
}

export const DAY_OF_WEEK_OPTIONS: readonly DayOfWeekOption[] = [
  { value: 1, label: 'Senin', short: 'Sen' },
  { value: 2, label: 'Selasa', short: 'Sel' },
  { value: 3, label: 'Rabu', short: 'Rab' },
  { value: 4, label: 'Kamis', short: 'Kam' },
  { value: 5, label: 'Jumat', short: 'Jum' },
  { value: 6, label: 'Sabtu', short: 'Sab' },
  { value: 7, label: 'Minggu', short: 'Min' },
] as const;

export const teachingScheduleCreateSchema = z.object({
  teacherId: z.string().trim().min(1, 'Guru wajib dipilih.'),
  subjectId: z.string().trim().min(1, 'Mata pelajaran wajib dipilih.'),
  classId: z.string().trim().min(1, 'Kelas wajib dipilih.'),
  dayOfWeek: z.coerce.number().int().min(1, 'Hari harus antara 1 (Senin) sampai 7 (Minggu).').max(7),
  startTime: timeHHMMSchema,
  endTime: timeHHMMSchema,
  room: z.string().trim().max(60).nullable().optional().default(null),
  effectiveFrom: z.string().min(8, 'Tanggal mulai berlaku wajib diisi.'),
  effectiveUntil: z.string().nullable().optional().default(null),
  isActive: z.boolean().default(true),
});

export const teachingScheduleUpdateSchema = teachingScheduleCreateSchema.partial();

export const teachingScheduleImportRowSchema = z.object({
  className: z.string().trim(),
  subjectCodeOrName: z.string().trim(),
  dayOfWeek: z.union([z.coerce.number(), z.string().trim()]),
  startTime: z.string().trim(),
  endTime: z.string().trim(),
  teacherNiyOrName: z.string().trim().optional().default(''),
  useHomeroomTeacher: z.union([z.boolean(), z.string().trim()]).optional().default(false),
  room: z.string().trim().max(60).optional().default(''),
  isActive: z.union([z.boolean(), z.string().trim()]).optional().default(true),
});

export const teachingScheduleImportRequestSchema = z.object({
  mode: z.enum(['preview', 'commit']),
  effectiveFrom: z.string().optional(),
  rows: z
    .array(teachingScheduleImportRowSchema)
    .min(1, 'Minimal 1 baris jadwal untuk diimpor.')
    .max(500),
});

export const attendanceRuleCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama aturan minimal 2 karakter.').max(100),
  audience: z.enum([AttendanceAudience.STUDENT, AttendanceAudience.TEACHER]),
  classIds: z.array(z.string().trim().min(1)).default([]),
  daysOfWeek: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, 'Pilih minimal 1 hari aktif.'),
  checkInStart: timeHHMMSchema,
  lateAfter: timeHHMMSchema,
  lateToleranceMinutes: z.coerce.number().int().min(0).max(120).default(0),
  checkInDeadline: timeHHMMSchema,
  checkOutStart: timeHHMMSchema,
  checkOutDeadline: timeHHMMSchema,
  gpsRequired: z.boolean().default(true),
  geofenceRequired: z.boolean().default(false),
  effectiveFrom: z.string().min(8, 'Tanggal mulai berlaku wajib diisi.'),
  isActive: z.boolean().default(true),
});

export const holidayCreateSchema = z.object({
  date: dateYYYYMMDDSchema,
  name: z.string().trim().min(2, 'Nama hari libur/pengecualian minimal 2 karakter.').max(120),
  scope: z.enum([HolidayScope.SCHOOL, HolidayScope.STUDENT, HolidayScope.TEACHER]).default(HolidayScope.SCHOOL),
  isActive: z.boolean().default(true),
});

export const holidayUpdateSchema = holidayCreateSchema.partial();
