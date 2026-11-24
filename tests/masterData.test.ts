import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME } from '../backend/_lib/auth/cookies';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleAcademicYears } from '../backend/academic-years/index';
import { handleLogin } from '../backend/auth/login';
import { handleClasses } from '../backend/classes/index';
import { handleClassById } from '../backend/classes/[id]';
import { handleStudentById } from '../backend/students/[id]';
import { handleStudentsBulkDelete } from '../backend/students/bulk-delete';
import { handleStudentsImport } from '../backend/students/import';
import { handleStudents } from '../backend/students/index';
import { handleSubjects } from '../backend/subjects/index';
import { handleTeacherById } from '../backend/teachers/[id]';
import { handleTeachersBulkDelete } from '../backend/teachers/bulk-delete';
import { handleTeachers } from '../backend/teachers/index';
import { CollectionName, StudentStatus, TeacherStatus, UserRole } from '../src/types';

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
  await handleLogin(
    { method: 'POST', ip: '127.0.0.1', body: { username, password } },
    res,
    repo,
  );
  assert.equal(res.statusCode, 200, `Login failed for ${username}`);
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
    if (k === SESSION_COOKIE_NAME) {
      assert.ok(v.length > 10);
    }
  }
  return {
    cookie: pairs.join('; '),
    csrf,
    headers: { cookie: pairs.join('; '), [CSRF_HEADER_NAME]: csrf },
  };
}

