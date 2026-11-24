import { z } from 'zod';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  encryptPasswordForAdminView,
  hashPassword,
  verifyPassword,
} from '../_lib/auth/password';
import { revokeAllUserSessions } from '../_lib/auth/session';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.').max(128),
  newPassword: z
    .string()
    .min(6, 'Kata sandi baru minimal 6 karakter.')
    .max(128, 'Kata sandi baru maksimal 128 karakter.'),
});

export async function handleChangePassword(
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
      allowMustChangePassword: true,
    });

    const parsed = changePasswordSchema.parse(req.body ?? {});

    if (parsed.currentPassword === parsed.newPassword) {
      throw ApiError.badRequest('Kata sandi baru harus berbeda dari kata sandi saat ini.');
    }

    const usersCol = repo.collection(CollectionName.USERS);
    const fullUser = await usersCol.getById(auth.user.id);
    if (!fullUser) {
      throw ApiError.unauthorized('Akun tidak ditemukan.');
    }

    const validCurrent = await verifyPassword(parsed.currentPassword, fullUser.passwordHash);
    if (!validCurrent) {
      throw ApiError.badRequest('Kata sandi saat ini tidak sesuai.');
    }

    const newHash = await hashPassword(parsed.newPassword);
    await usersCol.update(fullUser.id, {
      passwordHash: newHash,
      passwordCipher: encryptPasswordForAdminView(parsed.newPassword),
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    });

    // Revoke other active sessions while keeping current session alive
    await revokeAllUserSessions(repo, fullUser.id, auth.session.id);

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: auth.user.id,
      clientIp: auth.clientIp,
    });

    sendOk(res, {
      changed: true,
      mustChangePassword: false,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleChangePassword(req, res);
}
