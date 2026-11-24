import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

// Precomputed dummy bcrypt hash used for constant-time verification when username does not exist
const DUMMY_PASSWORD_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  const hashToCompare = passwordHash && passwordHash.length > 0 ? passwordHash : DUMMY_PASSWORD_HASH;
  const matched = await bcrypt.compare(plainPassword, hashToCompare);
  return Boolean(passwordHash && matched);
}

/** Generates a cryptographically strong high-entropy random token (hex/base64url) */
export function generateRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

/** Computes a SHA-256 hex digest of a raw token (for userSessions & qrTokens storage) */
export function hashToken(rawToken: string): string {
  const secretPepper = process.env.SESSION_SECRET ?? '';
  return crypto.createHash('sha256').update(`${secretPepper}:${rawToken}`).digest('hex');
}

/** Hashes client IP for privacy-preserving audit logs */
export function hashIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip.trim()).digest('hex').slice(0, 32);
}

function derivePasswordVaultKey(): Buffer {
  const seed =
    process.env.SESSION_SECRET ||
    'absensi-digital-local-vault-key-v1';
  return crypto.createHash('sha256').update(`pw-vault:${seed}`).digest();
}

/**
 * Encrypts a password with AES-256-GCM so authorized admins can view current
 * credentials in User Management while keeping Firestore storage encrypted.
 */
export function encryptPasswordForAdminView(plainPassword: string): string {
  const key = derivePasswordVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainPassword, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptPasswordForAdminView(
  payload: string | null | undefined,
): string | null {
  if (!payload || !payload.startsWith('v1:')) return null;
  try {
    const parts = payload.split(':');
    if (parts.length !== 4) return null;
    const iv = Buffer.from(parts[1]!, 'base64url');
    const tag = Buffer.from(parts[2]!, 'base64url');
    const encrypted = Buffer.from(parts[3]!, 'base64url');
    const key = derivePasswordVaultKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS;

function pickRandomChar(charset: string): string {
  const idx = crypto.randomInt(0, charset.length);
  return charset[idx]!;
}

/**
 * Generates a cryptographically random temporary password (never derived from NIP/NIS).
 * Guaranteed to include uppercase, lowercase, digit, and symbol.
 */
export function generateTemporaryPassword(length = 12): string {
  const required = [
    pickRandomChar(UPPER),
    pickRandomChar(LOWER),
    pickRandomChar(DIGITS),
    pickRandomChar(SYMBOLS),
  ];

  const remainingCount = Math.max(8, length) - required.length;
  const chars = [...required];
  for (let i = 0; i < remainingCount; i++) {
    chars.push(pickRandomChar(ALL_CHARS));
  }

  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join('');
}
