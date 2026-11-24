import crypto from 'node:crypto';
import { manualExceptionAttendanceSchema } from '../../src/lib/teacherAttendanceValidation';
import {
  AttendanceMethod,
  CollectionName,
  QrOwnerType,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { MASTER_WRITE_ROLES } from '../_lib/masterDataRoles';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

/**
 * POST /api/attendance/manual-exception
 * Admin-only exception pathway when device GPS fails.
 * Requires mandatory reason (min 8 chars) and writes an immutable audit log.
 */
export async function handleManualExceptionAttendance(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, { repo, allowedRoles: MASTER_WRITE_ROLES });
    const parsed = manualExceptionAttendanceSchema.parse(req.body ?? {});

    let personNameSnapshot = '';
    let nisSnapshot: string | null = null;
    let niyNipSnapshot: string | null = null;
    let classIdSnapshot: string | null = null;
    let classNameSnapshot: string | null = null;

    if (parsed.personType === QrOwnerType.TEACHER) {
      const teacher = await repo.collection(CollectionName.TEACHERS).getById(parsed.personId);
      if (!teacher) throw ApiError.notFound('Guru tidak ditemukan.');
      personNameSnapshot = teacher.fullName;
      niyNipSnapshot = teacher.niyNip;
    } else {
      const student = await repo.collection(CollectionName.STUDENTS).getById(parsed.personId);
      if (!student) throw ApiError.notFound('Siswa tidak ditemukan.');
      personNameSnapshot = student.fullName;
      nisSnapshot = student.nis;
      classIdSnapshot = student.classId;
      const cls = await repo.collection(CollectionName.CLASSES).getById(student.classId);
      classNameSnapshot = cls?.name ?? null;
    }

    const serverTimestamp = new Date().toISOString();
    const deterministicId = `att_${parsed.personType}_${parsed.personId}_${parsed.attendanceDate}_${parsed.eventType}`;
    const attendanceCol = repo.collection(CollectionName.ATTENDANCE_RECORDS);

    const createdResult = await attendanceCol.createIfNotExists(deterministicId, {
      personType: parsed.personType,
      personId: parsed.personId,
      personNameSnapshot,
      nisSnapshot,
      niyNipSnapshot,
      classIdSnapshot,
      classNameSnapshot,
      attendanceDate: parsed.attendanceDate,
      eventType: parsed.eventType,
      status: parsed.status,
      method: AttendanceMethod.MANUAL_CORRECTION,
      serverTimestamp,
      clientTimestamp: null,
      latitude: null,
      longitude: null,
      gpsAccuracyMeters: null,
      distanceFromSchoolMeters: null,
      geofencePassed: null,
      selfiePath: null,
      deviceInfo: 'Pengecualian Manual Admin',
      idempotencyKey: `manual_${crypto.randomBytes(8).toString('hex')}`,
      corrected: true,
      correctionReason: parsed.reason,
      anomalyFlags: ['MANUAL_GPS_EXCEPTION'],
      createdBy: auth.user.id,
    });

    if (!createdResult.created) {
      throw ApiError.conflict(
        `Catatan absensi untuk ${personNameSnapshot} pada ${parsed.attendanceDate} (${parsed.eventType}) sudah ada. Gunakan fitur Koreksi pada catatan tersebut.`,
      );
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'ATTENDANCE_MANUAL_EXCEPTION',
      entityType: 'ATTENDANCE_RECORD',
      entityId: createdResult.doc.id,
      after: {
        personType: parsed.personType,
        personId: parsed.personId,
        attendanceDate: parsed.attendanceDate,
        eventType: parsed.eventType,
        status: parsed.status,
      },
      reason: parsed.reason,
      clientIp: auth.clientIp,
    });

    sendOk(res, createdResult.doc, 201);
  } catch (err) {
    sendError(res, err);
  }
}

export default async function handler(
  req: ApiRequestLike,
  res: MinimalApiResponse,
): Promise<void> {
  await handleManualExceptionAttendance(req, res);
}
