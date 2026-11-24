import { parseTimeToMinutes } from '../../src/lib/date';
import { teachingScheduleUpdateSchema } from '../../src/lib/scheduleRulesValidation';
import { CollectionName } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { checkScheduleConflicts } from './index';

export async function handleScheduleById(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  idOverride?: string,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const id = idOverride ?? getQueryString(req, 'id');
    if (!id) throw ApiError.badRequest('ID jadwal wajib diisi.');

    const col = repo.collection(CollectionName.TEACHING_SCHEDULES);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });
      const item = await col.getById(id);
      if (!item) throw ApiError.notFound('Jadwal mengajar tidak ditemukan.');
      sendOk(res, item);
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Jadwal mengajar tidak ditemukan.');

      const parsed = teachingScheduleUpdateSchema.parse(req.body ?? {});

      const nextTeacherId = parsed.teacherId ?? existing.teacherId;
      const nextSubjectId = parsed.subjectId ?? existing.subjectId;
      const nextClassId = parsed.classId ?? existing.classId;
      const nextDay = parsed.dayOfWeek ?? existing.dayOfWeek;
      const nextStart = parsed.startTime ?? existing.startTime;
      const nextEnd = parsed.endTime ?? existing.endTime;
      const nextFrom = parsed.effectiveFrom
        ? new Date(parsed.effectiveFrom).toISOString()
        : existing.effectiveFrom;
      const nextUntil =
        parsed.effectiveUntil !== undefined
          ? parsed.effectiveUntil
            ? new Date(parsed.effectiveUntil).toISOString()
            : null
          : existing.effectiveUntil;
      const nextActive = parsed.isActive ?? existing.isActive;

      if (parseTimeToMinutes(nextEnd) <= parseTimeToMinutes(nextStart)) {
        throw ApiError.badRequest('Jam selesai harus setelah jam mulai.');
      }

      const allSchedules = await col.list();
      const conflict = checkScheduleConflicts(
        {
          id,
          teacherId: nextTeacherId,
          classId: nextClassId,
          dayOfWeek: nextDay,
          startTime: nextStart,
          endTime: nextEnd,
          effectiveFrom: nextFrom,
          effectiveUntil: nextUntil,
          isActive: nextActive,
        },
        allSchedules.items,
      );

      if (conflict) {
        const msg =
          conflict.conflictType === 'TEACHER'
            ? `Jadwal bentrok dengan jadwal mengajar guru lain pada pukul ${conflict.conflictSchedule.startTime}–${conflict.conflictSchedule.endTime} WIB.`
            : `Jadwal bentrok dengan jadwal kelas pada pukul ${conflict.conflictSchedule.startTime}–${conflict.conflictSchedule.endTime} WIB.`;
        throw ApiError.conflict(msg, { conflictType: conflict.conflictType });
      }

      const updated = await col.update(id, {
        teacherId: nextTeacherId,
        subjectId: nextSubjectId,
        classId: nextClassId,
        dayOfWeek: nextDay,
        startTime: nextStart,
        endTime: nextEnd,
        room: parsed.room !== undefined ? parsed.room : existing.room,
        effectiveFrom: nextFrom,
        effectiveUntil: nextUntil,
        isActive: nextActive,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHEDULE_UPDATED',
        entityType: 'TEACHING_SCHEDULE',
        entityId: id,
        before: {
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          isActive: existing.isActive,
        },
        after: {
          dayOfWeek: updated?.dayOfWeek,
          startTime: updated?.startTime,
          endTime: updated?.endTime,
          isActive: updated?.isActive,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, updated);
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const existing = await col.getById(id);
      if (!existing) throw ApiError.notFound('Jadwal mengajar tidak ditemukan.');

      const archived = await col.update(id, { isActive: false });
      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHEDULE_ARCHIVED',
        entityType: 'TEACHING_SCHEDULE',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        clientIp: auth.clientIp,
      });

      sendOk(res, { archived: true, schedule: archived });
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
  await handleScheduleById(req, res);
}
