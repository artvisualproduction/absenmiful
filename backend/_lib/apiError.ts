import { ZodError } from 'zod';
import { formatZodErrors } from '../../src/lib/validation';
import type { ApiErrorResponse, ApiSuccessResponse, PaginationMeta } from '../../src/types/api';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Sesi tidak valid atau telah berakhir.'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Anda tidak memiliki hak akses untuk tindakan ini.'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Data tidak ditemukan.'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static tooManyRequests(message = 'Terlalu banyak percobaan. Silakan coba lagi nanti.'): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  static internal(message = 'Terjadi kesalahan pada server.'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

export function buildSuccessPayload<T>(data: T, meta?: PaginationMeta): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    serverTime: new Date().toISOString(),
  };
}

export function buildErrorPayload(error: unknown): {
  statusCode: number;
  body: ApiErrorResponse;
} {
  const serverTime = new Date().toISOString();

  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        serverTime,
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data yang dikirim tidak valid.',
          details: formatZodErrors(error),
        },
        serverTime,
      },
    };
  }

  console.error('[API_UNHANDLED_ERROR]', error);
  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal pada server.',
      },
      serverTime,
    },
  };
}

export interface MinimalApiResponse {
  status(code: number): MinimalApiResponse;
  json(payload: unknown): void;
  setHeader?(name: string, value: string | string[]): void;
}

export function sendOk<T>(
  res: MinimalApiResponse,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta,
): void {
  res.status(statusCode).json(buildSuccessPayload(data, meta));
}

export function sendError(res: MinimalApiResponse, error: unknown): void {
  const { statusCode, body } = buildErrorPayload(error);
  res.status(statusCode).json(body);
}
