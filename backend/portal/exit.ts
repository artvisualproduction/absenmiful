import { portalExitSchema } from '../../src/lib/attendanceScanValidation';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { clearAuthCookies } from '../_lib/auth/cookies';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { verifyPassword } from '../_lib/auth/password';
import { revokeSession } from '../_lib/auth/session';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * POST /api/portal/exit
 * Verifies the server-side `portalExitPasswordHash` before exiting Portal Absensi,
 * revokes the active portal session cookie, and writes an audit log entry.
 */
export async function handlePortalExit(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR],
    });

    const parsed = portalExitSchema.parse(req.body ?? {});
    const settings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');

    if (!settings?.portalExitPasswordHash) {
      throw ApiError.badRequest(
        'Kata sandi keluar portal belum dikonfigurasi pada pengaturan sistem.',
      );
    }

    const matched = await verifyPassword(parsed.password, settings.portalExitPasswordHash);
    if (!matched) {
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'PORTAL_EXIT_FAILED',
        entityType: 'PORTAL_SESSION',
        entityId: auth.session.id,
        clientIp: auth.clientIp,
      });
      throw ApiError.unauthorized('Kata sandi keluar portal tidak sesuai.');
    }

    await revokeSession(repo, auth.session.id);
    clearAuthCookies(req, res);

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'PORTAL_EXITED',
      entityType: 'PORTAL_SESSION',
      entityId: auth.session.id,
      clientIp: auth.clientIp,
    });

    sendOk(res, { exited: true });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handlePortalExit(req, res);
}
