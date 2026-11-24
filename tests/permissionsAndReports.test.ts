import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../backend/_lib/auth/cookies';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleLogin } from '../backend/auth/login';
import { handleDashboardSummary } from '../backend/dashboard/summary';
import { handlePermissionAdminReview } from '../backend/permissions/[id]/admin-review';
import {
  handlePermissionById,
  handlePermissionCancel,
} from '../backend/permissions/[id]/cancel';
import { handlePermissionPrincipalDecision } from '../backend/permissions/[id]/decision';
import { handlePermissions } from '../backend/permissions/index';
import { handleMyPermissions } from '../backend/permissions/me';
import { handleAttendanceReport } from '../backend/reports/attendance';
import { handleReportExport } from '../backend/reports/export';
import { handleGpsSettings } from '../backend/settings/gps';
import { handleUploadPermissionAttachment } from '../backend/uploads/attachment';
import { handleSignedUrl } from '../backend/uploads/signed-url';
import {
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  CollectionName,
  HolidayScope,
  PermissionLeaveType,
  PermissionStatus,
  QrOwnerType,
  ReviewDecision,
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

const VALID_PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF',
).toString('base64')}`;

const FAKE_PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from(
  '<html><body>not a pdf</body></html>',
).toString('base64')}`;

async function setupBootstrappedRepo() {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  const boot = await bootstrapInitialAccounts(repo, {
    superAdminPassword: 'SuperPassword#2026',
    adminPassword: 'AdminPassword#2026',
    principalPassword: 'PrincipalPassword#2026',
  });
  const teacherAccounts = boot.accounts.filter((a) => a.role === UserRole.TEACHER);
  assert.ok(teacherAccounts.length >= 2, 'Harus tersedia minimal 2 akun guru dari bootstrap.');
  // Simulate teachers completing initial password change so protected endpoints are active
  await repo.collection(CollectionName.USERS).update(teacherAccounts[0].userId, {
    mustChangePassword: false,
  });
  await repo.collection(CollectionName.USERS).update(teacherAccounts[1].userId, {
    mustChangePassword: false,
  });
  return {
    repo,
    adminCreds: { username: 'admin', password: 'AdminPassword#2026' },
    principalCreds: { username: 'kepsek', password: 'PrincipalPassword#2026' },
    teacher1Creds: {
      username: teacherAccounts[0].username,
      password: teacherAccounts[0].temporaryPassword ?? '',
    },
    teacher2Creds: {
      username: teacherAccounts[1].username,
      password: teacherAccounts[1].temporaryPassword ?? '',
    },
  };
}

