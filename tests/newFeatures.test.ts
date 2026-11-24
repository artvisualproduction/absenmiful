import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  bootstrapInitialAccounts,
  ensurePreviewAccountsInitialized,
} from '../backend/_lib/auth/bootstrapService';
import { CSRF_HEADER_NAME } from '../backend/_lib/auth/cookies';
import { verifyPassword } from '../backend/_lib/auth/password';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleTeacherSelfAttendance } from '../backend/attendance/teacher-self';
import { handleLogin } from '../backend/auth/login';
import { handleResetPassword } from '../backend/auth/reset-password';
import { handleClasses } from '../backend/classes/index';
import { handleSchedulesImport } from '../backend/schedules/import';
import { handleAppSettings } from '../backend/settings/index';
import { handleFactoryReset } from '../backend/settings/factory-reset';
import { handlePublicSettings } from '../backend/settings/public';
import { handleSettingsRestore } from '../backend/settings/restore';
import {
  handleFactoryBaseline,
  handleRestorePointApply,
  handleRestorePointById,
  handleRestorePoints,
} from '../backend/settings/restore-points';
import { handleStudents } from '../backend/students/index';
import { handleSubjectsImport } from '../backend/subjects/import';
import { handleTeachers } from '../backend/teachers/index';
import { handleUploadSelfie } from '../backend/uploads/selfie';
import { handleUserById } from '../backend/users/[id]';
import { handleGenerateUsersFromTeachers } from '../backend/users/generate';
import { handleUsers } from '../backend/users/index';
import { AuthProvider } from '../src/app/providers/AuthProvider';
import { getNavigationForRole } from '../src/components/layout/navigation';
import { ToastProvider } from '../src/components/ui/Toast';
import { AboutContent } from '../src/features/about/AboutPage';
import { LoginPage } from '../src/features/auth/LoginPage';
import {
  formatDateTimeJakarta,
  formatTimeWithSecondsJakarta,
  getTimeHHMMJakarta,
} from '../src/lib/date';
import { formatVoiceMessage } from '../src/lib/speech';
import {
  AttendanceEventType,
  CollectionName,
  QrOwnerType,
  TeacherStatus,
  UserRole,
  type VoiceTemplatesConfig,
} from '../src/types';

interface MockResponseCapture {
  statusCode: number;
  body: Record<string, unknown>;
  headers: Record<string, string | string[]>;
  status(code: number): MockResponseCapture;
  json(payload: unknown): void;
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | undefined;
}

function createMockRes(): MockResponseCapture {
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

function extractAuthCookies(res: MockResponseCapture): { cookieHeader: string; csrfToken: string } {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const pairs: string[] = [];
  let csrfToken = '';
  for (const item of list) {
    const firstPart = item.split(';')[0] ?? '';
    const eq = firstPart.indexOf('=');
    if (eq > 0) {
      const k = firstPart.slice(0, eq).trim();
      const v = decodeURIComponent(firstPart.slice(eq + 1).trim());
      pairs.push(`${k}=${encodeURIComponent(v)}`);
      if (k === 'absensi_csrf') csrfToken = v;
    }
  }
  return { cookieHeader: pairs.join('; '), csrfToken };
}

async function loginAsSuperAdmin(repo: MockRepository): Promise<{
  cookieHeader: string;
  csrfToken: string;
  userId: string;
}> {
  const loginRes = createMockRes();
  await handleLogin(
    {
      method: 'POST',
      ip: '10.10.0.1',
      body: { username: 'superadmin', password: process.env.PREVIEW_SUPERADMIN_PASSWORD || 'superadmin123' },
    },
    loginRes,
    repo,
  );
  assert.equal(loginRes.statusCode, 200);
  const { cookieHeader, csrfToken } = extractAuthCookies(loginRes);
  const data = loginRes.body.data as { user: { id: string } };
  return { cookieHeader, csrfToken, userId: data.user.id };
}

test('handleSubjectsImport supports preview, commit, defaultToHomeroomTeacher, and duplicate code rejection', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const adminAuth = await loginAsSuperAdmin(repo);

  const authHeaders = {
    cookie: adminAuth.cookieHeader,
    [CSRF_HEADER_NAME]: adminAuth.csrfToken,
  };

  // 1. Preview valid rows (including defaultToHomeroomTeacher: true & 'YA')
  const previewOk = createMockRes();
  await handleSubjectsImport(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        mode: 'preview',
        rows: [
          { code: 'TEMATIK1', name: 'Tematik Terpadu', defaultToHomeroomTeacher: true, isActive: true },
          { code: 'SKI_MI', name: 'Sejarah Kebudayaan Islam', defaultToHomeroomTeacher: 'TIDAK', isActive: 'YA' },
        ],
      },
    },
    previewOk,
    repo,
  );
  assert.equal(previewOk.statusCode, 200);
  const previewData = previewOk.body.data as {
    validCount: number;
    invalidCount: number;
    rows: Array<{ code: string; defaultToHomeroomTeacher: boolean; valid: boolean }>;
  };
  assert.equal(previewData.validCount, 2);
  assert.equal(previewData.invalidCount, 0);
  assert.equal(previewData.rows[0]?.defaultToHomeroomTeacher, true);
  assert.equal(previewData.rows[1]?.defaultToHomeroomTeacher, false);

  // 2. Commit valid rows
  const commitOk = createMockRes();
  await handleSubjectsImport(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        mode: 'commit',
        rows: [
          { code: 'TEMATIK1', name: 'Tematik Terpadu', defaultToHomeroomTeacher: true, isActive: true },
          { code: 'SKI_MI', name: 'Sejarah Kebudayaan Islam', defaultToHomeroomTeacher: false, isActive: true },
        ],
      },
    },
    commitOk,
    repo,
  );
  assert.equal(commitOk.statusCode, 201);
  assert.equal((commitOk.body.data as { importedCount: number }).importedCount, 2);

  // 3. Reject duplicate code (already in DB + duplicate within file)
  const dupPreview = createMockRes();
  await handleSubjectsImport(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        mode: 'preview',
        rows: [
          { code: 'TEMATIK1', name: 'Duplikat DB' },
          { code: 'BARU1', name: 'Mapel Baru Pertama' },
          { code: 'BARU1', name: 'Mapel Baru Duplikat File' },
        ],
      },
    },
    dupPreview,
    repo,
  );
  assert.equal(dupPreview.statusCode, 200);
  const dupData = dupPreview.body.data as {
    validCount: number;
    invalidCount: number;
    rows: Array<{ valid: boolean; errors: string[] }>;
  };
  assert.equal(dupData.validCount, 1);
  assert.equal(dupData.invalidCount, 2);

  const dupCommit = createMockRes();
  await handleSubjectsImport(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        mode: 'commit',
        rows: [{ code: 'TEMATIK1', name: 'Duplikat DB' }],
      },
    },
    dupCommit,
    repo,
  );
  assert.equal(dupCommit.statusCode, 400);
});

