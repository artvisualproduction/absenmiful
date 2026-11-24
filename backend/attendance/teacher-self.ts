import { detectLocationAnomalies } from '../../src/lib/attendanceAnomaly';
import { evaluateAttendanceStatus } from '../../src/lib/attendanceEvaluator';
import { getDateKeyJakarta, getTimeHHMMJakarta, parseTimeToMinutes } from '../../src/lib/date';
import { validateGeofence } from '../../src/lib/haversine';
import { teacherSelfAttendanceSchema } from '../../src/lib/teacherAttendanceValidation';
import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  CollectionName,
  FileCategory,
  QrOwnerType,
  TeacherStatus,
  UserRole,
  type AttendanceRule,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { resolveTeacherProfileForUser } from '../_lib/auth/resolvePrincipalTeacher';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

function selectActiveTeacherRule(
  rules: AttendanceRule[],
  nowMs: number,
  bypassTimeWindow = false,
): AttendanceRule | null {
  const activeTeacherRules = rules.filter(
    (r) => r.isActive && r.audience === AttendanceAudience.TEACHER,
  );
  const effective = activeTeacherRules.filter((r) => {
    if (!bypassTimeWindow) {
      if (r.effectiveFrom && new Date(r.effectiveFrom).getTime() > nowMs) return false;
      if (r.effectiveUntil && new Date(r.effectiveUntil).getTime() < nowMs) return false;
    }
    return true;
  });
  const pool = effective.length > 0 ? effective : activeTeacherRules;
  const candidates = pool.sort((a, b) => {
    const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
      a.updatedAt ?? a.createdAt ?? '',
    );
    if (timeCmp !== 0) return timeCmp;
    return (b.version ?? 1) - (a.version ?? 1);
  });
  return candidates[0] ?? null;
}

function resolveTeacherAutoEventType(
  rule: AttendanceRule,
  serverNow: Date,
  hasCheckedInToday: boolean,
  bypassTimeWindow = false,
): AttendanceEventType {
  if (bypassTimeWindow) {
    return hasCheckedInToday ? AttendanceEventType.CHECK_OUT : AttendanceEventType.CHECK_IN;
  }

  const currentMin = parseTimeToMinutes(getTimeHHMMJakarta(serverNow));
  const outStart = parseTimeToMinutes(rule.checkOutStart);
  const outDeadline = parseTimeToMinutes(rule.checkOutDeadline);
  const inStart = parseTimeToMinutes(rule.checkInStart);
  const inDeadline = parseTimeToMinutes(rule.checkInDeadline);

  if (currentMin >= outStart && currentMin <= outDeadline) {
    return AttendanceEventType.CHECK_OUT;
  }
  if (currentMin >= inStart && currentMin <= inDeadline) {
    return AttendanceEventType.CHECK_IN;
  }
  if (hasCheckedInToday && currentMin > inDeadline) {
    return AttendanceEventType.CHECK_OUT;
  }
  return currentMin >= outStart ? AttendanceEventType.CHECK_OUT : AttendanceEventType.CHECK_IN;
}

export interface HandleTeacherSelfOptions {
  /** Strictly for deterministic unit tests — never read from HTTP body */
  serverNow?: Date;
}

/**
 * POST /api/attendance/teacher-self
 * Teacher self-service attendance with mandatory selfie, server-side GPS accuracy & Haversine
 * geofencing validation, heuristic anomaly indicators, and atomic duplicate prevention.
 */
