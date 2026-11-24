import crypto from 'node:crypto';
import { permissionAttachmentUploadSchema } from '../../src/lib/permissionValidation';
import { CollectionName, FileCategory, QrOwnerType, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import {
  buildPrivateStoragePath,
  createSignedFileUrl,
  parseAndValidateAttachmentDataUrl,
  putPrivateBlob,
} from '../_lib/storage/privateStorage';

/**
 * POST /api/uploads/attachment
 * Securely uploads a teacher permission attachment (JPEG, PNG, or PDF <= 5 MB)
 * to PRIVATE storage with magic-byte verification and `fileMetadata` tracking.
 */
export async function handleUploadPermissionAttachment(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
    });

    if (!auth.user.linkedTeacherId) {
      throw ApiError.forbidden('Akun Anda belum tertaut ke profil guru aktif.');
    }

    const parsed = permissionAttachmentUploadSchema.parse(req.body ?? {});
    const { buffer, mimeType } = parseAndValidateAttachmentDataUrl(
      parsed.dataUrl,
      parsed.mimeType,
    );

    const settings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
    const retentionDays = Math.max(30, settings?.photoRetentionDays ?? 90);
    const retentionUntil = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const fileId = `attf_${crypto.randomBytes(8).toString('hex')}`;
    const storagePath = buildPrivateStoragePath(
      FileCategory.PERMISSION_ATTACHMENT,
      auth.user.linkedTeacherId,
      fileId,
      mimeType,
    );

    putPrivateBlob(storagePath, buffer, mimeType);

    const metadata = await repo.collection(CollectionName.FILE_METADATA).create({
      id: fileId,
      ownerType: QrOwnerType.TEACHER,
      ownerId: auth.user.linkedTeacherId,
      category: FileCategory.PERMISSION_ATTACHMENT,
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
      retentionUntil,
      createdBy: auth.user.id,
    });

    const signed = createSignedFileUrl(metadata.id, 300);

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'PERMISSION_ATTACHMENT_UPLOADED',
      entityType: 'FILE_METADATA',
      entityId: metadata.id,
      after: {
        ownerId: metadata.ownerId,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
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
  await handleUploadPermissionAttachment(req, res);
}