test('Tahap 7: Urutan wajib Admin -> Kepala Sekolah, tolak lompatan status, & validasi lampiran PDF', async () => {
  const { repo, adminCreds, principalCreds, teacher1Creds } = await setupBootstrappedRepo();

  const teacher1Session = await loginAs(repo, teacher1Creds.username, teacher1Creds.password);
  const adminSession = await loginAs(repo, adminCreds.username, adminCreds.password);
  const principalSession = await loginAs(repo, principalCreds.username, principalCreds.password);

  // 1. Fake PDF magic bytes must be rejected
  const badUploadRes = createMockRes();
  await handleUploadPermissionAttachment(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        dataUrl: FAKE_PDF_DATA_URL,
        mimeType: 'application/pdf',
        fileName: 'palsu.pdf',
      },
    },
    badUploadRes,
    repo,
  );
  assert.equal(badUploadRes.statusCode, 400);

  // 2. Valid PDF upload succeeds
  const uploadRes = createMockRes();
  await handleUploadPermissionAttachment(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        dataUrl: VALID_PDF_DATA_URL,
        mimeType: 'application/pdf',
        fileName: 'surat-dokter.pdf',
      },
    },
    uploadRes,
    repo,
  );
  assert.equal(uploadRes.statusCode, 201);
  const uploadedFileId = (uploadRes.body.data as { fileId: string }).fileId;
  assert.ok(uploadedFileId);

  // 3. Teacher submits permission (status = SUBMITTED)
  const submitRes = createMockRes();
  await handlePermissions(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        leaveType: PermissionLeaveType.SICK,
        startAt: '2026-11-16T07:00:00+07:00',
        endAt: '2026-11-16T15:00:00+07:00',
        reason: 'Demam tinggi dan istirahat sesuai surat dokter klinik.',
        attachmentFileIds: [uploadedFileId],
      },
    },
    submitRes,
    repo,
  );
  assert.equal(submitRes.statusCode, 201);
  const permissionId = (submitRes.body.data as { id: string }).id;
  assert.equal((submitRes.body.data as { status: string }).status, PermissionStatus.SUBMITTED);

  // 4. CRITICAL: Principal CANNOT decide before Admin review (status jump rejected 409)
  const jumpRes = createMockRes();
  await handlePermissionPrincipalDecision(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: {
        decision: ReviewDecision.APPROVE,
        note: 'Mencoba langsung menyetujui tanpa review Admin.',
      },
    },
    jumpRes,
    permissionId,
    repo,
  );
  assert.equal(jumpRes.statusCode, 409);
  assert.equal((jumpRes.body.error as { code: string }).code, 'WORKFLOW_ORDER_VIOLATION');

  // 5. Admin returns permission (note required -> empty note rejected 400, valid note succeeds -> RETURNED)
  const badReturnRes = createMockRes();
  await handlePermissionAdminReview(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { decision: ReviewDecision.RETURN, note: '' },
    },
    badReturnRes,
    permissionId,
    repo,
  );
  assert.equal(badReturnRes.statusCode, 400);

  const returnRes = createMockRes();
  await handlePermissionAdminReview(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        decision: ReviewDecision.RETURN,
        note: 'Mohon lengkapi nama guru pengganti untuk jam pertama.',
      },
    },
    returnRes,
    permissionId,
    repo,
  );
  assert.equal(returnRes.statusCode, 200);
  assert.equal((returnRes.body.data as { status: string }).status, PermissionStatus.RETURNED);

  // Principal still cannot decide on RETURNED permission
  const jumpReturnedRes = createMockRes();
  await handlePermissionPrincipalDecision(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: { decision: ReviewDecision.APPROVE, note: 'Tetap tidak boleh lompat.' },
    },
    jumpReturnedRes,
    permissionId,
    repo,
  );
  assert.equal(jumpReturnedRes.statusCode, 409);

  // 6. Teacher revises and resubmits (RETURNED -> SUBMITTED)
  const resubmitRes = createMockRes();
  await handlePermissionById(
    {
      method: 'PATCH',
      headers: teacher1Session.headers,
      body: {
        leaveType: PermissionLeaveType.SICK,
        startAt: '2026-11-16T07:00:00+07:00',
        endAt: '2026-11-16T15:00:00+07:00',
        reason: 'Demam tinggi sesuai surat dokter; jam mengajar dialihkan ke guru piket.',
        attachmentFileIds: [uploadedFileId],
      },
    },
    resubmitRes,
    permissionId,
    repo,
  );
  assert.equal(resubmitRes.statusCode, 200);
  assert.equal((resubmitRes.body.data as { status: string }).status, PermissionStatus.SUBMITTED);

  // 7. Admin verifies & recommends approval (SUBMITTED -> ADMIN_REVIEWED)
  const recommendRes = createMockRes();
  await handlePermissionAdminReview(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        decision: ReviewDecision.RECOMMEND_APPROVE,
        note: 'Kelengkapan surat dokter sudah sesuai.',
      },
    },
    recommendRes,
    permissionId,
    repo,
  );
  assert.equal(recommendRes.statusCode, 200);
  assert.equal((recommendRes.body.data as { status: string }).status, PermissionStatus.ADMIN_REVIEWED);

  // 8. Principal approves (ADMIN_REVIEWED -> APPROVED)
  const approveRes = createMockRes();
  await handlePermissionPrincipalDecision(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: {
        decision: ReviewDecision.APPROVE,
        note: 'Disetujui, semoga lekas sembuh.',
      },
    },
    approveRes,
    permissionId,
    repo,
  );
  assert.equal(approveRes.statusCode, 200);
  const approvedData = approveRes.body.data as {
    status: string;
    adminReview: { reviewerId: string; note: string; reviewedAt: string };
    principalDecision: { reviewerId: string; note: string; decidedAt: string };
  };
  assert.equal(approvedData.status, PermissionStatus.APPROVED);
  assert.ok(approvedData.adminReview?.reviewerId);
  assert.ok(approvedData.adminReview?.reviewedAt);
  assert.ok(approvedData.principalDecision?.reviewerId);
  assert.ok(approvedData.principalDecision?.decidedAt);
  assert.equal(approvedData.principalDecision?.note, 'Disetujui, semoga lekas sembuh.');

  // 9. Terminal state: Teacher cannot cancel an already APPROVED permission
  const lateCancelRes = createMockRes();
  await handlePermissionCancel(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: { reason: 'Coba batal setelah disetujui' },
    },
    lateCancelRes,
    permissionId,
    repo,
  );
  assert.equal(lateCancelRes.statusCode, 409);

  // 10. Verify every transition was recorded in activityLogs
  const logs = (await repo.collection(CollectionName.ACTIVITY_LOGS).list()).items;
  const actions = logs.map((l) => l.action);
  assert.ok(actions.includes('PERMISSION_SUBMITTED'));
  assert.ok(actions.includes('PERMISSION_ADMIN_RETURNED'));
  assert.ok(actions.includes('PERMISSION_RESUBMITTED'));
  assert.ok(actions.includes('PERMISSION_ADMIN_RECOMMENDED'));
  assert.ok(actions.includes('PERMISSION_PRINCIPAL_APPROVED'));
});