test('handleSchedulesImport auto-resolves homeroom teacher and detects schedule conflicts', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const adminAuth = await loginAsSuperAdmin(repo);

  const authHeaders = {
    cookie: adminAuth.cookieHeader,
    [CSRF_HEADER_NAME]: adminAuth.csrfToken,
  };

  // Ensure we have a clean homeroom teacher assigned to class 1A and a subject with defaultToHomeroomTeacher: true
  const waliTeacher = await repo.collection(CollectionName.TEACHERS).create({
    niyNip: '9988776601',
    fullName: 'SITI AMINAH WALI 1A',
    position: 'Guru Kelas',
    photoPath: null,
    status: TeacherStatus.ACTIVE,
    qrTokenId: null,
    userId: null,
  });

  const classesRes = await repo.collection(CollectionName.CLASSES).list();
  const class1A = classesRes.items.find((c) => c.name.toUpperCase() === '1A');
  assert.ok(class1A);
  await repo.collection(CollectionName.CLASSES).update(class1A.id, {
    homeroomTeacherId: waliTeacher.id,
  });

  const tematikSubject = await repo.collection(CollectionName.SUBJECTS).create({
    code: 'TMK_SD',
    name: 'Tematik SD/MI',
    defaultToHomeroomTeacher: true,
    isActive: true,
  });

  // 1. Auto-resolve homeroom teacher when teacherNiyOrName is empty (via subject defaultToHomeroomTeacher)
  //    and detect conflict when another row overlaps the same class & day
  const previewRes = createMockRes();
  await handleSchedulesImport(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        mode: 'preview',
        rows: [
          {
            className: '1A',
            subjectCodeOrName: tematikSubject.code,
            teacherNiyOrName: '',
            dayOfWeek: 'Sabtu',
            startTime: '07:00',
            endTime: '08:10',
            room: 'Ruang 1A',
          },
          {
            className: '1A',
            subjectCodeOrName: tematikSubject.code,
            useHomeroomTeacher: true,
            dayOfWeek: 'Sabtu',
            startTime: '07:30',
            endTime: '08:30',
            room: 'Ruang 1A',
          },
        ],
      },
    },
    previewRes,
    repo,
  );

  assert.equal(previewRes.statusCode, 200);
  const previewData = previewRes.body.data as {
    validCount: number;
    invalidCount: number;
    rows: Array<{
      teacherId: string | null;
      teacherName: string;
      useHomeroomTeacher: boolean;
      valid: boolean;
      errors: string[];
    }>;
  };
  assert.equal(previewData.validCount, 1);
  assert.equal(previewData.invalidCount, 1);
  assert.equal(previewData.rows[0]?.teacherId, waliTeacher.id);
  assert.equal(previewData.rows[0]?.teacherName, 'SITI AMINAH WALI 1A');
  assert.equal(previewData.rows[0]?.useHomeroomTeacher, true);
  assert.equal(previewData.rows[1]?.valid, false);
  assert.ok(previewData.rows[1]?.errors.some((e) => e.toLowerCase().includes('bentrok')));

  // 2. Commit single non-conflicting homeroom schedule
  const commitRes = createMockRes();
  await handleSchedulesImport(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        mode: 'commit',
        rows: [
          {
            className: '1A',
            subjectCodeOrName: tematikSubject.code,
            teacherNiyOrName: '',
            dayOfWeek: 'Sabtu',
            startTime: '07:00',
            endTime: '08:10',
            room: 'Ruang 1A',
          },
        ],
      },
    },
    commitRes,
    repo,
  );
  assert.equal(commitRes.statusCode, 201);
  assert.equal((commitRes.body.data as { importedCount: number }).importedCount, 1);
});

test('handleSettingsRestore restores collections while preserving portalExitPasswordHash, initialSeedCompleted, and active admin', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const adminAuth = await loginAsSuperAdmin(repo);

  const originalSettings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
  assert.ok(originalSettings);
  const originalExitHash = originalSettings.portalExitPasswordHash;

  const restoreRes = createMockRes();
  await handleSettingsRestore(
    {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookieHeader,
        [CSRF_HEADER_NAME]: adminAuth.csrfToken,
      },
      body: {
        schemaVersion: '1.0',
        exportedAt: new Date().toISOString(),
        collections: {
          subjects: [
            {
              id: 'sub_restored_1',
              code: 'RST01',
              name: 'Mata Pelajaran Restore',
              defaultToHomeroomTeacher: true,
              isActive: true,
            },
          ],
          appSettings: [
            {
              ...originalSettings,
              schoolName: 'MI Miftahul Ulum Sumberwuluh (Restored)',
              portalExitPasswordHash: 'tampered_hash_must_be_ignored',
              initialSeedCompleted: false,
            },
          ],
          users: [
            {
              id: adminAuth.userId,
              isActive: false,
              role: 'TEACHER',
            },
          ],
        },
      },
    },
    restoreRes,
    repo,
  );

  assert.equal(restoreRes.statusCode, 200);
  assert.equal((restoreRes.body.data as { restored: boolean }).restored, true);

  const restoredSubjects = await repo.collection(CollectionName.SUBJECTS).list();
  assert.equal(restoredSubjects.items.length, 1);
  assert.equal(restoredSubjects.items[0]?.code, 'RST01');

  const updatedSettings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
  assert.ok(updatedSettings);
  assert.equal(updatedSettings.schoolName, 'MI Miftahul Ulum Sumberwuluh (Restored)');
  assert.equal(updatedSettings.portalExitPasswordHash, originalExitHash);
  assert.equal(updatedSettings.initialSeedCompleted, true);

  const activeAdmin = await repo.collection(CollectionName.USERS).getById(adminAuth.userId);
  assert.ok(activeAdmin);
  assert.equal(activeAdmin.isActive, true);
  assert.equal(activeAdmin.role, 'SUPER_ADMIN');
});

