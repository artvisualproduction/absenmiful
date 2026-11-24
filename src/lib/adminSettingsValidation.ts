import { z } from 'zod';
import { QrOwnerType, UserRole } from '../types/enums';

export const ALLOWED_BRANDING_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const MAX_BRANDING_BYTES = 2 * 1024 * 1024; // 2 MB (logo & ikon)
export const MAX_LOGIN_BACKGROUND_BYTES = 10 * 1024 * 1024; // 10 MB (background halaman login)

export const BRANDING_SLOTS = [
  'logo',
  'favicon',
  'pwaIcon192',
  'pwaIcon512',
  'loginBackground',
] as const;

export type BrandingSlot = (typeof BRANDING_SLOTS)[number];

export function getMaxBrandingBytes(slot: BrandingSlot): number {
  return slot === 'loginBackground' ? MAX_LOGIN_BACKGROUND_BYTES : MAX_BRANDING_BYTES;
}

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Warna harus berformat heksadesimal #RRGGBB.');

export const PORTAL_SCAN_METHODS = [
  'CAMERA_AND_USB',
  'CAMERA_ONLY',
  'USB_SCANNER_ONLY',
  'MANUAL_AND_SCANNER',
] as const;

export const appSettingsUpdateSchema = z.object({
  appName: z.string().trim().min(2, 'Nama aplikasi minimal 2 karakter.').max(60).optional(),
  pwaAppName: z
    .string()
    .trim()
    .min(2, 'Nama aplikasi PWA minimal 2 karakter.')
    .max(25, 'Nama aplikasi PWA maksimal 25 karakter.')
    .optional(),
  schoolName: z.string().trim().min(3, 'Nama sekolah minimal 3 karakter.').max(140).optional(),
  schoolAddress: z.string().trim().min(5, 'Alamat sekolah minimal 5 karakter.').max(300).optional(),
  schoolBio: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(3).max(60).optional(),
  theme: z
    .object({
      primary: hexColorSchema,
      accent: hexColorSchema,
      background: hexColorSchema,
    })
    .optional(),
  gpsEnabledForStudents: z.boolean().optional(),
  gpsEnabledForTeachers: z.boolean().optional(),
  teacherSelfServiceEnabled: z.boolean().optional(),
  portalScanMethod: z.enum(PORTAL_SCAN_METHODS).optional(),
  approvedPermissionAffectsRecap: z.boolean().optional(),
  quickLoginEnabled: z.boolean().optional(),
  bypassAttendanceTimeWindow: z.boolean().optional(),
  requireUserLinkedToTeacher: z.boolean().optional(),
  photoRetentionDays: z.coerce
    .number()
    .int()
    .min(7, 'Retensi foto minimal 7 hari.')
    .max(730, 'Retensi foto maksimal 730 hari.')
    .optional(),
  voiceTemplates: z
    .object({
      success: z.string().trim().min(2).max(120),
      failure: z.string().trim().min(2).max(120),
      namedSuccess: z.string().trim().min(2).max(160),
      late: z.string().trim().min(2).max(160).optional(),
      closed: z.string().trim().min(2).max(160).optional(),
      alreadyRecorded: z.string().trim().min(2).max(160).optional(),
    })
    .optional(),
  portalExitPassword: z
    .string()
    .min(3, 'Kata sandi keluar portal minimal 3 karakter.')
    .max(72)
    .optional(),
});

export const brandingUploadSchema = z.object({
  slot: z.enum(BRANDING_SLOTS),
  dataUrl: z.string().min(30, 'Data gambar branding tidak valid.'),
  mimeType: z.enum(ALLOWED_BRANDING_MIME_TYPES, {
    message: 'Format aset branding hanya mendukung PNG, JPEG, atau WebP.',
  }),
  fileName: z.string().trim().max(160).optional(),
});

export const qrBulkIssueSchema = z.object({
  ownerType: z.enum([QrOwnerType.STUDENT, QrOwnerType.TEACHER]),
  ownerIds: z
    .array(z.string().trim().min(1))
    .min(1, 'Pilih minimal 1 siswa atau guru.')
    .max(100, 'Maksimal 100 kartu QR per permintaan massal.'),
});

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(40, 'Username maksimal 40 karakter.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip.'),
  password: z
    .string()
    .min(6, 'Kata sandi minimal 6 karakter.')
    .max(72, 'Kata sandi maksimal 72 karakter.'),
  role: z.enum([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.OPERATOR,
    UserRole.TEACHER,
  ]),
  linkedTeacherId: z.string().trim().nullable().optional().default(null),
  isActive: z.boolean().optional().default(true),
  mustChangePassword: z.boolean().optional().default(false),
});

export const userUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(40, 'Username maksimal 40 karakter.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip.')
    .optional(),
  role: z
    .enum([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.PRINCIPAL,
      UserRole.OPERATOR,
      UserRole.TEACHER,
    ])
    .optional(),
  isActive: z.boolean().optional(),
  linkedTeacherId: z.string().trim().nullable().optional(),
  mustChangePassword: z.boolean().optional(),
  password: z
    .string()
    .min(6, 'Kata sandi baru minimal 6 karakter.')
    .max(72, 'Kata sandi baru maksimal 72 karakter.')
    .optional(),
});

export const generateUsersFromTeachersSchema = z.object({
  items: z
    .array(
      z.object({
        teacherId: z.string().trim().min(1, 'ID guru wajib diisi.'),
        role: z.enum([UserRole.PRINCIPAL, UserRole.TEACHER]).optional(),
      }),
    )
    .min(1, 'Pilih minimal 1 data guru untuk dibuatkan akun.')
    .max(200, 'Maksimal 200 guru per proses generate.'),
});

export const auditLogQuerySchema = z.object({
  actorUserId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal awal harus YYYY-MM-DD.')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal akhir harus YYYY-MM-DD.')
    .optional(),
  search: z.string().trim().max(120).optional().default(''),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(25),
});
