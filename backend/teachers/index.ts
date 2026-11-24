import crypto from 'node:crypto';
import { teacherCreateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  encryptPasswordForAdminView,
  hashPassword,
} from '../_lib/auth/password';
import {
  buildUsernameBaseFromName,
  findAvailableUsername,
  reserveUniqueUsername,
} from '../_lib/auth/uniqueUsername';
import {
  getQueryInt,
  getQueryString,
  MASTER_READ_ROLES,
  MASTER_WRITE_ROLES,
  paginateArrayByCursor,
} from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleTeachers(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const teacherCol = repo.collection(CollectionName.TEACHERS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

      const search = getQueryString(req, 'search').toLowerCase();
      const status = getQueryString(req, 'status');
      const cursor = getQueryString(req, 'cursor');
      const limit = getQueryInt(req, 'limit', 10, 1, 1000);

      const [teachersRes, usersRes] = await Promise.all([
        teacherCol.list({ sort: { field: 'fullName', direction: 'asc' } }),
        repo.collection(CollectionName.USERS).list(),
      ]);

      // Map safe user metadata ONLY — NEVER expose passwordHash
      const userById = new Map(
        usersRes.items.map((u) => [
          u.id,
          {
            id: u.id,
            username: u.username,
            role: u.role,
            isActive: u.isActive,
            mustChangePassword: u.mustChangePassword,
          },
        ]),
      );

      const filtered = teachersRes.items
        .filter((t) => {
          if (status && t.status !== status) return false;
          if (search) {
            const linked = t.userId ? userById.get(t.userId) : null;
            if (
              !t.fullName.toLowerCase().includes(search) &&
              !t.niyNip.toLowerCase().includes(search) &&
              !t.position.toLowerCase().includes(search) &&
              !(linked?.username.toLowerCase().includes(search) ?? false)
            ) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => {
          const aIsPrincipal = a.position.toLowerCase().includes('kepala sekolah') ? 0 : 1;
          const bIsPrincipal = b.position.toLowerCase().includes('kepala sekolah') ? 0 : 1;
          if (aIsPrincipal !== bIsPrincipal) return aIsPrincipal - bIsPrincipal;
          return a.fullName.localeCompare(b.fullName, 'id');
        })
        .map((t) => {
          const linked = t.userId ? userById.get(t.userId) ?? null : null;
          return {
            ...t,
            username: linked?.username ?? null,
            accountRole: linked?.role ?? null,
            accountActive: linked?.isActive ?? false,
            mustChangePassword: linked?.mustChangePassword ?? false,
          };
        });

      const paginated = paginateArrayByCursor(filtered, cursor, limit);
      sendOk(res, paginated);
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = teacherCreateSchema.parse(req.body ?? {});

      const duplicate = await teacherCol.findFirst([
        { field: 'niyNip', op: '==', value: parsed.niyNip },
      ]);
      if (duplicate) {
        throw ApiError.conflict(`NIY/NIP "${parsed.niyNip}" sudah terdaftar pada guru lain.`);
      }

      let createdUserId: string | null = null;
      let createdUsername: string | null = null;

      const teacherId = `tch_${crypto.randomBytes(6).toString('hex')}`;

      if (parsed.createAccount) {
        if (!parsed.password || parsed.password.length < 6) {
          throw ApiError.badRequest('Kata sandi akun guru wajib diisi minimal 6 karakter.');
        }

        const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
        const desiredBase =
          parsed.username && parsed.username.trim().length >= 3
            ? parsed.username.trim()
            : await findAvailableUsername(repo, buildUsernameBaseFromName(parsed.fullName));

        const normalizedUsername = await reserveUniqueUsername(repo, desiredBase, userId);
        const passwordHash = await hashPassword(parsed.password);

        await repo.collection(CollectionName.USERS).create({
          id: userId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher: encryptPasswordForAdminView(parsed.password),
          role: UserRole.TEACHER,
          linkedTeacherId: teacherId,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          createdBy: auth.user.id,
        });

        createdUserId = userId;
        createdUsername = normalizedUsername;
      }

      const normalizedWorkingDays =
        parsed.workingDays && parsed.workingDays.length > 0
          ? Array.from(new Set(parsed.workingDays)).sort((a, b) => a - b)
          : null;

      const created = await teacherCol.create({
        id: teacherId,
        niyNip: parsed.niyNip,
        fullName: parsed.fullName,
        position: parsed.position,
        photoPath: parsed.photoPath ?? null,
        userId: createdUserId,
        qrTokenId: null,
        ...(normalizedWorkingDays ? { workingDays: normalizedWorkingDays } : {}),
        status: parsed.status,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'TEACHER_CREATED',
        entityType: 'TEACHER',
        entityId: created.id,
        after: {
          niyNip: created.niyNip,
          fullName: created.fullName,
          position: created.position,
          hasAccount: Boolean(createdUserId),
        },
        clientIp: auth.clientIp,
      });

      sendOk(
        res,
        {
          teacher: {
            ...created,
            username: createdUsername,
            accountActive: Boolean(createdUserId),
          },
          ...(createdUsername
            ? {
                accountProvisioned: {
                  username: createdUsername,
                  mustChangePassword: false,
                },
              }
            : {}),
        },
        201,
      );
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
  await handleTeachers(req, res);
}