test('ensurePreviewAccountsInitialized does not respawn deleted seed students and teachers across restarts', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();

  // First initialization seeds sample students & teachers once
  await ensurePreviewAccountsInitialized(repo);
  const initialStudents = await repo.collection(CollectionName.STUDENTS).list();
  const initialTeachers = await repo.collection(CollectionName.TEACHERS).list();
  assert.ok(initialStudents.items.length > 0);
  assert.ok(initialTeachers.items.length > 0);

  // Admin deletes all seed students and seed teachers
  await Promise.all(
    initialStudents.items.map((s) => repo.collection(CollectionName.STUDENTS).delete(s.id)),
  );
  await Promise.all(
    initialTeachers.items.map((t) => repo.collection(CollectionName.TEACHERS).delete(t.id)),
  );

  assert.equal((await repo.collection(CollectionName.STUDENTS).count()), 0);
  assert.equal((await repo.collection(CollectionName.TEACHERS).count()), 0);

  // Simulate repeated server cold starts / restarts
  await ensurePreviewAccountsInitialized(repo);
  await ensurePreviewAccountsInitialized(repo);

  assert.equal((await repo.collection(CollectionName.STUDENTS).count()), 0);
  assert.equal((await repo.collection(CollectionName.TEACHERS).count()), 0);
});

test('handleResetPassword requires admin-defined customPassword and never generates a random password', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const adminAuth = await loginAsSuperAdmin(repo);

  const usersRes = await repo.collection(CollectionName.USERS).list();
  const teacherUser = usersRes.items.find((u) => u.username === 'guru');
  assert.ok(teacherUser);

  const authHeaders = {
    cookie: adminAuth.cookieHeader,
    [CSRF_HEADER_NAME]: adminAuth.csrfToken,
  };

  // 1. Omitting customPassword must fail with 400
  const missingPwRes = createMockRes();
  await handleResetPassword(
    {
      method: 'POST',
      headers: authHeaders,
      body: { targetUserId: teacherUser.id, reason: 'Tanpa password' },
    },
    missingPwRes,
    repo,
  );
  assert.equal(missingPwRes.statusCode, 400);

  // 2. Providing admin-defined customPassword succeeds without temporaryPassword
  const validResetRes = createMockRes();
  await handleResetPassword(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        targetUserId: teacherUser.id,
        customPassword: 'SandiGuruBaru!2026',
        reason: 'Ditetapkan langsung oleh admin',
      },
    },
    validResetRes,
    repo,
  );
  assert.equal(validResetRes.statusCode, 200);
  const resetData = validResetRes.body.data as Record<string, unknown>;
  assert.equal(resetData.passwordUpdated, true);
  assert.equal('temporaryPassword' in resetData, false);

  const updatedUser = await repo.collection(CollectionName.USERS).getById(teacherUser.id);
  assert.ok(updatedUser);
  assert.equal(await verifyPassword('SandiGuruBaru!2026', updatedUser.passwordHash), true);
});

test('formatVoiceMessage renders all voice attendance outcomes accurately', () => {
  const templates: VoiceTemplatesConfig = {
    success: 'ABSENSI BERHASIL',
    namedSuccess: 'TERIMA KASIH, {name} SUDAH ABSEN',
    late: 'PERHATIAN, {name} TERLAMBAT HARI INI',
    failure: 'KARTU TIDAK DIKENAL',
    closed: 'MAAF, PORTAL ABSENSI BELUM DIBUKA',
    alreadyRecorded: '{name}, ANDA SUDAH ABSEN HARI INI',
  };

  assert.equal(formatVoiceMessage(templates, 'success'), 'ABSENSI BERHASIL');
  assert.equal(
    formatVoiceMessage(templates, 'success', 'Ahmad Fauzi'),
    'TERIMA KASIH, Ahmad Fauzi SUDAH ABSEN',
  );
  assert.equal(
    formatVoiceMessage(templates, 'late', 'Siti Aminah'),
    'PERHATIAN, Siti Aminah TERLAMBAT HARI INI',
  );
  assert.equal(formatVoiceMessage(templates, 'closed'), 'MAAF, PORTAL ABSENSI BELUM DIBUKA');
  assert.equal(
    formatVoiceMessage(templates, 'alreadyRecorded', 'Budi Santoso'),
    'Budi Santoso, ANDA SUDAH ABSEN HARI INI',
  );
  assert.equal(formatVoiceMessage(templates, 'failure'), 'KARTU TIDAK DIKENAL');
});

