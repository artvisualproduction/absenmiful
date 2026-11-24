import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import {
  CSRF_COOKIE_NAME,
  getHeaderValue,
  parseCookies,
  type CookieResponseLike,
} from '../_lib/auth/cookies';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleMe(
  req: ApiRequestLike,
  res: MinimalApiResponse & CookieResponseLike,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method && req.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus GET.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowMustChangePassword: true,
    });

    let displayName = auth.user.username;
    let position: string | null = null;
    if (auth.user.linkedTeacherId) {
      const teacher = await repo
        .collection(CollectionName.TEACHERS)
        .getById(auth.user.linkedTeacherId);
      if (teacher) {
        displayName = teacher.fullName;
        position = teacher.position;
      }
    }

    const cookies = parseCookies(getHeaderValue(req, 'cookie'));

    // Strictly return minimal profile and role — NEVER passwordHash
    sendOk(res, {
      user: {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
        linkedTeacherId: auth.user.linkedTeacherId,
        displayName,
        position,
        mustChangePassword:
          auth.user.role === UserRole.TEACHER ? false : auth.user.mustChangePassword,
        isActive: auth.user.isActive,
      },
      csrfToken: cookies[CSRF_COOKIE_NAME] ?? null,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse & CookieResponseLike,
): Promise<void> {
  await handleMe(req, res);
}
