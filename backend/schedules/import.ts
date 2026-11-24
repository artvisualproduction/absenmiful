import { parseTimeToMinutes } from '../../src/lib/date';
import {
  DAY_OF_WEEK_OPTIONS,
  teachingScheduleImportRequestSchema,
} from '../../src/lib/scheduleRulesValidation';
import { CollectionName, type TeachingSchedule } from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';
import { checkScheduleConflicts } from './index';

function parseBooleanInput(raw: boolean | string | undefined, defaultValue: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  const val = String(raw ?? '').trim().toUpperCase();
  if (!val) return defaultValue;
  if (['YA', 'Y', 'TRUE', '1', 'AKTIF', 'WALI', 'WALI KELAS'].includes(val)) return true;
  if (['TIDAK', 'NO', 'FALSE', '0', 'NONAKTIF'].includes(val)) return false;
  return defaultValue;
}

function parseDayOfWeek(raw: number | string): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 7) {
    return raw;
  }
  const str = String(raw ?? '').trim();
  if (!str) return null;
  if (/^[1-7]$/.test(str)) {
    return Number.parseInt(str, 10);
  }
  const upper = str.toUpperCase();
  const map: Record<string, number> = {
    SENIN: 1,
    SEN: 1,
    MONDAY: 1,
    SELASA: 2,
    SEL: 2,
    TUESDAY: 2,
    RABU: 3,
    RAB: 3,
    WEDNESDAY: 3,
    KAMIS: 4,
    KAM: 4,
    THURSDAY: 4,
    JUMAT: 5,
    "JUM'AT": 5,
    JUM: 5,
    FRIDAY: 5,
    SABTU: 6,
    SAB: 6,
    SATURDAY: 6,
    MINGGU: 7,
    AHAD: 7,
    MIN: 7,
    SUNDAY: 7,
  };
  return map[upper] ?? null;
}