test('Restore Points support create, sanitized listing, apply restore, and delete', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const adminAuth = await loginAsSuperAdmin(repo);
  const authHeaders = {
    cookie: adminAuth.cookieHeader,
    [CSRF_HEADER_NAME]: adminAuth.csrfToken,
  };

  // Create a custom subject before creating the restore point
  await repo.collection(CollectionName.SUBJECTS).create({
    code: 'RP_TEST',
    name: 'Mapel Sebelum Perubahan',
    defaultToHomeroomTeacher: false,
    isActive: true,
  });

  // 1. Create restore point
  const createRes = createMockRes();
  await handleRestorePoints(
    {
      method: 'POST',
      headers: authHeaders,
      body: { name: 'Sebelum Ujian Semester', note: 'Titik aman' },
    },
    createRes,
    repo,
  );
  assert.equal(createRes.statusCode, 201);
  const rpSummary = createRes.body.data as { id: string; name: string; snapshot?: unknown };
  assert.equal(rpSummary.name, 'Sebelum Ujian Semester');
  assert.equal('snapshot' in rpSummary, false);

  // 2. List restore points omits snapshot blob and contains no password hashes
  const listRes = createMockRes();
  await handleRestorePoints(
    { method: 'GET', headers: authHeaders },
    listRes,
    repo,
  );
  assert.equal(listRes.statusCode, 200);
  const listData = listRes.body.data as { items: Array<Record<string, unknown>> };
  assert.equal(listData.items.length, 1);
  assert.equal('snapshot' in listData.items[0]!, false);

  const storedRp = await repo.collection(CollectionName.RESTORE_POINTS).getById(rpSummary.id);
  assert.ok(storedRp);
  const storedJson = JSON.stringify(storedRp.snapshot);
  assert.equal(storedJson.includes('passwordHash'), false);
  assert.equal(storedJson.includes('portalExitPasswordHash'), false);

  // 3. Mutate database: delete all subjects
  const subsBefore = await repo.collection(CollectionName.SUBJECTS).list();
  for (const s of subsBefore.items) {
    await repo.collection(CollectionName.SUBJECTS).delete(s.id);
  }
  assert.equal(await repo.collection(CollectionName.SUBJECTS).count(), 0);

  // 4. Apply restore point
  const applyRes = createMockRes();
  await handleRestorePointApply(
    { method: 'POST', headers: authHeaders },
    applyRes,
    rpSummary.id,
    repo,
  );
  assert.equal(applyRes.statusCode, 200);
  assert.equal((applyRes.body.data as { restored: boolean }).restored, true);

  const subsAfter = await repo.collection(CollectionName.SUBJECTS).list();
  assert.ok(subsAfter.items.some((s) => s.code === 'RP_TEST'));

  // 5. Delete restore point
  const delRes = createMockRes();
  await handleRestorePointById(
    { method: 'DELETE', headers: authHeaders },
    delRes,
    rpSummary.id,
    repo,
  );
  assert.equal(delRes.statusCode, 200);
  assert.equal(await repo.collection(CollectionName.RESTORE_POINTS).count(), 0);
});

test('handleFactoryReset restores clean MI MIFTAHUL ULUM baseline (0 students/teachers/classes) and supports custom baseline + self-adding afterwards', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const adminAuth = await loginAsSuperAdmin(repo);
  const authHeaders = {
    cookie: adminAuth.cookieHeader,
    [CSRF_HEADER_NAME]: adminAuth.csrfToken,
  };

  // Reject wrong confirmation text
  const badRes = createMockRes();
  await handleFactoryReset(
    { method: 'POST', headers: authHeaders, body: { confirmationText: 'reset' } },
    badRes,
    repo,
  );
  assert.equal(badRes.statusCode, 400);

  // Execute embedded factory reset
  const okRes = createMockRes();
  await handleFactoryReset(
    { method: 'POST', headers: authHeaders, body: { confirmationText: 'RESET PABRIK' } },
    okRes,
    repo,
  );
  assert.equal(okRes.statusCode, 200);
  assert.equal((okRes.body.data as { reset: boolean }).reset, true);

  // Clean MI MIFTAHUL ULUM baseline: 0 students, 0 teachers, 0 classes, 0 subjects, 0 schedules, 2 general rules
  assert.equal(await repo.collection(CollectionName.STUDENTS).count(), 0);
  assert.equal(await repo.collection(CollectionName.TEACHERS).count(), 0);
  assert.equal(await repo.collection(CollectionName.CLASSES).count(), 0);
  assert.equal(await repo.collection(CollectionName.TEACHING_SCHEDULES).count(), 0);
  assert.equal(await repo.collection(CollectionName.SUBJECTS).count(), 0);
  assert.equal(await repo.collection(CollectionName.ATTENDANCE_RULES).count(), 2);

  // Admin account preserved; seeded teacher users wiped cleanly
  const usersAfter = await repo.collection(CollectionName.USERS).list();
  assert.ok(usersAfter.items.some((u) => u.id === adminAuth.userId));
  assert.equal(
    usersAfter.items.some((u) => u.role === UserRole.TEACHER),
    false,
  );

  // Settings reset to MI MIFTAHUL ULUM / MiFUL with initialSeedCompleted: true and default portal password '123'
  const settingsAfter = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
  assert.ok(settingsAfter);
  assert.equal(settingsAfter.schoolName, 'MI MIFTAHUL ULUM');
  assert.equal(settingsAfter.pwaAppName, 'MiFUL');
  assert.equal(settingsAfter.quickLoginEnabled, false);
  assert.equal(settingsAfter.initialSeedCompleted, true);
  assert.equal(await verifyPassword('123', settingsAfter.portalExitPasswordHash), true);

  // Admin can add classes, teachers, and students cleanly from 0
  const createTeacherRes = createMockRes();
  await handleTeachers(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        niyNip: '20521133199001',
        fullName: 'USTADZ AHMAD',
        position: 'Guru',
        status: TeacherStatus.ACTIVE,
        createAccount: false,
      },
    },
    createTeacherRes,
    repo,
  );
  assert.equal(createTeacherRes.statusCode, 201);
  const createdTeacher = (createTeacherRes.body.data as { teacher: { id: string } }).teacher;

  const createClassRes = createMockRes();
  await handleClasses(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: '1A',
        gradeLevel: '1',
        homeroomTeacherId: createdTeacher.id,
        academicYearId: 'ay_2026_2027',
        capacity: 30,
        isActive: true,
      },
    },
    createClassRes,
    repo,
  );
  assert.equal(createClassRes.statusCode, 201);
  const createdClass = createClassRes.body.data as { id: string };

  const createStudentRes = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        nis: '00260001',
        fullName: 'MUHAMMAD ZAKI',
        classId: createdClass.id,
        status: 'ACTIVE',
      },
    },
    createStudentRes,
    repo,
  );
  assert.equal(createStudentRes.statusCode, 201);
  assert.equal(await repo.collection(CollectionName.TEACHERS).count(), 1);
  assert.equal(await repo.collection(CollectionName.CLASSES).count(), 1);
  assert.equal(await repo.collection(CollectionName.STUDENTS).count(), 1);

  // Re-running bootstrap does NOT respawn demo students/teachers/classes
  await ensurePreviewAccountsInitialized(repo);
  assert.equal(await repo.collection(CollectionName.STUDENTS).count(), 1);
  assert.equal(await repo.collection(CollectionName.TEACHERS).count(), 1);
  assert.equal(await repo.collection(CollectionName.CLASSES).count(), 1);

  // Custom Factory Baseline: update settings & save as factory baseline
  const patchRes = createMockRes();
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: authHeaders,
      body: { schoolName: 'MI MIFTAHUL ULUM KUSTOM', pwaAppName: 'MiFUL Kustom' },
    },
    patchRes,
    repo,
  );
  assert.equal(patchRes.statusCode, 200);

  const saveBaselineRes = createMockRes();
  await handleFactoryBaseline({ method: 'POST', headers: authHeaders }, saveBaselineRes, repo);
  assert.equal(saveBaselineRes.statusCode, 200);
  assert.equal((saveBaselineRes.body.data as { configured: boolean }).configured, true);

  // Internal __factory_baseline__ MUST NOT leak into regular Restore Points list
  const rpListRes = createMockRes();
  await handleRestorePoints({ method: 'GET', headers: authHeaders }, rpListRes, repo);
  assert.equal((rpListRes.body.data as { items: unknown[] }).items.length, 0);

  // Mutate settings temporarily, then Format Factory -> restores custom baseline
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: authHeaders,
      body: { schoolName: 'Sementara Berubah' },
    },
    createMockRes(),
    repo,
  );
  const customResetRes = createMockRes();
  await handleFactoryReset(
    { method: 'POST', headers: authHeaders, body: { confirmationText: 'RESET PABRIK' } },
    customResetRes,
    repo,
  );
  assert.equal(customResetRes.statusCode, 200);
  assert.equal((customResetRes.body.data as { usedCustomBaseline: boolean }).usedCustomBaseline, true);
  const restoredCustomSettings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
  assert.equal(restoredCustomSettings?.schoolName, 'MI MIFTAHUL ULUM KUSTOM');
  assert.equal(restoredCustomSettings?.pwaAppName, 'MiFUL Kustom');

  // Clear custom baseline via DELETE -> reverts Format Factory back to built-in clean baseline
  const clearBaselineRes = createMockRes();
  await handleFactoryBaseline({ method: 'DELETE', headers: authHeaders }, clearBaselineRes, repo);
  assert.equal(clearBaselineRes.statusCode, 200);
  assert.equal((clearBaselineRes.body.data as { configured: boolean }).configured, false);

  const revertedResetRes = createMockRes();
  await handleFactoryReset(
    { method: 'POST', headers: authHeaders, body: { confirmationText: 'RESET PABRIK' } },
    revertedResetRes,
    repo,
  );
  assert.equal(revertedResetRes.statusCode, 200);
  assert.equal((revertedResetRes.body.data as { usedCustomBaseline: boolean }).usedCustomBaseline, false);
  assert.equal(await repo.collection(CollectionName.STUDENTS).count(), 0);
  assert.equal(await repo.collection(CollectionName.TEACHERS).count(), 0);
  assert.equal(await repo.collection(CollectionName.CLASSES).count(), 0);
});

