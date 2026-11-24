export const SESSION_COOKIE_NAME = 'absensi_session';
export const CSRF_COOKIE_NAME = 'absensi_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export interface CookieRequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

export interface CookieResponseLike {
  setHeader?(name: string, value: string | string[]): void;
  getHeader?(name: string): unknown;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function getHeaderValue(
  req: CookieRequestLike,
  headerName: string,
): string | undefined {
  const headers = req.headers;
  if (!headers) return undefined;
  const lower = headerName.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

function isSecureContext(req: CookieRequestLike): boolean {
  const host = (getHeaderValue(req, 'x-forwarded-host') ?? getHeaderValue(req, 'host') ?? '').toLowerCase();
  const isLocalHost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0');

  const proto = (getHeaderValue(req, 'x-forwarded-proto') ?? '').toLowerCase();
  if (proto === 'https') return true;

  const origin = (getHeaderValue(req, 'origin') ?? getHeaderValue(req, 'referer') ?? '').toLowerCase();
  if (origin.startsWith('https://')) return true;

  if (!isLocalHost && (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1')) {
    return true;
  }
  return false;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    maxAgeSeconds?: number;
    path?: string;
  },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`];
  if (typeof options.maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  return parts.join('; ');
}

function appendSetCookie(res: CookieResponseLike, cookies: string[]): void {
  if (!res.setHeader) return;
  const existing = res.getHeader?.('Set-Cookie');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing.map(String), ...cookies]);
  } else if (typeof existing === 'string') {
    res.setHeader('Set-Cookie', [existing, ...cookies]);
  } else {
    res.setHeader('Set-Cookie', cookies);
  }
}

export function setAuthCookies(
  req: CookieRequestLike,
  res: CookieResponseLike,
  sessionToken: string,
  csrfToken: string,
  maxAgeSeconds = 12 * 60 * 60,
): void {
  const secure = isSecureContext(req);
  // Top-level Vercel deployment uses SameSite=Lax (accepted on all browsers including iOS Safari);
  // HTTPS iframe previews (e.g. AI Studio) use SameSite=None; Secure.
  const sameSite: 'None' | 'Lax' =
    process.env.VERCEL === '1' ? 'Lax' : secure ? 'None' : 'Lax';

  const sessionCookie = serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAgeSeconds,
    path: '/',
  });

  const csrfCookie = serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    maxAgeSeconds,
    path: '/',
  });

  appendSetCookie(res, [sessionCookie, csrfCookie]);
}

export function clearAuthCookies(req: CookieRequestLike, res: CookieResponseLike): void {
  const secure = isSecureContext(req);
  const sameSite: 'None' | 'Lax' =
    process.env.VERCEL === '1' ? 'Lax' : secure ? 'None' : 'Lax';

  appendSetCookie(res, [
    serializeCookie(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure,
      sameSite,
      maxAgeSeconds: 0,
      path: '/',
    }),
    serializeCookie(CSRF_COOKIE_NAME, '', {
      httpOnly: false,
      secure,
      sameSite,
      maxAgeSeconds: 0,
      path: '/',
    }),
  ]);
}
