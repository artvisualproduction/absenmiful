import { portalActivateSchema } from '../../src/lib/attendanceScanValidation';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { setAuthCookies } from '../_lib/auth/cookies';
import { extractClientIp, type ApiRequestLike } from '../_lib/auth/middleware';
import { verifyPassword } from '../_lib/auth/password';
import {
  checkIpRateLimit,
  clearIpAttempts,
  recordIpFailedAttempt,
} from '../_lib/auth/rateLimit';
import { createUserSession } from '../_lib/auth/session';
import { normalizeUsername } from '../_lib/auth/uniqueUsername';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const PORTAL_ACTIVATE_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
]);

const GENERIC_AUTH_ERROR = 'Username atau kata sandi tidak valid, atau akun tidak berwenang mengaktifkan portal.';

/**
 * POST /api/portal/activate
 * Authorizes a dedicated Portal Absensi device session using Admin/Operator credentials.
 */
export async function handlePortalActivate(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const clientIp = extractClientIp(req);
    const rateCheck = checkIpRateLimit(clientIp);
    if (!rateCheck.allowed) {
      throw ApiError.tooManyRequests(
        `Terlalu banyak percobaan. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
      );
    }

    const parsed = portalActivateSchema.parse(req.body ?? {});
    const normalized = normalizeUsername(parsed.username);

    const user = await repo
      .collection(CollectionName.USERS)
      .findFirst([{ field: 'normalizedUsername', op: '==', value: normalized }]);

    if (!user || !user.isActive || !PORTAL_ACTIVATE_ROLES.has(user.role)) {
      recordIpFailedAttempt(clientIp);
      throw ApiError.unauthorized(GENERIC_AUTH_ERROR);
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw ApiError.tooManyRequests('Akun sementara terkunci. Silakan coba lagi beberapa menit lagi.');
    }

    const valid = await verifyPassword(parsed.password, user.passwordHash);
    if (!valid) {
      recordIpFailedAttempt(clientIp);
      throw ApiError.unauthorized(GENERIC_AUTH_ERROR);
    }

    clearIpAttempts(clientIp);
    const createdSession = await createUserSession(repo, user.id);
    setAuthCookies(req, res, createdSession.rawSessionToken, createdSession.csrfToken);

    await recordActivityLog(repo, {
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PORTAL_ACTIVATED',
      entityType: 'PORTAL_SESSION',
      entityId: createdSession.session.id,
      clientIp,
    });

    sendOk(res, {
      authorized: true,
      operatorUsername: user.username,
      expiresAt: createdSession.session.expiresAt,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handlePortalActivate(req, res);
}
