import { userUpdateSchema } from '../../src/lib/adminSettingsValidation';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { encryptPasswordForAdminView, hashPassword } from '../_lib/auth/password';
import { revokeAllUserSessions } from '../_lib/auth/session';
import {
  normalizeUsername,
  releaseUniqueUsername,
  reserveUniqueUsername,
} from '../_lib/auth/uniqueUsername';
import { getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const USER_MANAGE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

/**
 * PATCH /api/users/:id — Updates username, role, isActive, linkedTeacherId, password, or mustChangePassword.
 * DELETE /api/users/:id — Deletes a user account while safely returning any linked teacher profile to the teacher pool.
 */
export async function handleUserById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'PATCH' && req.method !== 'DELETE') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus PATCH atau DELETE.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: USER_MANAGE_ROLES });
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID pengguna wajib diisi.');

    const col = repo.collection(CollectionName.USERS);
    const target = await col.getById(id);
    if (!target) {
      throw ApiError.notFound('Akun pengguna tidak ditemukan.');
    }

    // Strict hierarchy & privilege-escalation protection
    if (target.role === UserRole.SUPER_ADMIN && auth.user.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Anda tidak berwenang mengelola akun SUPER_ADMIN.');
    }
    if (
      auth.user.role === UserRole.PRINCIPAL &&
      (target.role === UserRole.SUPER_ADMIN || target.role === UserRole.ADMIN)
    ) {
      throw ApiError.forbidden(
        'Kepala Sekolah tidak berwenang mengubah akun SUPER_ADMIN atau ADMIN.',
      );
    }

    const teacherCol = repo.collection(CollectionName.TEACHERS);

    if (req.method === 'DELETE') {
      if (target.id === auth.user.id) {
        throw ApiError.badRequest('Anda tidak dapat menghapus akun yang sedang Anda gunakan.');
      }
      if (target.role === UserRole.SUPER_ADMIN) {
        const superAdmins = await col.list({
          filters: [{ field: 'role', op: '==', value: UserRole.SUPER_ADMIN }],
        });
        if (superAdmins.items.length <= 1) {
          throw ApiError.badRequest('Minimal harus ada 1 akun Super Admin yang aktif di sistem.');
        }
      }

      // Safely unlink teacher profile without deleting any teacher data
      const teacherIdsToUnlink = new Set<string>();
      if (target.linkedTeacherId) {
        teacherIdsToUnlink.add(target.linkedTeacherId);
      }
      const linkedTeachers = await teacherCol.list({
        filters: [{ field: 'userId', op: '==', value: target.id }],
      });
      for (const teacher of linkedTeachers.items) {
        teacherIdsToUnlink.add(teacher.id);
      }

      for (const teacherId of teacherIdsToUnlink) {
        await teacherCol.update(teacherId, { userId: null }).catch(() => undefined);
      }

      await revokeAllUserSessions(repo, target.id);
      await releaseUniqueUsername(repo, target.normalizedUsername).catch(() => undefined);
      await col.delete(target.id);

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: target.id,
        before: {
          username: target.username,
          role: target.role,
          linkedTeacherId: target.linkedTeacherId,
        },
        after: {
          deleted: true,
          returnedToTeacherIds: Array.from(teacherIdsToUnlink),
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, {
        deleted: true,
        id: target.id,
        username: target.username,
        unlinkedTeacherId: target.linkedTeacherId ?? null,
      });
      return;
    }

    // PATCH /api/users/:id
    const parsed = userUpdateSchema.parse(req.body ?? {});

    if (parsed.role === UserRole.SUPER_ADMIN && auth.user.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Hanya Super Admin yang dapat menetapkan peran SUPER_ADMIN.');
    }
    if (
      auth.user.role === UserRole.PRINCIPAL &&
      parsed.role &&
      (parsed.role === UserRole.SUPER_ADMIN || parsed.role === UserRole.ADMIN)
    ) {
      throw ApiError.forbidden(
        'Kepala Sekolah tidak berwenang menaikkan peran menjadi SUPER_ADMIN atau ADMIN.',
      );
    }
    if (target.id === auth.user.id && parsed.isActive === false) {
      throw ApiError.badRequest('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }
    if (target.id === auth.user.id && parsed.role !== undefined && parsed.role !== target.role) {
      throw ApiError.badRequest('Anda tidak dapat mengubah peran akun Anda sendiri.');
    }

    const effectiveRole = parsed.role ?? target.role;
    const effectiveLinkedTeacherId =
      parsed.linkedTeacherId !== undefined ? parsed.linkedTeacherId : target.linkedTeacherId;

    const appSettings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
    const requireLinkedTeacher = appSettings?.requireUserLinkedToTeacher ?? true;

    const isModifyingRoleOrTeacherLink =
      parsed.role !== undefined || parsed.linkedTeacherId !== undefined;

    if (
      isModifyingRoleOrTeacherLink &&
      requireLinkedTeacher &&
      effectiveRole !== UserRole.SUPER_ADMIN &&
      !effectiveLinkedTeacherId
    ) {
      throw ApiError.badRequest(
        'Pengaturan mewajibkan akun peran ini ditautkan ke profil guru aktif.',
      );
    }

    if (effectiveLinkedTeacherId && parsed.linkedTeacherId !== undefined) {
      const nextTeacher = await teacherCol.getById(effectiveLinkedTeacherId);
      if (!nextTeacher) {
        throw ApiError.badRequest('Profil guru yang ditautkan tidak ditemukan.');
      }
      if (nextTeacher.userId && nextTeacher.userId !== target.id) {
        const existingOwner = await col.getById(nextTeacher.userId);
        if (existingOwner) {
          throw ApiError.conflict(
            `Profil guru "${nextTeacher.fullName}" sudah tertaut ke akun "${existingOwner.username}".`,
          );
        }
      }
    }

    let usernamePatch: { username?: string; normalizedUsername?: string } = {};
    let reservedNewNormalizedUsername: string | null = null;
    if (parsed.username !== undefined) {
      const nextTrimmed = parsed.username.trim();
      const nextNormalized = normalizeUsername(nextTrimmed);
      if (nextNormalized.length < 3) {
        throw ApiError.badRequest('Username minimal 3 karakter.');
      }
      if (nextNormalized !== target.normalizedUsername) {
        reservedNewNormalizedUsername = await reserveUniqueUsername(repo, nextTrimmed, target.id);
        usernamePatch = {
          username: nextTrimmed,
          normalizedUsername: reservedNewNormalizedUsername,
        };
      } else if (nextTrimmed !== target.username) {
        usernamePatch = {
          username: nextTrimmed,
        };
      }
    }

    let passwordPatch: Record<string, unknown> = {};
    const passwordChanged = Boolean(parsed.password && parsed.password.length >= 6);
    if (passwordChanged && parsed.password) {
      const nextHash = await hashPassword(parsed.password);
      passwordPatch = {
        passwordHash: nextHash,
        passwordCipher: encryptPasswordForAdminView(parsed.password),
        failedLoginCount: 0,
        lockedUntil: null,
      };
    }

    const nextMustChange =
      parsed.mustChangePassword !== undefined
        ? effectiveRole === UserRole.TEACHER
          ? false
          : parsed.mustChangePassword
        : undefined;

    let updated;
    try {
      updated = await col.update(id, {
        ...usernamePatch,
        ...(parsed.role !== undefined ? { role: parsed.role } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.linkedTeacherId !== undefined
          ? { linkedTeacherId: parsed.linkedTeacherId }
          : {}),
        ...(nextMustChange !== undefined ? { mustChangePassword: nextMustChange } : {}),
        ...passwordPatch,
      });
    } catch (err) {
      if (reservedNewNormalizedUsername) {
        await releaseUniqueUsername(repo, reservedNewNormalizedUsername).catch(() => undefined);
      }
      throw err;
    }

    if (!updated) {
      if (reservedNewNormalizedUsername) {
        await releaseUniqueUsername(repo, reservedNewNormalizedUsername).catch(() => undefined);
      }
      throw ApiError.notFound('Akun pengguna tidak ditemukan.');
    }

    if (reservedNewNormalizedUsername && target.normalizedUsername !== reservedNewNormalizedUsername) {
      await releaseUniqueUsername(repo, target.normalizedUsername).catch(() => undefined);
    }

    if (parsed.linkedTeacherId !== undefined && parsed.linkedTeacherId !== target.linkedTeacherId) {
      if (target.linkedTeacherId) {
        await teacherCol.update(target.linkedTeacherId, { userId: null }).catch(() => undefined);
      }
      if (parsed.linkedTeacherId) {
        await teacherCol.update(parsed.linkedTeacherId, { userId: target.id });
      }
    }

    if (
      parsed.isActive === false ||
      (parsed.role && parsed.role !== target.role) ||
      ((passwordChanged || Boolean(reservedNewNormalizedUsername)) && target.id !== auth.user.id)
    ) {
      await revokeAllUserSessions(repo, target.id);
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: target.id,
      before: {
        username: target.username,
        role: target.role,
        isActive: target.isActive,
        linkedTeacherId: target.linkedTeacherId,
      },
      after: {
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
        linkedTeacherId: updated.linkedTeacherId,
        ...(passwordChanged ? { passwordChangedDirectly: true } : {}),
      },
      clientIp: auth.clientIp,
    });

    const { passwordHash: _omitHash, passwordCipher: _omitCipher, ...safeUpdated } = updated;
    sendOk(res, safeUpdated);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleUserById(req, res);
}