test('24-hour Jakarta date helpers format strictly in 24h without WIB suffix and SSR renders About & Login pages', () => {
  const afternoonIso = '2026-11-20T14:35:09+07:00';
  const midnightIso = '2026-11-20T00:05:09+07:00';

  assert.equal(getTimeHHMMJakarta(afternoonIso), '14:35');
  assert.equal(getTimeHHMMJakarta(midnightIso), '00:05');
  assert.equal(formatTimeWithSecondsJakarta(afternoonIso), '14:35:09');
  assert.equal(formatTimeWithSecondsJakarta(midnightIso), '00:05:09');

  const formattedDt = formatDateTimeJakarta(afternoonIso);
  assert.ok(formattedDt.includes('14:35'));
  assert.equal(formattedDt.includes('WIB'), false);

  const loginHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(LoginPage)),
      ),
    ),
  );
  assert.ok(loginHtml.includes('Selamat Datang !'));
  assert.ok(loginHtml.includes('ArtVisual Production'));
  assert.ok(loginHtml.includes('Application and Website Developer'));

  const aboutHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/about'] },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(AboutContent)),
      ),
    ),
  );
  assert.ok(aboutHtml.includes('ArtVisual Production'));
  assert.ok(aboutHtml.includes('Application and Website Developer'));
  assert.ok(aboutHtml.includes('Biaya Langganan'));
  assert.ok(aboutHtml.includes('Rp0/bulan'));
  assert.ok(aboutHtml.includes('Biaya langganan dibebaskan untuk lembaga ini'));

  // Verify sidebar capitalization and menu structure
  const adminNav = getNavigationForRole(UserRole.ADMIN);
  const sysGroup = adminNav.find((g) => g.label === 'ADMINISTRASI SISTEM');
  assert.ok(sysGroup);
  const userNav = sysGroup.items.find((i) => i.to === '/admin/users');
  assert.equal(userNav?.label, 'Manajemen Pengguna');
  const settingsIdx = sysGroup.items.findIndex((i) => i.to === '/admin/settings');
  const aboutIdx = sysGroup.items.findIndex((i) => i.to === '/admin/about');
  assert.ok(settingsIdx >= 0);
  assert.equal(aboutIdx, settingsIdx + 1, 'Tentang Aplikasi must sit directly below Pengaturan');

  const teacherNav = getNavigationForRole(UserRole.TEACHER);
  const teacherItems = teacherNav.flatMap((g) => g.items);
  assert.equal(
    teacherItems.some((item) => item.to === '/teacher/about' || item.label === 'Tentang Aplikasi'),
    false,
    'Teacher role must not include Tentang Aplikasi in navigation',
  );
});

