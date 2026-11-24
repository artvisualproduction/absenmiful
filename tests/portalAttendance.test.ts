import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../backend/_lib/auth/cookies';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleAttendanceCorrection } from '../backend/attendance/[id]/correction';
import { handleAttendanceList } from '../backend/attendance/index';
import { handleAttendanceScan } from '../backend/attendance/scan';
import { handleLogin } from '../backend/auth/login';
import { handlePortalActivate } from '../backend/portal/activate';
import { handlePortalExit } from '../backend/portal/exit';
import { handleQrRevoke } from '../backend/qr/revoke';
import { handleQrTokens } from '../backend/qr/tokens';
import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceStatus,
  CollectionName,
  QrOwnerType,
  StudentStatus,
  UserRole,
} from '../src/types';

interface MockRes {
  statusCode: number;
  body: Record<string, unknown>;
  headers: Record<string, string | string[]>;
  status(code: number): MockRes;
  json(payload: unknown): void;
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | undefined;
}

function createMockRes(): MockRes {
  return {
    statusCode: 200,
    body: {},
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload as Record<string, unknown>;
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

test('Stage 5 API: QR high-entropy token issuance/revocation, atomic scan idempotency & duplicate prevention, GPS/geofence, correction audit, and portal exit verification', async () => {
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

  const teacherAcc = boot.accounts.find((a) => a.role === UserRole.TEACHER)!;
  await repo.collection(CollectionName.USERS).update(teacherAcc.userId, { mustChangePassword: false });
  const teacherSession = await loginAs(repo, teacherAcc.username, teacherAcc.temporaryPassword!);

  const studentsRes = await repo.collection(CollectionName.STUDENTS).list({ limit: 3 });
  const student1 = studentsRes.items[0]!;
  const student2 = studentsRes.items[1]!;

  // 1. Issue high-entropy QR token for student1 (never contains NIS!)
  const issueRes = createMockRes();
  await handleQrTokens(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { ownerType: QrOwnerType.STUDENT, ownerId: student1.id },
    },
    issueRes,
    repo,
  );
  assert.equal(issueRes.statusCode, 201);
  const issued = issueRes.body.data as { qrTokenId: string; rawToken: string; ownerName: string };
  assert.ok(issued.rawToken.startsWith('QR1.'));
  assert.ok(issued.rawToken.length >= 40);
  assert.ok(!issued.rawToken.includes(student1.nis), 'QR token must NEVER contain NIS');

  // Verify database stores ONLY hash, NOT plaintext raw token
  const storedQr = await repo.collection(CollectionName.QR_TOKENS).getById(issued.qrTokenId);
  assert.ok(storedQr);
  assert.notEqual(storedQr!.tokenHash, issued.rawToken);
  assert.equal(storedQr!.tokenHash.length, 64);

  // 2. Unauthenticated & Teacher scan requests are denied
  const unauthScan = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      body: { token: issued.rawToken, eventType: 'CHECK_IN', idempotencyKey: 'idem_unauth_1' },
    },
    unauthScan,
    repo,
    { serverNow: new Date('2026-08-10T06:40:00+07:00') },
  );
  assert.equal(unauthScan.statusCode, 401);

  const teacherScan = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: teacherSession.headers,
      body: { token: issued.rawToken, eventType: 'CHECK_IN', idempotencyKey: 'idem_teacher_1' },
    },
    teacherScan,
    repo,
    { serverNow: new Date('2026-08-10T06:40:00+07:00') },
  );
  assert.equal(teacherScan.statusCode, 403);

  // 3. Valid CHECK_IN scan on Monday 06:40 WIB -> 201 PRESENT, minimal response (no NIS leaked)
  const schoolLoc = (await repo.collection(CollectionName.SCHOOL_LOCATIONS).list()).items[0]!;
  const scan1 = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: issued.rawToken,
        eventType: 'AUTO',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 15,
        idempotencyKey: 'idem_std1_checkin_001',
      },
    },
    scan1,
    repo,
    { serverNow: new Date('2026-08-10T06:40:00+07:00') },
  );
  assert.equal(scan1.statusCode, 201);
  const scan1Data = scan1.body.data as Record<string, unknown>;
  assert.equal(scan1Data.name, student1.fullName);
  assert.equal(scan1Data.status, AttendanceStatus.PRESENT);
  assert.equal(scan1Data.eventType, AttendanceEventType.CHECK_IN);
  assert.equal(scan1Data.nis, undefined, 'Kiosk scan response must NOT expose NIS');
  assert.equal(scan1Data.tokenHash, undefined);

  // 4. Idempotency replay (same idempotencyKey) -> 200 idempotentReplay without creating duplicate
  const replayRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: issued.rawToken,
        eventType: 'CHECK_IN',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 15,
        idempotencyKey: 'idem_std1_checkin_001',
      },
    },
    replayRes,
    repo,
    { serverNow: new Date('2026-08-10T06:40:05+07:00') },
  );
  assert.equal(replayRes.statusCode, 200);
  assert.equal((replayRes.body.data as { idempotentReplay: boolean }).idempotentReplay, true);

  // 5. Duplicate scan with NEW idempotencyKey same student + date + CHECK_IN -> 409 CONFLICT
  const dupRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: issued.rawToken,
        eventType: 'CHECK_IN',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 15,
        idempotencyKey: 'idem_std1_checkin_002',
      },
    },
    dupRes,
    repo,
    { serverNow: new Date('2026-08-10T06:45:00+07:00') },
  );
  assert.equal(dupRes.statusCode, 409);

  // 6. AUTO mode during CHECK_OUT window (12:30 WIB) records CHECK_OUT -> 201
  const outRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: issued.rawToken,
        eventType: 'AUTO',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 15,
        idempotencyKey: 'idem_std1_checkout_001',
      },
    },
    outRes,
    repo,
    { serverNow: new Date('2026-08-10T12:30:00+07:00') },
  );
  assert.equal(outRes.statusCode, 201);
  assert.equal((outRes.body.data as { eventType: string }).eventType, AttendanceEventType.CHECK_OUT);

  // 7. GPS/Geofence enforcement test when rule requires GPS + Geofence
  const studentRule = (
    await repo.collection(CollectionName.ATTENDANCE_RULES).list({
      filters: [
        { field: 'audience', op: '==', value: AttendanceAudience.STUDENT },
        { field: 'isActive', op: '==', value: true },
      ],
    })
  ).items[0]!;
  await repo.collection(CollectionName.ATTENDANCE_RULES).update(studentRule.id, {
    gpsRequired: true,
    geofenceRequired: true,
  });

  const issue2 = createMockRes();
  await handleQrTokens(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { ownerType: QrOwnerType.STUDENT, ownerId: student2.id },
    },
    issue2,
    repo,
  );
  const rawToken2 = (issue2.body.data as { rawToken: string }).rawToken;

  // Missing GPS coordinates -> 400
  const missingGpsRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: rawToken2,
        eventType: 'CHECK_IN',
        idempotencyKey: 'idem_std2_nogps',
      },
    },
    missingGpsRes,
    repo,
    { serverNow: new Date('2026-08-10T07:20:00+07:00') },
  );
  assert.equal(missingGpsRes.statusCode, 400);

  // Far away coordinates (~5 km away) -> 400 geofence rejected
  const farRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: rawToken2,
        eventType: 'CHECK_IN',
        latitude: schoolLoc.latitude + 0.05,
        longitude: schoolLoc.longitude + 0.05,
        gpsAccuracyMeters: 10,
        idempotencyKey: 'idem_std2_far',
      },
    },
    farRes,
    repo,
    { serverNow: new Date('2026-08-10T07:20:00+07:00') },
  );
  assert.equal(farRes.statusCode, 400);

  // Inside geofence at 07:20 WIB -> 201 LATE
  const lateInsideRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: rawToken2,
        eventType: 'CHECK_IN',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 10,
        idempotencyKey: 'idem_std2_late',
      },
    },
    lateInsideRes,
    repo,
    { serverNow: new Date('2026-08-10T07:20:00+07:00') },
  );
  assert.equal(lateInsideRes.statusCode, 201);
  assert.equal((lateInsideRes.body.data as { status: string }).status, AttendanceStatus.LATE);

  // 8. Revoking token prevents future scans (404)
  const revokeRes = createMockRes();
  await handleQrRevoke(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { qrTokenId: issued.qrTokenId, reason: 'Kartu hilang' },
    },
    revokeRes,
    repo,
  );
  assert.equal(revokeRes.statusCode, 200);

  const scanRevoked = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: issued.rawToken,
        eventType: 'CHECK_IN',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 10,
        idempotencyKey: 'idem_std1_revoked',
      },
    },
    scanRevoked,
    repo,
    { serverNow: new Date('2026-08-11T06:40:00+07:00') },
  );
  assert.equal(scanRevoked.statusCode, 404);

  // 9. Inactive student cannot scan
  await repo.collection(CollectionName.STUDENTS).update(student2.id, { status: StudentStatus.INACTIVE });
  const scanInactive = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        token: rawToken2,
        eventType: 'CHECK_IN',
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 10,
        idempotencyKey: 'idem_std2_inactive',
      },
    },
    scanInactive,
    repo,
    { serverNow: new Date('2026-08-11T06:40:00+07:00') },
  );
  assert.equal(scanInactive.statusCode, 400);

  // 10. GET /api/attendance: Principal & Admin can list, Teacher gets 403
  const listPrincipal = createMockRes();
  await handleAttendanceList(
    { method: 'GET', headers: principalSession.headers, query: { date: '2026-08-10' } },
    listPrincipal,
    repo,
  );
  assert.equal(listPrincipal.statusCode, 200);
  const listedItems = (listPrincipal.body.data as { items: Array<{ id: string }> }).items;
  assert.equal(listedItems.length, 3); // std1 in, std1 out, std2 late in

  const listTeacher = createMockRes();
  await handleAttendanceList({ method: 'GET', headers: teacherSession.headers }, listTeacher, repo);
  assert.equal(listTeacher.statusCode, 403);

  // 11. PATCH /api/attendance/:id/correction: Admin succeeds with reason + audit log, Principal gets 403, missing reason gets 400
  const targetId = listedItems[0]!.id;
  const corrNoReason = createMockRes();
  await handleAttendanceCorrection(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: { status: AttendanceStatus.PRESENT, reason: 'ok' },
    },
    corrNoReason,
    targetId,
    repo,
  );
  assert.equal(corrNoReason.statusCode, 400);

  const corrPrincipal = createMockRes();
  await handleAttendanceCorrection(
    {
      method: 'PATCH',
      headers: principalSession.headers,
      body: { status: AttendanceStatus.PRESENT, reason: 'Koreksi tidak diizinkan untuk kepsek' },
    },
    corrPrincipal,
    targetId,
    repo,
  );
  assert.equal(corrPrincipal.statusCode, 403);

  const corrAdmin = createMockRes();
  await handleAttendanceCorrection(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: {
        status: AttendanceStatus.PRESENT,
        reason: 'Siswa sempat izin ke UKS sebelum memindai kartu QR',
      },
    },
    corrAdmin,
    targetId,
    repo,
  );
  assert.equal(corrAdmin.statusCode, 200);
  assert.equal((corrAdmin.body.data as { corrected: boolean }).corrected, true);

  const corrLogs = await repo.collection(CollectionName.ACTIVITY_LOGS).list({
    filters: [{ field: 'action', op: '==', value: 'ATTENDANCE_CORRECTED' }],
  });
  assert.equal(corrLogs.items.length, 1);

  // 12. Portal activate & exit password verification
  const actRes = createMockRes();
  await handlePortalActivate(
    { method: 'POST', ip: '127.0.0.1', body: { username: 'admin', password: 'AdminSecret!2026' } },
    actRes,
    repo,
  );
  assert.equal(actRes.statusCode, 200);
  const portalSession = extractSessionHeaders(actRes);

  // Wrong exit password -> 401
  const wrongExit = createMockRes();
  await handlePortalExit(
    { method: 'POST', headers: portalSession.headers, body: { password: 'WrongPassword!' } },
    wrongExit,
    repo,
  );
  assert.equal(wrongExit.statusCode, 401);

  // Correct exit password -> 200 and revokes portal session
  const okExit = createMockRes();
  await handlePortalExit(
    { method: 'POST', headers: portalSession.headers, body: { password: 'PortalExit!2026' } },
    okExit,
    repo,
  );
  assert.equal(okExit.statusCode, 200);

  // Using the revoked portal session cookie for a scan now fails with 401
  const afterExitScan = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: portalSession.headers,
      body: { token: rawToken2, eventType: 'CHECK_IN', idempotencyKey: 'idem_after_exit' },
    },
    afterExitScan,
    repo,
  );
  assert.equal(afterExitScan.statusCode, 401);
});
