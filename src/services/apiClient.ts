import type { ApiResponse } from '../types/api';

const CSRF_COOKIE_NAME = 'absensi_csrf';

let memoryCsrfToken: string | null = null;
const sessionExpiredListeners = new Set<() => void>();

export function setClientCsrfToken(token: string | null): void {
  memoryCsrfToken = token;
}

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  suppressUnauthorizedEvent?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE_NAME) ?? memoryCsrfToken;
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
    );
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      response.status,
      'INVALID_RESPONSE',
      'Respons server tidak dapat dibaca.',
    );
  }

  if (!response.ok || !json.success) {
    const errPayload = !json.success
      ? json.error
      : { code: 'REQUEST_FAILED', message: 'Permintaan gagal diproses.' };

    if (response.status === 401 && !options.suppressUnauthorizedEvent) {
      sessionExpiredListeners.forEach((fn) => fn());
    }

    throw new ApiClientError(
      response.status,
      errPayload.code,
      errPayload.message,
      errPayload.details,
    );
  }

  return json.data;
}
