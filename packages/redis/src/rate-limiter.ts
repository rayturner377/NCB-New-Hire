import { redis } from './client.js';

/**
 * Generic fixed-window rate limiter, Redis-backed (INCR + EXPIRE-on-first-hit)
 * — replaces the old in-memory Map-based version (packages/shared's
 * rate-limiter.ts), which reset on every restart and couldn't work across
 * more than one apps/web process. Semantics are unchanged: the window starts
 * on the first recorded attempt and resets entirely once it elapses, rather
 * than sliding forward on every attempt — Redis's EXPIRE only gets (re-)set
 * when INCR reports the key was just created (count === 1), matching the old
 * Map version's "only set resetAt if the current one is missing/expired."
 *
 * Callers own their own key namespacing (see apps/web's login-rate-limit.ts
 * and action-rate-limit.ts) — this module has no opinion about what a "key"
 * represents, only how to count attempts against one.
 */
export async function isRateLimited(key: string, maxAttempts: number): Promise<boolean> {
  const raw = await redis.get(key);
  if (!raw) return false;
  return Number.parseInt(raw, 10) >= maxAttempts;
}

export async function recordFailedAttempt(key: string, windowMs: number): Promise<void> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
}

export async function clearAttempts(key: string): Promise<void> {
  await redis.del(key);
}