test('Tahap 7: Pencegahan IDOR — guru tidak dapat melihat, membatalkan, atau mengakses lampiran izin guru lain', async () => {
  const { repo, teacher1Creds, teacher2Creds } = await setupBootstrappedRepo();

  const teacher1Session = await loginAs(repo, teacher1Creds.username, teacher1Creds.password);
  const teacher2Session = await loginAs(repo, teacher2Creds.username, teacher2Creds.password);

  // Teacher 1 uploads attachment & creates permission
  const uploadRes = createMockRes();
  await handleUploadPermissionAttachment(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        dataUrl: VALID_PDF_DATA_URL,
        mimeType: 'application/pdf',
        fileName: 'rahasia-guru1.pdf',
      },
    },
    uploadRes,
    repo,
  );
  assert.equal(uploadRes.statusCode, 201);
  const fileId = (uploadRes.body.data as { fileId: string }).fileId;

  const submitRes = createMockRes();
  await handlePermissions(
    {
      method: 'POST',
      headers: teacher1Session.headers,
      body: {
        leaveType: PermissionLeaveType.PERSONAL,
        startAt: '2026-11-17T07:00:00+07:00',
        endAt: '2026-11-17T14:00:00+07:00',
        reason: 'Keperluan keluarga mendesak di luar kota.',
        attachmentFileIds: [fileId],
      },
    },
    submitRes,
    repo,
  );
  assert.equal(submitRes.statusCode, 201);
  const permId = (submitRes.body.data as { id: string }).id;

  // Teacher 2 cannot list global /api/permissions
  const listAllRes = createMockRes();
  await handlePermissions({ method: 'GET', headers: teacher2Session.headers }, listAllRes, repo);
  assert.equal(listAllRes.statusCode, 403);

  // Teacher 2'../backend/permissions/me returns 0 items (never leaks Teacher 1's permission)
  const myRes = createMockRes();
  await handleMyPermissions({ method: 'GET', headers: teacher2Session.headers }, myRes, repo);
  assert.equal(myRes.statusCode, 200);
  assert.equal((myRes.body.data as { items: unknown[] }).items.length, 0);

  // Teacher 2 cannot view Teacher 1's permission by ID
  const getByIdRes = createMockRes();
  await handlePermissionById(
    { method: 'GET', headers: teacher2Session.headers },
    getByIdRes,
    permId,
    repo,
  );
  assert.equal(getByIdRes.statusCode, 403);

  // Teacher 2 cannot cancel Teacher 1's permission
  const cancelRes = createMockRes();
  await handlePermissionCancel(
    { method: 'POST', headers: teacher2Session.headers, body: {} },
    cancelRes,
    permId,
    repo,
  );
  assert.equal(cancelRes.statusCode, 403);

  // Teacher 2 cannot obtain signed URL for Teacher 1's attachment
  const signedRes = createMockRes();
  await handleSignedUrl(
    { method: 'POST', headers: teacher2Session.headers, body: { fileId } },
    signedRes,
    repo,
  );
  assert.equal(signedRes.statusCode, 403);
});

