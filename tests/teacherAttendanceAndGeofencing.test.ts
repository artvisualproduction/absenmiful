import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../backend/_lib/auth/cookies';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleManualExceptionAttendance } from '../backend/attendance/manual-exception';
import { handleMyAttendance } from '../backend/attendance/me';
import { handleAttendanceScan } from '../backend/attendance/scan';
import { handleTeacherSelfAttendance } from '../backend/attendance/teacher-self';
import { handleLogin } from '../backend/auth/login';
import { handleSchoolLocationById } from '../backend/locations/[id]';
import { handleSchoolLocations } from '../backend/locations/index';
import { handleQrTokens } from '../backend/qr/tokens';
import { handleGpsSettings } from '../backend/settings/gps';
import { handleServePrivateFile } from '../backend/uploads/file';
import { handleUploadSelfie } from '../backend/uploads/selfie';
import { handleSignedUrl } from '../backend/uploads/signed-url';
import { detectLocationAnomalies } from '../src/lib/attendanceAnomaly';
import {
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  CollectionName,
  FileCategory,
  QrOwnerType,
  UserRole,
} from '../src/types';

interface MockRes {
  statusCode: number;
  body: Record<string, unknown>;
  binaryBody: Buffer | null;
  headers: Record<string, string | string[]>;
  status(code: number): MockRes;
  json(payload: unknown): void;
  send(buf: Buffer): void;
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | undefined;
}

function createMockRes(): MockRes {
  return {
    statusCode: 200,
    body: {},
    binaryBody: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload as Record<string, unknown>;
    },
    send(buf: Buffer) {
      this.binaryBody = buf;
    },
    setHeader(name: string, value: string | string[]) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };
}

function extractSessionHeaders(res: MockRes) {
  const setCookies = (res.headers['set-cookie'] as string[]) ?? [];
  const pairs: string[] = [];
  let csrf = '';
  for (const item of setCookies) {
    const first = item.split(';')[0] ?? '';
    const eq = first.indexOf('=');
    const k = first.slice(0, eq).trim();
    const v = decodeURIComponent(first.slice(eq + 1).trim());
    pairs.push(`${k}=${encodeURIComponent(v)}`);
    if (k === CSRF_COOKIE_NAME) csrf = v;
  }
  return { headers: { cookie: pairs.join('; '), [CSRF_HEADER_NAME]: csrf } };
}

async function loginAs(repo: MockRepository, username: string, password: string) {
  const res = createMockRes();
  await handleLogin({ method: 'POST', ip: '127.0.0.1', body: { username, password } }, res, repo);
  assert.equal(res.statusCode, 200);
  return extractSessionHeaders(res);
}

// Minimal valid binary JPEG header (FF D8 FF E0 ...)
const VALID_JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]).toString('base64')}`;

// Minimal valid binary PNG header (89 50 4E 47 0D 0A 1A 0A ...)
const VALID_PNG_DATA_URL = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]).toString('base64')}`;

