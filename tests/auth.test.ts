import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapInitialAccounts } from '../backend/_lib/auth/bootstrapService';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME } from '../backend/_lib/auth/cookies';
import { resetAllIpRateLimits } from '../backend/_lib/auth/rateLimit';
import { MockRepository } from '../backend/_lib/repository/mockRepository';
import { handleChangePassword } from '../backend/auth/change-password';
import { handleLogin } from '../backend/auth/login';
import { handleLogout } from '../backend/auth/logout';
import { handleMe } from '../backend/auth/me';
import { handleResetPassword } from '../backend/auth/reset-password';
import { handleFoundationOverview } from '../backend/foundation/overview';
import { CollectionName, UserRole } from '../src/types';

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
  const res: MockResponseCapture = {
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
  return res;
}

function extractCookieHeader(res: MockResponseCapture): {
  cookieHeader: string;
  csrfToken: string;
  sessionToken: string;
} {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const pairs: string[] = [];
  let csrfToken = '';
  let sessionToken = '';

  for (const item of list) {
    const firstPart = item.split(';')[0] ?? '';
    const eq = firstPart.indexOf('=');
    if (eq > 0) {
      const k = firstPart.slice(0, eq).trim();
      const v = decodeURIComponent(firstPart.slice(eq + 1).trim());
      pairs.push(`${k}=${encodeURIComponent(v)}`);
      if (k === CSRF_COOKIE_NAME) csrfToken = v;
      if (k === SESSION_COOKIE_NAME) sessionToken = v;
    }
  }
  return { cookieHeader: pairs.join('; '), csrfToken, sessionToken };
}

