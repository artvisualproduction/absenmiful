import { UserRole } from '../../src/types';
import type { ApiRequestLike } from './auth/middleware';

/** Admin, Super Admin, Operator, dan Kepala Sekolah (baca) sesuai Blueprint Bagian 5 */
export const MASTER_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
  UserRole.PRINCIPAL,
];

/** Hanya peran Admin/Operator yang dapat menulis/mengubah master data */
export const MASTER_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATOR,
];

export function getQueryString(req: ApiRequestLike, key: string): string {
  const val = req.query?.[key];
  if (Array.isArray(val)) return String(val[0] ?? '').trim();
  if (typeof val === 'string') return val.trim();
  return '';
}

export function getQueryInt(
  req: ApiRequestLike,
  key: string,
  defaultValue: number,
  min = 1,
  max = 100,
): number {
  const raw = getQueryString(req, key);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

export function paginateArrayByCursor<T extends { id: string }>(
  items: T[],
  cursor: string,
  limit: number,
): { items: T[]; total: number; nextCursor: string | null } {
  const total = items.length;
  let startIndex = 0;

  if (cursor) {
    const foundIdx = items.findIndex((item) => item.id === cursor);
    if (foundIdx >= 0) {
      startIndex = foundIdx + 1;
    }
  }

  const pageItems = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + pageItems.length < total;
  const nextCursor =
    hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1]!.id : null;

  return {
    items: pageItems,
    total,
    nextCursor,
  };
}
