import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../backend/_lib/auth/cookies';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleAttendanceRules } from '../backend/attendance-rules/index';
import { handleLogin } from '../backend/auth/login';
import { handleHolidayById, handleHolidays } from '../backend/holidays/index';
import { handleScheduleById } from '../backend/schedules/[id]';
import { handleSchedules } from '../backend/schedules/index';
import { handleMyTeacherSchedule } from '../backend/teachers/me/schedule';
import { evaluateAttendanceStatus } from '../src/lib/attendanceEvaluator';
import {
  AttendanceAudience,
  AttendanceEventType,
  AttendanceStatus,
  CollectionName,
  HolidayScope,
  UserRole,
  type AttendanceRule,
  type Holiday,
} from '../src/types';

const BASE_STUDENT_RULE: AttendanceRule = {
  id: 'rule_student_test',
  name: 'Aturan Jam Absensi Siswa',
  version: 1,
  audience: AttendanceAudience.STUDENT,
  classIds: [],
  daysOfWeek: [1, 2, 3, 4, 5, 6], // Senin..Sabtu
  checkInStart: '06:15',
  lateAfter: '07:00',
  lateToleranceMinutes: 0,
  checkInDeadline: '09:00',
  checkOutStart: '12:00',
  checkOutDeadline: '15:30',
  timezone: 'Asia/Jakarta',
  gpsRequired: false,
  geofenceRequired: false,
  effectiveFrom: '2026-07-01T00:00:00+07:00',
  effectiveUntil: null,
  isActive: true,
  createdBy: 'system',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const SCHOOL_HOLIDAY: Holiday = {
  id: 'hol_test_1',
  date: '2026-08-17',
  name: 'Hari Kemerdekaan RI',
  scope: HolidayScope.SCHOOL,
  isActive: true,
  createdBy: 'system',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const STUDENT_ONLY_HOLIDAY: Holiday = {
  id: 'hol_test_2',
  date: '2026-08-18',
  name: 'Rapat Kerja Guru (Siswa Belajar di Rumah)',
  scope: HolidayScope.STUDENT,
  isActive: true,
  createdBy: 'system',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

test('evaluateAttendanceStatus: CHECK_IN exact boundaries, before window, late, tolerance, and after deadline', () => {
  // 2026-08-10 is Monday (day 1)
  // 1 minute before checkInStart -> REJECTED
  const beforeStart = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T06:14:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(beforeStart.status, AttendanceStatus.REJECTED);
  assert.equal(beforeStart.lateMinutes, 0);

  // Exact checkInStart boundary -> PRESENT
  const atStart = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T06:15:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(atStart.status, AttendanceStatus.PRESENT);
  assert.equal(atStart.lateMinutes, 0);

  // Exact lateAfter boundary -> PRESENT (not late yet)
  const atLateBoundary = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T07:00:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(atLateBoundary.status, AttendanceStatus.PRESENT);
  assert.equal(atLateBoundary.lateMinutes, 0);

  // 1 minute after lateAfter -> LATE (1 minute)
  const oneMinLate = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T07:01:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(oneMinLate.status, AttendanceStatus.LATE);
  assert.equal(oneMinLate.lateMinutes, 1);

  // Tolerance minutes (5 minutes): 07:05 is still PRESENT, 07:06 is LATE (1 minute)
  const ruleWithTolerance: AttendanceRule = {
    ...BASE_STUDENT_RULE,
    lateToleranceMinutes: 5,
  };
  const atToleranceEnd = evaluateAttendanceStatus(
    ruleWithTolerance,
    '2026-08-10T07:05:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(atToleranceEnd.status, AttendanceStatus.PRESENT);
  assert.equal(atToleranceEnd.lateMinutes, 0);

  const pastTolerance = evaluateAttendanceStatus(
    ruleWithTolerance,
    '2026-08-10T07:06:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(pastTolerance.status, AttendanceStatus.LATE);
  assert.equal(pastTolerance.lateMinutes, 1);

  // Exact checkInDeadline -> LATE (still accepted)
  const atDeadline = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T09:00:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(atDeadline.status, AttendanceStatus.LATE);
  assert.equal(atDeadline.lateMinutes, 120);

  // 1 minute after checkInDeadline -> REJECTED
  const pastDeadline = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T09:01:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(pastDeadline.status, AttendanceStatus.REJECTED);
});

test('evaluateAttendanceStatus: CHECK_OUT boundaries', () => {
  const beforeOut = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T11:59:00+07:00',
    AttendanceEventType.CHECK_OUT,
  );
  assert.equal(beforeOut.status, AttendanceStatus.REJECTED);

  const atOutStart = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T12:00:00+07:00',
    AttendanceEventType.CHECK_OUT,
  );
  assert.equal(atOutStart.status, AttendanceStatus.PRESENT);

  const atOutDeadline = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T15:30:00+07:00',
    AttendanceEventType.CHECK_OUT,
  );
  assert.equal(atOutDeadline.status, AttendanceStatus.PRESENT);

  const afterOutDeadline = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-10T15:31:00+07:00',
    AttendanceEventType.CHECK_OUT,
  );
  assert.equal(afterOutDeadline.status, AttendanceStatus.REJECTED);
});

test('evaluateAttendanceStatus: holidays per scope, inactive weekday, and rule effective window', () => {
  // Sunday (2026-08-16) is inactive (day 7) -> REJECTED
  const sunday = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-16T06:45:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(sunday.status, AttendanceStatus.REJECTED);
  assert.match(sunday.reason, /Minggu/);

  // School-wide holiday blocks students and teachers
  const holidayStudent = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-17T06:45:00+07:00',
    AttendanceEventType.CHECK_IN,
    { holidays: [SCHOOL_HOLIDAY, STUDENT_ONLY_HOLIDAY] },
  );
  assert.equal(holidayStudent.status, AttendanceStatus.REJECTED);
  assert.match(holidayStudent.reason, /Kemerdekaan/);

  // Student-only holiday blocks STUDENT but NOT TEACHER
  const studentBlocked = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-18T06:45:00+07:00',
    AttendanceEventType.CHECK_IN,
    { holidays: [STUDENT_ONLY_HOLIDAY] },
  );
  assert.equal(studentBlocked.status, AttendanceStatus.REJECTED);

  const teacherRule: AttendanceRule = {
    ...BASE_STUDENT_RULE,
    id: 'rule_teacher_test',
    audience: AttendanceAudience.TEACHER,
  };
  const teacherAllowed = evaluateAttendanceStatus(
    teacherRule,
    '2026-08-18T06:45:00+07:00',
    AttendanceEventType.CHECK_IN,
    { holidays: [STUDENT_ONLY_HOLIDAY] },
  );
  assert.equal(teacherAllowed.status, AttendanceStatus.PRESENT);

  // Before effectiveFrom -> REJECTED
  const beforeEffective = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-06-30T06:45:00+07:00',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(beforeEffective.status, AttendanceStatus.REJECTED);

  // Timezone check: UTC 2026-08-09T23:30:00Z is 2026-08-10 06:30 WIB (Monday) -> PRESENT
  const utcConvertedToJakarta = evaluateAttendanceStatus(
    BASE_STUDENT_RULE,
    '2026-08-09T23:30:00.000Z',
    AttendanceEventType.CHECK_IN,
  );
  assert.equal(utcConvertedToJakarta.jakartaDate, '2026-08-10');
  assert.equal(utcConvertedToJakarta.jakartaTime, '06:30');
  assert.equal(utcConvertedToJakarta.status, AttendanceStatus.PRESENT);
});

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

