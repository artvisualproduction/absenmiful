import { CollectionName, UserRole } from '../../../src/types';
import type { IDataRepository } from '../repository/types';
import { hashIpAddress } from './password';

export interface RecordActivityInput {
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  clientIp?: string | null;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'temporaryPassword',
  'sessionTokenHash',
  'tokenHash',
  'rawToken',
  'portalExitPassword',
  'portalExitPasswordHash',
  'privateKey',
  'secret',
]);

export function sanitizeAuditSnapshot(
  obj: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!obj) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key)) continue;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizeAuditSnapshot(val as Record<string, unknown>);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function recordActivityLog(
  repo: IDataRepository,
  input: RecordActivityInput,
): Promise<void> {
  await repo.collection(CollectionName.ACTIVITY_LOGS).create({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: sanitizeAuditSnapshot(input.before),
    after: sanitizeAuditSnapshot(input.after),
    reason: input.reason ?? null,
    ipHash: hashIpAddress(input.clientIp),
  });
}
