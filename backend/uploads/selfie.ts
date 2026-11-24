import crypto from 'node:crypto';
import { selfieUploadSchema } from '../../src/lib/teacherAttendanceValidation';
import { CollectionName, FileCategory, QrOwnerType, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { resolveTeacherProfileForUser } from '../_lib/auth/resolvePrincipalTeacher';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import {
  buildPrivateStoragePath,
  createSignedFileUrl,
  parseAndValidateImageDataUrl,
  putPrivateBlob,
} from '../_lib/storage/privateStorage';

const UPLOAD_ALLOWED_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
  UserRole.PRINCIPAL,
  UserRole.TEACHER,
];

/**
 * POST /api/uploads/selfie
 * Validates MIME + magic bytes + size <= 2 MB, stores in PRIVATE storage,
 * persists `fileMetadata` with `retentionUntil` from `appSettings`, and returns
 * a short-lived signed URL.
 */
export async function handleUploadSelfie(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: UPLOAD_ALLOWED_ROLES });
    const parsed = selfieUploadSchema.parse(req.body ?? {});

    // Determine authorized ownerId (teachers can NEVER upload under another teacher's ID)
    let resolvedOwnerType: QrOwnerType = parsed.ownerType;
    let resolvedOwnerId: string;

    if (auth.user.role === UserRole.TEACHER) {
      if (!auth.user.linkedTeacherId) {
        throw ApiError.forbidden('Akun guru belum tertaut ke profil guru aktif.');
      }
      if (parsed.ownerId && parsed.ownerId !== auth.user.linkedTeacherId) {
        throw ApiError.forbidden('Anda tidak berhak mengunggah foto untuk akun lain.');
      }
      resolvedOwnerType = QrOwnerType.TEACHER;
      resolvedOwnerId = auth.user.linkedTeacherId;
    } else if (auth.user.role === UserRole.PRINCIPAL) {
      const principalProfile = await resolveTeacherProfileForUser(repo, auth.user);
      if (!principalProfile) {
        throw ApiError.forbidden(
          'Akun Kepala Sekolah belum tertaut ke profil pendidik aktif. Hubungi Admin untuk menautkan akun di Manajemen Pengguna.',
        );
      }
      resolvedOwnerType = QrOwnerType.TEACHER;
      resolvedOwnerId = principalProfile.id;
    } else {
      // Admin / Operator uploading via Portal QR_SELFIE flow
      resolvedOwnerId = parsed.ownerId ?? `portal_${auth.user.id}`;
    }

    if (
      (auth.user.role === UserRole.TEACHER || auth.user.role === UserRole.PRINCIPAL) &&
      parsed.mimeType === 'image/png'
    ) {
      throw ApiError.badRequest(
        'Absensi mandiri guru hanya menerima tangkapan kamera langsung (JPEG), tidak mendukung unggahan gambar PNG.',
      );
    }

    const { buffer, mimeType } = parseAndValidateImageDataUrl(parsed.dataUrl, parsed.mimeType);

    const settings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
    const retentionDays = Math.max(1, settings?.photoRetentionDays ?? 90);
    const retentionUntil = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const fileId = `fil_${crypto.randomBytes(8).toString('hex')}`;
    const storagePath = buildPrivateStoragePath(
      FileCategory.ATTENDANCE_SELFIE,
      resolvedOwnerId,
      fileId,
      mimeType,
    );

    putPrivateBlob(storagePath, buffer, mimeType);

    const dataBase64 = buffer.length <= 900_000 ? buffer.toString('base64') : null;

    const metadata = await repo.collection(CollectionName.FILE_METADATA).create({
      id: fileId,
      ownerType: resolvedOwnerType,
      ownerId: resolvedOwnerId,
      category: FileCategory.ATTENDANCE_SELFIE,
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
      retentionUntil,
      ...(dataBase64 ? { dataBase64 } : {}),
      createdBy: auth.user.id,
    });

    const signed = createSignedFileUrl(metadata.id, 300);

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'SELFIE_UPLOADED',
      entityType: 'FILE_METADATA',
      entityId: metadata.id,
      after: {
        ownerType: metadata.ownerType,
        ownerId: metadata.ownerId,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        retentionUntil: metadata.retentionUntil,
      },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        fileId: metadata.id,
        storagePath: metadata.storagePath,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        retentionUntil: metadata.retentionUntil,
        signedUrl: signed.url,
        signedUrlExpiresAt: signed.expiresAt,
      },
      201,
    );
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleUploadSelfie(req, res);
}
