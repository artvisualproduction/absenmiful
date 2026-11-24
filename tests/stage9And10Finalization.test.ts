import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { MinimalApiResponse } from '../backend/_lib/apiError';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
} from '../backend/_lib/auth/cookies';
import { ensurePreviewAccountsInitialized } from '../backend/_lib/auth/bootstrapService';
import { hashPassword } from '../backend/_lib/auth/password';
import { createUserSession } from '../backend/_lib/auth/session';
import { handleLogin } from '../backend/auth/login';
import { FirestoreRestRepository } from '../backend/_lib/repository/firestoreRestRepository';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleAttendanceScan } from '../backend/attendance/scan';
import { handleAuditLogs } from '../backend/audit-logs/index';
import { handleResetPassword } from '../backend/auth/reset-password';
import { handleWebManifest } from '../backend/manifest';
import { handlePortalExit } from '../backend/portal/exit';
import { handleQrBulkIssue } from '../backend/qr/bulk';
import { handleQrTokens } from '../backend/qr/tokens';
import { handleAttendanceMatrix } from '../backend/reports/matrix';
import { handleSettingsBackup } from '../backend/settings/backup';
import { handleBrandingUpload } from '../backend/settings/branding';
import { handleAppSettings } from '../backend/settings/index';
import { handleStudents } from '../backend/students/index';
import { handleTeachers } from '../backend/teachers/index';
import { handleUserById } from '../backend/users/[id]';
import { handleUsers } from '../backend/users/index';
import { AuthProvider } from '../src/app/providers/AuthProvider';
import { ToastProvider } from '../src/components/ui/Toast';
import { LoginPage } from '../src/features/auth/LoginPage';
import { PortalAbsensiPage } from '../src/features/portal/PortalAbsensiPage';
import {
  AttendanceAudience,
  CollectionName,
  Gender,
  QrOwnerType,
  StudentStatus,
  UserRole,
} from '../src/types';

function createMockRes() {
  const headers: Record<string, string | string[]> = {};
  const result = { statusCode: 200, body: null as unknown, headers };
  const res: MinimalApiResponse = {
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      result.body = payload;
    },
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
    },
  };
  return { res, result };
}