test('Real-mode bootstrap & factory reset leave only superadmin base role (no admin/kepsek/guru)', async () => {
  resetAllIpRateLimits();
  const baseRepo = new MockRepository();
  for (const name of Object.values(CollectionName)) {
    const res = await baseRepo.collection(name).list();
    for (const item of res.items) {
      await baseRepo.collection(name).delete(item.id);
    }
  }

  const realRepo = {
    mode: 'real' as const,
    collection: <K extends CollectionName>(name: K) => baseRepo.collection(name),
  };

  await ensurePreviewAccountsInitialized(realRepo);

  const usersAfterInit = await baseRepo.collection(CollectionName.USERS).list();
  assert.equal(usersAfterInit.total, 1);
  assert.equal(usersAfterInit.items[0]?.username, 'superadmin');
  assert.equal(usersAfterInit.items[0]?.role, UserRole.SUPER_ADMIN);
  assert.equal((await baseRepo.collection(CollectionName.TEACHERS).count()), 0);

  // Add an admin & an unlinked teacher account manually, then factory reset -> only superadmin remains
  const saAuth = await loginAsSuperAdmin(baseRepo);
  const authHeaders = {
    cookie: saAuth.cookieHeader,
    [CSRF_HEADER_NAME]: saAuth.csrfToken,
  };

  const resetSettingsRes = createMockRes();
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: authHeaders,
      body: { requireUserLinkedToTeacher: false },
    },
    resetSettingsRes,
    baseRepo,
  );
  assert.equal(resetSettingsRes.statusCode, 200);

  const adminCreateRes = createMockRes();
  await handleUsers(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        username: 'legacyadmin',
        password: 'Password123',
        role: UserRole.ADMIN,
        isActive: true,
        mustChangePassword: false,
      },
    },
    adminCreateRes,
    baseRepo,
  );
  assert.equal(adminCreateRes.statusCode, 201);

  const factoryRes = createMockRes();
  await handleFactoryReset(
    {
      method: 'POST',
      headers: authHeaders,
      body: { confirmationText: 'RESET PABRIK' },
    },
    factoryRes,
    baseRepo,
  );
  assert.equal(factoryRes.statusCode, 200);

  const usersAfterReset = await baseRepo.collection(CollectionName.USERS).list();
  assert.equal(usersAfterReset.total, 1);
  assert.equal(usersAfterReset.items[0]?.role, UserRole.SUPER_ADMIN);
  assert.equal(usersAfterReset.items[0]?.username, 'superadmin');

  // Verify bootstrapInitialAccounts with superAdminPassword only creates only superadmin when no teachers exist
  const bootstrapRepo = new MockRepository();
  for (const name of Object.values(CollectionName)) {
    const res = await bootstrapRepo.collection(name).list();
    for (const item of res.items) {
      await bootstrapRepo.collection(name).delete(item.id);
    }
  }
  const bootResult = await bootstrapInitialAccounts(
    { mode: 'real' as const, collection: <K extends CollectionName>(n: K) => bootstrapRepo.collection(n) },
    { superAdminPassword: 'SuperPassword123' },
  );
  assert.equal(bootResult.accounts.length, 1);
  assert.equal(bootResult.accounts[0]?.role, UserRole.SUPER_ADMIN);
  assert.equal(bootResult.accounts[0]?.username, 'superadmin');
});