export async function handleTeacherSelfAttendance(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
  options: HandleTeacherSelfOptions = {},
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    const auth = await requireAuth(req, {
      repo,
      allowedRoles: [UserRole.TEACHER, UserRole.PRINCIPAL],
    });

    const resolvedTeacher = await resolveTeacherProfileForUser(repo, auth.user);
    if (!resolvedTeacher) {
      throw ApiError.forbidden(
        auth.user.role === UserRole.PRINCIPAL
          ? 'Akun Kepala Sekolah belum tertaut ke profil pendidik aktif. Hubungi Admin untuk menautkan akun di Manajemen Pengguna.'
          : 'Akun Anda belum tertaut ke profil guru aktif.',
      );
    }

    const parsed = teacherSelfAttendanceSchema.parse(req.body ?? {});
    const serverNow = options.serverNow ?? new Date();
    const serverTimestamp = serverNow.toISOString();
    const attendanceDate = getDateKeyJakarta(serverNow);

    // 1. Check idempotency replay first
    const attendanceCol = repo.collection(CollectionName.ATTENDANCE_RECORDS);
    const existingByIdem = await attendanceCol.findFirst([
      { field: 'idempotencyKey', op: '==', value: parsed.idempotencyKey },
    ]);
    if (existingByIdem && existingByIdem.personId === resolvedTeacher.id) {
      sendOk(res, {
        record: existingByIdem,
        message: 'Absensi Anda sudah tercatat sebelumnya (idempotent).',
        idempotentReplay: true,
      });
      return;
    }

    // 2. Load appSettings, active rule, holidays, schoolLocation, and uploaded selfie metadata
    const [settings, rulesRes, holidaysRes, locationsRes, selfieMeta] = await Promise.all([
      repo.collection(CollectionName.APP_SETTINGS).getById('default'),
      repo.collection(CollectionName.ATTENDANCE_RULES).list(),
      repo.collection(CollectionName.HOLIDAYS).list(),
      repo.collection(CollectionName.SCHOOL_LOCATIONS).list({
        filters: [{ field: 'isActive', op: '==', value: true }],
      }),
      repo.collection(CollectionName.FILE_METADATA).getById(parsed.selfieFileId),
    ]);

    const teacher = resolvedTeacher;
    if (teacher.status !== TeacherStatus.ACTIVE) {
      throw ApiError.forbidden('Profil guru tidak aktif. Hubungi Admin Madrasah.');
    }

    if (settings && settings.teacherSelfServiceEnabled === false) {
      throw ApiError.forbidden(
        'Fitur absensi mandiri guru sedang dinonaktifkan oleh Admin Madrasah.',
      );
    }

    // 3. Verify selfie exists, belongs to THIS teacher, is an ATTENDANCE_SELFIE, and is JPEG (not PNG upload)
    if (
      !selfieMeta ||
      selfieMeta.category !== FileCategory.ATTENDANCE_SELFIE ||
      selfieMeta.ownerType !== QrOwnerType.TEACHER ||
      selfieMeta.ownerId !== teacher.id
    ) {
      throw ApiError.badRequest(
        'Foto selfie belum terverifikasi atau bukan milik akun Anda. Ambil ulang foto selfie.',
      );
    }
    if (selfieMeta.mimeType !== 'image/jpeg') {
      throw ApiError.badRequest(
        'Absensi mandiri guru hanya menerima foto kamera langsung (JPEG), tidak mendukung gambar PNG.',
      );
    }

    // 4. Resolve active TEACHER attendance rule & eventType
    const bypassTimeWindow = Boolean(settings?.bypassAttendanceTimeWindow);
    const activeRule = selectActiveTeacherRule(
      rulesRes.items,
      serverNow.getTime(),
      bypassTimeWindow,
    );
    if (!activeRule) {
      throw ApiError.badRequest('Belum ada aturan jam absensi aktif untuk guru.');
    }

    const checkInId = `att_${QrOwnerType.TEACHER}_${teacher.id}_${attendanceDate}_${AttendanceEventType.CHECK_IN}`;
    const existingCheckIn = await attendanceCol.getById(checkInId);

    const resolvedEventType: AttendanceEventType =
      parsed.eventType === 'AUTO'
        ? resolveTeacherAutoEventType(
            activeRule,
            serverNow,
            Boolean(existingCheckIn),
            bypassTimeWindow,
          )
        : parsed.eventType;

    // 5. Evaluate server time against TEACHER rule & holidays
    const evaluation = evaluateAttendanceStatus(activeRule, serverNow, resolvedEventType, {
      holidays: holidaysRes.items,
      bypassTimeWindow,
    });
    if (evaluation.status === AttendanceStatus.REJECTED) {
      throw ApiError.badRequest(evaluation.reason, {
        status: AttendanceStatus.REJECTED,
        eventType: resolvedEventType,
      });
    }

    // 6. Validate GPS accuracy & Haversine geofence on server
    const activeLocation = locationsRes.items[0] ?? null;
    const gpsEnabledForTeachers = settings?.gpsEnabledForTeachers ?? true;
    const requiresGps = activeRule.gpsRequired && gpsEnabledForTeachers;
    const requiresGeofence = activeRule.geofenceRequired && gpsEnabledForTeachers;

    const hasCoordinates =
      typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number';
    const accuracyVal = typeof parsed.gpsAccuracyMeters === 'number' ? parsed.gpsAccuracyMeters : 0;

    let distanceFromSchoolMeters: number | null = null;
    let geofencePassed: boolean | null = null;

    if ((requiresGps || requiresGeofence) && !hasCoordinates) {
      throw ApiError.badRequest(
        'Lokasi GPS wajib aktif untuk melakukan absensi mandiri. Aktifkan izin lokasi pada perangkat Anda atau hubungi Admin untuk pengecualian manual.',
      );
    }

    if (hasCoordinates && activeLocation) {
      const geoResult = validateGeofence({
        school: { latitude: activeLocation.latitude, longitude: activeLocation.longitude },
        device: { latitude: parsed.latitude!, longitude: parsed.longitude! },
        radiusMeters: activeLocation.radiusMeters,
        maxAccuracyMeters: activeLocation.maxGpsAccuracyMeters,
        accuracyMeters: accuracyVal,
      });

      distanceFromSchoolMeters = geoResult.distanceMeters;
      geofencePassed = geoResult.passed;

      if ((requiresGps || requiresGeofence) && !geoResult.accuracyAcceptable) {
        throw ApiError.badRequest(
          geoResult.reason ??
            `Akurasi GPS terlalu rendah (${Math.round(accuracyVal)} m, maksimal ${activeLocation.maxGpsAccuracyMeters} m). Pindah ke area terbuka atau hubungi Admin untuk pengecualian manual.`,
          {
            code: 'GPS_ACCURACY_POOR',
            distanceMeters: geoResult.distanceMeters,
            accuracyMeters: accuracyVal,
          },
        );
      }

      if (requiresGeofence && !geoResult.withinRadius) {
        throw ApiError.badRequest(
          geoResult.reason ??
            `Anda berada di luar radius area sekolah (${Math.round(geoResult.distanceMeters)} m dari batas ${activeLocation.radiusMeters} m).`,
          {
            code: 'OUTSIDE_GEOFENCE',
            distanceMeters: geoResult.distanceMeters,
            radiusMeters: activeLocation.radiusMeters,
          },
        );
      }
    } else if (requiresGeofence) {
      throw ApiError.badRequest(
        'Titik koordinat lokasi sekolah belum dikonfigurasi. Hubungi Admin Madrasah.',
      );
    }

    // 7. Compute heuristic location anomaly indicators (diagnostic only, NOT claiming perfect anti-spoofing)
    const previousSample =
      existingCheckIn &&
      existingCheckIn.latitude !== null &&
      existingCheckIn.longitude !== null
        ? {
            latitude: existingCheckIn.latitude,
            longitude: existingCheckIn.longitude,
            accuracyMeters: existingCheckIn.gpsAccuracyMeters,
            timestampIso: existingCheckIn.serverTimestamp,
          }
        : null;

    const anomalyFlags = hasCoordinates
      ? detectLocationAnomalies({
          current: {
            latitude: parsed.latitude!,
            longitude: parsed.longitude!,
            accuracyMeters: accuracyVal,
            timestampIso: serverTimestamp,
          },
          previousToday: previousSample,
          maxAccuracyMeters: activeLocation?.maxGpsAccuracyMeters ?? 100,
        })
      : [];

    // 8. Atomic duplicate-safe creation keyed by person + date + eventType
    const deterministicId = `att_${QrOwnerType.TEACHER}_${teacher.id}_${attendanceDate}_${resolvedEventType}`;
    const createResult = await attendanceCol.createIfNotExists(deterministicId, {
      personType: QrOwnerType.TEACHER,
      personId: teacher.id,
      personNameSnapshot: teacher.fullName,
      nisSnapshot: null,
      niyNipSnapshot: teacher.niyNip,
      classIdSnapshot: null,
      classNameSnapshot: null,
      attendanceDate,
      eventType: resolvedEventType,
      status: evaluation.status,
      method: AttendanceMethod.SELF_SERVICE_SELFIE,
      serverTimestamp,
      clientTimestamp: parsed.clientTimestamp,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      gpsAccuracyMeters: parsed.gpsAccuracyMeters,
      distanceFromSchoolMeters,
      geofencePassed,
      selfiePath: selfieMeta.storagePath,
      deviceInfo: parsed.deviceInfo,
      idempotencyKey: parsed.idempotencyKey,
      corrected: false,
      correctionReason: null,
      anomalyFlags,
      createdBy: auth.user.id,
    });

    if (!createResult.created) {
      if (createResult.doc.idempotencyKey === parsed.idempotencyKey) {
        sendOk(res, {
          record: createResult.doc,
          message: 'Absensi Anda sudah tercatat sebelumnya (idempotent).',
          idempotentReplay: true,
        });
        return;
      }

      const label =
        resolvedEventType === AttendanceEventType.CHECK_IN ? 'absen masuk' : 'absen pulang';
      throw ApiError.conflict(`Anda sudah tercatat ${label} pada tanggal ${attendanceDate}.`);
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'TEACHER_SELF_ATTENDANCE',
      entityType: 'ATTENDANCE_RECORD',
      entityId: createResult.doc.id,
      after: {
        teacherId: teacher.id,
        attendanceDate,
        eventType: resolvedEventType,
        status: evaluation.status,
        distanceFromSchoolMeters,
        geofencePassed,
        anomalyFlags,
      },
      clientIp: auth.clientIp,
    });

    sendOk(
      res,
      {
        record: createResult.doc,
        message: evaluation.reason,
        lateMinutes: evaluation.lateMinutes,
        idempotentReplay: false,
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
  await handleTeacherSelfAttendance(req, res);
}
