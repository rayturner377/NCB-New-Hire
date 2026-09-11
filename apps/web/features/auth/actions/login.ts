'use server';

import { redirect } from 'next/navigation';
import { auditRepository, usersRepository } from '@ncb/database';
import { hashForAudit } from '@ncb/shared';
import { auth } from '@ncb/auth';
import { getClientIp } from '../../../lib/client-ip';
import { loginSchema } from '../schemas/login';
import { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } from '../services/login-rate-limit';

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

  let userId: string;
  try {
    const result = await auth.api.signInEmail({ body: { email, password } });
    userId = result.user.id;
  } catch {
    await recordFailedLoginAttempt(attemptKey);
    await auditRepository.append({
      eventType: 'login_failed',
      sourceIp: ip,
      details: { emailHash: hashForAudit(email) }
    });
    return { ok: false, error: 'Invalid email or password.' };
  }

  clearLoginAttempts(attemptKey);

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
