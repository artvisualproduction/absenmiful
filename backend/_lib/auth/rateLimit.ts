/**
 * Login rate limiter & account lockout policy.
 * - Account-level: MAX_FAILED_ATTEMPTS consecutive failures -> ACCOUNT_LOCK_MINUTES cooldown
 * - IP-level: sliding window protection against credential stuffing / unknown usernames
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const ACCOUNT_LOCK_MINUTES = 15;
export const IP_WINDOW_MS = 15 * 60 * 1000;
export const IP_MAX_ATTEMPTS = 20;

interface IpWindowEntry {
  timestamps: number[];
}

const ipAttempts = new Map<string, IpWindowEntry>();

export function checkIpRateLimit(
  ipKey: string,
  nowMs = Date.now(),
  maxAttempts = IP_MAX_ATTEMPTS,
  windowMs = IP_WINDOW_MS,
): { allowed: boolean; retryAfterSeconds: number } {
  const entry = ipAttempts.get(ipKey);
  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const cutoff = nowMs - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxAttempts) {
    const oldest = entry.timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordIpFailedAttempt(ipKey: string, nowMs = Date.now()): void {
  const entry = ipAttempts.get(ipKey) ?? { timestamps: [] };
  entry.timestamps.push(nowMs);
  ipAttempts.set(ipKey, entry);
}

export function clearIpAttempts(ipKey: string): void {
  ipAttempts.delete(ipKey);
}

export function resetAllIpRateLimits(): void {
  ipAttempts.clear();
}

export function isAccountLocked(lockedUntil: string | null | undefined, nowMs = Date.now()): boolean {
  if (!lockedUntil) return false;
  const lockMs = new Date(lockedUntil).getTime();
  return Number.isFinite(lockMs) && lockMs > nowMs;
}

export function computeNextFailedState(
  currentFailedCount: number,
  nowMs = Date.now(),
): { failedLoginCount: number; lockedUntil: string | null; lockedNow: boolean } {
  const nextCount = currentFailedCount + 1;
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    return {
      failedLoginCount: nextCount,
      lockedUntil: new Date(nowMs + ACCOUNT_LOCK_MINUTES * 60 * 1000).toISOString(),
      lockedNow: true,
    };
  }
  return {
    failedLoginCount: nextCount,
    lockedUntil: null,
    lockedNow: false,
  };
}