function makeAuthHeaders(rawSessionToken: string, csrfToken: string) {
  return {
    cookie: `${SESSION_COOKIE_NAME}=${rawSessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
    [CSRF_HEADER_NAME]: csrfToken,
  };
}

async function seedStage9Fixture() {
  const repo = new MockRepository();
  const pwHash = await hashPassword('Rahasia1234!');

  const superAdmin = await repo.collection(CollectionName.USERS).create({
    username: 'superadmin',
    normalizedUsername: 'superadmin',
    passwordHash: pwHash,
    role: UserRole.SUPER_ADMIN,
    linkedTeacherId: null,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: 'system',
  });

  const admin = await repo.collection(CollectionName.USERS).create({
    username: 'admin',
    normalizedUsername: 'admin',
    passwordHash: pwHash,
    role: UserRole.ADMIN,
    linkedTeacherId: null,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: superAdmin.id,
  });

  const principal = await repo.collection(CollectionName.USERS).create({
    username: 'kepsek',
    normalizedUsername: 'kepsek',
    passwordHash: pwHash,
    role: UserRole.PRINCIPAL,
    linkedTeacherId: null,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: superAdmin.id,
  });

  const teacherUser = await repo.collection(CollectionName.USERS).create({
    username: 'guru1',
    normalizedUsername: 'guru1',
    passwordHash: pwHash,
    role: UserRole.TEACHER,
    linkedTeacherId: null,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: admin.id,
  });

  const classesRes = await repo.collection(CollectionName.CLASSES).list();
  const cls = classesRes.items[0];
  assert.ok(cls, 'MockRepository should seed classes');

  const student = await repo.collection(CollectionName.STUDENTS).create({
    nis: '00991234',
    fullName: 'Aulia Rahma',
    classId: cls.id,
    gender: Gender.P,
    photoPath: null,
    status: StudentStatus.ACTIVE,
    qrTokenId: null,
    isDemo: false,
  });

  // Deactivate seeded student rules and create a 24h test rule for reliable scan testing
  const existingRules = await repo.collection(CollectionName.ATTENDANCE_RULES).list();
  for (const r of existingRules.items) {
    if (r.audience === AttendanceAudience.STUDENT) {
      await repo.collection(CollectionName.ATTENDANCE_RULES).update(r.id, { isActive: false });
    }
  }

  await repo.collection(CollectionName.ATTENDANCE_RULES).create({
    name: 'Aturan Siswa 24 Jam Test',
    audience: AttendanceAudience.STUDENT,
    classIds: [],
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    checkInStart: '00:00',
    lateAfter: '23:58',
    checkInDeadline: '23:59',
    checkOutStart: '00:00',
    checkOutDeadline: '23:59',
    lateToleranceMinutes: 5,
    gpsRequired: false,
    geofenceRequired: false,
    timezone: 'Asia/Jakarta',
    effectiveFrom: '2024-01-01',
    effectiveUntil: null,
    version: 99,
    isActive: true,
  });

  const saSession = await createUserSession(repo, superAdmin.id);
  const adminSession = await createUserSession(repo, admin.id);
  const principalSession = await createUserSession(repo, principal.id);
  const teacherSession = await createUserSession(repo, teacherUser.id);

  return {
    repo,
    superAdmin,
    admin,
    principal,
    teacherUser,
    student,
    cls,
    headers: {
      superAdmin: makeAuthHeaders(saSession.rawSessionToken, saSession.csrfToken),
      admin: makeAuthHeaders(adminSession.rawSessionToken, adminSession.csrfToken),
      principal: makeAuthHeaders(principalSession.rawSessionToken, principalSession.csrfToken),
      teacher: makeAuthHeaders(teacherSession.rawSessionToken, teacherSession.csrfToken),
    },
  };
}

// ---------------------------------------------------------------------------
// 1. STAGE 9: QR Bulk Issuance & Token Revocation (Zero PII in QR Token)
// ---------------------------------------------------------------------------
test('Stage 9 QR: bulk issuance generates random tokens without NIS/name and revokes old tokens', async () => {
  const fx = await seedStage9Fixture();

  const first = createMockRes();
  await handleQrBulkIssue(
    {
      method: 'POST',
      headers: fx.headers.admin,
      body: { ownerType: QrOwnerType.STUDENT, ownerIds: [fx.student.id] },
    },
    first.res,
    fx.repo,
  );
  assert.equal(first.result.statusCode, 201);
  const firstToken = (first.result.body as { data: { items: Array<{ rawToken: string }> } }).data
    .items[0].rawToken;
  assert.ok(firstToken.length >= 24);
  assert.ok(!firstToken.includes(fx.student.nis), 'QR token must never contain NIS');
  assert.ok(!firstToken.toLowerCase().includes('aulia'), 'QR token must never contain student name');

  // Re-issue revokes old token
  const second = createMockRes();
  await handleQrBulkIssue(
    {
      method: 'POST',
      headers: fx.headers.admin,
      body: { ownerType: QrOwnerType.STUDENT, ownerIds: [fx.student.id] },
    },
    second.res,
    fx.repo,
  );
  assert.equal(second.result.statusCode, 201);
  const secondToken = (second.result.body as { data: { items: Array<{ rawToken: string }> } }).data
    .items[0].rawToken;
  assert.notEqual(firstToken, secondToken);

  const allTokens = await fx.repo.collection(CollectionName.QR_TOKENS).list({
    filters: [{ field: 'ownerId', op: '==', value: fx.student.id }],
  });
  const activeCount = allTokens.items.filter((t) => t.isActive && t.revokedAt === null).length;
  const revokedCount = allTokens.items.filter((t) => !t.isActive && t.revokedAt !== null).length;
  assert.equal(activeCount, 1);
  assert.equal(revokedCount, 1);
});

// ---------------------------------------------------------------------------
// 2. STAGE 9: Settings RBAC, Branding Magic-Byte Validation, Manifest Sync & Backup Sanitization
// ---------------------------------------------------------------------------
test('Stage 9 Settings: Principal read-only, Admin updates propagate to manifest, malicious upload rejected, backup sanitized', async () => {
  const fx = await seedStage9Fixture();

  // Principal can GET settings (canEdit: false)
  const pGet = createMockRes();
  await handleAppSettings(
    { method: 'GET', headers: fx.headers.principal },
    pGet.res,
    fx.repo,
  );
  assert.equal(pGet.result.statusCode, 200);
  const pData = (
    pGet.result.body as { data: { canEdit: boolean; settings: Record<string, unknown> } }
  ).data;
  assert.equal(pData.canEdit, false);
  assert.equal('portalExitPasswordHash' in pData.settings, false);

  // Principal cannot PATCH settings
  const pPatch = createMockRes();
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: fx.headers.principal,
      body: { schoolName: 'Diubah Kepala Sekolah' },
    },
    pPatch.res,
    fx.repo,
  );
  assert.equal(pPatch.result.statusCode, 403);

  // Admin updates schoolName + portalExitPassword
  const aPatch = createMockRes();
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: fx.headers.admin,
      body: {
        appName: 'Absensi MI MU',
        schoolName: 'MI Miftahul Ulum Sumberwuluh Resmi',
        portalExitPassword: 'PortalBaru2026!',
      },
    },
    aPatch.res,
    fx.repo,
  );
  assert.equal(aPatch.result.statusCode, 200);

  // Dynamic manifest immediately reflects updated settings (and defaults PWA name to MiFUL)
  const manifestRes = createMockRes();
  await handleWebManifest({ method: 'GET' }, manifestRes.res, fx.repo);
  assert.equal(manifestRes.result.statusCode, 200);
  const manifest = manifestRes.result.body as {
    name: string;
    short_name: string;
    display: string;
    icons: unknown[];
  };
  assert.ok(manifest.name.includes('MI Miftahul Ulum Sumberwuluh Resmi'));
  assert.equal(manifest.short_name, 'MiFUL');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 3);

  // Admin can customize pwaAppName and manifest updates immediately
  const pwaPatch = createMockRes();
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: fx.headers.admin,
      body: { pwaAppName: 'MIFUL Hadir' },
    },
    pwaPatch.res,
    fx.repo,
  );
  assert.equal(pwaPatch.result.statusCode, 200);
  const manifestCustomNameRes = createMockRes();
  await handleWebManifest({ method: 'GET' }, manifestCustomNameRes.res, fx.repo);
  const manifestCustomName = manifestCustomNameRes.result.body as {
    name: string;
    short_name: string;
  };
  assert.equal(manifestCustomName.short_name, 'MIFUL Hadir');
  assert.ok(manifestCustomName.name.startsWith('MIFUL Hadir'));

  // Malicious upload (HTML script pretending to be image/png) MUST be rejected by magic-byte check
  const fakePngDataUrl = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
  const badUpload = createMockRes();
  await handleBrandingUpload(
    {
      method: 'POST',
      headers: fx.headers.admin,
      body: { slot: 'logo', mimeType: 'image/png', dataUrl: fakePngDataUrl },
    },
    badUpload.res,
    fx.repo,
  );
  assert.equal(badUpload.result.statusCode, 400);

  // Sanitized JSON backup MUST NOT contain any passwordHash, portalExitPasswordHash, or tokenHash
  const backupRes = createMockRes();
  await handleSettingsBackup(
    { method: 'POST', headers: fx.headers.admin },
    backupRes.res,
    fx.repo,
  );
  assert.equal(backupRes.result.statusCode, 200);
  const serialized = JSON.stringify(backupRes.result.body);
  assert.ok(!serialized.includes('passwordHash'));
  assert.ok(!serialized.includes('portalExitPasswordHash'));
  assert.ok(!serialized.includes('tokenHash'));
  assert.ok(!serialized.includes('sessionTokenHash'));
});

// ---------------------------------------------------------------------------
// 3. STAGE 9: Users RBAC Hierarchy & Audit Logs Append-Only + Redaction
// ---------------------------------------------------------------------------
test('Stage 9 Users & Audit Logs: Principal/Admin cannot manage SUPER_ADMIN; audit logs are append-only and redacted', async () => {
  const fx = await seedStage9Fixture();

  // Principal cannot modify SUPER_ADMIN
  const pModSa = createMockRes();
  await handleUserById(
    {
      method: 'PATCH',
      headers: fx.headers.principal,
      body: { isActive: false },
    },
    pModSa.res,
    fx.superAdmin.id,
    fx.repo,
  );
  assert.equal(pModSa.result.statusCode, 403);

  // Admin cannot escalate teacher to SUPER_ADMIN
  const aEscalate = createMockRes();
  await handleUserById(
    {
      method: 'PATCH',
      headers: fx.headers.admin,
      body: { role: UserRole.SUPER_ADMIN },
    },
    aEscalate.res,
    fx.teacherUser.id,
    fx.repo,
  );
  assert.equal(aEscalate.result.statusCode, 403);

  // Admin cannot reset SUPER_ADMIN password
  const aResetSa = createMockRes();
  await handleResetPassword(
    {
      method: 'POST',
      headers: fx.headers.admin,
      body: {
        targetUserId: fx.superAdmin.id,
        customPassword: 'TestPassword!2026',
        reason: 'Uji akses lintas peran',
      },
    },
    aResetSa.res,
    fx.repo,
  );
  assert.equal(aResetSa.result.statusCode, 403);

  // Admin deactivating teacherUser revokes active sessions immediately
  const aDeactivate = createMockRes();
  await handleUserById(
    {
      method: 'PATCH',
      headers: fx.headers.admin,
      body: { isActive: false },
    },
    aDeactivate.res,
    fx.teacherUser.id,
    fx.repo,
  );
  assert.equal(aDeactivate.result.statusCode, 200);
  const teacherSessions = await fx.repo.collection(CollectionName.USER_SESSIONS).list({
    filters: [{ field: 'userId', op: '==', value: fx.teacherUser.id }],
  });
  assert.ok(teacherSessions.items.every((s) => s.revokedAt !== null));

  // Audit logs reject DELETE (strictly append-only via API)
  const delLog = createMockRes();
  await handleAuditLogs(
    { method: 'DELETE', headers: fx.headers.superAdmin },
    delLog.res,
    fx.repo,
  );
  assert.equal(delLog.result.statusCode, 405);

  // Principal sees LIMITED_PRINCIPAL scope
  const pLogs = createMockRes();
  await handleAuditLogs(
    { method: 'GET', headers: fx.headers.principal },
    pLogs.res,
    fx.repo,
  );
  assert.equal(pLogs.result.statusCode, 200);
  assert.equal((pLogs.result.body as { data: { scope: string } }).data.scope, 'LIMITED_PRINCIPAL');
});

// ---------------------------------------------------------------------------
// 4. STAGE 10: Concurrent Scan Load Test, Session Expiry & Mass Assignment Protection
// ---------------------------------------------------------------------------
test('Stage 10 Concurrency & Security: 20 parallel duplicate scans create exactly 1 record; expired session & mass assignment blocked', async () => {
  const fx = await seedStage9Fixture();

  // Issue QR token for student
  const qrRes = createMockRes();
  await handleQrTokens(
    {
      method: 'POST',
      headers: fx.headers.admin,
      body: { ownerType: QrOwnerType.STUDENT, ownerId: fx.student.id },
    },
    qrRes.res,
    fx.repo,
  );
  const rawToken = (qrRes.result.body as { data: { rawToken: string } }).data.rawToken;

  // Fire 20 concurrent scan requests for the same student (simulating rapid burst)
  const burstResults = await Promise.all(
    Array.from({ length: 20 }, (_, i) => {
      const m = createMockRes();
      return handleAttendanceScan(
        {
          method: 'POST',
          headers: fx.headers.admin,
          body: {
            token: rawToken,
            eventType: 'CHECK_IN',
            idempotencyKey: `burst-key-${i}`,
          },
        },
        m.res,
        fx.repo,
      ).then(() => m.result.statusCode);
    }),
  );

  const succeeded = burstResults.filter((c) => c === 200 || c === 201).length;
  assert.equal(succeeded, 1, 'Exactly one scan should create the CHECK_IN record under concurrency');
  const records = await fx.repo.collection(CollectionName.ATTENDANCE_RECORDS).list({
    filters: [{ field: 'personId', op: '==', value: fx.student.id }],
  });
  assert.equal(records.items.length, 1);

  // Expired session token must be rejected with 401
  const expiredSession = await createUserSession(fx.repo, fx.admin.id, -60_000);
  const expRes = createMockRes();
  await handleUsers(
    {
      method: 'GET',
      headers: makeAuthHeaders(expiredSession.rawSessionToken, expiredSession.csrfToken),
    },
    expRes.res,
    fx.repo,
  );
  assert.equal(expRes.result.statusCode, 401);

  // Mass assignment check: injecting isDemo=true or archivedAt when creating student is ignored
  const maRes = createMockRes();
  await handleStudents(
    {
      method: 'POST',
      headers: fx.headers.admin,
      body: {
        nis: '00887766',
        fullName: 'Budi Santoso',
        classId: fx.cls.id,
        gender: 'L',
        status: StudentStatus.ACTIVE,
        isDemo: true,
        archivedAt: '2020-01-01T00:00:00.000Z',
        role: 'SUPER_ADMIN',
      },
    },
    maRes.res,
    fx.repo,
  );
  assert.equal(maRes.result.statusCode, 201);
  const createdStudent = (
    maRes.result.body as { data: { isDemo?: boolean } }
  ).data;
  assert.equal(createdStudent.isDemo ?? false, false);

  // Auto-init preview accounts allows immediate Admin login without manual installation
  const freshRepo = new MockRepository();
  await ensurePreviewAccountsInitialized(freshRepo);
  const loginRes = createMockRes();
  await handleLogin(
    {
      method: 'POST',
      headers: {},
      body: { username: 'admin', password: 'admin123' },
    },
    loginRes.res,
    freshRepo,
  );
  assert.equal(loginRes.result.statusCode, 200);
  const loggedUser = (loginRes.result.body as { data: { user: { role: string } } }).data.user;
  assert.equal(loggedUser.role, UserRole.ADMIN);
});

// ---------------------------------------------------------------------------
// 5. STAGE 10: FirestoreRestRepository Mock-Fetch CRUD, OAuth2 JWT & Cursor Pagination
// ---------------------------------------------------------------------------
test('Stage 10 FirestoreRestRepository: supports RS256 OAuth2 token, createIfNotExists, getById, and cursor pagination over REST', async () => {
  const originalFetch = globalThis.fetch;
  const mockStore = new Map<string, Record<string, unknown>>();
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';

    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'mock-oauth-token', expires_in: 3600 }), {
        status: 200,
      });
    }

    if (url.endsWith(':runQuery') && method === 'POST') {
      const docs = Array.from(mockStore.values()).sort((a, b) => {
        const aName = (a.fields as { name?: { stringValue?: string } })?.name?.stringValue ?? '';
        const bName = (b.fields as { name?: { stringValue?: string } })?.name?.stringValue ?? '';
        return aName.localeCompare(bName);
      });
      return new Response(JSON.stringify(docs.map((doc) => ({ document: doc }))), {
        status: 200,
      });
    }

    if (url.includes('/documents/subjects')) {
      if (method === 'POST') {
        const u = new URL(url);
        const docId = u.searchParams.get('documentId') ?? `doc-${mockStore.size + 1}`;
        const body = JSON.parse(String(init?.body ?? '{}'));
        const docName = `projects/demo/databases/(default)/documents/subjects/${docId}`;
        if (mockStore.has(docId)) {
          return new Response(JSON.stringify({ error: { message: 'ALREADY_EXISTS' } }), {
            status: 409,
          });
        }
        const stored = { name: docName, fields: body.fields };
        mockStore.set(docId, stored);
        return new Response(JSON.stringify(stored), { status: 200 });
      }
      if (method === 'GET' && url.includes('/documents/subjects?')) {
        return new Response(JSON.stringify({ documents: Array.from(mockStore.values()) }), {
          status: 200,
        });
      }
      if (method === 'GET' && url.endsWith('/documents/subjects')) {
        return new Response(JSON.stringify({ documents: Array.from(mockStore.values()) }), {
          status: 200,
        });
      }
      if (method === 'GET') {
        const id = decodeURIComponent(url.split('/').pop() ?? '');
        const found = mockStore.get(id);
        if (!found) {
          return new Response(JSON.stringify({ error: { message: 'NOT_FOUND' } }), { status: 404 });
        }
        return new Response(JSON.stringify(found), { status: 200 });
      }
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;

  try {
    const restRepo = new FirestoreRestRepository({
      projectId: 'demo',
      authMode: 'service_account',
      apiKey: '',
      clientEmail: 'absensi-api@demo.iam.gserviceaccount.com',
      privateKey: privateKeyPem,
      storageBucket: 'demo.appspot.com',
      dataMode: 'real',
    });

    const subjects = restRepo.collection(CollectionName.SUBJECTS);
    const first = await subjects.createIfNotExists('sub-1', {
      name: 'Matematika',
      code: 'MTK',
      isActive: true,
    });
    assert.equal(first.created, true);

    const dup = await subjects.createIfNotExists('sub-1', {
      name: 'Duplikat',
      code: 'MTK',
      isActive: true,
    });
    assert.equal(dup.created, false);

    await subjects.createIfNotExists('sub-2', {
      name: 'Bahasa Arab',
      code: 'BAR',
      isActive: true,
    });
    await subjects.createIfNotExists('sub-3', {
      name: 'Fiqih',
      code: 'FQH',
      isActive: true,
    });

    const page1 = await subjects.list({ limit: 2, sort: { field: 'name', direction: 'asc' } });
    assert.equal(page1.items.length, 2);
    assert.ok(page1.nextCursor !== null);

    const page2 = await subjects.list({
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
      sort: { field: 'name', direction: 'asc' },
    });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.nextCursor, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// 6. STAGE 10: UI Smoke Rendering + Static Security & PWA Config Audit
// ---------------------------------------------------------------------------
test('Stage 10 UI & Security Audit: Login SSR renders cleanly; firestore.rules, indexes, vercel.json, and SW comply', () => {
  const html = renderToStaticMarkup(
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
  assert.ok(html.includes('MI MIFTAHUL ULUM'));
  assert.ok(html.includes('Selamat Datang !'));
  assert.ok(html.includes('ArtVisual Production'));
  assert.ok(html.includes('Application and Website Developer'));
  assert.equal(html.includes('Masuk dengan Google'), false);

  const portalHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/portal'] },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(PortalAbsensiPage)),
      ),
    ),
  );
  assert.ok(portalHtml.includes('MI MIFTAHUL ULUM'));
  assert.equal(portalHtml.includes('STANDBY SIAP PINDAI'), false);
  assert.equal(portalHtml.includes('Otomatis (Deteksi Masuk &amp; Pulang)'), false);
  assert.equal(portalHtml.includes('portal-manual-nis-input'), false);
  assert.equal(portalHtml.includes('Catat Absen'), false);

  const rulesText = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.equal(rulesText.includes('allow read, write: if true;'), false);
  assert.ok(rulesText.includes('match /attendanceRecords/{docId}'));
  assert.ok(rulesText.includes('allow read, write: if false;'));

  const indexesJson = JSON.parse(fs.readFileSync(path.resolve('firestore.indexes.json'), 'utf8')) as {
    indexes: unknown[];
  };
  assert.ok(indexesJson.indexes.length >= 7);

  const vercelText = fs.readFileSync(path.resolve('vercel.json'), 'utf8');
  assert.ok(vercelText.includes('Content-Security-Policy'));
  assert.ok(vercelText.includes('Strict-Transport-Security'));
  assert.ok(vercelText.includes('X-Frame-Options'));
  assert.ok(vercelText.includes('no-store'));

  const swText = fs.readFileSync(path.resolve('public/service-worker.js'), 'utf8');
  assert.ok(swText.includes("pathname.startsWith('/api/')"));
  assert.ok(swText.includes('SKIP_WAITING'));
  assert.ok(swText.includes('/offline.html'));

  for (const iconPath of [
    'public/icons/pwa-192x192.png',
    'public/icons/pwa-512x512.png',
    'public/icons/pwa-maskable-512x512.png',
    'public/icons/apple-touch-icon.png',
    'public/favicon.png',
  ]) {
    const buf = fs.readFileSync(path.resolve(iconPath));
    assert.equal(buf[0], 0x89, `${iconPath} must have PNG magic header`);
    assert.equal(buf[1], 0x50);
  }
});

// ---------------------------------------------------------------------------
// 7. Production Feature Upgrades Regression Suite
// ---------------------------------------------------------------------------
test('Production Upgrades: Kepala Sekolah first, NIS/NIY scan, default portal password 123, logo syncs PWA icons, portalScanMethod, & attendance matrix', async () => {
  const repo = new MockRepository();
  await ensurePreviewAccountsInitialized(repo);

  // Login as Admin
  const loginRes = createMockRes();
  await handleLogin(
    {
      method: 'POST',
      headers: {},
      body: { username: 'admin', password: process.env.PREVIEW_ADMIN_PASSWORD || 'admin123' },
    },
    loginRes.res,
    repo,
  );
  assert.equal(loginRes.result.statusCode, 200);
  const setCookie = loginRes.result.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie ?? '')];
  const sessionPair = cookies
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!
    .split(';')[0]!;
  const csrfPair = cookies
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))!
    .split(';')[0]!;
  const csrfToken = csrfPair.split('=')[1]!;
  const adminHeaders = {
    cookie: `${sessionPair}; ${csrfPair}`,
    [CSRF_HEADER_NAME]: csrfToken,
  };

  // 1. Kepala Sekolah always sorted first on GET /api/teachers
  const teachersRes = createMockRes();
  await handleTeachers({ method: 'GET', headers: adminHeaders, query: {} }, teachersRes.res, repo);
  assert.equal(teachersRes.result.statusCode, 200);
  const teacherList = (
    teachersRes.result.body as { data: { items: { fullName: string; position: string }[] } }
  ).data.items;
  assert.equal(teacherList[0]?.fullName, 'IMAM MUSTHOFA');
  assert.equal(teacherList[0]?.position, 'Kepala Sekolah');

  // 2. Direct NIS scan works for students without needing random QR token
  const scanNisRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminHeaders,
      body: {
        token: '90000001',
        eventType: 'AUTO',
        idempotencyKey: 'prod_upgrade_nis_scan_001',
        latitude: -8.2134,
        longitude: 113.0792,
        gpsAccuracyMeters: 15,
      },
    },
    scanNisRes.res,
    repo,
    { serverNow: new Date('2026-11-18T06:50:00+07:00') },
  );
  assert.equal(scanNisRes.result.statusCode, 201);

  // 3. Direct NIY/NIP scan resolves teacher (triggers 428 SELFIE_REQUIRED when selfie missing)
  const scanNiyRes = createMockRes();
  await handleAttendanceScan(
    {
      method: 'POST',
      headers: adminHeaders,
      body: {
        token: '20521133191001',
        eventType: 'AUTO',
        idempotencyKey: 'prod_upgrade_niy_scan_001',
        latitude: -8.2134,
        longitude: 113.0792,
        gpsAccuracyMeters: 15,
      },
    },
    scanNiyRes.res,
    repo,
    { serverNow: new Date('2026-11-18T06:50:00+07:00') },
  );
  assert.equal(scanNiyRes.result.statusCode, 428);

  // 5. Logo upload automatically updates faviconPath, pwaIcon192Path, pwaIcon512Path
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const logoUploadRes = createMockRes();
  await handleBrandingUpload(
    {
      method: 'POST',
      headers: adminHeaders,
      body: {
        slot: 'logo',
        mimeType: 'image/png',
        dataUrl: `data:image/png;base64,${tinyPngBase64}`,
      },
    },
    logoUploadRes.res,
    repo,
  );
  assert.equal(logoUploadRes.result.statusCode, 201);
  const uploadedUrl = (logoUploadRes.result.body as { data: { url: string } }).data.url;
  const updatedSettings = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
  assert.equal(updatedSettings?.logoPath, uploadedUrl);
  assert.equal(updatedSettings?.faviconPath, uploadedUrl);
  assert.equal(updatedSettings?.pwaIcon192Path, uploadedUrl);
  assert.equal(updatedSettings?.pwaIcon512Path, uploadedUrl);

  const manifestAfterLogoRes = createMockRes();
  await handleWebManifest({ method: 'GET' }, manifestAfterLogoRes.res, repo);
  assert.equal(manifestAfterLogoRes.result.statusCode, 200);
  const manifestAfterLogo = manifestAfterLogoRes.result.body as {
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
  };
  assert.equal(manifestAfterLogo.icons.length, 3);
  for (const icon of manifestAfterLogo.icons) {
    assert.equal(icon.src, uploadedUrl);
    assert.equal(icon.type, 'image/png');
  }

  // 6. portalScanMethod can be updated via PATCH /api/settings
  const patchMethodRes = createMockRes();
  await handleAppSettings(
    {
      method: 'PATCH',
      headers: adminHeaders,
      body: { portalScanMethod: 'USB_SCANNER_ONLY' },
    },
    patchMethodRes.res,
    repo,
  );
  assert.equal(patchMethodRes.result.statusCode, 200);
  const afterMethod = await repo.collection(CollectionName.APP_SETTINGS).getById('default');
  assert.equal(afterMethod?.portalScanMethod, 'USB_SCANNER_ONLY');

  // 7. GET /api/reports/matrix returns weekly date columns & accurate cell code ('H') for scanned student
  const matrixRes = createMockRes();
  await handleAttendanceMatrix(
    {
      method: 'GET',
      headers: adminHeaders,
      query: {
        period: 'custom',
        dimension: 'STUDENT',
        dateFrom: '2026-11-16',
        dateTo: '2026-11-21',
      },
    },
    matrixRes.res,
    repo,
  );
  assert.equal(matrixRes.result.statusCode, 200);
  const matrixData = (
    matrixRes.result.body as {
      data: {
        dates: { date: string }[];
        rows: { identifier: string; cells: Record<string, string>; summary: { present: number } }[];
      };
    }
  ).data;
  assert.equal(matrixData.dates.length, 6);
  const stuRow = matrixData.rows.find((r) => r.identifier === '90000001');
  assert.ok(stuRow);
  assert.equal(stuRow.cells['2026-11-18'], 'H');
  assert.equal(stuRow.summary.present, 1);

  // 8. Default portal exit password is "123" (revokes active session upon exit)
  const exitOk = createMockRes();
  await handlePortalExit(
    { method: 'POST', headers: adminHeaders, body: { password: '123' } },
    exitOk.res,
    repo,
  );
  assert.equal(exitOk.result.statusCode, 200);
});
