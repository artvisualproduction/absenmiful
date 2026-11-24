import { qrRevokeSchema } from '../../src/lib/attendanceScanValidation';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { revokeQrToken } from '../_lib/qr/tokenService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleQrRevoke(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = qrRevokeSchema.parse(req.body ?? {});

    const result = await revokeQrToken(
      repo,
      {
        qrTokenId: parsed.qrTokenId,
        ownerType: parsed.ownerType,
        ownerId: parsed.ownerId,
      },
      {
        userId: auth.user.id,
        role: auth.user.role,
        clientIp: auth.clientIp,
      },
      parsed.reason,
    );

    sendOk(res, result);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleQrRevoke(req, res);
}
