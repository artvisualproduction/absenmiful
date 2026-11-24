import { z } from 'zod';
import {
  AttendanceEventType,
  AttendanceStatus,
  FileCategory,
  QrOwnerType,
} from '../types/enums';
import { dateYYYYMMDDSchema } from './validation';

export const ALLOWED_SELFIE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_SELFIE_BYTES = 2 * 1024 * 1024; // 2 MB

export const selfieUploadSchema = z.object({
  dataUrl: z.string().min(30, 'Data gambar selfie tidak valid.'),
  mimeType: z.enum(ALLOWED_SELFIE_MIME_TYPES, {
    message: 'Format foto hanya mendukung JPEG atau PNG.',
  }),
  category: z.literal(FileCategory.ATTENDANCE_SELFIE).default(FileCategory.ATTENDANCE_SELFIE),
  ownerType: z.enum([QrOwnerType.TEACHER, QrOwnerType.STUDENT]).default(QrOwnerType.TEACHER),
  ownerId: z.string().trim().min(1).optional(),
});

export const teacherSelfAttendanceSchema = z.object({
  eventType: z
    .enum([AttendanceEventType.CHECK_IN, AttendanceEventType.CHECK_OUT, 'AUTO'])
    .default('AUTO'),
  latitude: z
    .number()
    .min(-90, 'Latitude tidak valid.')
    .max(90, 'Latitude tidak valid.')
    .nullable()
    .optional()
    .default(null),
  longitude: z
    .number()
    .min(-180, 'Longitude tidak valid.')
    .max(180, 'Longitude tidak valid.')
    .nullable()
    .optional()
    .default(null),
  gpsAccuracyMeters: z
    .number()
    .min(0, 'Akurasi GPS tidak valid.')
    .max(100000, 'Akurasi GPS tidak valid.')
    .nullable()
    .optional()
    .default(null),
  selfieFileId: z.string().trim().min(4, 'Foto selfie wajib diunggah sebelum absen.'),
  idempotencyKey: z.string().trim().min(8, 'Idempotency key minimal 8 karakter.').max(128),
  clientTimestamp: z.string().nullable().optional().default(null),
  deviceInfo: z.string().trim().max(200).nullable().optional().default(null),
});

export const manualExceptionAttendanceSchema = z.object({
  personType: z.enum([QrOwnerType.TEACHER, QrOwnerType.STUDENT]),
  personId: z.string().trim().min(1, 'Siswa atau guru wajib dipilih.'),
  attendanceDate: dateYYYYMMDDSchema,
  eventType: z.enum([AttendanceEventType.CHECK_IN, AttendanceEventType.CHECK_OUT]),
  status: z.enum([
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.SICK,
    AttendanceStatus.EXCUSED,
  ]),
  reason: z
    .string()
    .trim()
    .min(8, 'Alasan pengecualian manual wajib diisi minimal 8 karakter.')
    .max(400),
});

export const schoolLocationCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama lokasi minimal 2 karakter.').max(120),
  latitude: z.coerce.number().min(-90, 'Latitude harus antara -90 dan 90.').max(90),
  longitude: z.coerce.number().min(-180, 'Longitude harus antara -180 dan 180.').max(180),
  radiusMeters: z.coerce
    .number()
    .int()
    .min(10, 'Radius minimal 10 meter.')
    .max(5000, 'Radius maksimal 5000 meter.'),
  maxGpsAccuracyMeters: z.coerce
    .number()
    .int()
    .min(5, 'Ambang akurasi minimal 5 meter.')
    .max(1000, 'Ambang akurasi maksimal 1000 meter.'),
  isActive: z.boolean().default(true),
});

export const schoolLocationUpdateSchema = schoolLocationCreateSchema.partial();

export const gpsSettingsUpdateSchema = z.object({
  gpsEnabledForStudents: z.boolean().optional(),
  gpsEnabledForTeachers: z.boolean().optional(),
  teacherSelfServiceEnabled: z.boolean().optional(),
  approvedPermissionAffectsRecap: z.boolean().optional(),
});
