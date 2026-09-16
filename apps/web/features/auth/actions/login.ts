'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auditRepository, usersRepository } from '@ncb/database';
import { hashForAudit } from '@ncb/shared';
import { auth } from '@ncb/auth';
import { freshRequestHeaders } from '../../../lib/fresh-request-headers';
import { getClientIp } from '../../../lib/client-ip';
import { loginSchema } from '../schemas/login';
import { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } from '../services/login-rate-limit';
import { isDeviceResendRateLimited, recordDeviceResendAttempt } from '../services/device-verification-rate-limit';

export interface LoginResult {
  ok: false;
  error: string;
}

/**
 * Same rate-limiting, audit-logging, and generic-error behavior as before
 * Better Auth: error messages intentionally stay generic ("Invalid email or
 * password") to avoid confirming which part was wrong — Better Auth's own
 * signInEmail already throws the identical error for a nonexistent email, a
 * user with no credential account, and a wrong password (confirmed from its
 * source before relying on it), so no extra collapsing logic is needed here
 * to preserve that. On success this redirects to `/` and never returns to
 * the caller (matches next/navigation's redirect() contract); only failures
 * produce a LoginResult for the form to render.
 *
 * Every account has `twoFactorEnabled` (the `two-factor` plugin's OTP
 * method — see packages/auth/src/index.ts), so a device Better Auth's own
 * trust-device cookie doesn't already recognize gets challenged here:
 * signInEmail's own `after` hook deletes the session it just created and
 * returns `{ twoFactorRedirect: true, ... }` instead of a real session, so
 * `result.user` only exists on the genuinely-signed-in branch below.
 */
export async function login(_prevState: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  });

  if (!parsed.success) {
    return { ok: false, error: 'Enter your email and password.' };
  }

  const { email, password } = parsed.data;
  const ip = await getClientIp();
  const attemptKey = `${ip}:${email || 'unknown'}`;

  if (await isLoginRateLimited(attemptKey)) {
    return { ok: false, error: 'Too many login attempts. Try again later.' };
  }

  let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;
  try {
    // Without the real request's headers, Better Auth's two-factor plugin can't see any cookie the
    // browser actually sent — including the trust-device cookie — so it would challenge every
    // sign-in as if from a brand-new device, even an already-verified one. Confirmed the hard way:
    // real end-to-end testing found this always sent a fresh device-verification challenge on a
    // second sign-in from a browser that had already completed one.
    result = await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    await recordFailedLoginAttempt(attemptKey);
    await auditRepository.append({
      eventType: 'login_failed',
      sourceIp: ip,
      details: { emailHash: hashForAudit(email) }
    });
    return { ok: false, error: 'Invalid email or password.' };
  }

  await clearLoginAttempts(attemptKey);

  if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
    // Credentials were correct (signInEmail wouldn't have reached here otherwise) but this
    // device/browser isn't the one Better Auth's trust-device cookie recognizes — send the emailed
    // code and hold off on granting access until it's confirmed at /verify-device. Shares the same
    // IP-keyed budget as resend-device-code.ts's own "Resend" button (see
    // device-verification-rate-limit.ts) — repeatedly resubmitting a known-correct password here is
    // otherwise an unthrottled way to keep emailing fresh codes to the account holder.
    if (await isDeviceResendRateLimited(ip)) {
      return { ok: false, error: 'Too many attempts. Try again later.' };
    }
    await recordDeviceResendAttempt(ip);
    // signInEmail (above) just set the pending two-factor cookie this call needs to see — see
    // freshRequestHeaders's own doc comment for why plain headers() can't see it.
    await auth.api.sendTwoFactorOTP({ headers: await freshRequestHeaders() });
    const user = await usersRepository.findByEmail(email);
    await auditRepository.append({
      eventType: 'login_requires_device_verification',
      actorUserId: user?.id,
      sourceIp: ip,
      details: { role: user?.role }
    });
    redirect('/verify-device');
  }

  const userId = result.user.id;

  // Recognized device — the trust-device cookie already satisfied the 2FA challenge, so this is a
  // real, complete sign-in. Still enforce single-active-session-per-account here: an already-open
  // session elsewhere is expected/silent in this branch (not "suspicious" the way an unrecognized
  // device is), so no email goes out — see verify-device-code.ts for the branch that does email.
  // signInEmail (above) just set this session's own cookie — see freshRequestHeaders's own doc
  // comment for why plain headers() can't see a cookie set earlier in this same action.
  await auth.api.revokeOtherSessions({ headers: await freshRequestHeaders() });

  // Re-fetched rather than trusting Better Auth's own returned user shape —
  // this app's `role` lives on the same row but isn't something the auth
  // layer is the authoritative source for.
  const user = await usersRepository.findById(userId);
  await auditRepository.append({
    eventType: 'login_success',
    actorUserId: userId,
    sourceIp: ip,
    details: { role: user?.role }
  });

  redirect('/');
}