async function loginAs(repo: MockRepository, username: string, password: string) {
  const res = createMockRes();
  await handleLogin({ method: 'POST', ip: '127.0.0.1', body: { username, password } }, res, repo);
  assert.equal(res.statusCode, 200);
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

test('Stage 4 API: Schedule conflict validation, teacher self-scope, versioned rules, holidays, and RBAC', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();

  const boot = await bootstrapInitialAccounts(repo, {
    superAdminPassword: 'SuperSecret!2026',
    adminPassword: 'AdminSecret!2026',
    principalPassword: 'KepsekSecret!2026',
  });

  const adminSession = await loginAs(repo, 'admin', 'AdminSecret!2026');
  const principalSession = await loginAs(repo, 'kepsek', 'KepsekSecret!2026');

  const teacherAccounts = boot.accounts.filter((a) => a.role === UserRole.TEACHER);
  assert.ok(teacherAccounts.length >= 2);
  const teacherA = teacherAccounts[0]!;
  await repo.collection(CollectionName.USERS).update(teacherA.userId, { mustChangePassword: false });
  const teacherASession = await loginAs(repo, teacherA.username, teacherA.temporaryPassword!);

  const teachersRes = await repo.collection(CollectionName.TEACHERS).list();
  const subjectsRes = await repo.collection(CollectionName.SUBJECTS).list();
  const classesRes = await repo.collection(CollectionName.CLASSES).list();

  const teacherUserA = await repo.collection(CollectionName.USERS).getById(teacherA.userId);
  const linkedTeacherIdA = teacherUserA!.linkedTeacherId!;
  const otherTeacher = teachersRes.items.find((t) => t.id !== linkedTeacherIdA)!;
  const subj = subjectsRes.items[0]!;
  const classA = classesRes.items[0]!;
  const classB = classesRes.items[1]!;

  // 1. Create a schedule for teacherA on Friday 10:00-11:00 in classA
  const createRes = createMockRes();
  await handleSchedules(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        teacherId: linkedTeacherIdA,
        subjectId: subj.id,
        classId: classA.id,
        dayOfWeek: 5,
        startTime: '10:00',
        endTime: '11:00',
        room: 'Ruang Uji',
        effectiveFrom: '2026-07-01T00:00:00+07:00',
        effectiveUntil: null,
        isActive: true,
      },
    },
    createRes,
    repo,
  );
  assert.equal(createRes.statusCode, 201);
  const createdScheduleId = (createRes.body.data as { id: string }).id;

  // 2. Teacher conflict (same teacher, different class, overlapping 10:30-11:30) -> 409
  const teacherConflictRes = createMockRes();
  await handleSchedules(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        teacherId: linkedTeacherIdA,
        subjectId: subj.id,
        classId: classB.id,
        dayOfWeek: 5,
        startTime: '10:30',
        endTime: '11:30',
        effectiveFrom: '2026-07-01T00:00:00+07:00',
        isActive: true,
      },
    },
    teacherConflictRes,
    repo,
  );
  assert.equal(teacherConflictRes.statusCode, 409);

  // 3. Class conflict (different teacher, same classA, overlapping 10:15-10:45) -> 409
  const classConflictRes = createMockRes();
  await handleSchedules(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        teacherId: otherTeacher.id,
        subjectId: subj.id,
        classId: classA.id,
        dayOfWeek: 5,
        startTime: '10:15',
        endTime: '10:45',
        effectiveFrom: '2026-07-01T00:00:00+07:00',
        isActive: true,
      },
    },
    classConflictRes,
    repo,
  );
  assert.equal(classConflictRes.statusCode, 409);

  // 4. Adjacent non-overlapping schedule (11:00-12:00) succeeds with 201
  const adjacentRes = createMockRes();
  await handleSchedules(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        teacherId: linkedTeacherIdA,
        subjectId: subj.id,
        classId: classA.id,
        dayOfWeek: 5,
        startTime: '11:00',
        endTime: '12:00',
        effectiveFrom: '2026-07-01T00:00:00+07:00',
        isActive: true,
      },
    },
    adjacentRes,
    repo,
  );
  assert.equal(adjacentRes.statusCode, 201);

  // 5. GET /api/teachers/me/schedule strictly returns ONLY teacherA's schedules
  const myScheduleRes = createMockRes();
  await handleMyTeacherSchedule(
    { method: 'GET', headers: teacherASession.headers },
    myScheduleRes,
    repo,
  );
  assert.equal(myScheduleRes.statusCode, 200);
  const myWeekly = (myScheduleRes.body.data as { weeklySchedules: Array<{ teacherId: string }> })
    .weeklySchedules;
  assert.ok(myWeekly.length >= 2);
  assert.ok(myWeekly.every((s) => s.teacherId === linkedTeacherIdA));

  // Archive schedule works without deletion
  const archiveSchedRes = createMockRes();
  await handleScheduleById(
    { method: 'DELETE', headers: adminSession.headers },
    archiveSchedRes,
    createdScheduleId,
    repo,
  );
  assert.equal(archiveSchedRes.statusCode, 200);

  // 6. Versioned Attendance Rule: creating v2 preserves v1 historical record
  const beforeRules = await repo.collection(CollectionName.ATTENDANCE_RULES).list({
    filters: [{ field: 'audience', op: '==', value: AttendanceAudience.STUDENT }],
  });
  const originalV1 = beforeRules.items.find((r) => r.isActive && r.classIds.length === 0)!;
  assert.equal(originalV1.version, 1);

  const createV2Res = createMockRes();
  await handleAttendanceRules(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        name: 'Aturan Siswa Ramadhan',
        audience: AttendanceAudience.STUDENT,
        classIds: [],
        daysOfWeek: [1, 2, 3, 4, 5, 6],
        checkInStart: '06:45',
        lateAfter: '07:30',
        lateToleranceMinutes: 10,
        checkInDeadline: '09:30',
        checkOutStart: '11:30',
        checkOutDeadline: '14:00',
        gpsRequired: false,
        geofenceRequired: false,
        effectiveFrom: '2027-02-01T00:00:00+07:00',
        isActive: true,
      },
    },
    createV2Res,
    repo,
  );
  assert.equal(createV2Res.statusCode, 201);
  const createdV2 = createV2Res.body.data as AttendanceRule;
  assert.equal(createdV2.version, 2);

  // Original v1 is still preserved with original lateAfter and now marked inactive with effectiveUntil
  const preservedV1 = await repo
    .collection(CollectionName.ATTENDANCE_RULES)
    .getById(originalV1.id);
  assert.ok(preservedV1);
  assert.equal(preservedV1!.isActive, false);
  assert.equal(preservedV1!.lateAfter, originalV1.lateAfter);
  assert.ok(preservedV1!.effectiveUntil);

  // 7. Holidays CRUD + duplicate conflict + archive
  const createHolRes = createMockRes();
  await handleHolidays(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        date: '2026-11-10',
        name: 'Hari Pahlawan (Libur Khusus)',
        scope: HolidayScope.SCHOOL,
        isActive: true,
      },
    },
    createHolRes,
    repo,
  );
  assert.equal(createHolRes.statusCode, 201);
  const holId = (createHolRes.body.data as Holiday).id;

  const dupHolRes = createMockRes();
  await handleHolidays(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        date: '2026-11-10',
        name: 'Duplikat Libur',
        scope: HolidayScope.SCHOOL,
        isActive: true,
      },
    },
    dupHolRes,
    repo,
  );
  assert.equal(dupHolRes.statusCode, 409);

  const archiveHolRes = createMockRes();
  await handleHolidayById(
    { method: 'DELETE', headers: adminSession.headers },
    archiveHolRes,
    holId,
    repo,
  );
  assert.equal(archiveHolRes.statusCode, 200);

  // 8. RBAC checks: TEACHER gets 403 on admin schedules/rules/holidays; PRINCIPAL is read-only
  const teacherDeniedSched = createMockRes();
  await handleSchedules({ method: 'GET', headers: teacherASession.headers }, teacherDeniedSched, repo);
  assert.equal(teacherDeniedSched.statusCode, 403);

  const teacherDeniedRules = createMockRes();
  await handleAttendanceRules({ method: 'GET', headers: teacherASession.headers }, teacherDeniedRules, repo);
  assert.equal(teacherDeniedRules.statusCode, 403);

  const teacherDeniedHolidays = createMockRes();
  await handleHolidays({ method: 'GET', headers: teacherASession.headers }, teacherDeniedHolidays, repo);
  assert.equal(teacherDeniedHolidays.statusCode, 403);

  const principalGetRules = createMockRes();
  await handleAttendanceRules({ method: 'GET', headers: principalSession.headers }, principalGetRules, repo);
  assert.equal(principalGetRules.statusCode, 200);

  const principalPostRules = createMockRes();
  await handleAttendanceRules(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: { name: 'Tidak Boleh' },
    },
    principalPostRules,
    repo,
  );
  assert.equal(principalPostRules.statusCode, 403);
});
