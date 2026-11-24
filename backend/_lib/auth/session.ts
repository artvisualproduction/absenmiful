import crypto from 'node:crypto';
import { CollectionName, type SafeUser, type User, type UserSession } from '../../../src/types';
import type { IDataRepository } from '../repository/types';
import { generateRandomToken, hashToken } from './password';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

function getStatelessSessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.VERCEL_PROJECT_ID?.trim() ||
    'absensi-digital-serverless-mock-session-v1'
  );
}

interface StatelessMockSessionPayload {
  sid: string;
  uid: string;
  un: string;
  exp: number;
}

function signMockSessionToken(payload: StatelessMockSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getStatelessSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `st1.${encoded}.${sig}`;
}

function verifyMockSessionToken(token: string): StatelessMockSessionPayload | null {
  if (!token.startsWith('st1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getStatelessSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<StatelessMockSessionPayload>;
    if (
      typeof parsed.sid !== 'string' ||
      typeof parsed.uid !== 'string' ||
      typeof parsed.un !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (!Number.isFinite(parsed.exp) || parsed.exp <= Date.now()) {
      return null;
    }
    return {
      sid: parsed.sid,
      uid: parsed.uid,
      un: parsed.un,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/** Strips passwordHash & passwordCipher so secrets never leak through auth APIs */
export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _omitHash, passwordCipher: _omitCipher, ...safe } = user;
  return safe;
}

export interface CreatedSessionBundle {
  session: UserSession;
  rawSessionToken: string;
  csrfToken: string;
  maxAgeSeconds: number;
}

export async function createUserSession(
  repo: IDataRepository,
  userId: string,
  ttlMs = SESSION_TTL_MS,
): Promise<CreatedSessionBundle> {
  const csrfToken = generateRandomToken(24);
  const now = new Date();
  const expiresMs = now.getTime() + ttlMs;
  const expiresAt = new Date(expiresMs).toISOString();

  let rawSessionToken = generateRandomToken(32);

  // In ephemeral in-memory mock mode (e.g. Vercel serverless without Firestore creds),
  // sign a stateless token so sessions survive across stateless Lambda containers.
  if (repo.mode === 'mock') {
    const user = await repo.collection(CollectionName.USERS).getById(userId);
    if (user) {
      rawSessionToken = signMockSessionToken({
        sid: `sess_${crypto.randomBytes(8).toString('hex')}`,
        uid: user.id,
        un: user.normalizedUsername,
        exp: expiresMs,
      });
    }
  }

  const session = await repo.collection(CollectionName.USER_SESSIONS).create({
    userId,
    sessionTokenHash: hashToken(rawSessionToken),
    expiresAt,
    revokedAt: null,
    lastSeenAt: now.toISOString(),
  });

  return {
    session,
    rawSessionToken,
    csrfToken,
    maxAgeSeconds: Math.max(0, Math.floor(ttlMs / 1000)),
  };
}

export interface ResolvedAuthContext {
  user: SafeUser;
  session: UserSession;
}

export async function resolveActiveSession(
  repo: IDataRepository,
  rawSessionToken: string | undefined,
): Promise<ResolvedAuthContext | null> {
  if (!rawSessionToken || rawSessionToken.trim().length < 16) {
    return null;
  }

  const trimmed = rawSessionToken.trim();
  const tokenHash = hashToken(trimmed);
  const sessionCol = repo.collection(CollectionName.USER_SESSIONS);
  const session = await sessionCol.findFirst([
    { field: 'sessionTokenHash', op: '==', value: tokenHash },
  ]);

  if (session) {
    if (session.revokedAt !== null) return null;

    const expiresMs = new Date(session.expiresAt).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      return null;
    }

    const user = await repo.collection(CollectionName.USERS).getById(session.userId);
    if (!user || !user.isActive) {
      return null;
    }

    await sessionCol.update(session.id, {
      lastSeenAt: new Date().toISOString(),
    });

    return {
      user: toSafeUser(user),
      session,
    };
  }

  // Stateless cross-container session recovery strictly for ephemeral mock mode on serverless hosts
  if (repo.mode === 'mock') {
    const payload = verifyMockSessionToken(trimmed);
    if (!payload) return null;

    const usersCol = repo.collection(CollectionName.USERS);
    const user =
      (await usersCol.getById(payload.uid)) ??
      (await usersCol.findFirst([{ field: 'normalizedUsername', op: '==', value: payload.un }]));
    if (!user || !user.isActive) return null;

    const nowIso = new Date().toISOString();
    const rehydrated = await sessionCol.create({
      userId: user.id,
      sessionTokenHash: tokenHash,
      expiresAt: new Date(payload.exp).toISOString(),
      revokedAt: null,
      lastSeenAt: nowIso,
    });

    return {
      user: toSafeUser(user),
      session: rehydrated,
    };
  }

  return null;
}

export async function revokeSession(repo: IDataRepository, sessionId: string): Promise<void> {
  await repo.collection(CollectionName.USER_SESSIONS).update(sessionId, {
    revokedAt: new Date().toISOString(),
  });
}

export async function revokeAllUserSessions(
  repo: IDataRepository,
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  const sessionCol = repo.collection(CollectionName.USER_SESSIONS);
  const sessions = await sessionCol.list({
    filters: [{ field: 'userId', op: '==', value: userId }],
  });

  const nowIso = new Date().toISOString();
  await Promise.all(
    sessions.items
      .filter((s) => s.revokedAt === null && s.id !== exceptSessionId)
      .map((s) => sessionCol.update(s.id, { revokedAt: nowIso })),
  );
}
