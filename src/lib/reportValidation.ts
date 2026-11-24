import { z } from 'zod';
import { AttendanceStatus } from '../types/enums';

export const REPORT_PERIODS = ['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_DIMENSIONS = ['STUDENT', 'TEACHER', 'ALL'] as const;
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

export const reportQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).default('monthly'),
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal awal harus YYYY-MM-DD.')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal akhir harus YYYY-MM-DD.')
    .optional(),
  dimension: z.enum(REPORT_DIMENSIONS).default('STUDENT'),
  classId: z.string().trim().optional(),
  status: z
    .enum([
      '',
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.SICK,
      AttendanceStatus.EXCUSED,
      AttendanceStatus.ABSENT,
      'MISSING_CHECK_IN',
      'MISSING_CHECK_OUT',
    ])
    .optional()
    .default(''),
  search: z.string().trim().max(120).optional().default(''),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(25),
});

export const reportExportSchema = reportQuerySchema.extend({
  format: z.enum(['XLSX', 'PDF', 'PRINT']),
});
