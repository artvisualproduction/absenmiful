import { z } from 'zod';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  encryptPasswordForAdminView,
  hashPassword,
} from '../_lib/auth/password';
import { revokeAllUserSessions } from '../_lib/auth/session';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const resetPasswordSchema = z.object({
  targetUserId: z.string().trim().min(1, 'ID pengguna wajib diisi.'),
  customPassword: z
    .string()
    .min(6, 'Kata sandi baru minimal 6 karakter.')
    .max(72, 'Kata sandi baru maksimal 72 karakter.'),
  reason: z.string().trim().max(250).optional().default(''),
  mustChangePassword: z.boolean().optional(),
});

export async function handleResetPassword(
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
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    });

    const parsed = resetPasswordSchema.parse(req.body ?? {});
    const usersCol = repo.collection(CollectionName.USERS);
    const target = await usersCol.getById(parsed.targetUserId);

    if (!target) {
      throw ApiError.notFound('Akun pengguna tidak ditemukan.');
    }

    // Strict role hierarchy
    if (target.role === UserRole.SUPER_ADMIN && auth.user.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Hanya Super Admin yang dapat mengubah kata sandi akun Super Admin.');
    }
    if (
      auth.user.role === UserRole.PRINCIPAL &&
      (target.role === UserRole.SUPER_ADMIN || target.role === UserRole.ADMIN)
    ) {
      throw ApiError.forbidden(
        'Kepala Sekolah tidak berwenang mengubah kata sandi akun SUPER_ADMIN atau ADMIN.',
      );
    }

    const nextPassword = parsed.customPassword;
    const newHash = await hashPassword(nextPassword);
    const nextMustChange =
      target.role === UserRole.TEACHER ? false : (parsed.mustChangePassword ?? false);

    await usersCol.update(target.id, {
      passwordHash: newHash,
      passwordCipher: encryptPasswordForAdminView(nextPassword),
      mustChangePassword: nextMustChange,
      failedLoginCount: 0,
      lockedUntil: null,
    });

    if (target.id !== auth.user.id) {
      await revokeAllUserSessions(repo, target.id);
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: target.id,
      reason: parsed.reason || 'Penetapan kata sandi oleh admin',
      after: {
        mustChangePassword: nextMustChange,
        mode: 'ADMIN_DEFINED',
      },
      clientIp: auth.clientIp,
    });

    sendOk(res, {
      targetUserId: target.id,
      username: target.username,
      passwordUpdated: true,
      mustChangePassword: nextMustChange,
    });
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleResetPassword(req, res);
}