test('Tahap 8: Rekap laporan menghitung hari kerja, libur, dampak izin disetujui, paginasi cursor, RBAC guru, audit ekspor & badge dashboard', async () => {
  const { repo, adminCreds, principalCreds, teacher1Creds } = await setupBootstrappedRepo();

  const adminSession = await loginAs(repo, adminCreds.username, adminCreds.password);
  const principalSession = await loginAs(repo, principalCreds.username, principalCreds.password);
  const teacher1Session = await loginAs(repo, teacher1Creds.username, teacher1Creds.password);

  // Identify teacher1 entity
  const users = (await repo.collection(CollectionName.USERS).list()).items;
  const teacher1User = users.find((u) => u.username === teacher1Creds.username)!;
  assert.ok(teacher1User.linkedTeacherId);
  const teacher1Profile = await repo
    .collection(CollectionName.TEACHERS)
    .getById(teacher1User.linkedTeacherId);
  const teacher1Name = teacher1Profile?.fullName ?? teacher1User.username;

  // Seed 1 holiday inside week 2026-11-16 (Mon) .. 2026-11-21 (Sat) -> Wed 2026-11-18 is holiday
  await repo.collection(CollectionName.HOLIDAYS).create({
    date: '2026-11-18',
    name: 'Hari Libur Nasional Uji',
    scope: HolidayScope.SCHOOL,
    isActive: true,
  });

  // Teacher 1 has:
  // - Mon 2026-11-16: PRESENT (Check-in & Check-out)
  // - Tue 2026-11-17: LATE (Check-in only -> missingCheckOut = 1)
  // - Wed 2026-11-18: HOLIDAY (excluded from working days!)
  // - Thu 2026-11-19: Approved SICK permission
  // - Fri 2026-11-20: Approved PERSONAL permission
  // - Sat 2026-11-21: No attendance -> ABSENT (1)
  const attCol = repo.collection(CollectionName.ATTENDANCE_RECORDS);
  await attCol.create({
    personType: QrOwnerType.TEACHER,
    personId: teacher1User.linkedTeacherId,
    personNameSnapshot: teacher1Name,
    niyNipSnapshot: teacher1Profile?.niyNip ?? '19800101',
    classIdSnapshot: null,
    classNameSnapshot: null,
    attendanceDate: '2026-11-16',
    eventType: AttendanceEventType.CHECK_IN,
    status: AttendanceStatus.PRESENT,
    method: AttendanceMethod.SELF_SERVICE_SELFIE,
    serverTimestamp: '2026-11-16T06:55:00+07:00',
    clientTimestamp: null,
    latitude: null,
    longitude: null,
    gpsAccuracyMeters: null,
    distanceFromSchoolMeters: null,
    geofencePassed: true,
    selfiePath: null,
    deviceInfo: null,
    idempotencyKey: 'rpt-t1-mon-in',
    corrected: false,
    correctionReason: null,
  });
  await attCol.create({
    personType: QrOwnerType.TEACHER,
    personId: teacher1User.linkedTeacherId,
    personNameSnapshot: teacher1Name,
    niyNipSnapshot: teacher1Profile?.niyNip ?? '19800101',
    classIdSnapshot: null,
    classNameSnapshot: null,
    attendanceDate: '2026-11-16',
    eventType: AttendanceEventType.CHECK_OUT,
    status: AttendanceStatus.PRESENT,
    method: AttendanceMethod.SELF_SERVICE_SELFIE,
    serverTimestamp: '2026-11-16T14:05:00+07:00',
    clientTimestamp: null,
    latitude: null,
    longitude: null,
    gpsAccuracyMeters: null,
    distanceFromSchoolMeters: null,
    geofencePassed: true,
    selfiePath: null,
    deviceInfo: null,
    idempotencyKey: 'rpt-t1-mon-out',
    corrected: false,
    correctionReason: null,
  });
  await attCol.create({
    personType: QrOwnerType.TEACHER,
    personId: teacher1User.linkedTeacherId,
    personNameSnapshot: teacher1Name,
    niyNipSnapshot: teacher1Profile?.niyNip ?? '19800101',
    classIdSnapshot: null,
    classNameSnapshot: null,
    attendanceDate: '2026-11-17',
    eventType: AttendanceEventType.CHECK_IN,
    status: AttendanceStatus.LATE,
    method: AttendanceMethod.SELF_SERVICE_SELFIE,
    serverTimestamp: '2026-11-17T07:20:00+07:00',
    clientTimestamp: null,
    latitude: null,
    longitude: null,
    gpsAccuracyMeters: null,
    distanceFromSchoolMeters: null,
    geofencePassed: true,
    selfiePath: null,
    deviceInfo: null,
    idempotencyKey: 'rpt-t1-tue-in',
    corrected: false,
    correctionReason: null,
  });

  // Create two approved permissions (Thu SICK, Fri PERSONAL) + 1 SUBMITTED + 1 ADMIN_REVIEWED
  const permCol = repo.collection(CollectionName.TEACHER_PERMISSIONS);
  const emptyAdminReview = { reviewerId: null, decision: null, note: null, reviewedAt: null };
  const emptyPrincipalDecision = { reviewerId: null, decision: null, note: null, decidedAt: null };

  await permCol.create({
    teacherId: teacher1User.linkedTeacherId,
    teacherNameSnapshot: teacher1Name,
    leaveType: PermissionLeaveType.SICK,
    startAt: '2026-11-19T07:00:00+07:00',
    endAt: '2026-11-19T15:00:00+07:00',
    reason: 'Sakit flu',
    attachmentPaths: [],
    status: PermissionStatus.APPROVED,
    adminReview: {
      reviewerId: 'admin',
      decision: ReviewDecision.RECOMMEND_APPROVE,
      note: 'OK',
      reviewedAt: '2026-11-18T10:00:00+07:00',
    },
    principalDecision: {
      reviewerId: 'kepsek',
      decision: ReviewDecision.APPROVE,
      note: 'Disetujui',
      decidedAt: '2026-11-18T11:00:00+07:00',
    },
  });
  await permCol.create({
    teacherId: teacher1User.linkedTeacherId,
    teacherNameSnapshot: teacher1Name,
    leaveType: PermissionLeaveType.PERSONAL,
    startAt: '2026-11-20T07:00:00+07:00',
    endAt: '2026-11-20T15:00:00+07:00',
    reason: 'Urusan keluarga',
    attachmentPaths: [],
    status: PermissionStatus.APPROVED,
    adminReview: {
      reviewerId: 'admin',
      decision: ReviewDecision.RECOMMEND_APPROVE,
      note: 'OK',
      reviewedAt: '2026-11-19T10:00:00+07:00',
    },
    principalDecision: {
      reviewerId: 'kepsek',
      decision: ReviewDecision.APPROVE,
      note: 'Disetujui',
      decidedAt: '2026-11-19T11:00:00+07:00',
    },
  });
  await permCol.create({
    teacherId: teacher1User.linkedTeacherId,
    teacherNameSnapshot: teacher1Name,
    leaveType: PermissionLeaveType.OTHER,
    startAt: '2026-11-23T07:00:00+07:00',
    endAt: '2026-11-23T14:00:00+07:00',
    reason: 'Menunggu verifikasi admin',
    attachmentPaths: [],
    status: PermissionStatus.SUBMITTED,
    adminReview: emptyAdminReview,
    principalDecision: emptyPrincipalDecision,
  });
  await permCol.create({
    teacherId: teacher1User.linkedTeacherId,
    teacherNameSnapshot: teacher1Name,
    leaveType: PermissionLeaveType.OFFICIAL_DUTY,
    startAt: '2026-11-24T07:00:00+07:00',
    endAt: '2026-11-24T14:00:00+07:00',
    reason: 'Rapat KKG Kecamatan',
    attachmentPaths: [],
    status: PermissionStatus.ADMIN_REVIEWED,
    adminReview: {
      reviewerId: 'admin',
      decision: ReviewDecision.RECOMMEND_APPROVE,
      note: 'Surat tugas terlampir',
      reviewedAt: '2026-11-22T10:00:00+07:00',
    },
    principalDecision: emptyPrincipalDecision,
  });

  // 1. Admin queries weekly report for TEACHERS (2026-11-16..2026-11-22 -> 6 working days minus 1 holiday = 5)
  const teacherRptRes = createMockRes();
  await handleAttendanceReport(
    {
      method: 'GET',
      headers: adminSession.headers,
      query: {
        period: 'custom',
        dateFrom: '2026-11-16',
        dateTo: '2026-11-22',
        dimension: 'TEACHER',
      },
    },
    teacherRptRes,
    repo,
  );
  assert.equal(teacherRptRes.statusCode, 200);
  const teacherRpt = teacherRptRes.body.data as {
    workingDaysCount: number;
    items: Array<{
      personId: string;
      workingDays: number;
      present: number;
      late: number;
      sick: number;
      excused: number;
      absent: number;
      missingCheckOut: number;
    }>;
  };
  assert.equal(teacherRpt.workingDaysCount, 5);
  const t1Row = teacherRpt.items.find((r) => r.personId === teacher1User.linkedTeacherId)!;
  assert.ok(t1Row);
  assert.equal(t1Row.workingDays, 5);
  assert.equal(t1Row.present, 1);
  assert.equal(t1Row.late, 1);
  assert.equal(t1Row.sick, 1, 'Approved SICK permission must count as sick, not absent');
  assert.equal(t1Row.excused, 1, 'Approved PERSONAL permission must count as excused, not absent');
  assert.equal(t1Row.absent, 1, 'Only Saturday without attendance/permission is absent');
  assert.equal(t1Row.missingCheckOut, 1, 'Tuesday had check-in without check-out');

  // 2. Toggle approvedPermissionAffectsRecap = false -> sick & excused revert to absent (absent = 3)
  const toggleOffRes = createMockRes();
  await handleGpsSettings(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: { approvedPermissionAffectsRecap: false },
    },
    toggleOffRes,
    repo,
  );
  assert.equal(toggleOffRes.statusCode, 200);

  const policyOffRptRes = createMockRes();
  await handleAttendanceReport(
    {
      method: 'GET',
      headers: adminSession.headers,
      query: {
        period: 'custom',
        dateFrom: '2026-11-16',
        dateTo: '2026-11-22',
        dimension: 'TEACHER',
      },
    },
    policyOffRptRes,
    repo,
  );
  const t1OffRow = (
    policyOffRptRes.body.data as {
      items: Array<{ personId: string; sick: number; excused: number; absent: number }>;
    }
  ).items.find((r) => r.personId === teacher1User.linkedTeacherId)!;
  assert.equal(t1OffRow.sick, 0);
  assert.equal(t1OffRow.excused, 0);
  assert.equal(t1OffRow.absent, 3);

  // Restore policy to true
  await handleGpsSettings(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: { approvedPermissionAffectsRecap: true },
    },
    createMockRes(),
    repo,
  );

  // 3. Cursor pagination on student report
  const page1Res = createMockRes();
  await handleAttendanceReport(
    {
      method: 'GET',
      headers: adminSession.headers,
      query: {
        period: 'daily',
        referenceDate: '2026-11-16',
        dimension: 'STUDENT',
        limit: '5',
      },
    },
    page1Res,
    repo,
  );
  assert.equal(page1Res.statusCode, 200);
  const p1 = page1Res.body.data as {
    items: Array<{ id: string }>;
    total: number;
    nextCursor: string | null;
  };
  assert.equal(p1.items.length, 5);
  assert.ok(p1.total > 5);
  assert.ok(p1.nextCursor);

  const page2Res = createMockRes();
  await handleAttendanceReport(
    {
      method: 'GET',
      headers: adminSession.headers,
      query: {
        period: 'daily',
        referenceDate: '2026-11-16',
        dimension: 'STUDENT',
        limit: '5',
        cursor: p1.nextCursor!,
      },
    },
    page2Res,
    repo,
  );
  const p2 = page2Res.body.data as { items: Array<{ id: string }> };
  assert.equal(p2.items.length, 5);
  const overlap = p2.items.filter((i) => p1.items.some((j) => j.id === i.id));
  assert.equal(overlap.length, 0, 'Halaman cursor kedua tidak boleh tumpang tindih.');

  // 4. RBAC: Teacher requesting STUDENT report ONLY ever receives own row
  const teacherAttemptRes = createMockRes();
  await handleAttendanceReport(
    {
      method: 'GET',
      headers: teacher1Session.headers,
      query: {
        period: 'custom',
        dateFrom: '2026-11-16',
        dateTo: '2026-11-22',
        dimension: 'STUDENT',
      },
    },
    teacherAttemptRes,
    repo,
  );
  assert.equal(teacherAttemptRes.statusCode, 200);
  const teacherAttempt = teacherAttemptRes.body.data as {
    dimension: string;
    items: Array<{ personId: string }>;
  };
  assert.equal(teacherAttempt.dimension, 'TEACHER');
  assert.equal(teacherAttempt.items.length, 1);
  assert.equal(teacherAttempt.items[0].personId, teacher1User.linkedTeacherId);

  // 5. Export logs REPORT_EXPORTED to activityLogs and embeds schoolName, generatedAt, appliedFilters
  const exportRes = createMockRes();
  await handleReportExport(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: {
        format: 'PDF',
        period: 'custom',
        dateFrom: '2026-11-16',
        dateTo: '2026-11-22',
        dimension: 'TEACHER',
      },
    },
    exportRes,
    repo,
  );
  assert.equal(exportRes.statusCode, 200);
  const exported = exportRes.body.data as {
    schoolName: string;
    generatedAt: string;
    format: string;
    appliedFilters: { dateFrom: string; dateTo: string; dimension: string };
  };
  assert.ok(exported.schoolName.includes('MI Miftahul Ulum'));
  assert.ok(exported.generatedAt);
  assert.equal(exported.format, 'PDF');
  assert.equal(exported.appliedFilters.dateFrom, '2026-11-16');

  const auditLogs = (await repo.collection(CollectionName.ACTIVITY_LOGS).list()).items;
  assert.ok(auditLogs.some((l) => l.action === 'REPORT_EXPORTED'));

  // 6. Dashboard summary returns accurate pendingAdminPermissions & pendingPrincipalPermissions badge counts
  const dashRes = createMockRes();
  await handleDashboardSummary(
    {
      method: 'GET',
      headers: principalSession.headers,
      query: { date: '2026-11-16', dimension: 'ALL' },
    },
    dashRes,
    repo,
  );
  assert.equal(dashRes.statusCode, 200);
  const dash = dashRes.body.data as {
    kpis: {
      activeStudents: number;
      activeTeachers: number;
      pendingAdminPermissions: number;
      pendingPrincipalPermissions: number;
    };
    pendingPrincipalList: unknown[];
    recentDecisions: unknown[];
  };
  assert.ok(dash.kpis.activeStudents > 0);
  assert.ok(dash.kpis.activeTeachers > 0);
  assert.equal(dash.kpis.pendingAdminPermissions, 1);
  assert.equal(dash.kpis.pendingPrincipalPermissions, 1);
  assert.equal(dash.pendingPrincipalList.length, 1);
  assert.equal(dash.recentDecisions.length, 2);
});
