import { isRateLimited, recordFailedAttempt, clearAttempts } from '@ncb/redis';

/**
 * IP-keyed (not IP+email like login-rate-limit.ts/access-code-rate-limit.ts)
 * — verify-device-code.ts and resend-device-code.ts have no email/userId to
 * key on at all: identity here comes entirely from the plugin's own signed
 * `two_factor` cookie, not a form field. This exists because Better Auth's
 * own account-level lockout for the two-factor OTP method (accountLockout,
 * see packages/auth/src/index.ts's twoFactor() plugin) only ever activates
 * for an account that has a row in its `twoFactor` table — confirmed by
 * reading node_modules/better-auth's own source — and this app's OTP-only
 * setup never creates one (enabling OTP is just AppUser.twoFactorEnabled).
 * So that lockout is silently dead for every account here; the plugin's own
 * remaining protection is a 5-guess cap per issued code, with nothing
 * throttling how often a fresh code can be requested. These two limiters are
 * this app's own replacement for the account-level protection Better Auth
 * would otherwise provide.
 */
const VERIFY_PREFIX = 'device-verify-rate-limit:';
const VERIFY_MAX_ATTEMPTS = 10;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

const RESEND_PREFIX = 'device-resend-rate-limit:';
const RESEND_MAX_ATTEMPTS = 3;
const RESEND_WINDOW_MS = 10 * 60 * 1000;

export async function isDeviceVerifyRateLimited(ip: string): Promise<boolean> {
  return isRateLimited(`${VERIFY_PREFIX}${ip}`, VERIFY_MAX_ATTEMPTS);
}

export async function recordFailedDeviceVerifyAttempt(ip: string): Promise<void> {
  await recordFailedAttempt(`${VERIFY_PREFIX}${ip}`, VERIFY_WINDOW_MS);
}

export async function clearDeviceVerifyAttempts(ip: string): Promise<void> {
  await clearAttempts(`${VERIFY_PREFIX}${ip}`);
}

export async function isDeviceResendRateLimited(ip: string): Promise<boolean> {
  return isRateLimited(`${RESEND_PREFIX}${ip}`, RESEND_MAX_ATTEMPTS);
}

export async function recordDeviceResendAttempt(ip: string): Promise<void> {
  await recordFailedAttempt(`${RESEND_PREFIX}${ip}`, RESEND_WINDOW_MS);
}
