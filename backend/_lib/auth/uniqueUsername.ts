import { CollectionName } from '../../../src/types';
import { ApiError } from '../apiError';
import type { IDataRepository } from '../repository/types';

/**
 * Normalizes usernames to lowercase alphanumeric + dots/underscores.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

/**
 * Derives a clean base username candidate from a person's full name.
 */
export function buildUsernameBaseFromName(fullName: string): string {
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('.');
  return slug || 'guru';
}

/**
 * Derives username strictly from the teacher's first name (nama awal guru),
 * appending subsequent words only when the first token is shorter than 3 chars.
 */
export function buildFirstNameUsernameBase(fullName: string): string {
  const words = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  if (words.length === 0) return 'guru';

  let candidate = words[0]!;
  let idx = 1;
  while (candidate.length < 3 && idx < words.length) {
    candidate += words[idx]!;
    idx++;
  }
  if (candidate.length < 3) {
    candidate = `${candidate}guru`.slice(0, 8);
  }
  return candidate.slice(0, 32);
}

/**
 * Reserves a unique normalized username in the `uniqueUsernames` collection.
 * Uses document ID = normalizedUsername to guarantee uniqueness across concurrent calls.
 */
export async function reserveUniqueUsername(
  repo: IDataRepository,
  username: string,
  userId: string,
): Promise<string> {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    throw ApiError.badRequest('Username minimal 3 karakter (huruf, angka, titik, atau garis bawah).');
  }
  if (/^__.*__$/.test(normalized)) {
    throw ApiError.badRequest('Username tidak boleh diawali dan diakhiri garis bawah ganda (__).');
  }

  const col = repo.collection(CollectionName.UNIQUE_USERNAMES);
  const existing = await col.getById(normalized);
  if (existing) {
    throw ApiError.conflict(`Username "${normalized}" sudah digunakan.`);
  }

  await col.create({
    id: normalized,
    normalizedUsername: normalized,
    userId,
  });

  return normalized;
}

export async function releaseUniqueUsername(
  repo: IDataRepository,
  normalizedUsername: string,
): Promise<void> {
  await repo.collection(CollectionName.UNIQUE_USERNAMES).delete(normalizedUsername);
}

/**
 * Finds the first available unique username candidate (base, base2, base3, ...).
 */
export async function findAvailableUsername(
  repo: IDataRepository,
  base: string,
): Promise<string> {
  const normalizedBase = normalizeUsername(base) || 'user';
  const col = repo.collection(CollectionName.UNIQUE_USERNAMES);

  if (!/^__.*__$/.test(normalizedBase) && !(await col.getById(normalizedBase))) {
    return normalizedBase;
  }

  for (let suffix = 2; suffix <= 999; suffix++) {
    const candidate = `${normalizedBase}${suffix}`;
    if (!/^__.*__$/.test(candidate) && !(await col.getById(candidate))) {
      return candidate;
    }
  }

  throw ApiError.conflict('Tidak dapat menemukan username unik yang tersedia.');
}
