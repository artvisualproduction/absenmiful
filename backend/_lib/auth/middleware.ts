import crypto from 'node:crypto';
import { UserRole, type SafeUser, type UserSession } from '../../../src/types';
import { ApiError } from '../apiError';
import { getRepository } from '../repository';
import type { IDataRepository } from '../repository/types';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  getHeaderValue,
  parseCookies,
  SESSION_COOKIE_NAME,
  type CookieRequestLike,
} from './cookies';
import { resolveActiveSession } from './session';

export interface ApiRequestLike extends CookieRequestLike {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
  ip?: string;
}

export interface AuthContext {
  user: SafeUser;
  session: UserSession;
  clientIp: string;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function extractClientIp(req: ApiRequestLike): string {
  const forwarded = getHeaderValue(req, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates double-submit CSRF cookie vs X-CSRF-Token header on state-changing requests.
 */
export function assertCsrfToken(req: ApiRequestLike): void {
  const method = (req.method ?? 'GET').toUpperCase();
  if (!MUTATING_METHODS.has(method)) return;

  const cookies = parseCookies(getHeaderValue(req, 'cookie'));
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = getHeaderValue(req, CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || !timingSafeStringEqual(cookieToken, headerToken)) {
    throw ApiError.forbidden('Token keamanan CSRF tidak valid atau hilang. Muat ulang halaman.');
  }
}

export interface RequireAuthOptions {
  allowedRoles?: UserRole[];
  skipCsrf?: boolean;
  allowMustChangePassword?: boolean;
  repo?: IDataRepository;
}

/**
 * Universal server-side authorization guard used across all protected API endpoints.
 * Verifies:
 * 1. Active, non-revoked, non-expired session cookie in `userSessions`
 * 2. Active user record in `users`
 * 3. Double-submit CSRF token for mutating HTTP methods
 * 4. Role membership when `allowedRoles` is provided
 * 5. `mustChangePassword` enforcement (blocks regular endpoints until password is changed)
 */
export async function requireAuth(
  req: ApiRequestLike,
  options: RequireAuthOptions = {},
): Promise<AuthContext> {
  const repo = options.repo ?? getRepository();
  const cookies = parseCookies(getHeaderValue(req, 'cookie'));
  const rawSessionToken = cookies[SESSION_COOKIE_NAME];

  const resolved = await resolveActiveSession(repo, rawSessionToken);
  if (!resolved) {
    throw ApiError.unauthorized('Sesi tidak aktif atau telah berakhir. Silakan login kembali.');
  }

  if (!options.skipCsrf) {
    assertCsrfToken(req);
  }

  if (
    options.allowedRoles &&
    options.allowedRoles.length > 0 &&
    !options.allowedRoles.includes(resolved.user.role)
  ) {
    throw ApiError.forbidden('Peran Anda tidak memiliki izin untuk mengakses sumber daya ini.');
  }

  if (
    !options.allowMustChangePassword &&
    resolved.user.mustChangePassword &&
    resolved.user.role !== UserRole.TEACHER
  ) {
    throw new ApiError(
      403,
      'MUST_CHANGE_PASSWORD',
      'Anda wajib mengganti kata sandi sementara sebelum menggunakan fitur ini.',
    );
  }

  return {
    user: resolved.user,
    session: resolved.session,
    clientIp: extractClientIp(req),
  };
}
