import crypto from 'node:crypto';
import { generateUsersFromTeachersSchema } from '../../src/lib/adminSettingsValidation';
import { CollectionName, TeacherStatus, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { encryptPasswordForAdminView, hashPassword } from '../_lib/auth/password';
import {
  buildFirstNameUsernameBase,
  findAvailableUsername,
  reserveUniqueUsername,
} from '../_lib/auth/uniqueUsername';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const GENERATE_ALLOWED_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export interface GeneratedTeacherUserSummary {
  userId: string;
  teacherId: string;
  fullName: string;
  niyNip: string;
  position: string;
  role: UserRole.PRINCIPAL | UserRole.TEACHER;
  username: string;
  generatedPassword: string;
}

/**
 * POST /api/users/generate-from-teachers
 * Generates linked PRINCIPAL / TEACHER user accounts from selected teacher profiles:
 * - username = first name of teacher (lowercase alphanumeric, deduplicated if taken)
 * - password = `${username}123` (e.g. `imam` -> `imam123`)
 */
export async function handleGenerateUsersFromTeachers(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: GENERATE_ALLOWED_ROLES });
    const parsed = generateUsersFromTeachersSchema.parse(req.body ?? {});

    const teacherCol = repo.collection(CollectionName.TEACHERS);
    const userCol = repo.collection(CollectionName.USERS);

    const [teachersRes, usersRes] = await Promise.all([teacherCol.list(), userCol.list()]);
    const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t]));
    const existingUserById = new Map(usersRes.items.map((u) => [u.id, u]));
    const existingLinkedTeacherIds = new Set(
      usersRes.items.map((u) => u.linkedTeacherId).filter((id): id is string => Boolean(id)),
    );

    const seenTeacherIds = new Set<string>();
    const created: GeneratedTeacherUserSummary[] = [];
    const skipped: Array<{ teacherId: string; fullName: string; reason: string }> = [];

    for (const item of parsed.items) {
      if (seenTeacherIds.has(item.teacherId)) continue;
      seenTeacherIds.add(item.teacherId);

      const teacher = teacherMap.get(item.teacherId);
      if (!teacher) {
        skipped.push({
          teacherId: item.teacherId,
          fullName: item.teacherId,
          reason: 'Profil guru tidak ditemukan.',
        });
        continue;
      }

      if (teacher.status !== TeacherStatus.ACTIVE) {
        skipped.push({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          reason: 'Profil guru berstatus nonaktif/arsip.',
        });
        continue;
      }

      const alreadyLinked =
        existingLinkedTeacherIds.has(teacher.id) ||
        Boolean(teacher.userId && existingUserById.has(teacher.userId));
      if (alreadyLinked) {
        skipped.push({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          reason: 'Guru ini sudah memiliki akun pengguna tertaut.',
        });
        continue;
      }

      const targetRole: UserRole.PRINCIPAL | UserRole.TEACHER =
        item.role ??
        (teacher.position.toLowerCase().includes('kepala sekolah')
          ? UserRole.PRINCIPAL
          : UserRole.TEACHER);

      if (auth.user.role === UserRole.PRINCIPAL && targetRole === UserRole.PRINCIPAL) {
        throw ApiError.forbidden(
          'Kepala Sekolah hanya dapat men-generate akun Guru, bukan akun Kepala Sekolah.',
        );
      }

      try {
        const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
        let normalizedUsername: string;

        if (item.customUsername && item.customUsername.trim().length >= 3) {
          const cleanedCustom = item.customUsername.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
          normalizedUsername = await reserveUniqueUsername(repo, cleanedCustom, userId);
        } else {
          const base = buildFirstNameUsernameBase(teacher.fullName);
          const availableUsername = await findAvailableUsername(repo, base);
          normalizedUsername = await reserveUniqueUsername(repo, availableUsername, userId);
        }

        const generatedPassword =
          item.customPassword && item.customPassword.trim().length >= 6
            ? item.customPassword.trim()
            : `${normalizedUsername}123`;
        const passwordHash = await hashPassword(generatedPassword);
        const passwordCipher = encryptPasswordForAdminView(generatedPassword);

        await userCol.create({
          id: userId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher,
          role: targetRole,
          linkedTeacherId: teacher.id,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          createdBy: auth.user.id,
        });

        await teacherCol.update(teacher.id, { userId });
        existingLinkedTeacherIds.add(teacher.id);

        created.push({
          userId,
          teacherId: teacher.id,
          fullName: teacher.fullName,
          niyNip: teacher.niyNip,
          position: teacher.position,
          role: targetRole,
          username: normalizedUsername,
          generatedPassword,
        });
      } catch (itemErr) {
        skipped.push({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          reason: itemErr instanceof Error ? itemErr.message : 'Gagal membuat akun.',
        });
      }
    }

    if (created.length === 0) {
      throw ApiError.badRequest(
        skipped[0]?.reason ?? 'Tidak ada akun baru yang dapat dibuat dari data guru terpilih.',
      );
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'USERS_GENERATED_FROM_TEACHERS',
      entityType: 'USER',
      entityId: 'batch-generate',
      after: {
        createdCount: created.length,
        skippedCount: skipped.length,
        usernames: created.map((c) => c.username),
      },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        created,
        skipped,
        createdCount: created.length,
      },
      201,
    );
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleGenerateUsersFromTeachers(req, res);
}
