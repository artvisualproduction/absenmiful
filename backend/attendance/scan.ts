import { detectLocationAnomalies } from '../../src/lib/attendanceAnomaly';
import { evaluateAttendanceStatus } from '../../src/lib/attendanceEvaluator';
import { attendanceScanSchema } from '../../src/lib/attendanceScanValidation';
import { getDateKeyJakarta, getTimeHHMMJakarta, parseTimeToMinutes } from '../../src/lib/date';
import { validateGeofence } from '../../src/lib/haversine';
import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  CollectionName,
  FileCategory,
  QrOwnerType,
  StudentStatus,
  TeacherStatus,
  UserRole,
  type AttendanceRule,
} from '../../src/types';
import { ApiError, sendError, sendOk, type MinimalApiResponse } from '../_lib/apiError';
import { recordActivityLog } from '../_lib/auth/audit';
import { requireAuth, type ApiRequestLike } from '../_lib/auth/middleware';
import { findActiveQrTokenByRaw } from '../_lib/qr/tokenService';
import { getRepository } from '../_lib/repository';
import type { IDataRepository } from '../_lib/repository/types';

const PORTAL_SCAN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
];

function selectApplicableRule(
  rules: AttendanceRule[],
  audience: AttendanceAudience,
  classId: string | null,
  nowMs: number,
  bypassTimeWindow = false,
): AttendanceRule | null {
  const activeForAudience = rules.filter((r) => r.isActive && r.audience === audience);
  const effectiveCandidates = activeForAudience.filter((r) => {
    if (!bypassTimeWindow) {
      if (r.effectiveFrom && new Date(r.effectiveFrom).getTime() > nowMs) return false;
      if (r.effectiveUntil && new Date(r.effectiveUntil).getTime() < nowMs) return false;
    }
    return true;
  });
  const candidates = effectiveCandidates.length > 0 ? effectiveCandidates : activeForAudience;

  const compareNewest = (a: AttendanceRule, b: AttendanceRule): number => {
    const timeCmp = (b.updatedAt ?? b.createdAt ?? '').localeCompare(
      a.updatedAt ?? a.createdAt ?? '',
    );
    if (timeCmp !== 0) return timeCmp;
    return (b.version ?? 1) - (a.version ?? 1);
  };

  if (classId) {
    const classSpecific = candidates
      .filter((r) => r.classIds.includes(classId))
      .sort((a, b) => {
        if (a.classIds.length !== b.classIds.length) {
          return a.classIds.length - b.classIds.length;
        }
        return compareNewest(a, b);
      });
    if (classSpecific.length > 0) return classSpecific[0];
  }

  const schoolWide = candidates
    .filter((r) => r.classIds.length === 0)
    .sort(compareNewest);
  return schoolWide[0] ?? null;
}

function resolveAutoEventType(
  rule: AttendanceRule,
  serverNow: Date,
  hasCheckedInToday: boolean,
  bypassTimeWindow = false,
): AttendanceEventType {
  // When time-window bypass is active for testing, 1st scan -> CHECK_IN, 2nd scan -> CHECK_OUT
  if (bypassTimeWindow) {
    return hasCheckedInToday ? AttendanceEventType.CHECK_OUT : AttendanceEventType.CHECK_IN;
  }

  const currentMin = parseTimeToMinutes(getTimeHHMMJakarta(serverNow));
  const outStart = parseTimeToMinutes(rule.checkOutStart);
  const outDeadline = parseTimeToMinutes(rule.checkOutDeadline);
  const inStart = parseTimeToMinutes(rule.checkInStart);
  const inDeadline = parseTimeToMinutes(rule.checkInDeadline);

  // Inside check-out window -> CHECK_OUT
  if (currentMin >= outStart && currentMin <= outDeadline) {
    return AttendanceEventType.CHECK_OUT;
  }
  // Inside check-in window -> CHECK_IN (unless already checked in and past checkInDeadline)
  if (currentMin >= inStart && currentMin <= inDeadline) {
    return AttendanceEventType.CHECK_IN;
  }
  // If already checked in today and past midday/checkInDeadline, treat as CHECK_OUT attempt
  if (hasCheckedInToday && currentMin > inDeadline) {
    return AttendanceEventType.CHECK_OUT;
  }
  // Default to CHECK_IN before outStart, CHECK_OUT after outStart
  return currentMin >= outStart ? AttendanceEventType.CHECK_OUT : AttendanceEventType.CHECK_IN;
}

