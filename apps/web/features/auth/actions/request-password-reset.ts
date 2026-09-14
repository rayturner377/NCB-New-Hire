'use server';

import { auditRepository, usersRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getClientIp } from '../../../lib/client-ip';
import { sendNotification } from '../../notifications/services/notification-service';
import { requestPasswordResetSchema } from '../schemas/request-password-reset';
import { issueAccessCode } from '../services/access-codes-service';
import { isPasswordResetRequestRateLimited, recordPasswordResetRequestAttempt } from '../services/password-reset-request-rate-limit';

export interface RequestPasswordResetResult {
  ok: boolean;
  error?: string;
}

/**
 * The unified sign-in page's "Forgot password?" trigger — self-service, no
 * session required. Always returns ok on any well-formed email, whether or
 * not an account exists for it — the sign-in page moves on to the
 * code-entry step either way, so a stranger probing random addresses learns
 * nothing an existing account wouldn't already reveal by simply trying to
 * sign in.
 */
export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetResult | null,
  formData: FormData
): Promise<RequestPasswordResetResult> {
  await assertSameOrigin();

  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' };
  }

  const { email } = parsed.data;
  const ip = await getClientIp();
  const attemptKey = `${ip}:${email.toLowerCase()}`;

  if (await isPasswordResetRequestRateLimited(attemptKey)) {
    return { ok: false, error: 'Too many requests. Try again later.' };
  }
  await recordPasswordResetRequestAttempt(attemptKey);

  const user = await usersRepository.findByEmail(email.toLowerCase());
  if (user) {
    const resetCode = await issueAccessCode(user.id, 'password_reset');

    await auditRepository.append({
      eventType: 'password_reset_requested',
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      sourceIp: ip
    });

    await sendNotification({
      templateKey: 'password_reset',
      to: user.email,
      variables: { recipientName: user.displayName, resetCode, resetUrl: '/login' },
      entityType: 'user',
      entityId: user.id
    });
  }

  return { ok: true };
}
