import { z } from 'zod';
import { AttendanceEventType, AttendanceStatus, QrOwnerType } from '../types/enums';

export const qrIssueSchema = z.object({
  ownerType: z.enum([QrOwnerType.STUDENT, QrOwnerType.TEACHER]),
  ownerId: z.string().trim().min(1, 'ID pemilik wajib diisi.'),
});

export const qrRevokeSchema = z
  .object({
    qrTokenId: z.string().trim().min(1).optional(),
    ownerType: z.enum([QrOwnerType.STUDENT, QrOwnerType.TEACHER]).optional(),
    ownerId: z.string().trim().min(1).optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((data) => Boolean(data.qrTokenId || (data.ownerType && data.ownerId)), {
    message: 'Sertakan qrTokenId atau pasangan ownerType dan ownerId.',
  });

export const attendanceScanSchema = z.object({
  token: z.string().trim().min(2, 'Kode QR / NIS / NIY tidak valid.').max(256),
  eventType: z
    .enum([AttendanceEventType.CHECK_IN, AttendanceEventType.CHECK_OUT, 'AUTO'])
    .default('AUTO'),
  latitude: z.number().min(-90).max(90).nullable().optional().default(null),
  longitude: z.number().min(-180).max(180).nullable().optional().default(null),
  gpsAccuracyMeters: z.number().min(0).max(100000).nullable().optional().default(null),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Idempotency key minimal 8 karakter.')
    .max(128),
  clientTimestamp: z.string().nullable().optional().default(null),
  deviceInfo: z.string().trim().max(200).nullable().optional().default(null),
  selfieFileId: z.string().trim().min(4).max(120).nullable().optional().default(null),
});

export const attendanceCorrectionSchema = z.object({
  status: z.enum([
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.SICK,
    AttendanceStatus.EXCUSED,
    AttendanceStatus.ABSENT,
  ]),
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan koreksi wajib diisi (minimal 5 karakter).')
    .max(400),
});

export const portalActivateSchema = z.object({
  username: z.string().trim().min(3, 'Username wajib diisi.').max(64),
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(128),
});

export const portalExitSchema = z.object({
  password: z.string().min(1, 'Kata sandi keluar portal wajib diisi.').max(128),
});
