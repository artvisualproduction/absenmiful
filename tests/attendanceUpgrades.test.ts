import assert from 'node:assert/strict';
import test from 'node:test';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../backend/_lib/auth/cookies';
import { hashPassword } from '../backend/_lib/auth/password';
import { createUserSession } from '../backend/_lib/auth/session';
import { buildAttendanceReport } from '../backend/_lib/reports/attendanceReportService';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleAttendanceById } from '../backend/attendance/[id]';
import { handleMyAttendance } from '../backend/attendance/me';
import { handleTeacherSelfAttendance } from '../backend/attendance/teacher-self';
import { handleAttendanceMatrix } from '../backend/reports/matrix';
import { handleTeacherById } from '../backend/teachers/[id]';
import { handleUploadSelfie } from '../backend/uploads/selfie';
import {
  AttendanceEventType,
  AttendanceStatus,
  CollectionName,
  QrOwnerType,
  UserRole,
} from '../src/types';

function makeMockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(name: string, value: string | string[]) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

// Valid minimal 1x1 JPEG data URL (FF D8 FF magic bytes)
const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

test('Principal daily attendance, Superadmin delete attendance, optional GPS, and Teacher 5-day HLT reporting', async () => {
  const repo = new MockRepository();
  const now = new Date('2026-08-03T00:00:00Z'); // Monday 07:00 WIB (2026-08-03)

  const superAdminPass = await hashPassword('SuperAdmin#123');
  const principalPass = await hashPassword('Principal#123');

  const superAdmin = await repo.collection(CollectionName.USERS).create({
    id: 'usr_super_test',
    username: 'supertest',
    normalizedUsername: 'supertest',
    passwordHash: superAdminPass,
    role: UserRole.SUPER_ADMIN,
    linkedTeacherId: null,
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
  });

  const principal = await repo.collection(CollectionName.USERS).create({
    id: 'usr_kepsek_test',
    username: 'kepsektest',
    normalizedUsername: 'kepsektest',
    passwordHash: principalPass,
    role: UserRole.PRINCIPAL,
    linkedTeacherId: null,
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
  });

  const superSession = await createUserSession(repo, superAdmin.id);
  const principalSession = await createUserSession(repo, principal.id);

  const superHeaders = {
    cookie: `${SESSION_COOKIE_NAME}=${superSession.rawSessionToken}; ${CSRF_COOKIE_NAME}=${superSession.csrfToken}`,
    'x-csrf-token': superSession.csrfToken,
  };
  const principalHeaders = {
    cookie: `${SESSION_COOKIE_NAME}=${principalSession.rawSessionToken}; ${CSRF_COOKIE_NAME}=${principalSession.csrfToken}`,
    'x-csrf-token': principalSession.csrfToken,
  };

  // 1. Disable GPS for teachers to confirm self-attendance works without coordinates
  await repo.collection(CollectionName.APP_SETTINGS).update('default', {
    gpsEnabledForTeachers: false,
  });

  // 2. Principal uploads selfie & submits daily self-attendance (auto-linked to tch_06 Kepala Sekolah)
  const selfieRes = makeMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: principalHeaders,
      body: {
        dataUrl: TINY_JPEG_DATA_URL,
        mimeType: 'image/jpeg',
        ownerType: QrOwnerType.TEACHER,
      },
    },
    selfieRes,
    repo,
  );
  assert.equal(selfieRes.statusCode, 201);
  const selfieFileId = (selfieRes.body as { data: { fileId: string } }).data.fileId;
  assert.ok(selfieFileId);

  const selfAttRes = makeMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: principalHeaders,
      body: {
        eventType: 'AUTO',
        latitude: null,
        longitude: null,
        gpsAccuracyMeters: null,
        selfieFileId,
        idempotencyKey: 'principal-att-001',
        clientTimestamp: now.toISOString(),
        deviceInfo: 'UnitTest',
      },
    },
    selfAttRes,
    repo,
    { serverNow: now },
  );
  assert.equal(selfAttRes.statusCode, 201);
  const createdRec = (
    selfAttRes.body as {
      data: {
        record: {
          id: string;
          personId: string;
          status: AttendanceStatus;
          eventType: AttendanceEventType;
        };
      };
    }
  ).data.record;
  assert.equal(createdRec.personId, 'tch_06');
  assert.equal(createdRec.eventType, AttendanceEventType.CHECK_IN);
  assert.equal(createdRec.status, AttendanceStatus.PRESENT);

  // Verify GET /api/attendance/me works for Principal and returns workingDays/HLT metadata
  const meRes = makeMockRes();
  await handleMyAttendance(
    { method: 'GET', headers: principalHeaders, query: { limit: '10' } },
    meRes,
    repo,
  );
  assert.equal(meRes.statusCode, 200);
  const meData = (
    meRes.body as {
      data: {
        linkedTeacherId: string;
        items: Array<{ id: string }>;
        teacherWorkingDays: number[];
      };
    }
  ).data;
  assert.equal(meData.linkedTeacherId, 'tch_06');
  assert.ok(meData.items.some((r) => r.id === createdRec.id));
  assert.deepEqual(meData.teacherWorkingDays, [1, 2, 3, 4, 5, 6]);

  // 3. Configure teacher tch_01 as 5-day teacher (Mon-Fri, Saturday = HLT)
  const patchTeacherRes = makeMockRes();
  await handleTeacherById(
    {
      method: 'PATCH',
      headers: superHeaders,
      body: { workingDays: [1, 2, 3, 4, 5] },
    },
    patchTeacherRes,
    'tch_01',
    repo,
  );
  assert.equal(patchTeacherRes.statusCode, 200);

  // 4. Verify Summary Report & Matrix Report for Mon 2026-08-03 .. Sat 2026-08-08 (6 school days)
  const report = await buildAttendanceReport(repo, {
    period: 'custom',
    dateFrom: '2026-08-03',
    dateTo: '2026-08-08',
    dimension: 'TEACHER',
    unbounded: true,
    now: new Date('2026-08-08T10:00:00Z'),
  });
  const tch01Row = report.items.find((r) => r.personId === 'tch_01');
  const tch02Row = report.items.find((r) => r.personId === 'tch_02');
  assert.ok(tch01Row);
  assert.ok(tch02Row);
  assert.equal(tch01Row.workingDays, 5);
  assert.equal(tch01Row.hlt, 1);
  assert.equal(tch01Row.absent, 5); // 5 working days absent, Saturday is HLT (not Alfa)
  assert.equal(tch02Row.workingDays, 6);
  assert.equal(tch02Row.hlt, 0);
  assert.equal(tch02Row.absent, 6);

  const matrixRes = makeMockRes();
  await handleAttendanceMatrix(
    {
      method: 'GET',
      headers: superHeaders,
      query: {
        period: 'custom',
        dateFrom: '2026-08-03',
        dateTo: '2026-08-08',
        dimension: 'TEACHER',
      },
    },
    matrixRes,
    repo,
    { now: new Date('2026-08-08T10:00:00Z') },
  );
  assert.equal(matrixRes.statusCode, 200);
  const matrixRows = (
    matrixRes.body as {
      data: {
        rows: Array<{
          id: string;
          cells: Record<string, string>;
          summary: { hlt: number; workingDays: number; absent: number };
        }>;
      };
    }
  ).data.rows;
  const mTch01 = matrixRows.find((r) => r.id === 'tch_01');
  const mTch02 = matrixRows.find((r) => r.id === 'tch_02');
  assert.equal(mTch01?.cells['2026-08-08'], 'HLT');
  assert.equal(mTch01?.summary.hlt, 1);
  assert.equal(mTch01?.summary.workingDays, 5);
  assert.equal(mTch02?.cells['2026-08-08'], 'A');
  assert.equal(mTch02?.summary.hlt, 0);

  // 5. Superadmin deletes the Principal's attendance record
  const delRes = makeMockRes();
  await handleAttendanceById(
    {
      method: 'DELETE',
      headers: superHeaders,
    },
    delRes,
    createdRec.id,
    repo,
  );
  assert.equal(delRes.statusCode, 200);
  const afterDelete = await repo.collection(CollectionName.ATTENDANCE_RECORDS).getById(createdRec.id);
  assert.equal(afterDelete, null);
});
