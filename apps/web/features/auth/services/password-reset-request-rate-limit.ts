import { isRateLimited, recordFailedAttempt } from '@ncb/redis';

const KEY_PREFIX = 'password-reset-request-rate-limit:';
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * IP+email keyed, same shape as access-code-rate-limit.ts's wrong-guess
 * limiter, but for a different action: how many times a code can be
 * *requested* rather than guessed. Bounds "Forgot password?" from being used
 * to spam a real inbox with codes, or to probe many emails cheaply — no
 * session exists yet to key off of, same as login-rate-limit.ts.
 */
export async function isPasswordResetRequestRateLimited(key: string): Promise<boolean> {
  return isRateLimited(`${KEY_PREFIX}${key}`, MAX_ATTEMPTS);
}

export async function recordPasswordResetRequestAttempt(key: string): Promise<void> {
  await recordFailedAttempt(`${KEY_PREFIX}${key}`, WINDOW_MS);
}
