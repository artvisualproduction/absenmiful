import { parseTimeToMinutes } from '../../src/lib/date';
import { teachingScheduleCreateSchema } from '../../src/lib/scheduleRulesValidation';
import { CollectionName, type TeachingSchedule } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { getQueryString, MASTER_READ_ROLES, MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

function effectiveRangesOverlap(
  fromA: string,
  untilA: string | null,
  fromB: string,
  untilB: string | null,
): boolean {
  const startA = new Date(fromA).getTime();
  const endA = untilA ? new Date(untilA).getTime() : Number.POSITIVE_INFINITY;
  const startB = new Date(fromB).getTime();
  const endB = untilB ? new Date(untilB).getTime() : Number.POSITIVE_INFINITY;
  return startA <= endB && startB <= endA;
}

export function checkScheduleConflicts(
  candidate: {
    id?: string;
    teacherId: string;
    classId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
    isActive: boolean;
  },
  existingSchedules: TeachingSchedule[],
): { conflictType: 'TEACHER' | 'CLASS'; conflictSchedule: TeachingSchedule } | null {
  if (!candidate.isActive) return null;

  const candStart = parseTimeToMinutes(candidate.startTime);
  const candEnd = parseTimeToMinutes(candidate.endTime);

  for (const item of existingSchedules) {
    if (!item.isActive) continue;
    if (candidate.id && item.id === candidate.id) continue;
    if (item.dayOfWeek !== candidate.dayOfWeek) continue;

    if (
      !effectiveRangesOverlap(
        candidate.effectiveFrom,
        candidate.effectiveUntil,
        item.effectiveFrom,
        item.effectiveUntil,
      )
    ) {
      continue;
    }

    const itemStart = parseTimeToMinutes(item.startTime);
    const itemEnd = parseTimeToMinutes(item.endTime);
    const timeOverlaps = candStart < itemEnd && itemStart < candEnd;
    if (!timeOverlaps) continue;

    if (item.teacherId === candidate.teacherId) {
      return { conflictType: 'TEACHER', conflictSchedule: item };
    }
    if (item.classId === candidate.classId) {
      return { conflictType: 'CLASS', conflictSchedule: item };
    }
  }

  return null;
}

export async function handleSchedules(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    const col = repo.collection(CollectionName.TEACHING_SCHEDULES);

    if (req.method === 'GET') {
      await requireAuth(req, { repo, allowedRoles: MASTER_READ_ROLES });

      const teacherId = getQueryString(req, 'teacherId');
      const classId = getQueryString(req, 'classId');
      const dayParam = getQueryString(req, 'dayOfWeek');
      const activeParam = getQueryString(req, 'isActive');

      const [schedulesRes, teachersRes, subjectsRes, classesRes] = await Promise.all([
        col.list({ sort: { field: 'startTime', direction: 'asc' } }),
        repo.collection(CollectionName.TEACHERS).list(),
        repo.collection(CollectionName.SUBJECTS).list(),
        repo.collection(CollectionName.CLASSES).list(),
      ]);

      const teacherMap = new Map(teachersRes.items.map((t) => [t.id, t.fullName]));
      const subjectMap = new Map(subjectsRes.items.map((s) => [s.id, { name: s.name, code: s.code }]));
      const classMap = new Map(classesRes.items.map((c) => [c.id, c.name]));

      const filtered = schedulesRes.items
        .filter((s) => {
          if (teacherId && s.teacherId !== teacherId) return false;
          if (classId && s.classId !== classId) return false;
          if (dayParam && String(s.dayOfWeek) !== dayParam) return false;
          if (activeParam === 'true' && !s.isActive) return false;
          if (activeParam === 'false' && s.isActive) return false;
          return true;
        })
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
        .map((s) => ({
          ...s,
          teacherName: teacherMap.get(s.teacherId) ?? '-',
          subjectName: subjectMap.get(s.subjectId)?.name ?? '-',
          subjectCode: subjectMap.get(s.subjectId)?.code ?? '-',
          className: classMap.get(s.classId) ?? '-',
        }));

      sendOk(res, { items: filtered, total: filtered.length });
      return;
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
      const parsed = teachingScheduleCreateSchema.parse(req.body ?? {});

      if (parseTimeToMinutes(parsed.endTime) <= parseTimeToMinutes(parsed.startTime)) {
        throw ApiError.badRequest('Jam selesai harus setelah jam mulai.');
      }

      const [teacher, subject, schoolClass, allSchedules] = await Promise.all([
        repo.collection(CollectionName.TEACHERS).getById(parsed.teacherId),
        repo.collection(CollectionName.SUBJECTS).getById(parsed.subjectId),
        repo.collection(CollectionName.CLASSES).getById(parsed.classId),
        col.list(),
      ]);

      if (!teacher) throw ApiError.badRequest('Guru tidak ditemukan.');
      if (!subject) throw ApiError.badRequest('Mata pelajaran tidak ditemukan.');
      if (!schoolClass) throw ApiError.badRequest('Kelas tidak ditemukan.');

      const effectiveFromIso = new Date(parsed.effectiveFrom).toISOString();
      const effectiveUntilIso = parsed.effectiveUntil
        ? new Date(parsed.effectiveUntil).toISOString()
        : null;

      if (
        effectiveUntilIso &&
        new Date(effectiveUntilIso).getTime() < new Date(effectiveFromIso).getTime()
      ) {
        throw ApiError.badRequest('Tanggal berakhir tidak boleh sebelum tanggal mulai berlaku.');
      }

      const conflict = checkScheduleConflicts(
        {
          teacherId: parsed.teacherId,
          classId: parsed.classId,
          dayOfWeek: parsed.dayOfWeek,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          effectiveFrom: effectiveFromIso,
          effectiveUntil: effectiveUntilIso,
          isActive: parsed.isActive,
        },
        allSchedules.items,
      );

      if (conflict) {
        const msg =
          conflict.conflictType === 'TEACHER'
            ? `Jadwal bentrok: guru ${teacher.fullName} sudah memiliki jadwal mengajar pada pukul ${conflict.conflictSchedule.startTime}–${conflict.conflictSchedule.endTime} WIB.`
            : `Jadwal bentrok: kelas ${schoolClass.name} sudah memiliki pelajaran pada pukul ${conflict.conflictSchedule.startTime}–${conflict.conflictSchedule.endTime} WIB.`;
        throw ApiError.conflict(msg, { conflictType: conflict.conflictType });
      }

      const created = await col.create({
        teacherId: parsed.teacherId,
        subjectId: parsed.subjectId,
        classId: parsed.classId,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        room: parsed.room ?? null,
        effectiveFrom: effectiveFromIso,
        effectiveUntil: effectiveUntilIso,
        isActive: parsed.isActive,
        createdBy: auth.user.id,
      });

      await recordActivityLog(repo, {
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        action: 'SCHEDULE_CREATED',
        entityType: 'TEACHING_SCHEDULE',
        entityId: created.id,
        after: {
          teacherId: created.teacherId,
          classId: created.classId,
          dayOfWeek: created.dayOfWeek,
          startTime: created.startTime,
          endTime: created.endTime,
        },
        clientIp: auth.clientIp,
      });

      sendOk(res, created, 201);
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
  await handleSchedules(req, res);
}