export interface HandleAttendanceScanOptions {
  /** Strictly for deterministic unit testing — NEVER read from HTTP request body */
  serverNow?: Date;
}

/**
 * POST /api/attendance/scan
 * Server-authoritative QR attendance scan endpoint.
 * Returns ONLY minimal kiosk response: { name, status, eventType, message, attendanceDate, recordedAt }.
 */
export async function handleAttendanceScan(
  req: ApiRequestLike,
  res: MinimalApiResponse,
  repo: IDataRepository = getRepository(),
  options: HandleAttendanceScanOptions = {},
): Promise<void> {
  try {
    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode harus POST.');
    }

    // 1. Validate active portal / operator device session + CSRF
    const auth = await requireAuth(req, { repo, allowedRoles: PORTAL_SCAN_ROLES });

    // 2. Validate payload
    const parsed = attendanceScanSchema.parse(req.body ?? {});

    // 3. Official authoritative server time (Asia/Jakarta)
    const serverNow = options.serverNow ?? new Date();
    const serverTimestamp = serverNow.toISOString();
    const attendanceDate = getDateKeyJakarta(serverNow);

    // 4. Idempotency replay check before processing
    const attendanceCol = repo.collection(CollectionName.ATTENDANCE_RECORDS);
    const existingByIdempotency = await attendanceCol.findFirst([
      { field: 'idempotencyKey', op: '==', value: parsed.idempotencyKey },
    ]);
    if (existingByIdempotency) {
      sendOk(res, {
        name: existingByIdempotency.personNameSnapshot,
        status: existingByIdempotency.status,
        eventType: existingByIdempotency.eventType,
        message: 'Absensi sudah tercatat sebelumnya (idempotent).',
        attendanceDate: existingByIdempotency.attendanceDate,
        recordedAt: existingByIdempotency.serverTimestamp,
        idempotentReplay: true,
      });
      return;
    }

    // 5. Resolve QR payload:
    //    Priority A: Direct NIS (Student) or NIY/NIP (Teacher) encoded on the QR card
    //    Priority B: Legacy hashed random QR token (backward compatibility)
    let resolvedOwnerType: QrOwnerType | null = null;
    let resolvedOwnerId: string | null = null;

    const normalizedToken = parsed.token.trim();
    const compactToken = normalizedToken.replace(/\s+/g, '');

    const studentByNis =
      (await repo
        .collection(CollectionName.STUDENTS)
        .findFirst([{ field: 'nis', op: '==', value: normalizedToken }])) ??
      (compactToken !== normalizedToken
        ? await repo
            .collection(CollectionName.STUDENTS)
            .findFirst([{ field: 'nis', op: '==', value: compactToken }])
        : null);

    if (studentByNis) {
      resolvedOwnerType = QrOwnerType.STUDENT;
      resolvedOwnerId = studentByNis.id;
    } else {
      const teacherByNiy =
        (await repo
          .collection(CollectionName.TEACHERS)
          .findFirst([{ field: 'niyNip', op: '==', value: normalizedToken }])) ??
        (compactToken !== normalizedToken
          ? await repo
              .collection(CollectionName.TEACHERS)
              .findFirst([{ field: 'niyNip', op: '==', value: compactToken }])
          : null);
      if (teacherByNiy) {
        resolvedOwnerType = QrOwnerType.TEACHER;
        resolvedOwnerId = teacherByNiy.id;
      } else {
        const qrToken = await findActiveQrTokenByRaw(repo, normalizedToken);
        if (qrToken) {
          resolvedOwnerType = qrToken.ownerType;
          resolvedOwnerId = qrToken.ownerId;
        }
      }
    }

    if (!resolvedOwnerType || !resolvedOwnerId) {
      throw ApiError.notFound('Kode QR / NIS / NIY tidak dikenali atau sudah dicabut.');
    }

    const qrOwner = { ownerType: resolvedOwnerType, ownerId: resolvedOwnerId };

    // 6. Resolve person & verify active status
    let personName = '';
    let nisSnapshot: string | null = null;
    let niyNipSnapshot: string | null = null;
    let classIdSnapshot: string | null = null;
    let classNameSnapshot: string | null = null;
    let audience: AttendanceAudience;

    if (qrOwner.ownerType === QrOwnerType.STUDENT) {
      audience = AttendanceAudience.STUDENT;
      const student =
        studentByNis ?? (await repo.collection(CollectionName.STUDENTS).getById(qrOwner.ownerId));
      if (!student) {
        throw ApiError.notFound('Data siswa pemilik QR tidak ditemukan.');
      }
      if (
        student.status !== StudentStatus.ACTIVE &&
        student.status !== StudentStatus.DEMO_ACTIVE
      ) {
        throw ApiError.badRequest(
          `Absensi ditolak: status siswa ${student.fullName} tidak aktif.`,
          { name: student.fullName },
        );
      }
      personName = student.fullName;
      nisSnapshot = student.nis;
      classIdSnapshot = student.classId;
      const cls = await repo.collection(CollectionName.CLASSES).getById(student.classId);
      classNameSnapshot = cls?.name ?? null;
    } else {
      audience = AttendanceAudience.TEACHER;
      const teacher = await repo.collection(CollectionName.TEACHERS).getById(qrOwner.ownerId);
      if (!teacher) {
        throw ApiError.notFound('Data guru pemilik QR tidak ditemukan.');
      }
      if (teacher.status !== TeacherStatus.ACTIVE) {
        throw ApiError.badRequest(
          `Absensi ditolak: status guru ${teacher.fullName} tidak aktif.`,
          { name: teacher.fullName },
        );
      }
      personName = teacher.fullName;
      niyNipSnapshot = teacher.niyNip;
    }

    // 7. Load active rules, holidays, appSettings, and active school location
    const [rulesRes, holidaysRes, settings, locationsRes] = await Promise.all([
      repo.collection(CollectionName.ATTENDANCE_RULES).list(),
      repo.collection(CollectionName.HOLIDAYS).list(),
      repo.collection(CollectionName.APP_SETTINGS).getById('default'),
      repo.collection(CollectionName.SCHOOL_LOCATIONS).list({
        filters: [{ field: 'isActive', op: '==', value: true }],
      }),
    ]);

    const bypassTimeWindow = Boolean(settings?.bypassAttendanceTimeWindow);

    const activeRule = selectApplicableRule(
      rulesRes.items,
      audience,
      classIdSnapshot,
      serverNow.getTime(),
      bypassTimeWindow,
    );
    if (!activeRule) {
      throw ApiError.badRequest(
        'Belum ada aturan jam absensi aktif untuk kategori ini.',
        { name: personName },
      );
    }

    // 8. Resolve eventType (explicit or AUTO)
    const checkInDocId = `att_${qrOwner.ownerType}_${qrOwner.ownerId}_${attendanceDate}_${AttendanceEventType.CHECK_IN}`;
    const existingCheckIn = await attendanceCol.getById(checkInDocId);
    let resolvedEventType: AttendanceEventType;
    if (parsed.eventType === 'AUTO') {
      resolvedEventType = resolveAutoEventType(
        activeRule,
        serverNow,
        Boolean(existingCheckIn),
        bypassTimeWindow,
      );
    } else {
      resolvedEventType = parsed.eventType;
    }

    // 9. Evaluate attendance status via pure server-time evaluator
    const evaluation = evaluateAttendanceStatus(activeRule, serverNow, resolvedEventType, {
      holidays: holidaysRes.items,
      bypassTimeWindow,
    });

    if (evaluation.status === AttendanceStatus.REJECTED) {
      throw ApiError.badRequest(evaluation.reason, {
        name: personName,
        status: AttendanceStatus.REJECTED,
        eventType: resolvedEventType,
      });
    }

    // 9b. For TEACHER QR scans on Portal, require a verified selfie step (method QR_SELFIE)
    let selfieStoragePath: string | null = null;
    if (qrOwner.ownerType === QrOwnerType.TEACHER) {
      if (!parsed.selfieFileId) {
        throw new ApiError(
          428,
          'SELFIE_REQUIRED',
          `Ambil foto selfie untuk verifikasi absensi guru ${personName}.`,
          {
            requiresSelfie: true,
            ownerType: QrOwnerType.TEACHER,
            ownerId: qrOwner.ownerId,
            name: personName,
            eventType: resolvedEventType,
          },
        );
      }
      const selfieMeta = await repo
        .collection(CollectionName.FILE_METADATA)
        .getById(parsed.selfieFileId);
      if (
        !selfieMeta ||
        selfieMeta.category !== FileCategory.ATTENDANCE_SELFIE ||
        selfieMeta.ownerType !== QrOwnerType.TEACHER ||
        (selfieMeta.ownerId !== qrOwner.ownerId && !selfieMeta.ownerId.startsWith('portal_'))
      ) {
        throw ApiError.badRequest(
          'Foto selfie verifikasi guru tidak ditemukan atau tidak valid. Ambil ulang selfie.',
          { name: personName, status: AttendanceStatus.REJECTED },
        );
      }
      selfieStoragePath = selfieMeta.storagePath;
    }

    // 10. Validate GPS & Geofence if required by rule/settings
    const gpsEnabledBySettings =
      audience === AttendanceAudience.STUDENT
        ? (settings?.gpsEnabledForStudents ?? true)
        : (settings?.gpsEnabledForTeachers ?? true);

    const requiresGps = activeRule.gpsRequired && gpsEnabledBySettings;
    const requiresGeofence = activeRule.geofenceRequired && gpsEnabledBySettings;
    const activeLocation = locationsRes.items[0] ?? null;

    let distanceFromSchoolMeters: number | null = null;
    let geofencePassed: boolean | null = null;

    const hasCoordinates =
      typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number';

    if ((requiresGps || requiresGeofence) && !hasCoordinates) {
      throw ApiError.badRequest(
        'Lokasi GPS wajib aktif untuk melakukan absensi. Aktifkan izin lokasi pada perangkat portal.',
        { name: personName, status: AttendanceStatus.REJECTED },
      );
    }

    if (hasCoordinates && activeLocation) {
      const geoResult = validateGeofence({
        school: { latitude: activeLocation.latitude, longitude: activeLocation.longitude },
        device: { latitude: parsed.latitude!, longitude: parsed.longitude! },
        radiusMeters: activeLocation.radiusMeters,
        maxAccuracyMeters: activeLocation.maxGpsAccuracyMeters,
        accuracyMeters: parsed.gpsAccuracyMeters,
      });
      distanceFromSchoolMeters = geoResult.distanceMeters;
      geofencePassed = geoResult.passed;

      if (requiresGeofence && !geoResult.passed) {
        throw ApiError.badRequest(
          geoResult.reason ?? 'Lokasi perangkat berada di luar radius area sekolah.',
          { name: personName, status: AttendanceStatus.REJECTED },
        );
      }
      if (
        requiresGps &&
        !requiresGeofence &&
        parsed.gpsAccuracyMeters !== null &&
        parsed.gpsAccuracyMeters > activeLocation.maxGpsAccuracyMeters
      ) {
        throw ApiError.badRequest(
          `Akurasi GPS tidak memadai (${Math.round(parsed.gpsAccuracyMeters)} m, maksimal ${activeLocation.maxGpsAccuracyMeters} m).`,
          { name: personName, status: AttendanceStatus.REJECTED },
        );
      }
    }

    // 10b. Heuristic location anomaly indicators (diagnostic only)
    let anomalyFlags: string[] = [];
    if (hasCoordinates) {
      const prevSample =
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
      anomalyFlags = detectLocationAnomalies({
        current: {
          latitude: parsed.latitude!,
          longitude: parsed.longitude!,
          accuracyMeters: parsed.gpsAccuracyMeters,
          timestampIso: serverTimestamp,
        },
        previousToday: prevSample,
        maxAccuracyMeters: activeLocation?.maxGpsAccuracyMeters ?? 100,
      });
    }

    // 11. Atomic transaction-safe creation keyed by person + date + eventType
    const attendanceMethod =
      qrOwner.ownerType === QrOwnerType.TEACHER
        ? AttendanceMethod.QR_SELFIE
        : AttendanceMethod.QR;
    const deterministicId = `att_${qrOwner.ownerType}_${qrOwner.ownerId}_${attendanceDate}_${resolvedEventType}`;
    const createResult = await attendanceCol.createIfNotExists(deterministicId, {
      personType: qrOwner.ownerType,
      personId: qrOwner.ownerId,
      personNameSnapshot: personName,
      nisSnapshot,
      niyNipSnapshot,
      classIdSnapshot,
      classNameSnapshot,
      attendanceDate,
      eventType: resolvedEventType,
      status: evaluation.status,
      method: attendanceMethod,
      serverTimestamp,
      clientTimestamp: parsed.clientTimestamp,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      gpsAccuracyMeters: parsed.gpsAccuracyMeters,
      distanceFromSchoolMeters,
      geofencePassed,
      selfiePath: selfieStoragePath,
      deviceInfo: parsed.deviceInfo,
      idempotencyKey: parsed.idempotencyKey,
      corrected: false,
      correctionReason: null,
      anomalyFlags,
      createdBy: auth.user.id,
    });

    if (!createResult.created) {
      // Exact idempotency key replay during concurrent race -> return idempotent OK
      if (createResult.doc.idempotencyKey === parsed.idempotencyKey) {
        sendOk(res, {
          name: createResult.doc.personNameSnapshot,
          status: createResult.doc.status,
          eventType: createResult.doc.eventType,
          message: 'Absensi sudah tercatat sebelumnya (idempotent).',
          attendanceDate: createResult.doc.attendanceDate,
          recordedAt: createResult.doc.serverTimestamp,
          idempotentReplay: true,
        });
        return;
      }

      const eventLabel =
        resolvedEventType === AttendanceEventType.CHECK_IN ? 'absen masuk' : 'absen pulang';
      throw ApiError.conflict(
        `${personName} sudah tercatat ${eventLabel} hari ini.`,
        {
          name: personName,
          status: AttendanceStatus.REJECTED,
          eventType: resolvedEventType,
        },
      );
    }

    await recordActivityLog(repo, {
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      action: 'ATTENDANCE_QR_SCANNED',
      entityType: 'ATTENDANCE_RECORD',
      entityId: createResult.doc.id,
      after: {
        personType: qrOwner.ownerType,
        personId: qrOwner.ownerId,
        attendanceDate,
        eventType: resolvedEventType,
        status: evaluation.status,
      },
      clientIp: auth.clientIp,
    });

    // 12. Minimal response: ONLY name + status + eventType + message (no NIS/NIP/PII)
    sendOk(
      res,
      {
        name: personName,
        status: evaluation.status,
        eventType: resolvedEventType,
        message: evaluation.reason,
        attendanceDate,
        recordedAt: serverTimestamp,
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
  await handleAttendanceScan(req, res);
}
