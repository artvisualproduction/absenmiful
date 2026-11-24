import crypto from 'node:crypto';
import {
  CollectionName,
  QrOwnerType,
  UserRole,
  type QrToken,
} from '../../../src/types';
import { ApiError } from '../apiError';
import { recordActivityLog } from '../auth/audit';
import type { IDataRepository } from '../repository/types';

/**
 * Generates a high-entropy opaque QR token (256 bits of CSPRNG entropy).
 * Strictly contains NO personal data (never NIS, NIY/NIP, or names).
 */
export function generateHighEntropyQrToken(): string {
  const randomPart = crypto.randomBytes(32).toString('base64url');
  return `QR1.${randomPart}`;
}

/**
 * Computes SHA-256 hex hash stored in Firestore `qrTokens.tokenHash`.
 */
export function hashQrToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

export interface QrActorContext {
  userId: string;
  role: UserRole;
  clientIp?: string;
}

export interface IssuedQrTokenResult {
  qrTokenId: string;
  rawToken: string;
  ownerType: QrOwnerType;
  ownerId: string;
  ownerName: string;
  issuedAt: string;
}

/**
 * Issues a new high-entropy QR token for a Student or Teacher:
 * - Verifies owner exists
 * - Revokes any previous active tokens for this owner
 * - Persists ONLY `tokenHash` in `qrTokens`
 * - Updates `owner.qrTokenId`
 * - Records `QR_TOKEN_ISSUED` in `activityLogs`
 * - Returns `rawToken` ONCE to the caller
 */
export async function issueQrToken(
  repo: IDataRepository,
  ownerType: QrOwnerType,
  ownerId: string,
  actor: QrActorContext,
): Promise<IssuedQrTokenResult> {
  let ownerName = '';
  if (ownerType === QrOwnerType.STUDENT) {
    const student = await repo.collection(CollectionName.STUDENTS).getById(ownerId);
    if (!student) throw ApiError.notFound('Siswa tidak ditemukan.');
    ownerName = student.fullName;
  } else {
    const teacher = await repo.collection(CollectionName.TEACHERS).getById(ownerId);
    if (!teacher) throw ApiError.notFound('Guru tidak ditemukan.');
    ownerName = teacher.fullName;
  }

  const qrCol = repo.collection(CollectionName.QR_TOKENS);
  const nowIso = new Date().toISOString();

  // Revoke any existing active QR token for this owner so only one token is active at a time
  const existingActive = await qrCol.list({
    filters: [
      { field: 'ownerType', op: '==', value: ownerType },
      { field: 'ownerId', op: '==', value: ownerId },
      { field: 'isActive', op: '==', value: true },
    ],
  });

  await Promise.all(
    existingActive.items.map((old) =>
      qrCol.update(old.id, {
        isActive: false,
        revokedAt: nowIso,
      }),
    ),
  );

  const rawToken = generateHighEntropyQrToken();
  const tokenHash = hashQrToken(rawToken);
  const qrTokenId = `qr_${crypto.randomBytes(8).toString('hex')}`;

  const created = await qrCol.create({
    id: qrTokenId,
    tokenHash,
    ownerType,
    ownerId,
    isActive: true,
    issuedAt: nowIso,
    revokedAt: null,
    createdBy: actor.userId,
  });

  if (ownerType === QrOwnerType.STUDENT) {
    await repo.collection(CollectionName.STUDENTS).update(ownerId, { qrTokenId: created.id });
  } else {
    await repo.collection(CollectionName.TEACHERS).update(ownerId, { qrTokenId: created.id });
  }

  await recordActivityLog(repo, {
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'QR_TOKEN_ISSUED',
    entityType: 'QR_TOKEN',
    entityId: created.id,
    after: {
      ownerType,
      ownerId,
      revokedPreviousCount: existingActive.items.length,
    },
    clientIp: actor.clientIp,
  });

  return {
    qrTokenId: created.id,
    rawToken,
    ownerType,
    ownerId,
    ownerName,
    issuedAt: created.issuedAt,
  };
}

export async function revokeQrToken(
  repo: IDataRepository,
  target: { qrTokenId?: string; ownerType?: QrOwnerType; ownerId?: string },
  actor: QrActorContext,
  reason?: string,
): Promise<{ revokedCount: number; revokedIds: string[] }> {
  const qrCol = repo.collection(CollectionName.QR_TOKENS);
  const nowIso = new Date().toISOString();

  let tokensToRevoke: QrToken[] = [];
  if (target.qrTokenId) {
    const found = await qrCol.getById(target.qrTokenId);
    if (!found) throw ApiError.notFound('Token QR tidak ditemukan.');
    if (found.isActive) tokensToRevoke = [found];
  } else if (target.ownerType && target.ownerId) {
    const res = await qrCol.list({
      filters: [
        { field: 'ownerType', op: '==', value: target.ownerType },
        { field: 'ownerId', op: '==', value: target.ownerId },
        { field: 'isActive', op: '==', value: true },
      ],
    });
    tokensToRevoke = res.items;
  }

  for (const token of tokensToRevoke) {
    await qrCol.update(token.id, {
      isActive: false,
      revokedAt: nowIso,
    });

    if (token.ownerType === QrOwnerType.STUDENT) {
      const st = await repo.collection(CollectionName.STUDENTS).getById(token.ownerId);
      if (st && st.qrTokenId === token.id) {
        await repo.collection(CollectionName.STUDENTS).update(st.id, { qrTokenId: null });
      }
    } else {
      const tc = await repo.collection(CollectionName.TEACHERS).getById(token.ownerId);
      if (tc && tc.qrTokenId === token.id) {
        await repo.collection(CollectionName.TEACHERS).update(tc.id, { qrTokenId: null });
      }
    }

    await recordActivityLog(repo, {
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'QR_TOKEN_REVOKED',
      entityType: 'QR_TOKEN',
      entityId: token.id,
      before: { isActive: true },
      after: { isActive: false, revokedAt: nowIso },
      reason: reason ?? null,
      clientIp: actor.clientIp,
    });
  }

  return {
    revokedCount: tokensToRevoke.length,
    revokedIds: tokensToRevoke.map((t) => t.id),
  };
}

export async function findActiveQrTokenByRaw(
  repo: IDataRepository,
  rawToken: string,
): Promise<QrToken | null> {
  const tokenHash = hashQrToken(rawToken);
  return repo.collection(CollectionName.QR_TOKENS).findFirst([
    { field: 'tokenHash', op: '==', value: tokenHash },
    { field: 'isActive', op: '==', value: true },
  ]);
}
