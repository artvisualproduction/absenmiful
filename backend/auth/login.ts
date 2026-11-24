import { z } from 'zod';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { setAuthCookies, type CookieResponseLike } from '../_lib/auth/cookies';
import { extractClientIp, type ApiRequestLike } from '../_lib/auth/middleware';
import { verifyPassword } from '../_lib/auth/password';
import {
  checkIpRateLimit,
  clearIpAttempts,
  computeNextFailedState,
  isAccountLocked,
  recordIpFailedAttempt,
} from '../_lib/auth/rateLimit';
import { createUserSession, toSafeUser } from '../_lib/auth/session';
import { normalizeUsername } from '../_lib/auth/uniqueUsername';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const GENERIC_LOGIN_ERROR = 'Username atau kata sandi salah.';

const loginBodySchema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi.').max(64),
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(128),
});

export async function handleLogin(
  req: ApiRequestLike,
  res: MinimalApiResponse & CookieResponseLike,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const clientIp = extractClientIp(req);
    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      await recordActivityLog(repo, {
        actorUserId: 'anonymous',
        actorRole: UserRole.TEACHER,
        action: 'LOGIN_RATE_LIMITED',
        entityType: 'AUTH',
        entityId: 'ip_limit',
        reason: `Percobaan login melampaui batas dari IP terkait.`,
        clientIp,
      });
      throw ApiError.tooManyRequests(
        `Terlalu banyak percobaan login. Silakan coba lagi dalam ${Math.ceil(ipLimit.retryAfterSeconds / 60)} menit.`,
      );
    }

    const parsed = loginBodySchema.parse(req.body ?? {});
    const normalized = normalizeUsername(parsed.username);
    const usersCol = repo.collection(CollectionName.USERS);
    const user = await usersCol.findFirst([
      { field: 'normalizedUsername', op: '==', value: normalized },
    ]);

    if (user && isAccountLocked(user.lockedUntil)) {
      recordIpFailedAttempt(clientIp);
      await recordActivityLog(repo, {
        actorUserId: user.id,
        actorRole: user.role,
        action: 'LOGIN_FAILED_LOCKED',
        entityType: 'AUTH',
        entityId: user.id,
        reason: 'Akun sedang dalam masa tunggu (cooldown) akibat kegagalan login berulang.',
        clientIp,
      });
      throw ApiError.tooManyRequests(
        'Akun sementara dikunci karena terlalu banyak percobaan login gagal. Coba lagi beberapa menit lagi.',
      );
    }

    // Constant-time bcrypt check even if user is not found
    const passwordMatches = await verifyPassword(parsed.password, user?.passwordHash);

    if (!user || !user.isActive || !passwordMatches) {
      recordIpFailedAttempt(clientIp);

      if (user) {
        const nextFailed = computeNextFailedState(user.failedLoginCount ?? 0);
        await usersCol.update(user.id, {
          failedLoginCount: nextFailed.failedLoginCount,
          lockedUntil: nextFailed.lockedUntil,
        });

        await recordActivityLog(repo, {
          actorUserId: user.id,
          actorRole: user.role,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          entityId: user.id,
          reason: nextFailed.lockedNow
            ? 'Login gagal dan akun dikunci sementara.'
            : 'Kredensial tidak cocok atau akun nonaktif.',
          clientIp,
        });

        if (nextFailed.lockedNow) {
          throw ApiError.tooManyRequests(
            'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.',
          );
        }
      } else {
        await recordActivityLog(repo, {
          actorUserId: 'anonymous',
          actorRole: UserRole.TEACHER,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          entityId: normalized || 'unknown',
          reason: 'Percobaan login gagal.',
          clientIp,
        });
      }

      throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
    }

    // Successful login: reset counters, create hashed session, set HttpOnly + CSRF cookies
    clearIpAttempts(clientIp);
    const nowIso = new Date().toISOString();
    const updatedUser =
      (await usersCol.update(user.id, {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: nowIso,
      })) ?? user;

    const sessionBundle = await createUserSession(repo, user.id);
    setAuthCookies(
      req,
      res,
      sessionBundle.rawSessionToken,
      sessionBundle.csrfToken,
      sessionBundle.maxAgeSeconds,
    );

    let displayName = updatedUser.username;
    let position: string | null = null;
    if (updatedUser.linkedTeacherId) {
      const teacher = await repo
        .collection(CollectionName.TEACHERS)
        .getById(updatedUser.linkedTeacherId);
      if (teacher) {
        displayName = teacher.fullName;
        position = teacher.position;
      }
    }

    await recordActivityLog(repo, {
      actorUserId: updatedUser.id,
      actorRole: updatedUser.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: sessionBundle.session.id,
      clientIp,
    });

    const safeUser = toSafeUser(updatedUser);

    sendOk(res, {
      user: {
        id: safeUser.id,
        username: safeUser.username,
        role: safeUser.role,
        linkedTeacherId: safeUser.linkedTeacherId,
        displayName,
        position,
        mustChangePassword:
          safeUser.role === UserRole.TEACHER ? false : safeUser.mustChangePassword,
        isActive: safeUser.isActive,
      },
      csrfToken: sessionBundle.csrfToken,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse & CookieResponseLike,
): Promise<void> {
  await handleLogin(req, res);
}
