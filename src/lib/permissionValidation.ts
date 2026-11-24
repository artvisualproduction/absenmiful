import { z } from 'zod';
import {
  FileCategory,
  PermissionLeaveType,
  PermissionStatus,
  ReviewDecision,
} from '../types/enums';

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PERMISSION_ATTACHMENTS = 3;

export const permissionAttachmentUploadSchema = z.object({
  dataUrl: z.string().min(30, 'Data berkas lampiran tidak valid.'),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES, {
    message: 'Lampiran hanya mendukung format JPEG, PNG, atau PDF.',
  }),
  fileName: z.string().trim().min(1).max(160).optional(),
  category: z
    .literal(FileCategory.PERMISSION_ATTACHMENT)
    .default(FileCategory.PERMISSION_ATTACHMENT),
});

export const permissionCreateSchema = z
  .object({
    leaveType: z.enum([
      PermissionLeaveType.SICK,
      PermissionLeaveType.PERSONAL,
      PermissionLeaveType.OFFICIAL_DUTY,
      PermissionLeaveType.OTHER,
    ]),
    startAt: z.string().min(10, 'Tanggal/waktu mulai wajib diisi.'),
    endAt: z.string().min(10, 'Tanggal/waktu selesai wajib diisi.'),
    reason: z
      .string()
      .trim()
      .min(8, 'Alasan pengajuan izin wajib diisi minimal 8 karakter.')
      .max(1000, 'Alasan maksimal 1000 karakter.'),
    attachmentFileIds: z
      .array(z.string().trim().min(4))
      .max(MAX_PERMISSION_ATTACHMENTS, `Maksimal ${MAX_PERMISSION_ATTACHMENTS} berkas lampiran.`)
      .optional()
      .default([]),
  })
  .refine(
    (d) => {
      const s = new Date(d.startAt).getTime();
      const e = new Date(d.endAt).getTime();
      return Number.isFinite(s) && Number.isFinite(e) && e >= s;
    },
    {
      message: 'Waktu selesai izin harus sama dengan atau setelah waktu mulai.',
      path: ['endAt'],
    },
  );

export const permissionAdminReviewSchema = z
  .object({
    decision: z.enum([ReviewDecision.RECOMMEND_APPROVE, ReviewDecision.RETURN]),
    note: z.string().trim().max(500).optional().default(''),
  })
  .refine(
    (d) => d.decision !== ReviewDecision.RETURN || d.note.trim().length >= 5,
    {
      message: 'Catatan wajib diisi minimal 5 karakter saat mengembalikan pengajuan ke guru.',
      path: ['note'],
    },
  );

export const permissionPrincipalDecisionSchema = z
  .object({
    decision: z.enum([ReviewDecision.APPROVE, ReviewDecision.REJECT]),
    note: z.string().trim().max(500).optional().default(''),
  })
  .refine(
    (d) => d.decision !== ReviewDecision.REJECT || d.note.trim().length >= 5,
    {
      message: 'Catatan wajib diisi minimal 5 karakter saat menolak pengajuan izin.',
      path: ['note'],
    },
  );

export const permissionCancelSchema = z.object({
  reason: z.string().trim().max(300).optional().default(''),
});

export const PERMISSION_LEAVE_TYPE_LABELS: Record<PermissionLeaveType, string> = {
  [PermissionLeaveType.SICK]: 'Sakit',
  [PermissionLeaveType.PERSONAL]: 'Izin Pribadi',
  [PermissionLeaveType.OFFICIAL_DUTY]: 'Tugas Dinas',
  [PermissionLeaveType.OTHER]: 'Lainnya',
};

export const PERMISSION_STATUS_LABELS: Record<PermissionStatus, string> = {
  [PermissionStatus.SUBMITTED]: 'Diajukan (Menunggu Admin)',
  [PermissionStatus.ADMIN_REVIEWED]: 'Diverifikasi Admin (Menunggu Kepsek)',
  [PermissionStatus.RETURNED]: 'Dikembalikan ke Guru',
  [PermissionStatus.APPROVED]: 'Disetujui',
  [PermissionStatus.REJECTED]: 'Ditolak',
  [PermissionStatus.CANCELLED]: 'Dibatalkan',
};

/**
 * Pure workflow transition guard enforcing Blueprint 4.4 & PRD 5.15:
 * - SUBMITTED -> ADMIN_REVIEWED | RETURNED | CANCELLED
 * - RETURNED -> SUBMITTED (resubmit) | CANCELLED
 * - ADMIN_REVIEWED -> APPROVED | REJECTED | CANCELLED
 * - APPROVED / REJECTED / CANCELLED -> terminal (no further transitions)
 */
export function validatePermissionTransition(
  current: PermissionStatus,
  next: PermissionStatus,
): { allowed: boolean; reason?: string } {
  if (
    current === PermissionStatus.APPROVED ||
    current === PermissionStatus.REJECTED ||
    current === PermissionStatus.CANCELLED
  ) {
    return {
      allowed: false,
      reason: `Pengajuan izin berstatus ${PERMISSION_STATUS_LABELS[current]} sudah bersifat final dan tidak dapat diubah lagi.`,
    };
  }

  if (next === PermissionStatus.APPROVED || next === PermissionStatus.REJECTED) {
    if (current !== PermissionStatus.ADMIN_REVIEWED) {
      return {
        allowed: false,
        reason:
          'Urutan persetujuan tidak valid: pengajuan izin wajib diverifikasi Admin terlebih dahulu sebelum diputuskan Kepala Sekolah.',
      };
    }
    return { allowed: true };
  }

  if (next === PermissionStatus.ADMIN_REVIEWED || next === PermissionStatus.RETURNED) {
    if (current !== PermissionStatus.SUBMITTED) {
      return {
        allowed: false,
        reason: 'Hanya pengajuan berstatus SUBMITTED yang dapat ditinjau oleh Admin.',
      };
    }
    return { allowed: true };
  }

  if (next === PermissionStatus.CANCELLED) {
    return { allowed: true };
  }

  if (next === PermissionStatus.SUBMITTED && current === PermissionStatus.RETURNED) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Transisi status dari ${current} ke ${next} tidak diizinkan.`,
  };
}
