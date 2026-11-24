import { userCreateSchema } from '../../src/lib/adminSettingsValidation';
import { CollectionName, UserRole, type SafeUser } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  decryptPasswordForAdminView,
  encryptPasswordForAdminView,
  hashPassword,
} from '../_lib/auth/password';
import { reserveUniqueUsername } from '../_lib/auth/uniqueUsername';
import { getQueryString } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const USER_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

const USER_MANAGE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export interface EnrichedUserAccount extends SafeUser {
  linkedTeacherName: string | null;
  linkedTeacherPosition: string | null;
  currentPassword: string | null;
}

function canViewOrManageTarget(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === UserRole.SUPER_ADMIN) return true;
  if (actorRole === UserRole.ADMIN) return targetRole !== UserRole.SUPER_ADMIN;
  if (actorRole === UserRole.PRINCIPAL) {
    return targetRole !== UserRole.SUPER_ADMIN && targetRole !== UserRole.ADMIN;
  }
  return false;
}

function getUserRoleSortOrder(role: UserRole): number {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 0;
    case UserRole.PRINCIPAL:
      return 1;
    case UserRole.ADMIN:
    case UserRole.OPERATOR:
      return 2;
    case UserRole.TEACHER:
    default:
      return 3;
  }
}

/**
 * GET /api/users — Lists accounts (NEVER returns `passwordHash`).
 * POST /api/users — Creates a new user account with uniqueUsername reservation.
 *   RBAC: Only SUPER_ADMIN can create SUPER_ADMIN; PRINCIPAL cannot manage SUPER_ADMIN or ADMIN.
 */
export async function handleUsers(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const userCol = repo.collection(CollectionName.USERS);

    if (req.method === 'GET') {
      const auth = await requireAuth(req, { repo, allowedRoles: USER_READ_ROLES });
      const roleFilter = getQueryString(req, 'role');
      const statusFilter = getQueryString(req, 'isActive');
      const search = (getQueryString(req, 'search') ?? '').toLowerCase();

      const [usersRes, teachersRes] = await Promise.all([
        userCol.list({ sort: { field: 'createdAt', direction: 'desc' } }),
        repo.collection(CollectionName.TEACHERS).list(),
      ]);

      const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t]));

      const items: EnrichedUserAccount[] = usersRes.items
        .map(({ passwordHash: _omitHash, passwordCipher, ...safe }) => {
          const teacher = safe.linkedTeacherId ? teacherMap.get(safe.linkedTeacherId) : undefined;
          const canViewPw = canViewOrManageTarget(auth.user.role, safe.role);
          return {
            ...safe,
            linkedTeacherName: teacher?.fullName ?? null,
            linkedTeacherPosition: teacher?.position ?? null,
            currentPassword: canViewPw ? decryptPasswordForAdminView(passwordCipher) : null,
          };
        })
        .filter((u) => {
          if (roleFilter && u.role !== roleFilter) return false;
          if (statusFilter === 'true' && !u.isActive) return false;
          if (statusFilter === 'false' && u.isActive) return false;
          if (search) {
            const hay =
              `${u.username} ${u.linkedTeacherName ?? ''} ${u.linkedTeacherPosition ?? ''} ${u.role}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const rankDiff = getUserRoleSortOrder(a.role) - getUserRoleSortOrder(b.role);
          if (rankDiff !== 0) return rankDiff;
          const aLabel = a.linkedTeacherName ?? a.username;
          const bLabel = b.linkedTeacherName ?? b.username;
          return aLabel.localeCompare(bLabel, 'id');
        });

      sendOk(res, {
        items,
        total: items.length,
        actorRole: auth.user.role,
      });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: USER_MANAGE_ROLES });
      const parsed = userCreateSchema.parse(req.body ?? {});

      if (parsed.role === UserRole.SUPER_ADMIN && auth.user.role !== UserRole.SUPER_ADMIN) {
        throw ApiError.forbidden('Hanya Super Admin yang berwenang membuat akun SUPER_ADMIN.');
      }
      if (
        auth.user.role === UserRole.PRINCIPAL &&
        (parsed.role === UserRole.SUPER_ADMIN || parsed.role === UserRole.ADMIN)
      ) {
        throw ApiError.forbidden(
          'Kepala Sekolah tidak berwenang mengelola akun SUPER_ADMIN atau ADMIN.',
        );
      }

      const appSettings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
      const requireLinkedTeacher = appSettings?.requireUserLinkedToTeacher ?? true;

      if (
        requireLinkedTeacher &&
        parsed.role !== UserRole.SUPER_ADMIN &&
        !parsed.linkedTeacherId
      ) {
        throw ApiError.badRequest(
          'Pengaturan mewajibkan akun peran ini ditautkan ke profil guru aktif.',
        );
      }

      if (parsed.linkedTeacherId) {
        const teacher = await repo
          .collection(CollectionName.TEACHERS)
          .getById(parsed.linkedTeacherId);
        if (!teacher) {
          throw ApiError.badRequest('Profil guru yang ditautkan tidak ditemukan.');
        }
        if (teacher.userId) {
          const existingOwner = await userCol.getById(teacher.userId);
          if (existingOwner) {
            throw ApiError.conflict(
              `Profil guru "${teacher.fullName}" sudah tertaut ke akun "${existingOwner.username}".`,
            );
          }
        }
      }

      const normalizedUsername = parsed.username.trim().toLowerCase();
      const passwordHash = await hashPassword(parsed.password);
      const mustChangePassword =
        parsed.role === UserRole.TEACHER ? false : parsed.mustChangePassword;
      const created = await userCol.create({
        username: parsed.username.trim(),
        normalizedUsername,
        passwordHash,
        passwordCipher: encryptPasswordForAdminView(parsed.password),
        role: parsed.role,
        linkedTeacherId: parsed.linkedTeacherId ?? null,
        isActive: parsed.isActive,
        mustChangePassword,
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        createdBy: auth.user.id,
      });

      try {
        await reserveUniqueUsername(repo, parsed.username.trim(), created.id);
      } catch (err) {
        await userCol.delete(created.id);
        throw err;
      }

      if (parsed.linkedTeacherId) {
        await repo
          .collection(CollectionName.TEACHERS)
          .update(parsed.linkedTeacherId, { userId: created.id });
      }

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: created.id,
        after: {
          username: created.username,
          role: created.role,
          isActive: created.isActive,
          linkedTeacherId: created.linkedTeacherId,
        },
        clientIp: auth.clientIp,
      });

      const { passwordHash: _omitHash, passwordCipher: _omitCipher, ...safeCreated } = created;
      sendOk(res, safeCreated, 201);
      return;
    }

    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleUsers(req, res);
}