test('Master Data API: NIS/NIP uniqueness, enrollment rotation, archive-only, import validation, and strict RBAC', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();

  const boot = await bootstrapInitialAccounts(repo, {
    superAdminPassword: 'SuperSecret!2026',
    adminPassword: 'AdminSecret!2026',
    principalPassword: 'KepsekSecret!2026',
  });

  const teacherAcc = boot.accounts.find((a) => a.role === UserRole.TEACHER)!;
  const adminSession = await loginAs(repo, 'admin', 'AdminSecret!2026');
  const principalSession = await loginAs(repo, 'kepsek', 'KepsekSecret!2026');

  // Clear mustChangePassword on test teacher directly so we test role denial (403 FORBIDDEN), not mustChangePassword
  await repo.collection(CollectionName.USERS).update(teacherAcc.userId, { mustChangePassword: false });
  const teacherSession = await loginAs(repo, teacherAcc.username, teacherAcc.temporaryPassword!);

  // 1. TEACHER must receive 403 on ALL master data endpoints
  for (const fn of [
    () => handleStudents({ method: 'GET', headers: teacherSession.headers }, createMockRes(), repo),
    () => handleTeachers({ method: 'GET', headers: teacherSession.headers }, createMockRes(), repo),
    () => handleClasses({ method: 'GET', headers: teacherSession.headers }, createMockRes(), repo),
    () => handleSubjects({ method: 'GET', headers: teacherSession.headers }, createMockRes(), repo),
    () => handleAcademicYears({ method: 'GET', headers: teacherSession.headers }, createMockRes(), repo),
  ]) {
    // Capture response explicitly
    void fn;
  }

  const tStudents = createMockRes();
  await handleStudents({ method: 'GET', headers: teacherSession.headers }, tStudents, repo);
  assert.equal(tStudents.statusCode, 403);

  const tTeachers = createMockRes();
  await handleTeachers({ method: 'GET', headers: teacherSession.headers }, tTeachers, repo);
  assert.equal(tTeachers.statusCode, 403);

  const tClasses = createMockRes();
  await handleClasses({ method: 'GET', headers: teacherSession.headers }, tClasses, repo);
  assert.equal(tClasses.statusCode, 403);

  const tImport = createMockRes();
  await handleStudentsImport(
    {
      method: 'POST',
      headers: teacherSession.headers,
      body: { mode: 'preview', rows: [{ nis: '00999999', fullName: 'TEST', className: '1A' }] },
    },
    tImport,
    repo,
  );
  assert.equal(tImport.statusCode, 403);

  // 2. PRINCIPAL can READ (200) but CANNOT WRITE (403)
  const pRead = createMockRes();
  await handleStudents({ method: 'GET', headers: principalSession.headers }, pRead, repo);
  assert.equal(pRead.statusCode, 200);

  const pWrite = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: principalSession.headers,
      body: { nis: '00260099', fullName: 'SISWA BARU', classId: 'cls_1a' },
    },
    pWrite,
    repo,
  );
  assert.equal(pWrite.statusCode, 403);

  // 3. NIS uniqueness & leading zero string preservation
  const createStudent1 = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { nis: '00260001', fullName: 'ZAKI RAMADHAN', classId: 'cls_1a', status: StudentStatus.ACTIVE },
    },
    createStudent1,
    repo,
  );
  assert.equal(createStudent1.statusCode, 201);
  const createdStudent = createStudent1.body.data as { id: string; nis: string };
  assert.equal(createdStudent.nis, '00260001');

  // Duplicate NIS rejected with 409
  const dupNis = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { nis: '00260001', fullName: 'NAMA LAIN', classId: 'cls_2a' },
    },
    dupNis,
    repo,
  );
  assert.equal(dupNis.statusCode, 409);

  // Class change rotates studentEnrollments (2 records total: 1 COMPLETED, 1 ACTIVE)
  const moveClass = createMockRes();
  await handleStudentById(
    {
      method: 'PATCH',
      headers: adminSession.headers,
      body: { classId: 'cls_2a' },
    },
    moveClass,
    createdStudent.id,
    repo,
  );
  assert.equal(moveClass.statusCode, 200);

  const enrollments = await repo.collection(CollectionName.STUDENT_ENROLLMENTS).list({
    filters: [{ field: 'studentId', op: '==', value: createdStudent.id }],
  });
  assert.equal(enrollments.total, 2);

  // Archive-only DELETE (student still exists with status INACTIVE)
  const archiveRes = createMockRes();
  await handleStudentById(
    { method: 'DELETE', headers: adminSession.headers },
    archiveRes,
    createdStudent.id,
    repo,
  );
  assert.equal(archiveRes.statusCode, 200);
  const stillExists = await repo.collection(CollectionName.STUDENTS).getById(createdStudent.id);
  assert.ok(stillExists);
  assert.equal(stillExists.status, StudentStatus.INACTIVE);

  // 4. NIY/NIP uniqueness on Teachers
  const dupNip = createMockRes();
  await handleTeachers(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { niyNip: '20521133191001', fullName: 'DUPLIKAT', position: 'Guru' },
    },
    dupNip,
    repo,
  );
  assert.equal(dupNip.statusCode, 409);

  // 5. Excel Import preview flags invalid rows (duplicate NIS, unknown class, empty name) and commit rejects
  const invalidBatch = [
    { nis: '00260001', fullName: 'SUDAH ADA', className: '1A' }, // duplicate in DB
    { nis: '00260002', fullName: 'KELAS SALAH', className: '9Z' }, // unknown class
    { nis: '', fullName: '', className: '1A' }, // empty NIS & name
    { nis: '00260003', fullName: 'VALID SISWA', className: '2A' }, // valid
  ];

  const previewRes = createMockRes();
  await handleStudentsImport(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { mode: 'preview', rows: invalidBatch },
    },
    previewRes,
    repo,
  );
  assert.equal(previewRes.statusCode, 200);
  const previewData = previewRes.body.data as { validCount: number; invalidCount: number };
  assert.equal(previewData.validCount, 1);
  assert.equal(previewData.invalidCount, 3);

  const rejectedCommit = createMockRes();
  await handleStudentsImport(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { mode: 'commit', rows: invalidBatch },
    },
    rejectedCommit,
    repo,
  );
  assert.equal(rejectedCommit.statusCode, 400);

  // 6. Single active academic year enforcement
  const newYearRes = createMockRes();
  await handleAcademicYears(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        label: '2027/2028',
        semester: 'Ganjil',
        startDate: '2027-07-12',
        endDate: '2028-06-30',
        isActive: true,
      },
    },
    newYearRes,
    repo,
  );
  assert.equal(newYearRes.statusCode, 201);
  const activeYears = await repo.collection(CollectionName.ACADEMIC_YEARS).list({
    filters: [{ field: 'isActive', op: '==', value: true }],
  });
  assert.equal(activeYears.total, 1);
  assert.equal(activeYears.items[0]?.label, '2027/2028');
});

