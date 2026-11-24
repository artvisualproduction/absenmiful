import { CollectionName } from '../../src/types';
import { ApiError, sendError, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import {
  canUserAccessPrivateFile,
  getPrivateBlob,
  verifySignedFileSignature,
} from '../_lib/storage/privateStorage';

export interface BinaryApiResponse extends MinimalApiResponse {
  send?(body: Buffer): void;
  end?(body?: Buffer): void;
}

/**
 * GET /api/uploads/file?id=...&exp=...&sig=...
 * Serves a private file ONLY if:
 * 1. User has an active authenticated session
 * 2. Signed URL signature & expiration are valid
 * 3. User is Admin/Operator/Principal OR the owning teacher
 */
export async function handleServePrivateFile(
  req: ApiRequestLike,
  res: BinaryApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const auth = await requireAuth(req, { repo });
    const fileId = getQueryString(req, 'id');
    const exp = getQueryString(req, 'exp');
    const sig = getQueryString(req, 'sig');

    if (!fileId || !exp || !sig) {
      throw ApiError.badRequest('Parameter tautan sementara tidak lengkap.');
    }

    if (!verifySignedFileSignature(fileId, exp, sig)) {
      throw ApiError.forbidden('Tautan sementara tidak valid atau sudah kedaluwarsa.');
    }

    const meta = await repo.collection(CollectionName.FILE_METADATA).getById(fileId);
    if (!meta) {
      throw ApiError.notFound('Berkas tidak ditemukan.');
    }

    if (!canUserAccessPrivateFile(auth.user, meta)) {
      throw ApiError.forbidden('Anda tidak berwenang mengakses berkas ini.');
    }

    let blob = getPrivateBlob(meta.storagePath);
    if (!blob && meta.dataBase64) {
      blob = {
        buffer: Buffer.from(meta.dataBase64, 'base64'),
        mimeType: meta.mimeType,
      };
    }
    if (!blob) {
      throw ApiError.notFound('Isi berkas tidak lagi tersedia pada penyimpanan.');
    }

    res.setHeader?.('Content-Type', blob.mimeType);
    res.setHeader?.('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader?.('X-Content-Type-Options', 'nosniff');
    res.status(200);
    if (res.send) {
      res.send(blob.buffer);
    } else if (res.end) {
      res.end(blob.buffer);
    } else {
      res.json({ ok: true, sizeBytes: blob.buffer.length });
    }
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: BinaryApiResponse,
): Promise<void> {
  await handleServePrivateFile(req, res);
}
