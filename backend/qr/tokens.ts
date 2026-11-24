import { qrIssueSchema } from '../../src/lib/attendanceScanValidation';
import { CollectionName, type QrToken } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { issueQrToken } from '../_lib/qr/tokenService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

function toSafeQrTokenMeta(token: QrToken) {
  return {
    id: token.id,
    ownerType: token.ownerType,
    ownerId: token.ownerId,
    isActive: token.isActive,
    issuedAt: token.issuedAt,
    revokedAt: token.revokedAt,
  };
}

export async function handleQrTokens(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const ownerType = getQueryString(req, 'ownerType');
      const ownerId = getQueryString(req, 'ownerId');
      const activeOnly = getQueryString(req, 'activeOnly');

      const result = await repo.collection(CollectionName.QR_TOKENS).list({
        sort: { field: 'issuedAt', direction: 'desc' },
      });

      const filtered = result.items
        .filter((t) => {
          if (ownerType && t.ownerType !== ownerType) return false;
          if (ownerId && t.ownerId !== ownerId) return false;
          if (activeOnly === 'true' && !t.isActive) return false;
          return true;
        })
        .map(toSafeQrTokenMeta);

      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = qrIssueSchema.parse(req.body ?? {});

      const issued = await issueQrToken(repo, parsed.ownerType, parsed.ownerId, {
        userId: auth.user.id,
        role: auth.user.role,
        clientIp: auth.clientIp,
      });

      sendOk(res, issued, 201);
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleQrTokens(req, res);
}
