import crypto from 'node:crypto';
import { teacherUpdateSchema } from '../../src/lib/masterDataValidation';
import { CollectionName, QrOwnerType, TeacherStatus, UserRole } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import {
  encryptPasswordForAdminView,
  generateTemporaryPassword,
  hashPassword,
} from '../_lib/auth/password';
import { revokeAllUserSessions } from '../_lib/auth/session';
import {
  buildUsernameBaseFromName,
  findAvailableUsername,
  releaseUniqueUsername,
  reserveUniqueUsername,
} from '../_lib/auth/uniqueUsername';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

export async function handleTeacherById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID guru wajib diisi.');

    const teacherCol = repo.collection(CollectionName.TEACHERS);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const teacher = await teacherCol.getById(id);
      if (!teacher) throw ApiError.notFound('Data guru tidak ditemukan.');

      let username: string | null = null;
      let accountActive = false;
      if (teacher.userId) {
        const linked = await repo.collection(CollectionName.USERS).getById(teacher.userId);
        if (linked) {
          username = linked.username;
          accountActive = linked.isActive;
        }
      }

      sendOk(res, { ...teacher, username, accountActive });
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await teacherCol.getById(id);
      if (!existing) throw ApiError.notFound('Data guru tidak ditemukan.');

      const parsed = teacherUpdateSchema.parse(req.body ?? {});

      if (parsed.niyNip && parsed.niyNip !== existing.niyNip) {
        const dup = await teacherCol.findFirst([
          { field: 'niyNip', op: '==', value: parsed.niyNip },
        ]);
        if (dup && dup.id !== id) {
          throw ApiError.conflict(`NIY/NIP "${parsed.niyNip}" sudah terdaftar pada guru lain.`);
        }
      }

      let linkedUserId = existing.userId;
      let accountProvisioned:
        | { username: string; temporaryPassword: string; mustChangePassword: boolean }
        | undefined;

      if (parsed.createAccount && !existing.userId) {
        const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
        const desiredBase =
          parsed.username && parsed.username.trim().length >= 3
            ? parsed.username.trim()
            : await findAvailableUsername(
                repo,
                buildUsernameBaseFromName(parsed.fullName ?? existing.fullName),
              );

        const normalizedUsername = await reserveUniqueUsername(repo, desiredBase, userId);
        const temporaryPassword = generateTemporaryPassword(12);
        const passwordHash = await hashPassword(temporaryPassword);

        await repo.collection(CollectionName.USERS).create({
          id: userId,
          username: normalizedUsername,
          normalizedUsername,
          passwordHash,
          passwordCipher: encryptPasswordForAdminView(temporaryPassword),
          role: UserRole.TEACHER,
          linkedTeacherId: existing.id,
          isActive: true,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          createdBy: auth.user.id,
        });

        linkedUserId = userId;
        accountProvisioned = {
          username: normalizedUsername,
          temporaryPassword,
          mustChangePassword: false,
        };
      }

      const normalizedWorkingDays =
        parsed.workingDays === undefined
          ? undefined
          : parsed.workingDays === null || parsed.workingDays.length === 0
            ? null
            : Array.from(new Set(parsed.workingDays)).sort((a, b) => a - b);

      const updated = await teacherCol.update(id, {
        ...(parsed.niyNip !== undefined ? { niyNip: parsed.niyNip } : {}),
        ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
        ...(parsed.position !== undefined ? { position: parsed.position } : {}),
        ...(parsed.photoPath !== undefined ? { photoPath: parsed.photoPath } : {}),
        ...(normalizedWorkingDays !== undefined ? { workingDays: normalizedWorkingDays } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(linkedUserId !== existing.userId ? { userId: linkedUserId } : {}),
      });

      // Sync linked user active status when teacher is archived/reactivated
      if (parsed.status !== undefined && linkedUserId) {
        const isActive = parsed.status === TeacherStatus.ACTIVE;
        await repo.collection(CollectionName.USERS).update(linkedUserId, { isActive });
        if (!isActive) {
          await revokeAllUserSessions(repo, linkedUserId);
        }
      }

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'TEACHER_UPDATED',
        entityType: 'TEACHER',
        entityId: id,
        before: {
          niyNip: existing.niyNip,
          fullName: existing.fullName,
          position: existing.position,
          workingDays: existing.workingDays ?? null,
          status: existing.status,
        },
        after: {
          niyNip: updated?.niyNip,
          fullName: updated?.fullName,
          position: updated?.position,
          workingDays: updated?.workingDays ?? null,
          status: updated?.status,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, {
        teacher: updated,
        ...(accountProvisioned ? { accountProvisioned } : {}),
      });
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await teacherCol.getById(id);
      if (!existing) throw ApiError.notFound('Data guru tidak ditemukan.');

      const isPermanent = getQueryString(req, 'permanent') === 'true';
      if (isPermanent) {
        if (existing.userId && existing.userId === auth.user.id) {
          throw ApiError.badRequest(
            'Tidak dapat menghapus data guru yang terhubung dengan akun yang sedang aktif login.',
          );
        }

        const userCol = repo.collection(CollectionName.USERS);
        const qrCol = repo.collection(CollectionName.QR_TOKENS);
        const classCol = repo.collection(CollectionName.CLASSES);
        const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);

        const [qrTokens, classesRes, schedulesRes] = await Promise.all([
          qrCol.list({
            filters: [
              { field: 'ownerType', op: '==', value: QrOwnerType.TEACHER },
              { field: 'ownerId', op: '==', value: id },
            ],
          }),
          classCol.list({ filters: [{ field: 'homeroomTeacherId', op: '==', value: id }] }),
          scheduleCol.list({ filters: [{ field: 'teacherId', op: '==', value: id }] }),
        ]);

        await Promise.all([
          ...qrTokens.items.map((qr) => qrCol.delete(qr.id)),
          ...classesRes.items.map((c) => classCol.update(c.id, { homeroomTeacherId: null })),
          ...schedulesRes.items.map((s) => scheduleCol.delete(s.id)),
        ]);

        if (existing.userId) {
          await revokeAllUserSessions(repo, existing.userId);
          const linkedUser = await userCol.getById(existing.userId);
          if (linkedUser) {
            await releaseUniqueUsername(repo, linkedUser.normalizedUsername);
            await userCol.delete(linkedUser.id);
          }
        }

        await teacherCol.delete(id);

        await recordActivityLog(repo, {
          actorUserId: auth.user.id,
          actorRole: auth.user.role,
          action: 'TEACHER_DELETED',
          entityType: 'TEACHER',
          entityId: id,
          before: { niyNip: existing.niyNip, fullName: existing.fullName },
          reason: 'Dihapus permanen oleh admin.',
          clientIp: auth.clientIp,
        });

        sendOk(res, { deleted: true, id });
        return;
      }

      const archived = await teacherCol.update(id, { status: TeacherStatus.INACTIVE });
      if (existing.userId) {
        await repo.collection(CollectionName.USERS).update(existing.userId, { isActive: false });
        await revokeAllUserSessions(repo, existing.userId);
      }

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'TEACHER_ARCHIVED',
        entityType: 'TEACHER',
        entityId: id,
        before: { status: existing.status },
        after: { status: TeacherStatus.INACTIVE },
        reason: 'Diarsipkan oleh admin (tanpa penghapusan permanen).',
        clientIp: auth.clientIp,
      });

      sendOk(res, { archived: true, teacher: archived });
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
  await handleTeacherById(req, res);
}