function normalizeTimeHHMM(raw: string): string | null {
  const cleaned = raw.trim().replace(/\./g, ':');
  const m = cleaned.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (!m) return null;
  const h = Number.parseInt(m[1]!, 10);
  const min = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export interface ScheduleImportPreviewRow {
  rowNumber: number;
  className: string;
  classId: string | null;
  subjectLabel: string;
  subjectId: string | null;
  teacherName: string;
  teacherId: string | null;
  useHomeroomTeacher: boolean;
  dayOfWeek: number | null;
  dayLabel: string;
  startTime: string;
  endTime: string;
  room: string | null;
  isActive: boolean;
  valid: boolean;
  errors: string[];
}

export async function handleSchedulesImport(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = teachingScheduleImportRequestSchema.parse(req.body ?? {});

    const [classesRes, subjectsRes, teachersRes, schedulesRes] = await Promise.all([
      repo.collection(CollectionName.CLASSES).list(),
      repo.collection(CollectionName.SUBJECTS).list(),
      repo.collection(CollectionName.TEACHERS).list(),
      repo.collection(CollectionName.TEACHING_SCHEDULES).list(),
    ]);

    const classByName = new Map(classesRes.items.map((c) => [c.name.trim().toUpperCase(), c]));
    const subjectByCode = new Map(subjectsRes.items.map((s) => [s.code.trim().toUpperCase(), s]));
    const subjectByName = new Map(subjectsRes.items.map((s) => [s.name.trim().toUpperCase(), s]));
    const teacherById = new Map(teachersRes.items.map((t) => [t.id, t]));
    const teacherByNiy = new Map(teachersRes.items.map((t) => [t.niyNip.trim().toUpperCase(), t]));
    const teacherByName = new Map(teachersRes.items.map((t) => [t.fullName.trim().toUpperCase(), t]));

    const effectiveFromIso = parsed.effectiveFrom
      ? new Date(parsed.effectiveFrom).toISOString()
      : new Date().toISOString();

    const simulatedSchedules: TeachingSchedule[] = [...schedulesRes.items];
    const previewRows: ScheduleImportPreviewRow[] = [];

    for (let idx = 0; idx < parsed.rows.length; idx++) {
      const row = parsed.rows[idx]!;
      const errors: string[] = [];

      const classKey = row.className.trim().toUpperCase();
      const matchedClass = classByName.get(classKey) ?? null;
      if (!matchedClass) {
        errors.push(`Kelas "${row.className}" tidak ditemukan.`);
      }

      const subjectKey = row.subjectCodeOrName.trim().toUpperCase();
      const matchedSubject = subjectByCode.get(subjectKey) ?? subjectByName.get(subjectKey) ?? null;
      if (!matchedSubject) {
        errors.push(`Mata pelajaran "${row.subjectCodeOrName}" tidak ditemukan.`);
      }

      const dayNum = parseDayOfWeek(row.dayOfWeek);
      const dayLabel =
        DAY_OF_WEEK_OPTIONS.find((d) => d.value === dayNum)?.label ?? String(row.dayOfWeek);
      if (!dayNum) {
        errors.push(`Hari "${row.dayOfWeek}" tidak valid (gunakan Senin–Minggu atau 1–7).`);
      }

      const startTime = normalizeTimeHHMM(row.startTime);
      const endTime = normalizeTimeHHMM(row.endTime);
      if (!startTime) {
        errors.push(`Jam mulai "${row.startTime}" harus berformat HH:MM.`);
      }
      if (!endTime) {
        errors.push(`Jam selesai "${row.endTime}" harus berformat HH:MM.`);
      }
      if (startTime && endTime && parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
        errors.push('Jam selesai harus setelah jam mulai.');
      }

      const rawTeacher = (row.teacherNiyOrName ?? '').trim();
      const explicitHomeroom = parseBooleanInput(row.useHomeroomTeacher, false);
      const isHomeroomKeyword = ['WALI', 'WALI KELAS', 'WALIKELAS'].includes(rawTeacher.toUpperCase());
      const useHomeroomTeacher =
        explicitHomeroom ||
        isHomeroomKeyword ||
        (!rawTeacher && Boolean(matchedSubject?.defaultToHomeroomTeacher));

      let matchedTeacher = null;
      if (useHomeroomTeacher) {
        if (matchedClass?.homeroomTeacherId) {
          matchedTeacher = teacherById.get(matchedClass.homeroomTeacherId) ?? null;
          if (!matchedTeacher) {
            errors.push(`Data wali kelas untuk kelas ${matchedClass.name} tidak ditemukan.`);
          }
        } else if (matchedClass) {
          errors.push(
            `Kelas ${matchedClass.name} belum memiliki Wali Kelas yang ditetapkan di Data Kelas.`,
          );
        }
      } else {
        const teacherKey = rawTeacher.toUpperCase();
        matchedTeacher = teacherByNiy.get(teacherKey) ?? teacherByName.get(teacherKey) ?? null;
        if (!matchedTeacher) {
          errors.push(
            rawTeacher
              ? `Guru "${rawTeacher}" tidak ditemukan (gunakan NIY/NIP, nama lengkap, atau aktifkan Wali Kelas).`
              : 'Guru pengajar wajib diisi atau gunakan opsi Wali Kelas.',
          );
        }
      }

      const isActive = parseBooleanInput(row.isActive, true);
      const room = row.room?.trim() || null;

      if (
        errors.length === 0 &&
        matchedTeacher &&
        matchedSubject &&
        matchedClass &&
        dayNum &&
        startTime &&
        endTime
      ) {
        const conflict = checkScheduleConflicts(
          {
            teacherId: matchedTeacher.id,
            classId: matchedClass.id,
            dayOfWeek: dayNum,
            startTime,
            endTime,
            effectiveFrom: effectiveFromIso,
            effectiveUntil: null,
            isActive,
          },
          simulatedSchedules,
        );

        if (conflict) {
          errors.push(
            conflict.conflictType === 'TEACHER'
              ? `Bentrok jadwal guru ${matchedTeacher.fullName} pukul ${conflict.conflictSchedule.startTime}–${conflict.conflictSchedule.endTime}.`
              : `Bentrok jadwal kelas ${matchedClass.name} pukul ${conflict.conflictSchedule.startTime}–${conflict.conflictSchedule.endTime}.`,
          );
        } else if (isActive) {
          simulatedSchedules.push({
            id: `sim_${idx}`,
            teacherId: matchedTeacher.id,
            subjectId: matchedSubject.id,
            classId: matchedClass.id,
            dayOfWeek: dayNum,
            startTime,
            endTime,
            room,
            effectiveFrom: effectiveFromIso,
            effectiveUntil: null,
            isActive: true,
          });
        }
      }

      previewRows.push({
        rowNumber: idx + 1,
        className: matchedClass?.name ?? row.className,
        classId: matchedClass?.id ?? null,
        subjectLabel: matchedSubject ? `${matchedSubject.code} — ${matchedSubject.name}` : row.subjectCodeOrName,
        subjectId: matchedSubject?.id ?? null,
        teacherName: matchedTeacher?.fullName ?? (useHomeroomTeacher ? 'Wali Kelas' : row.teacherNiyOrName || '-'),
        teacherId: matchedTeacher?.id ?? null,
        useHomeroomTeacher,
        dayOfWeek: dayNum,
        dayLabel,
        startTime: startTime ?? row.startTime,
        endTime: endTime ?? row.endTime,
        room,
        isActive,
        valid: errors.length === 0,
        errors,
      });
    }

    const validCount = previewRows.filter((r) => r.valid).length;
    const invalidCount = previewRows.length - validCount;

    if (parsed.mode === 'preview') {
      sendOk(res, {
        mode: 'preview',
        total: previewRows.length,
        validCount,
        invalidCount,
        rows: previewRows,
      });
      return;
    }

    if (invalidCount > 0) {
      throw ApiError.badRequest(
        `Impor dibatalkan karena masih terdapat ${invalidCount} baris jadwal tidak valid atau bentrok.`,
        { previewRows, invalidCount },
      );
    }

    const scheduleCol = repo.collection(CollectionName.TEACHING_SCHEDULES);
    const createdItems = await Promise.all(
      previewRows.map((row) =>
        scheduleCol.create({
          teacherId: row.teacherId!,
          subjectId: row.subjectId!,
          classId: row.classId!,
          dayOfWeek: row.dayOfWeek!,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
          effectiveFrom: effectiveFromIso,
          effectiveUntil: null,
          isActive: row.isActive,
          createdBy: auth.user.id,
        }),
      ),
    );

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'SCHEDULES_IMPORTED',
      entityType: 'TEACHING_SCHEDULE',
      entityId: 'bulk_import',
      after: { count: createdItems.length },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        mode: 'commit',
        importedCount: createdItems.length,
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
  await handleSchedulesImport(req, res);
}