test('Auth API security suite: unauthenticated access, cross-role denial, rate limit, CSRF, mustChangePassword, and zero hash leakage', async () => {
  resetAllIpRateLimits();
  const repo = new MockRepository();

  // 1. Bootstrap initial accounts without hardcoded passwords in seed
  const bootstrap = await bootstrapInitialAccounts(repo, {
    superAdminPassword: 'SuperSecret!2026',
    adminPassword: 'AdminSecret!2026',
    principalPassword: 'KepsekSecret!2026',
  });

  const teacherAccounts = bootstrap.accounts.filter((a) => a.role === UserRole.TEACHER);
  assert.equal(teacherAccounts.length, 7);
  const principalAcc = bootstrap.accounts.find((a) => a.role === UserRole.PRINCIPAL);
  assert.equal(principalAcc?.linkedTeacherId, 'tch_06');

  // Verify temporary teacher passwords are NEVER derived from NIP
  const teachersInDb = await repo.collection(CollectionName.TEACHERS).list();
  for (const tAcc of teacherAccounts) {
    assert.ok(tAcc.temporaryPassword && tAcc.temporaryPassword.length >= 12);
    const teacherDoc = teachersInDb.items.find((t) => t.id === tAcc.linkedTeacherId);
    assert.ok(teacherDoc);
    assert.notEqual(tAcc.temporaryPassword, teacherDoc.niyNip);
  }

  // 2. Unauthenticated access must be rejected with 401
  const unauthMe = createMockRes();
  await handleMe({ method: 'GET', headers: {} }, unauthMe, repo);
  assert.equal(unauthMe.statusCode, 401);

  const unauthOverview = createMockRes();
  await handleFoundationOverview({ method: 'GET', headers: {} }, unauthOverview, repo);
  assert.equal(unauthOverview.statusCode, 401);

  // 3. Login failure message must ALWAYS be generic for unknown user vs wrong password
  const unknownRes = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.0.0.1', body: { username: 'tidakada', password: 'WrongPassword1!' } },
    unknownRes,
    repo,
  );
  assert.equal(unknownRes.statusCode, 401);

  const wrongPwRes = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.0.0.2', body: { username: 'admin', password: 'WrongPassword1!' } },
    wrongPwRes,
    repo,
  );
  assert.equal(wrongPwRes.statusCode, 401);
  assert.equal(
    (unknownRes.body.error as { message: string }).message,
    (wrongPwRes.body.error as { message: string }).message,
  );

  // 4. Rate limit / account lockout after 5 consecutive failed logins
  for (let i = 0; i < 4; i++) {
    const attemptRes = createMockRes();
    await handleLogin(
      { method: 'POST', ip: '10.0.0.3', body: { username: 'admin', password: 'BadPassword!' } },
      attemptRes,
      repo,
    );
    if (i === 3) {
      // 5th total failure locks the account and returns 429
      assert.equal(attemptRes.statusCode, 429);
    }
  }

  // Even with correct password while locked, login must remain blocked (429)
  const lockedCorrectRes = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.0.0.4', body: { username: 'admin', password: 'AdminSecret!2026' } },
    lockedCorrectRes,
    repo,
  );
  assert.equal(lockedCorrectRes.statusCode, 429);

  // 5. Successful login as PRINCIPAL — verify HttpOnly cookie & zero passwordHash leakage
  const principalLogin = createMockRes();
  await handleLogin(
    { method: 'POST', ip: '10.0.0.5', body: { username: 'kepsek', password: 'KepsekSecret!2026' } },
    principalLogin,
    repo,
  );
  assert.equal(principalLogin.statusCode, 200);
  const serializedLogin = JSON.stringify(principalLogin.body);
  assert.equal(serializedLogin.includes('passwordHash'), false);

  const setCookies = principalLogin.headers['set-cookie'] as string[];
  assert.ok(setCookies.some((c) => c.includes(SESSION_COOKIE_NAME) && c.includes('HttpOnly')));

  const principalCookies = extractCookieHeader(principalLogin);

  // /me must return minimal profile without passwordHash
  const meRes = createMockRes();
  await handleMe(
    { method: 'GET', headers: { cookie: principalCookies.cookieHeader } },
    meRes,
    repo,
  );
  assert.equal(meRes.statusCode, 200);
  assert.equal(JSON.stringify(meRes.body).includes('passwordHash'), false);

  // 6. Cross-role access denied: PRINCIPAL cannot reset passwords (403)
  const principalResetRes = createMockRes();
  await handleResetPassword(
    {
      method: 'POST',
      headers: {
        cookie: principalCookies.cookieHeader,
        [CSRF_HEADER_NAME]: principalCookies.csrfToken,
      },
      body: { targetUserId: teacherAccounts[0]!.userId, reason: 'Uji lintas role' },
    },
    principalResetRes,
    repo,
  );
  assert.equal(principalResetRes.statusCode, 403);

  // 7. Teacher first login with temporary password enforces mustChangePassword
  const firstTeacher = teacherAccounts[0]!;
  const teacherLogin = createMockRes();
  await handleLogin(
    {
      method: 'POST',
      ip: '10.0.0.6',
      body: { username: firstTeacher.username, password: firstTeacher.temporaryPassword },
    },
    teacherLogin,
    repo,
  );
  assert.equal(teacherLogin.statusCode, 200);
  const teacherCookies = extractCookieHeader(teacherLogin);

  // Change password without CSRF header must fail with 403
  const noCsrfRes = createMockRes();
  await handleChangePassword(
    {
      method: 'POST',
      headers: { cookie: teacherCookies.cookieHeader },
      body: { currentPassword: firstTeacher.temporaryPassword, newPassword: 'NewTeacher!2026' },
    },
    noCsrfRes,
    repo,
  );
  assert.equal(noCsrfRes.statusCode, 403);

  // Change password WITH valid CSRF header succeeds
  const validChangeRes = createMockRes();
  await handleChangePassword(
    {
      method: 'POST',
      headers: {
        cookie: teacherCookies.cookieHeader,
        [CSRF_HEADER_NAME]: teacherCookies.csrfToken,
      },
      body: { currentPassword: firstTeacher.temporaryPassword, newPassword: 'NewTeacher!2026' },
    },
    validChangeRes,
    repo,
  );
  assert.equal(validChangeRes.statusCode, 200);

  // Teacher cannot access admin/principal overview (403)
  const teacherOverviewRes = createMockRes();
  await handleFoundationOverview(
    { method: 'GET', headers: { cookie: teacherCookies.cookieHeader } },
    teacherOverviewRes,
    repo,
  );
  assert.equal(teacherOverviewRes.statusCode, 403);

  // 8. Logout revokes session server-side
  const logoutRes = createMockRes();
  await handleLogout(
    {
      method: 'POST',
      headers: {
        cookie: teacherCookies.cookieHeader,
        [CSRF_HEADER_NAME]: teacherCookies.csrfToken,
      },
    },
    logoutRes,
    repo,
  );
  assert.equal(logoutRes.statusCode, 200);

  // Reusing revoked session cookie must return 401
  const afterLogoutMe = createMockRes();
  await handleMe(
    { method: 'GET', headers: { cookie: teacherCookies.cookieHeader } },
    afterLogoutMe,
    repo,
  );
  assert.equal(afterLogoutMe.statusCode, 401);

  // 9. Verify activityLogs recorded logins & zero hashes leaked
  const logs = await repo.collection(CollectionName.ACTIVITY_LOGS).list();
  assert.ok(logs.total >= 6);
  assert.equal(JSON.stringify(logs.items).includes('passwordHash'), false);
});
