import { qrBulkIssueSchema } from '../../src/lib/adminSettingsValidation';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { issueQrToken } from '../_lib/qr/tokenService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * POST /api/qr/bulk
 * Issues (or regenerates, revoking old tokens) high-entropy random QR tokens for
 * multiple selected students or teachers in a single audited batch.
 * Raw tokens are returned ONCE for PNG/ZIP/Print card generation and NEVER stored raw.
 */
export async function handleQrBulkIssue(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = qrBulkIssueSchema.parse(req.body ?? {});
    const uniqueOwnerIds = Array.from(new Set(parsed.ownerIds));

    const issuedItems = [];
    for (const ownerId of uniqueOwnerIds) {
      const issued = await issueQrToken(repo, parsed.ownerType, ownerId, {
        userId: auth.user.id,
        role: auth.user.role,
        clientIp: auth.clientIp,
      });
      issuedItems.push(issued);
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'QR_TOKENS_BULK_ISSUED',
      entityType: 'QR_TOKEN',
      entityId: `${parsed.ownerType}_${uniqueOwnerIds.length}`,
      after: {
        ownerType: parsed.ownerType,
        count: issuedItems.length,
      },
      clientIp: auth.clientIp,
    });

    sendOk(res, { items: issuedItems, count: issuedItems.length }, 201);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleQrBulkIssue(req, res);
}