test('Generate User from Teacher derives first-name username + <username>123 password and respects requireUserLinkedToTeacher', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const saAuth = await loginAsSuperAdmin(repo);
  const authHeaders = {
    cookie: saAuth.cookieHeader,
    [CSRF_HEADER_NAME]: saAuth.csrfToken,
  };

  // Clear seeded teachers/users (except superadmin) to test cleanly
  const existingUsers = await repo.collection(CollectionName.USERS).list();
  for (const u of existingUsers.items) {
    if (u.role !== UserRole.SUPER_ADMIN) {
      await repo.collection(CollectionName.USERS).delete(u.id);
    }
  }
  const existingTeachers = await repo.collection(CollectionName.TEACHERS).list();
  for (const t of existingTeachers.items) {
    await repo.collection(CollectionName.TEACHERS).delete(t.id);
  }

  // Default requireUserLinkedToTeacher should be true
  const publicBefore = createMockRes();
  await handlePublicSettings({ method: 'GET' }, publicBefore, repo);
  assert.equal(publicBefore.statusCode, 200);
  assert.equal(
    (publicBefore.body.data as { settings: { requireUserLinkedToTeacher: boolean } }).settings
      .requireUserLinkedToTeacher,
    true,
  );

  // Creating TEACHER without linkedTeacherId fails when requireUserLinkedToTeacher is true
  const rejectUnlinked = createMockRes();
  await handleUsers(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        username: 'gurutanpat',
        password: 'Password123',
        role: UserRole.TEACHER,
        isActive: true,
        mustChangePassword: false,
      },
    },
    rejectUnlinked,
    repo,
  );
  assert.equal(rejectUnlinked.statusCode, 400);

  // Create 3 teachers: Kepala Sekolah + 2 Guru with matching first name
  const createTeacher = async (fullName: string, niyNip: string, position: string) => {
    const res = createMockRes();
    await handleTeachers(
      {
        method: 'POST',
        headers: authHeaders,
        body: { fullName, niyNip, position, status: TeacherStatus.ACTIVE },
      },
      res,
      repo,
    );
    assert.equal(res.statusCode, 201);
    return (res.body.data as { teacher: { id: string } }).teacher.id;
  };

  const imamId = await createTeacher('IMAM MUSTHOFA', '20521133191001', 'Kepala Sekolah');
  const nur1Id = await createTeacher('NUR ANIFATUL IZZA', '20521133191002', 'Guru Kelas');
  const nur2Id = await createTeacher('NUR ANISA', '20521133191003', 'Guru Mapel');

  // Generate users from selected teachers
  const genRes = createMockRes();
  await handleGenerateUsersFromTeachers(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        items: [{ teacherId: imamId }, { teacherId: nur1Id }, { teacherId: nur2Id }],
      },
    },
    genRes,
    repo,
  );
  assert.equal(genRes.statusCode, 201);
  const created = (
    genRes.body.data as {
      created: Array<{
        teacherId: string;
        username: string;
        generatedPassword: string;
        role: UserRole;
      }>;
    }
  ).created;
  assert.equal(created.length, 3);

  const imamAcc = created.find((c) => c.teacherId === imamId)!;
  assert.equal(imamAcc.role, UserRole.PRINCIPAL);
  assert.equal(imamAcc.username, 'imam');
  assert.equal(imamAcc.generatedPassword, 'imam123');

  const nur1Acc = created.find((c) => c.teacherId === nur1Id)!;
  assert.equal(nur1Acc.role, UserRole.TEACHER);
  assert.equal(nur1Acc.username, 'nur');
  assert.equal(nur1Acc.generatedPassword, 'nur123');

  const nur2Acc = created.find((c) => c.teacherId === nur2Id)!;
  assert.equal(nur2Acc.role, UserRole.TEACHER);
  assert.equal(nur2Acc.username, 'nur2');
  assert.equal(nur2Acc.generatedPassword, 'nur2123');

  // Verify real login works for imam/imam123 & nur/nur123 and teacher.userId was linked
  const imamLogin = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.20.0.1', body: { username: 'imam', password: 'imam123' } },
    imamLogin,
    repo,
  );
  assert.equal(imamLogin.statusCode, 200);
  const imamTeacher = await repo.collection(CollectionName.TEACHERS).getById(imamId);
  assert.ok(imamTeacher?.userId);

  // Re-generating for already-linked teacher is rejected cleanly
  const genRepeat = createMockRes();
  await handleGenerateUsersFromTeachers(
    { method: 'POST', headers: authHeaders, body: { items: [{ teacherId: imamId }] } },
    genRepeat,
    repo,
  );
  assert.equal(genRepeat.statusCode, 400);

  // Toggling requireUserLinkedToTeacher = false updates public settings and allows unlinked TEACHER
  const toggleOff = createMockRes();
  await handleAppSettings(
    { method: 'PATCH', headers: authHeaders, body: { requireUserLinkedToTeacher: false } },
    toggleOff,
    repo,
  );
  assert.equal(toggleOff.statusCode, 200);

  const allowUnlinked = createMockRes();
  await handleUsers(
    {
      method: 'POST',
      headers: authHeaders,
      body: {
        username: 'guruunlinked',
        password: 'Password123',
        role: UserRole.TEACHER,
        isActive: true,
        mustChangePassword: false,
      },
    },
    allowUnlinked,
    repo,
  );
  assert.equal(allowUnlinked.statusCode, 201);
});

test('Teacher self-attendance rejects PNG selfie upload and resolves AUTO CHECK_IN/CHECK_OUT automatically', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);

  const teacherLogin = createMockRes();
  await handleLogin(
    {
      method: 'POST',
      ip: '10.30.0.1',
      body: {
        username: 'guru',
        password: process.env.PREVIEW_TEACHER_PASSWORD || 'Guru1234!',
      },
    },
    teacherLogin,
    repo,
  );
  assert.equal(teacherLogin.statusCode, 200);
  const { cookieHeader, csrfToken } = extractAuthCookies(teacherLogin);
  const teacherHeaders = { cookie: cookieHeader, [CSRF_HEADER_NAME]: csrfToken };

  const validPngDataUrl = `data:image/png;base64,${Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]).toString('base64')}`;
  const validJpegDataUrl = `data:image/jpeg;base64,${Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
  ]).toString('base64')}`;

  // 1. PNG selfie upload is blocked for TEACHER
  const pngUploadRes = createMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: teacherHeaders,
      body: {
        ownerType: QrOwnerType.TEACHER,
        mimeType: 'image/png',
        dataUrl: validPngDataUrl,
      },
    },
    pngUploadRes,
    repo,
  );
  assert.equal(pngUploadRes.statusCode, 400);

  // 2. Camera JPEG upload succeeds
  const jpegUploadRes = createMockRes();
  await handleUploadSelfie(
    {
      method: 'POST',
      headers: teacherHeaders,
      body: {
        ownerType: QrOwnerType.TEACHER,
        mimeType: 'image/jpeg',
        dataUrl: validJpegDataUrl,
      },
    },
    jpegUploadRes,
    repo,
  );
  assert.equal(jpegUploadRes.statusCode, 201);
  const selfieFileId = (jpegUploadRes.body.data as { fileId: string }).fileId;

  const locations = await repo.collection(CollectionName.SCHOOL_LOCATIONS).list();
  const schoolLoc = locations.items[0]!;

  // 3. AUTO eventType at 06:45 WIB -> automatically records CHECK_IN
  const morningRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacherHeaders,
      body: {
        eventType: 'AUTO',
        selfieFileId,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 12,
        idempotencyKey: 'auto-checkin-key-01',
      },
    },
    morningRes,
    repo,
    { serverNow: new Date('2026-08-03T06:45:00+07:00') },
  );
  assert.equal(morningRes.statusCode, 201);
  const morningRecord = (morningRes.body.data as { record: { eventType: AttendanceEventType } }).record;
  assert.equal(morningRecord.eventType, AttendanceEventType.CHECK_IN);

  // 4. AUTO eventType at 14:15 WIB -> automatically records CHECK_OUT
  const afternoonRes = createMockRes();
  await handleTeacherSelfAttendance(
    {
      method: 'POST',
      headers: teacherHeaders,
      body: {
        eventType: 'AUTO',
        selfieFileId,
        latitude: schoolLoc.latitude,
        longitude: schoolLoc.longitude,
        gpsAccuracyMeters: 12,
        idempotencyKey: 'auto-checkout-key-01',
      },
    },
    afternoonRes,
    repo,
    { serverNow: new Date('2026-08-03T14:15:00+07:00') },
  );
  assert.equal(afternoonRes.statusCode, 201);
  const afternoonRecord = (afternoonRes.body.data as { record: { eventType: AttendanceEventType } }).record;
  assert.equal(afternoonRecord.eventType, AttendanceEventType.CHECK_OUT);
});

