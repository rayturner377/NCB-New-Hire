import { isRateLimited, recordFailedAttempt, clearAttempts } from '@ncb/redis';

const KEY_PREFIX = 'access-code-rate-limit:';
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * IP+email keyed, same shape as login-rate-limit.ts, for the public
 * /forgot-password redemption action — no session exists yet to key off of.
 * Fixed thresholds rather than the admin-configurable login policy: this is
 * a materially different attack surface (brute-forcing someone else's
 * emailed code, not guessing a password), so it doesn't need its own
 * Settings knob.
 */
export async function isAccessCodeRateLimited(key: string): Promise<boolean> {
  return isRateLimited(`${KEY_PREFIX}${key}`, MAX_ATTEMPTS);
}

export async function recordFailedAccessCodeAttempt(key: string): Promise<void> {
  await recordFailedAttempt(`${KEY_PREFIX}${key}`, WINDOW_MS);
}

export async function clearAccessCodeAttempts(key: string): Promise<void> {
  await clearAttempts(`${KEY_PREFIX}${key}`);
}