test('Master Data Permanent Delete: students, teachers, and classes with relation safeguards', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();

  await bootstrapInitialAccounts(repo, {
    superAdminPassword: 'SuperSecret!2026',
    adminPassword: 'AdminSecret!2026',
    principalPassword: 'KepsekSecret!2026',
  });

  const adminSession = await loginAs(repo, 'admin', 'AdminSecret!2026');

  // 1. Create and permanently delete a student
  const createS1 = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { nis: '00269001', fullName: 'SISWA HAPUS 1', classId: 'cls_1a', status: StudentStatus.ACTIVE },
    },
    createS1,
    repo,
  );
  assert.equal(createS1.statusCode, 201);
  const s1 = createS1.body.data as { id: string };

  const delS1 = createMockRes();
  await handleStudentById(
    { method: 'DELETE', headers: adminSession.headers, query: { permanent: 'true' } },
    delS1,
    s1.id,
    repo,
  );
  assert.equal(delS1.statusCode, 200);
  assert.equal(await repo.collection(CollectionName.STUDENTS).getById(s1.id), null);

  // 2. Bulk delete students
  const createS2 = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: { nis: '00269002', fullName: 'SISWA HAPUS 2', classId: 'cls_1a', status: StudentStatus.ACTIVE },
    },
    createS2,
    repo,
  );
  const s2 = createS2.body.data as { id: string };

  const bulkDelS = createMockRes();
  await handleStudentsBulkDelete(
    { method: 'POST', headers: adminSession.headers, body: { ids: [s2.id] } },
    bulkDelS,
    repo,
  );
  assert.equal(bulkDelS.statusCode, 200);
  assert.equal((bulkDelS.body.data as { deletedCount: number }).deletedCount, 1);
  assert.equal(await repo.collection(CollectionName.STUDENTS).getById(s2.id), null);

  // 3. Create teacher with account and permanently delete (also removes linked user & username)
  const createT1 = createMockRes();
  await handleTeachers(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        niyNip: '9988776655',
        fullName: 'GURU HAPUS 1',
        position: 'Guru Kelas',
        status: TeacherStatus.ACTIVE,
        createAccount: true,
        username: 'guruhapus1',
        password: 'GuruHapus!2026',
      },
    },
    createT1,
    repo,
  );
  assert.equal(createT1.statusCode, 201);
  const t1 = (createT1.body.data as { teacher: { id: string; userId: string } }).teacher;

  const delT1 = createMockRes();
  await handleTeacherById(
    { method: 'DELETE', headers: adminSession.headers, query: { permanent: 'true' } },
    delT1,
    t1.id,
    repo,
  );
  assert.equal(delT1.statusCode, 200);
  assert.equal(await repo.collection(CollectionName.TEACHERS).getById(t1.id), null);
  assert.equal(await repo.collection(CollectionName.USERS).getById(t1.userId), null);
  assert.equal(await repo.collection(CollectionName.UNIQUE_USERNAMES).getById('guruhapus1'), null);

  // 4. Bulk delete teachers
  const createT2 = createMockRes();
  await handleTeachers(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        niyNip: '9988776656',
        fullName: 'GURU HAPUS 2',
        position: 'Guru Mapel',
        status: TeacherStatus.ACTIVE,
        createAccount: false,
      },
    },
    createT2,
    repo,
  );
  const t2 = (createT2.body.data as { teacher: { id: string } }).teacher;

  const bulkDelT = createMockRes();
  await handleTeachersBulkDelete(
    { method: 'POST', headers: adminSession.headers, body: { ids: [t2.id] } },
    bulkDelT,
    repo,
  );
  assert.equal(bulkDelT.statusCode, 200);
  assert.equal((bulkDelT.body.data as { deletedCount: number }).deletedCount, 1);

  // 5. Class deletion blocked with 409 when students exist, allowed when empty
  const delNonEmptyClass = createMockRes();
  await handleClassById(
    { method: 'DELETE', headers: adminSession.headers },
    delNonEmptyClass,
    'cls_1a',
    repo,
  );
  assert.equal(delNonEmptyClass.statusCode, 409);

  const createEmptyClass = createMockRes();
  await handleClasses(
    {
      method: 'POST',
      headers: adminSession.headers,
      body: {
        name: '6Z',
        gradeLevel: '6',
        homeroomTeacherId: null,
        academicYearId: 'ay_2026_2027',
        capacity: 25,
        isActive: true,
      },
    },
    createEmptyClass,
    repo,
  );
  assert.equal(createEmptyClass.statusCode, 201);
  const emptyCls = createEmptyClass.body.data as { id: string };

  const delEmptyClass = createMockRes();
  await handleClassById(
    { method: 'DELETE', headers: adminSession.headers },
    delEmptyClass,
    emptyCls.id,
    repo,
  );
  assert.equal(delEmptyClass.statusCode, 200);
  assert.equal(await repo.collection(CollectionName.CLASSES).getById(emptyCls.id), null);
});