test('Users API supports editing username & password, sorting Super Admin -> Kepsek -> Guru, and deleting user safely back to teacher pool', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);
  const saAuth = await loginAsSuperAdmin(repo);
  const authHeaders = {
    cookie: saAuth.cookieHeader,
    [CSRF_HEADER_NAME]: saAuth.csrfToken,
  };

  // Clear seeded teachers and non-superadmin users
  const allUsers = await repo.collection(CollectionName.USERS).list();
  for (const u of allUsers.items) {
    if (u.role !== UserRole.SUPER_ADMIN) {
      await repo.collection(CollectionName.USERS).delete(u.id);
    }
  }
  const allTeachers = await repo.collection(CollectionName.TEACHERS).list();
  for (const t of allTeachers.items) {
    await repo.collection(CollectionName.TEACHERS).delete(t.id);
  }

  // Create 2 teachers and generate users (1 Kepsek, 1 Guru)
  const createTeacher = async (fullName: string, niyNip: string, position: string) => {
    const res = createMockRes();
    await handleTeachers(
      {
        method: 'POST',
        headers: authHeaders,
        body: { fullName, niyNip, position, status: TeacherStatus.ACTIVE },
      },
      res,
      repo,
    );
    assert.equal(res.statusCode, 201);
    return (res.body.data as { teacher: { id: string } }).teacher.id;
  };

  const teacherGuruId = await createTeacher('BUDI SANTOSO', '20521133192001', 'Guru Kelas 1');
  const teacherKepsekId = await createTeacher('AHMAD FAUZI', '20521133192002', 'Kepala Sekolah');

  const genRes = createMockRes();
  await handleGenerateUsersFromTeachers(
    {
      method: 'POST',
      headers: authHeaders,
      body: { items: [{ teacherId: teacherGuruId }, { teacherId: teacherKepsekId }] },
    },
    genRes,
    repo,
  );
  assert.equal(genRes.statusCode, 201);
  const generated = (
    genRes.body.data as { created: Array<{ userId: string; teacherId: string; username: string }> }
  ).created;
  const guruUser = generated.find((g) => g.teacherId === teacherGuruId)!;
  const kepsekUser = generated.find((g) => g.teacherId === teacherKepsekId)!;

  // 1. GET /api/users must order: SUPER_ADMIN -> PRINCIPAL -> TEACHER
  const listRes = createMockRes();
  await handleUsers({ method: 'GET', headers: authHeaders, query: {} }, listRes, repo);
  assert.equal(listRes.statusCode, 200);
  const listedItems = (listRes.body.data as { items: Array<{ role: UserRole; id: string }> }).items;
  assert.equal(listedItems[0]?.role, UserRole.SUPER_ADMIN);
  assert.equal(listedItems[1]?.role, UserRole.PRINCIPAL);
  assert.equal(listedItems[2]?.role, UserRole.TEACHER);

  // 2. Edit username & password of Guru user + Super Admin user
  const patchGuruRes = createMockRes();
  await handleUserById(
    {
      method: 'PATCH',
      headers: authHeaders,
      body: { username: 'budibaru', password: 'BudiPassword99' },
    },
    patchGuruRes,
    guruUser.userId,
    repo,
  );
  assert.equal(patchGuruRes.statusCode, 200);

  const guruNewLogin = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.40.0.1', body: { username: 'budibaru', password: 'BudiPassword99' } },
    guruNewLogin,
    repo,
  );
  assert.equal(guruNewLogin.statusCode, 200);

  // Updating Super Admin's own username & password works too
  const patchSaRes = createMockRes();
  await handleUserById(
    {
      method: 'PATCH',
      headers: authHeaders,
      body: { username: 'superutama', password: 'SuperBaru123' },
    },
    patchSaRes,
    saAuth.userId,
    repo,
  );
  assert.equal(patchSaRes.statusCode, 200);

  const saNewLogin = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.40.0.2', body: { username: 'superutama', password: 'SuperBaru123' } },
    saNewLogin,
    repo,
  );
  assert.equal(saNewLogin.statusCode, 200);

  // Duplicate username rejected with 409
  const dupPatchRes = createMockRes();
  await handleUserById(
    {
      method: 'PATCH',
      headers: authHeaders,
      body: { username: 'budibaru' },
    },
    dupPatchRes,
    kepsekUser.userId,
    repo,
  );
  assert.equal(dupPatchRes.statusCode, 409);

  // 3. Delete user safely returns linked teacher profile to teacher pool without deleting teacher
  const selfDeleteRes = createMockRes();
  await handleUserById(
    { method: 'DELETE', headers: authHeaders },
    selfDeleteRes,
    saAuth.userId,
    repo,
  );
  assert.equal(selfDeleteRes.statusCode, 400);

  const delGuruRes = createMockRes();
  await handleUserById(
    { method: 'DELETE', headers: authHeaders },
    delGuruRes,
    guruUser.userId,
    repo,
  );
  assert.equal(delGuruRes.statusCode, 200);

  // User deleted, teacher still exists with userId: null, and can be regenerated
  assert.equal(await repo.collection(CollectionName.USERS).getById(guruUser.userId), null);
  const intactTeacher = await repo.collection(CollectionName.TEACHERS).getById(teacherGuruId);
  assert.ok(intactTeacher, 'Data guru tidak boleh ikut terhapus saat user dihapus');
  assert.equal(intactTeacher.fullName, 'BUDI SANTOSO');
  assert.equal(intactTeacher.userId, null);

  const regenRes = createMockRes();
  await handleGenerateUsersFromTeachers(
    {
      method: 'POST',
      headers: authHeaders,
      body: { items: [{ teacherId: teacherGuruId }] },
    },
    regenRes,
    repo,
  );
  assert.equal(regenRes.statusCode, 201);
});


