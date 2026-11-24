import crypto from 'node:crypto';
import {
  FileCategory,
  QrOwnerType,
  UserRole,
  type FileMetadata,
  type SafeUser,
} from '../../../src/types';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from '../../../src/lib/permissionValidation';
import {
  ALLOWED_SELFIE_MIME_TYPES,
  MAX_SELFIE_BYTES,
} from '../../../src/lib/teacherAttendanceValidation';
import { ApiError } from '../apiError';

interface StoredBlob {
  buffer: Buffer;
  mimeType: string;
}

const privateBlobStore = new Map<string, StoredBlob>();

// Process-scoped fallback secret for local mock/dev; production sets SESSION_SECRET
const FALLBACK_SIGNING_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.FILE_SIGNING_SECRET?.trim() ||
    FALLBACK_SIGNING_SECRET
  );
}

/**
 * Parses a base64 Data URL (`data:image/jpeg;base64,...`) and strictly validates:
 * 1. MIME type allowlist (image/jpeg, image/png)
 * 2. Decoded size <= MAX_SELFIE_BYTES (2 MB)
 * 3. Binary magic-byte signature matches declared MIME type
 */
export function parseAndValidateImageDataUrl(
  dataUrl: string,
  declaredMime: string,
  maxBytes = MAX_SELFIE_BYTES,
): { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' } {
  if (!ALLOWED_SELFIE_MIME_TYPES.includes(declaredMime as 'image/jpeg' | 'image/png')) {
    throw ApiError.badRequest('Format gambar tidak diizinkan. Gunakan JPEG atau PNG.');
  }

  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw ApiError.badRequest('Format data gambar base64 tidak valid.');
  }

  const embeddedMime = match[1];
  const base64Body = match[2];
  if (embeddedMime !== declaredMime) {
    throw ApiError.badRequest('MIME gambar tidak sesuai dengan isi berkas.');
  }

  const buffer = Buffer.from(base64Body, 'base64');
  if (buffer.length === 0) {
    throw ApiError.badRequest('Berkas gambar kosong.');
  }
  if (buffer.length > maxBytes) {
    throw ApiError.badRequest(
      `Ukuran gambar melebihi batas maksimum (${Math.round(maxBytes / (1024 * 1024))} MB).`,
    );
  }

  // Magic-byte verification
  if (declaredMime === 'image/jpeg') {
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!isJpeg) {
      throw ApiError.badRequest('Header biner berkas bukan gambar JPEG yang valid.');
    }
  } else if (declaredMime === 'image/png') {
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (!isPng) {
      throw ApiError.badRequest('Header biner berkas bukan gambar PNG yang valid.');
    }
  }

  return { buffer, mimeType: declaredMime as 'image/jpeg' | 'image/png' };
}

/**
 * Validates permission attachments: JPEG, PNG, or PDF with magic-byte verification and <= 5 MB limit.
 */
export function parseAndValidateAttachmentDataUrl(
  dataUrl: string,
  declaredMime: string,
  maxBytes = MAX_ATTACHMENT_BYTES,
): { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' | 'application/pdf' } {
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      declaredMime as 'image/jpeg' | 'image/png' | 'application/pdf',
    )
  ) {
    throw ApiError.badRequest('Format lampiran tidak diizinkan. Gunakan JPEG, PNG, atau PDF.');
  }

  if (declaredMime === 'image/jpeg' || declaredMime === 'image/png') {
    return parseAndValidateImageDataUrl(dataUrl, declaredMime, maxBytes);
  }

  const match = /^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw ApiError.badRequest('Format data PDF base64 tidak valid.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw ApiError.badRequest('Berkas PDF kosong.');
  }
  if (buffer.length > maxBytes) {
    throw ApiError.badRequest(
      `Ukuran lampiran melebihi batas maksimum (${Math.round(maxBytes / (1024 * 1024))} MB).`,
    );
  }

  // PDF magic bytes: "%PDF-" (25 50 44 46 2D)
  const isPdf =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;
  if (!isPdf) {
    throw ApiError.badRequest('Header biner berkas bukan dokumen PDF yang valid.');
  }

  return { buffer, mimeType: 'application/pdf' };
}

export function buildPrivateStoragePath(
  category: FileCategory,
  ownerId: string,
  fileId: string,
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf',
): string {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'application/pdf' ? 'pdf' : 'jpg';
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder =
    category === FileCategory.ATTENDANCE_SELFIE
      ? 'selfies'
      : category === FileCategory.PERMISSION_ATTACHMENT
        ? 'permissions'
        : 'files';
  return `private/${folder}/${safeOwner}/${fileId}.${ext}`;
}

export function putPrivateBlob(storagePath: string, buffer: Buffer, mimeType: string): void {
  privateBlobStore.set(storagePath, { buffer, mimeType });
}

export function getPrivateBlob(storagePath: string): StoredBlob | null {
  return privateBlobStore.get(storagePath) ?? null;
}

export function signFileAccess(fileId: string, expiresAtEpochSec: number): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${fileId}:${expiresAtEpochSec}`)
    .digest('base64url');
}

export function createSignedFileUrl(fileId: string, ttlSeconds = 300): {
  url: string;
  expiresAt: string;
} {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signFileAccess(fileId, exp);
  return {
    url: `/api/uploads/file?id=${encodeURIComponent(fileId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifySignedFileSignature(
  fileId: string,
  expStr: string,
  sig: string,
  nowMs = Date.now(),
): boolean {
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) {
    return false;
  }
  const expected = signFileAccess(fileId, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const PRIVILEGED_VIEW_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
  UserRole.PRINCIPAL,
]);

/**
 * Access policy:
 * - SUPER_ADMIN, ADMIN, OPERATOR, PRINCIPAL may inspect private attendance selfies
 * - TEACHER may ONLY access their own uploaded files (`ownerId === user.linkedTeacherId`)
 */
export function canUserAccessPrivateFile(user: SafeUser, meta: FileMetadata): boolean {
  if (PRIVILEGED_VIEW_ROLES.has(user.role)) return true;
  if (
    user.role === UserRole.TEACHER &&
    meta.ownerType === QrOwnerType.TEACHER &&
    user.linkedTeacherId &&
    meta.ownerId === user.linkedTeacherId
  ) {
    return true;
  }
  return false;
}
