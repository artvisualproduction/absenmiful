import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { clearAuthCookies, type CookieResponseLike } from '../_lib/auth/cookies';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { revokeSession } from '../_lib/auth/session';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleLogout(
  req: ApiRequestLike,
  res: MinimalApiResponse & CookieResponseLike,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowMustChangePassword: true,
    });

    await revokeSession(repo, auth.session.id);
    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'LOGOUT',
      entityType: 'AUTH',
      entityId: auth.session.id,
      clientIp: auth.clientIp,
    });

    clearAuthCookies(req, res);
    sendOk(res, { loggedOut: true });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse & CookieResponseLike,
): Promise<void> {
  await handleLogout(req, res);
}
