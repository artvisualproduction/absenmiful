import { z } from 'zod';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { bootstrapInitialAccounts } from '../_lib/auth/bootstrapService';
import { extractClientIp, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const bootstrapBodySchema = z.object({
  superAdminPassword: z.string().min(8, 'Kata sandi Super Admin minimal 8 karakter.').max(128),
  adminPassword: z.string().min(8, 'Kata sandi Admin minimal 8 karakter.').max(128).optional(),
  principalPassword: z
    .string()
    .min(8, 'Kata sandi Kepala Sekolah minimal 8 karakter.')
    .max(128)
    .optional(),
});

export async function handleBootstrap(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const parsed = bootstrapBodySchema.parse(req.body ?? {});
    const result = await bootstrapInitialAccounts(repo, parsed, extractClientIp(req));
    sendOk(res, result, 201);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleBootstrap(req, res);
}