// Fake JPEG containing plain text bytes (fails magic-byte validation)
const FAKE_JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from('not-a-real-jpeg-file').toString('base64')}`;

test('Stage 6 Unit: detectLocationAnomalies flags zero accuracy, sub-meter accuracy, and implausible location jumps', () => {
  const normal = detectLocationAnomalies({
    current: {
      latitude: -8.15165,
      longitude: 113.11124,
      accuracyMeters: 15,
      timestampIso: '2026-08-03T00:00:00.000Z',
    },
    maxAccuracyMeters: 75,
  });
  assert.deepEqual(normal, []);

  const suspiciousZero = detectLocationAnomalies({
    current: {
      latitude: -8.15165,
      longitude: 113.11124,
      accuracyMeters: 0,
      timestampIso: '2026-08-03T00:00:00.000Z',
    },
    maxAccuracyMeters: 75,
  });
  assert.ok(suspiciousZero.includes('ACCURACY_ZERO_SUSPICIOUS'));

  const teleport = detectLocationAnomalies({
    current: {
      latitude: -8.25165,
      longitude: 113.21124,
      accuracyMeters: 12,
      timestampIso: '2026-08-03T00:00:03.000Z',
    },
    previousToday: {
      latitude: -8.15165,
      longitude: 113.11124,
      accuracyMeters: 12,
      timestampIso: '2026-08-03T00:00:00.000Z',
    },
    maxAccuracyMeters: 75,
  });
  assert.ok(teleport.includes('LOCATION_TELEPORT_JUMP'));
});

test('Stage 6 API: private selfie upload/signed URL RBAC, teacher self-attendance geofencing, QR_SELFIE portal flow, manual exception, and school locations CRUD', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();

  const boot = await bootstrapInitialAccounts(repo, {
    superAdminPassword: 'SuperSecret!2026',
    adminPassword: 'AdminSecret!2026',
    principalPassword: 'KepsekSecret!2026',
    portalExitPassword: 'PortalExit!2026',
  });

  const adminSession = await loginAs(repo, 'admin', 'AdminSecret!2026');
  const principalSession = await loginAs(repo, 'kepsek', 'KepsekSecret!2026');

  const teacherAccounts = boot.accounts.filter((a) => a.role === UserRole.TEACHER);
  assert.ok(teacherAccounts.length >= 2);
  const teacher1Acc = teacherAccounts[0]!;
  const teacher2Acc = teacherAccounts[1]!;

  await repo.collection(CollectionName.USERS).update(teacher1Acc.userId, { mustChangePassword: false });
  await repo.collection(CollectionName.USERS).update(teacher2Acc.userId, { mustChangePassword: false });

  const teacher1Session = await loginAs(repo, teacher1Acc.username, teacher1Acc.temporaryPassword!);
  const teacher2Session = await loginAs(repo, teacher2Acc.username, teacher2Acc.temporaryPassword!);

  const teacher1User = (await repo.collection(CollectionName.USERS).getById(teacher1Acc.userId))!;
  const teacher2User = (await repo.collection(CollectionName.USERS).getById(teacher2Acc.userId))!;
  assert.ok(teacher1User.linkedTeacherId);
  assert.ok(teacher2User.linkedTeacherId);

  const locations = await repo.collection(CollectionName.SCHOOL_LOCATIONS).list({
    filters: [{ field: 'isActive', op: '==', value: true }],
  });
  const schoolLoc = locations.items[0]!;
  assert.ok(schoolLoc);

  // 1. Reject fake JPEG magic bytes on selfie upload
  const fakeUploadRes = createMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        dataUrl: FAKE_JPEG_DATA_URL,
        mimeType: 'image/jpeg',
      },
    },
    fakeUploadRes,
    repo,
  );
  assert.equal(fakeUploadRes.statusCode, 400);

  // 2. Reject IDOR attempt: teacher1 trying to upload under teacher2's ID
  const idorUploadRes = createMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        dataUrl: VALID_JPEG_DATA_URL,
        mimeType: 'image/jpeg',
        ownerId: teacher2User.linkedTeacherId,
      },
    },
    idorUploadRes,
    repo,
  );
  assert.equal(idorUploadRes.statusCode, 403);

  // 3. Valid selfie upload by teacher1
  const uploadRes = createMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        dataUrl: VALID_JPEG_DATA_URL,
        mimeType: 'image/jpeg',
      },
    },
    uploadRes,
    repo,
  );
  assert.equal(uploadRes.statusCode, 201);
  const uploaded = uploadRes.body.data as {
    fileId: string;
    storagePath: string;
    signedUrl: string;
    retentionUntil: string;
  };
  assert.ok(uploaded.fileId.startsWith('fil_'));
  assert.ok(uploaded.storagePath.startsWith('private/selfies/'));
  assert.ok(uploaded.retentionUntil);

  const metaDoc = await repo.collection(CollectionName.FILE_METADATA).getById(uploaded.fileId);
  assert.equal(metaDoc?.category, FileCategory.ATTENDANCE_SELFIE);

  // 4. Signed URL RBAC: teacher2 CANNOT request signed URL or fetch teacher1's private selfie
  const forbiddenSignedRes = createMockRes();
  await handleSignedUrl(
    {
      method: 'POST',
      headers: teacher2Session.headers,
      body: { fileId: uploaded.fileId },
    },
    forbiddenSignedRes,
    repo,
  );
  assert.equal(forbiddenSignedRes.statusCode, 403);

  // Principal & owner CAN get signed URL and fetch binary file
  const principalSignedRes = createMockRes();
  await handleSignedUrl(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: { fileId: uploaded.fileId },
    },
    principalSignedRes,
    repo,
  );
  assert.equal(principalSignedRes.statusCode, 200);
  const signedUrlStr = (principalSignedRes.body.data as { signedUrl: string }).signedUrl;
  const parsedUrl = new URL(`http://localhost${signedUrlStr}`);
  const fileQuery = {
    id: parsedUrl.searchParams.get('id')!,
    exp: parsedUrl.searchParams.get('exp')!,
    sig: parsedUrl.searchParams.get('sig')!,
  };

  // Serve file to Principal -> 200 binary JPEG
  const serveOkRes = createMockRes();
  await handleServePrivateFile(
    { method: 'GET', headers: principalSession.headers, query: fileQuery },
    serveOkRes,
    repo,
  );
  assert.equal(serveOkRes.statusCode, 200);
  assert.equal(serveOkRes.headers['content-type'], 'image/jpeg');
  assert.ok(serveOkRes.binaryBody && serveOkRes.binaryBody.length > 0);

  // Even with valid signed params, teacher2 is blocked -> 403
  const serveForbiddenRes = createMockRes();
  await handleServePrivateFile(
    { method: 'GET', headers: teacher2Session.headers, query: fileQuery },
    serveForbiddenRes,
    repo,
  );
  assert.equal(serveForbiddenRes.statusCode, 403);

  // Tampered signature -> 403
  const serveTamperedRes = createMockRes();
  await handleServePrivateFile(
    {
      method: 'GET',
      headers: adminSession.headers,
      query: { ...fileQuery, sig: 'tampered_signature' },
    },
    serveTamperedRes,
    repo,
  );
  assert.equal(serveTamperedRes.statusCode, 403);

  // Deterministic Monday 06:45 WIB (on time for teacher check-in)
  const mondayCheckIn = new Date('2026-08-03T06:45:00+07:00');

  // 5. Teacher self-attendance rejects poor GPS accuracy
  const poorGpsRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 350,
        selfieFileId: uploaded.fileId,
        idempotencyKey: 'idem_poor_gps_001',
      },
    },
    poorGpsRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(poorGpsRes.statusCode, 400);

  // 6. Teacher self-attendance rejects coordinates outside geofence radius
  const outsideGeoRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude + 0.01, // ~1.1 km away
        longitude: schoolLoc.longitude + 0.01,
        gpsAccuracyMeters: 15,
        selfieFileId: uploaded.fileId,
        idempotencyKey: 'idem_outside_geo_001',
      },
    },
    outsideGeoRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(outsideGeoRes.statusCode, 400);

  // 7. Teacher self-attendance succeeds inside geofence with valid selfie
  const selfOkRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 12,
        selfieFileId: uploaded.fileId,
        idempotencyKey: 'idem_teacher1_in_001',
        deviceInfo: 'UnitTest Mobile',
      },
    },
    selfOkRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(selfOkRes.statusCode, 201);
  const selfData = selfOkRes.body.data as {
    record: {
      status: AttendanceStatus;
      method: AttendanceMethod;
      geofencePassed: boolean;
      selfiePath: string;
    };
  };
  assert.equal(selfData.record.status, AttendanceStatus.PRESENT);
  assert.equal(selfData.record.method, AttendanceMethod.SELF_SERVICE_SELFIE);
  assert.equal(selfData.record.geofencePassed, true);
  assert.equal(selfData.record.selfiePath, uploaded.storagePath);

  // Idempotent replay with same key -> 200
  const replayRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 12,
        selfieFileId: uploaded.fileId,
        idempotencyKey: 'idem_teacher1_in_001',
      },
    },
    replayRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(replayRes.statusCode, 200);
  assert.equal((replayRes.body.data as { idempotentReplay: boolean }).idempotentReplay, true);

  // Duplicate check-in with new key -> 409 Conflict
  const dupRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 12,
        selfieFileId: uploaded.fileId,
        idempotencyKey: 'idem_teacher1_in_002',
      },
    },
    dupRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(dupRes.statusCode, 409);

  // 8. Teacher QR_SELFIE flow on Portal (/api/attendance/scan for TEACHER)
  const qrRes = createMockRes();
  await handleQrTokens(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { ownerType: QrOwnerType.TEACHER, ownerId: teacher2User.linkedTeacherId },
    },
    qrRes,
    repo,
  );
  assert.equal(qrRes.statusCode, 201);
  const teacher2RawQr = (qrRes.body.data as { rawToken: string }).rawToken;

  // Step A: scan without selfieFileId -> 428 SELFIE_REQUIRED
  const scanNeedSelfieRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: teacher2RawQr,
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 18,
        idempotencyKey: 'idem_t2_qr_step1',
      },
    },
    scanNeedSelfieRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(scanNeedSelfieRes.statusCode, 428);
  assert.equal((scanNeedSelfieRes.body.error as { code: string }).code, 'SELFIE_REQUIRED');

  // Step B: Portal uploads selfie for teacher2 (PNG) then completes scan -> 201 QR_SELFIE
  const portalSelfieRes = createMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        dataUrl: VALID_PNG_DATA_URL,
        mimeType: 'image/png',
        ownerType: QrOwnerType.TEACHER,
        ownerId: teacher2User.linkedTeacherId,
      },
    },
    portalSelfieRes,
    repo,
  );
  assert.equal(portalSelfieRes.statusCode, 201);
  const portalSelfieId = (portalSelfieRes.body.data as { fileId: string }).fileId;

  const scanCompleteRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: teacher2RawQr,
        eventType: AttendanceEventType.CHECK_IN,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 18,
        idempotencyKey: 'idem_t2_qr_step2',
        selfieFileId: portalSelfieId,
      },
    },
    scanCompleteRes,
    repo,
    { serverNow: mondayCheckIn },
  );
  assert.equal(scanCompleteRes.statusCode, 201);
  const qrTeacherRecord = await repo
    .collection(CollectionName.ATTENDANCE_RECORDS)
    .getById(`att_TEACHER_${teacher2User.linkedTeacherId}_2026-08-03_CHECK_IN`);
  assert.equal(qrTeacherRecord?.method, AttendanceMethod.QR_SELFIE);
  assert.ok(qrTeacherRecord?.selfiePath?.endsWith('.png'));

  // 9. GET /api/attendance/me strictly isolates each teacher's own records
  const myAtt1Res = createMockRes();
  await handleMyAttendance({ method: 'GET', headers: teacher1Session.headers }, myAtt1Res, repo);
  assert.equal(myAtt1Res.statusCode, 200);
  const myItems1 = (myAtt1Res.body.data as { items: Array<{ personId: string }> }).items;
  assert.equal(myItems1.length, 1);
  assert.equal(myItems1[0]!.personId, teacher1User.linkedTeacherId);

  // 10. Manual GPS exception: blocked for Teacher & Principal, allowed for Admin with reason
  const teacherManualRes = createMockRes();
  await handleManualExceptionAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        personType: QrOwnerType.TEACHER,
        personId: teacher1User.linkedTeacherId,
        attendanceDate: '2026-08-04',
        eventType: AttendanceEventType.CHECK_IN,
        status: AttendanceStatus.PRESENT,
        reason: 'GPS perangkat tidak terkunci di ruang guru',
      },
    },
    teacherManualRes,
    repo,
  );
  assert.equal(teacherManualRes.statusCode, 403);

  const principalManualRes = createMockRes();
  await handleManualExceptionAttendance(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: {
        personType: QrOwnerType.TEACHER,
        personId: teacher1User.linkedTeacherId,
        attendanceDate: '2026-08-04',
        eventType: AttendanceEventType.CHECK_IN,
        status: AttendanceStatus.PRESENT,
        reason: 'GPS perangkat tidak terkunci di ruang guru',
      },
    },
    principalManualRes,
    repo,
  );
  assert.equal(principalManualRes.statusCode, 403);

  const adminManualRes = createMockRes();
  await handleManualExceptionAttendance(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        personType: QrOwnerType.TEACHER,
        personId: teacher1User.linkedTeacherId,
        attendanceDate: '2026-08-04',
        eventType: AttendanceEventType.CHECK_IN,
        status: AttendanceStatus.PRESENT,
        reason: 'GPS perangkat guru gagal terkunci saat hujan, diverifikasi fisik Admin',
      },
    },
    adminManualRes,
    repo,
  );
  assert.equal(adminManualRes.statusCode, 201);
  const manualRec = adminManualRes.body.data as {
    method: AttendanceMethod;
    corrected: boolean;
    anomalyFlags: string[];
  };
  assert.equal(manualRec.method, AttendanceMethod.MANUAL_CORRECTION);
  assert.equal(manualRec.corrected, true);
  assert.ok(manualRec.anomalyFlags.includes('MANUAL_GPS_EXCEPTION'));

  // 11. School Locations CRUD & GPS settings toggle
  const createLocRes = createMockRes();
  await handleSchoolLocations(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        name: 'Kampus Utara MI Miftahul Ulum',
        latitude: -8.152,
        longitude: 113.112,
        radiusMeters: 120,
        maxGpsAccuracyMeters: 80,
        isActive: true,
      },
    },
    createLocRes,
    repo,
  );
  assert.equal(createLocRes.statusCode, 201);
  const createdLoc = createLocRes.body.data as { id: string; radiusMeters: number };

  const patchLocRes = createMockRes();
  await handleSchoolLocationById(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: { radiusMeters: 150 },
    },
    patchLocRes,
    createdLoc.id,
    repo,
  );
  assert.equal(patchLocRes.statusCode, 200);
  assert.equal((patchLocRes.body.data as { radiusMeters: number }).radiusMeters, 150);

  // Teacher cannot mutate GPS settings -> 403
  const teacherGpsToggleRes = createMockRes();
  await handleGpsSettings(
    {
      method: 'PATCH',
      headers: teacher1Session.headers,
      body: { gpsEnabledForTeachers: false },
    },
    teacherGpsToggleRes,
    repo,
  );
  assert.equal(teacherGpsToggleRes.statusCode, 403);

  // Admin disables GPS for teachers -> teacher1 can check out outside geofence
  const adminGpsToggleRes = createMockRes();
  await handleGpsSettings(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: { gpsEnabledForTeachers: false },
    },
    adminGpsToggleRes,
    repo,
  );
  assert.equal(adminGpsToggleRes.statusCode, 200);

  const mondayCheckOut = new Date('2026-08-03T13:30:00+07:00');
  const outOutsideRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        eventType: AttendanceEventType.CHECK_OUT,
        latitude: -8.25,
        longitude: 113.25,
        gpsAccuracyMeters: 0, // triggers ACCURACY_ZERO_SUSPICIOUS anomaly flag
        selfieFileId: uploaded.fileId,
        idempotencyKey: 'idem_teacher1_out_001',
      },
    },
    outOutsideRes,
    repo,
    { serverNow: mondayCheckOut },
  );
  assert.equal(outOutsideRes.statusCode, 201);
  const outRec = (outOutsideRes.body.data as { record: { anomalyFlags: string[] } }).record;
  assert.ok(outRec.anomalyFlags.includes('ACCURACY_ZERO_SUSPICIOUS'));
});
