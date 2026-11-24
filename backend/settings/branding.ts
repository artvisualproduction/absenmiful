import crypto from 'node:crypto';
import {
  brandingUploadSchema,
  getMaxBrandingBytes,
  type BrandingSlot,
} from '../../src/lib/adminSettingsValidation';
import { CollectionName, FileCategory, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { syncPublicSettingsMirror } from '../_lib/auth/bootstrapService';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { putPrivateBlob } from '../_lib/storage/privateStorage';

const BRANDING_WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
/** Max raw bytes (~700 KB => ~933 KB base64) safe to embed in a single Firestore document (< 1 MiB) */
const MAX_FIRESTORE_INLINE_BRANDING_BYTES = 700 * 1024;

function validateImageMagicBytes(
  buffer: Buffer,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
): boolean {
  if (buffer.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  // WebP: RIFF....WEBP
  return (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

const SLOT_TO_SETTINGS_FIELD: Record<BrandingSlot, string> = {
  logo: 'logoPath',
  favicon: 'faviconPath',
  pwaIcon192: 'pwaIcon192Path',
  pwaIcon512: 'pwaIcon512Path',
  loginBackground: 'loginBackgroundPath',
};

/**
 * POST /api/settings/branding
 * Validates MIME, size (<= 10 MB for loginBackground, <= 2 MB for logo/icons), and binary magic bytes
 * for school branding uploads, stores blob + fileMetadata (including inline base64 when <= 700 KB for
 * Firestore & Vercel serverless persistence), and updates `appSettings/default` immediately.
 */
export async function handleBrandingUpload(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: BRANDING_WRITE_ROLES });
    const parsed = brandingUploadSchema.parse(req.body ?? {});

    const prefix = `data:${parsed.mimeType};base64,`;
    if (!parsed.dataUrl.startsWith(prefix)) {
      throw ApiError.badRequest(
        'Header data URL tidak sesuai dengan jenis berkas gambar yang dipilih.',
      );
    }

    const base64 = parsed.dataUrl.slice(prefix.length).replace(/\s+/g, '');
    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = getMaxBrandingBytes(parsed.slot);
    const maxMb = Math.round(maxBytes / (1024 * 1024));

    if (buffer.length === 0 || buffer.length > maxBytes) {
      throw ApiError.badRequest(
        parsed.slot === 'loginBackground'
          ? `Ukuran berkas gambar background maksimal ${maxMb} MB.`
          : `Ukuran berkas gambar branding maksimal ${maxMb} MB.`,
      );
    }

    if (!validateImageMagicBytes(buffer, parsed.mimeType)) {
      throw ApiError.badRequest(
        'Isi berkas tidak valid atau bukan gambar PNG/JPEG/WebP yang sah.',
      );
    }

    const ext =
      parsed.mimeType === 'image/png'
        ? 'png'
        : parsed.mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const fileId = `brand_${parsed.slot}_${crypto.randomBytes(6).toString('hex')}`;
    const storagePath = `branding/${parsed.slot}/${fileId}.${ext}`;

    putPrivateBlob(storagePath, buffer, parsed.mimeType);

    await repo.collection(CollectionName.FILE_METADATA).create({
      id: fileId,
      ownerType: 'SCHOOL',
      ownerId: 'default',
      category: FileCategory.BRANDING,
      storagePath,
      mimeType: parsed.mimeType,
      sizeBytes: buffer.length,
      retentionUntil: null,
      createdBy: auth.user.id,
      ...(buffer.length <= MAX_FIRESTORE_INLINE_BRANDING_BYTES ? { dataBase64: base64 } : {}),
    });

    // Also persist public branding binary in `publicBrandingAssets` so <img> tags render on LoginPage publicly
    if (buffer.length <= MAX_FIRESTORE_INLINE_BRANDING_BYTES) {
      await repo.collection(CollectionName.PUBLIC_BRANDING_ASSETS).createIfNotExists(fileId, {
        slot: parsed.slot,
        mimeType: parsed.mimeType,
        sizeBytes: buffer.length,
        storagePath,
        dataBase64: base64,
        createdBy: auth.user.id,
      });
    }

    const publicUrl = `/api/branding/asset?id=${encodeURIComponent(fileId)}`;
    const fieldName = SLOT_TO_SETTINGS_FIELD[parsed.slot];
    const settingsPatch: Record<string, string> =
      parsed.slot === 'logo'
        ? {
            logoPath: publicUrl,
            faviconPath: publicUrl,
            pwaIcon192Path: publicUrl,
            pwaIcon512Path: publicUrl,
          }
        : { [fieldName]: publicUrl };
    const updatedSettings = await repo
      .collection(CollectionName.APP_SETTINGS)
      .update('default', settingsPatch);
    if (updatedSettings) {
      await syncPublicSettingsMirror(repo, updatedSettings);
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'BRANDING_ASSET_UPLOADED',
      entityType: 'APP_SETTINGS',
      entityId: 'default',
      after: {
        slot: parsed.slot,
        fileId,
        mimeType: parsed.mimeType,
        sizeBytes: buffer.length,
      },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        slot: parsed.slot,
        fileId,
        url: publicUrl,
        mimeType: parsed.mimeType,
        sizeBytes: buffer.length,
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
  await handleBrandingUpload(req, res);
}
