import { CollectionName, FileCategory } from '../../src/types';
import { ApiError, sendError, type MinimalApiResponse } from '../_lib/apiError';
import type { ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { getPrivateBlob, putPrivateBlob } from '../_lib/storage/privateStorage';

interface BinaryApiResponse extends MinimalApiResponse {
  send?: (body: Buffer) => void;
  end?: (body?: Buffer | string) => void;
}

/**
 * GET /api/branding/asset?id=<fileId>
 * Serves ONLY public branding assets (school logo, favicon, PWA icons, login backdrop).
 * Strictly rejects any non-branding fileId (selfies & permission attachments remain 100% private).
 */
export async function handleBrandingAsset(
  req: ApiRequestLike,
  res: BinaryApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const fileId = getQueryString(req, 'id');
    if (!fileId) {
      throw ApiError.badRequest('Parameter id aset branding wajib diisi.');
    }

    // 1. Prefer publicBrandingAssets (publicly readable in Firestore Rules without exposing private fileMetadata)
    let blob: { buffer: Buffer; mimeType: string } | null = null;
    try {
      const publicAsset = await repo
        .collection(CollectionName.PUBLIC_BRANDING_ASSETS)
        .getById(fileId);
      if (publicAsset && publicAsset.dataBase64) {
        const buffer = Buffer.from(publicAsset.dataBase64, 'base64');
        if (publicAsset.storagePath) {
          putPrivateBlob(publicAsset.storagePath, buffer, publicAsset.mimeType);
        }
        blob = { buffer, mimeType: publicAsset.mimeType };
      }
    } catch {
      blob = null;
    }

    // 2. Fallback to fileMetadata (mock mode or authenticated admin session)
    if (!blob) {
      const meta = await repo.collection(CollectionName.FILE_METADATA).getById(fileId);
      if (!meta || meta.category !== FileCategory.BRANDING) {
        throw ApiError.notFound('Aset branding tidak ditemukan.');
      }

      blob = getPrivateBlob(meta.storagePath) ?? null;
      if (!blob && typeof meta.dataBase64 === 'string' && meta.dataBase64.length > 0) {
        const restoredBuffer = Buffer.from(meta.dataBase64, 'base64');
        putPrivateBlob(meta.storagePath, restoredBuffer, meta.mimeType);
        blob = { buffer: restoredBuffer, mimeType: meta.mimeType };
      }
    }

    if (!blob) {
      throw ApiError.notFound('Konten aset branding tidak tersedia.');
    }

    res.setHeader?.('Content-Type', blob.mimeType);
    res.setHeader?.('Cache-Control', 'public, max-age=3600');
    res.setHeader?.('X-Content-Type-Options', 'nosniff');
    res.status(200);
    if (typeof res.send === 'function') {
      res.send(blob.buffer);
    } else if (typeof res.end === 'function') {
      res.end(blob.buffer);
    }
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: BinaryApiResponse,
): Promise<void> {
  await handleBrandingAsset(req, res);
}
