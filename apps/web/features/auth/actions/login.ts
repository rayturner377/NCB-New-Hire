'use server';

import { redirect } from 'next/navigation';
import { auditRepository, usersRepository } from '@ncb/database';
import { hashForAudit, verifyPassword } from '@ncb/shared';
import { getClientIp } from '../../../lib/client-ip';
import { createSession } from '../../../lib/session';
import { loginSchema } from '../schemas/login';
import { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } from '../services/login-rate-limit';

export interface LoginResult {
  ok: false;
  error: string;
}

/**
 * Ported from server.js handleLogin (~L1309-1346). Same rate-limiting,
 * audit-logging (now via auditRepository instead of the flat file audit
 * log), and session-issuing behavior; error messages intentionally stay
 * generic ("Invalid email or password") to avoid confirming which part
 * was wrong, matching the original. On success this redirects to `/` and
 * never returns to the caller (matches next/navigation's redirect()
 * contract); only failures produce a LoginResult for the form to render.
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

  if (isLoginRateLimited(attemptKey)) {
    return { ok: false, error: 'Too many login attempts. Try again later.' };
  }

  const user = await usersRepository.findByEmail(email);
  const passwordRecord = user?.passwordRecord as Parameters<typeof verifyPassword>[1];

  if (!user || user.active === false || !verifyPassword(password, passwordRecord)) {
    recordFailedLoginAttempt(attemptKey);
    await auditRepository.append({
      eventType: 'login_failed',
      sourceIp: ip,
      details: { emailHash: hashForAudit(email) }
    });
    return { ok: false, error: 'Invalid email or password.' };
  }

  clearLoginAttempts(attemptKey);
  await createSession(user.id);
  await auditRepository.append({
    eventType: 'login_success',
    actorUserId: user.id,
    sourceIp: ip,
    details: { role: user.role }
  });

  redirect('/');
}
