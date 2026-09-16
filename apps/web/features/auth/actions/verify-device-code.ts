'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auditRepository } from '@ncb/database';
import { auth } from '@ncb/auth';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { freshRequestHeaders } from '../../../lib/fresh-request-headers';
import { getClientIp } from '../../../lib/client-ip';
import { sendNotification } from '../../notifications/services/notification-service';
import { verifyDeviceCodeSchema } from '../schemas/verify-device-code';
import { clearDeviceVerifyAttempts, isDeviceVerifyRateLimited, recordFailedDeviceVerifyAttempt } from '../services/device-verification-rate-limit';

export interface VerifyDeviceCodeResult {
  ok: false;
  error: string;
}

/**
 * The other half of login.ts's `twoFactorRedirect` branch — no session
 * exists yet (the plugin's own `after` hook deleted the one signInEmail
 * created), so this is reachable with no app session at all, same as
 * redeem-access-code.ts. `trustDevice: true` is always sent: recognizing
 * this device for the next 30 days (via Better Auth's own trust-device
 * cookie — see packages/auth/src/index.ts) is the entire point, and this
 * action is the only path that ever completes a challenge, so there's no
 * case where the caller wouldn't want it remembered. On success this
 * enforces single-active-session-per-account (revokeOtherSessions) and,
 * unlike login.ts's own silent trusted-device branch, emails a notice —
 * this is exactly the "new device" event the user should hear about.
 *
 * IP-rate-limited on top of the plugin's own 5-guesses-per-issued-code cap —
 * see device-verification-rate-limit.ts's own doc comment for why: Better
 * Auth's account-level lockout for this method never actually activates for
 * this app's OTP-only setup, so without this an attacker could keep
 * requesting fresh codes and burning 5 guesses against each one indefinitely.
 */
export async function verifyDeviceCodeAction(
  _prevState: VerifyDeviceCodeResult | null,
  formData: FormData
): Promise<VerifyDeviceCodeResult> {
  await assertSameOrigin();

  const parsed = verifyDeviceCodeSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter the 6-digit code from your email.' };
  }

  const ip = await getClientIp();

  if (await isDeviceVerifyRateLimited(ip)) {
    return { ok: false, error: 'Too many attempts. Try again later.' };
  }

  try {
    const result = await auth.api.verifyTwoFactorOTP({ body: { code: parsed.data.code, trustDevice: true }, headers: await headers() });

    // verifyTwoFactorOTP just set the real session cookie above — unlike change-password.ts's/
    // sign-out-other-sessions.ts's own revokeOtherSessions calls (where the caller's session cookie
    // already existed from before the action ran), plain headers() can't see a cookie set this
    // recently in the same action. See freshRequestHeaders's own doc comment for why (confirmed the
    // hard way — real end-to-end testing, not assumed).
    await auth.api.revokeOtherSessions({ headers: await freshRequestHeaders() });

    await clearDeviceVerifyAttempts(ip);

    await auditRepository.append({
      eventType: 'device_verified',
      actorUserId: result.user.id,
      sourceIp: ip
    });

    void sendNotification({
      templateKey: 'new_device_signed_in',
      to: result.user.email,
      variables: { recipientName: result.user.name || result.user.email },
      entityType: 'user',
      entityId: result.user.id
    });
  } catch {
    await recordFailedDeviceVerifyAttempt(ip);
    await auditRepository.append({
      eventType: 'device_verification_failed',
      sourceIp: ip
    });
    return { ok: false, error: 'That code is invalid or has expired.' };
  }

  redirect('/');
}
