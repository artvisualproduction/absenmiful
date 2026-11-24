import { z } from 'zod';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import {
  canUserAccessPrivateFile,
  createSignedFileUrl,
} from '../_lib/storage/privateStorage';

const signedUrlRequestSchema = z
  .object({
    fileId: z.string().trim().min(1).optional(),
    storagePath: z.string().trim().min(1).optional(),
  })
  .refine((d) => Boolean(d.fileId || d.storagePath), {
    message: 'Sertakan fileId atau storagePath.',
  });

/**
 * POST /api/uploads/signed-url
 * Generates a short-lived (5-minute) signed URL for private attendance selfies.
 * Strictly accessible ONLY to Admin/Operator/Principal or the owning teacher.
 */
export async function handleSignedUrl(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo });
    const parsed = signedUrlRequestSchema.parse(req.body ?? {});

    const metaCol = repo.collection(CollectionName.FILE_METADATA);
    const meta = parsed.fileId
      ? await metaCol.getById(parsed.fileId)
      : await metaCol.findFirst([{ field: 'storagePath', op: '==', value: parsed.storagePath! }]);

    if (!meta) {
      throw ApiError.notFound('Berkas tidak ditemukan.');
    }

    if (!canUserAccessPrivateFile(auth.user, meta)) {
      throw ApiError.forbidden('Anda tidak berwenang mengakses foto bukti kehadiran ini.');
    }

    const signed = createSignedFileUrl(meta.id, 300);
    sendOk(res, {
      fileId: meta.id,
      mimeType: meta.mimeType,
      signedUrl: signed.url,
      expiresAt: signed.expiresAt,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleSignedUrl(req, res);
}
