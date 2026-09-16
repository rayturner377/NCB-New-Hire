'use server';

import { headers } from 'next/headers';
import { auth } from '@ncb/auth';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getClientIp } from '../../../lib/client-ip';
import { isDeviceResendRateLimited, recordDeviceResendAttempt } from '../services/device-verification-rate-limit';

export interface ResendDeviceCodeResult {
  ok: boolean;
  error?: string;
}

/**
 * "Didn't get it? Resend" on /verify-device — reads the same pending
 * two-factor cookie sendTwoFactorOTP already relies on in login.ts, so it
 * needs no input beyond the request's own cookies. Rate-limited (see
 * device-verification-rate-limit.ts) since Better Auth's own send-otp
 * endpoint has no throttle of its own — nothing else stops this from being
 * spammed to email-bomb the account holder or grind through fresh 5-guess
 * budgets indefinitely.
 */
export async function resendDeviceCodeAction(): Promise<ResendDeviceCodeResult> {
  await assertSameOrigin();

  const ip = await getClientIp();
  if (await isDeviceResendRateLimited(ip)) {
    return { ok: false, error: 'Too many attempts. Try again later.' };
  }
  await recordDeviceResendAttempt(ip);

  try {
    await auth.api.sendTwoFactorOTP({ headers: await headers() });
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't resend the code — try signing in again." };
  }
}
