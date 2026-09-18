'use server';

import { auditRepository } from '@ncb/database';
import { auth } from '@ncb/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revokeAllSessionsForUser } from '@ncb/auth/utils';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getClientIp } from '../../../lib/client-ip';
import { fieldErrorsFrom } from '../../../lib/field-errors';
import { validatePasswordAgainstPolicy } from '../../settings/password-policy';
import { getSettings } from '../../settings/services/settings-service';
import { redeemAccessCodeSchema } from '../schemas/redeem-access-code';
import { clearAccessCodeAttempts, isAccessCodeRateLimited, recordFailedAccessCodeAttempt } from '../services/access-code-rate-limit';
import { redeemAccessCode } from '../services/access-codes-service';
import { sendNotification } from '../../notifications/services/notification-service';

export interface RedeemAccessCodeResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  passwordSaved?: boolean;
}

/**
 * The public login page's code-redemption action — no session required, since the
 * whole point is proving identity via an emailed code rather than an
 * existing one. Covers both account activation and password reset (see
 * redeemAccessCode's own doc comment) with the same form: email + code + a
 * freely chosen new password.
 */
export async function redeemAccessCodeAction(
  _prevState: RedeemAccessCodeResult | null,
  formData: FormData
): Promise<RedeemAccessCodeResult> {
  await assertSameOrigin();

  const parsed = redeemAccessCodeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details.', fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { email, code, password } = parsed.data;
  const ip = await getClientIp();
  const attemptKey = `${ip}:${email.toLowerCase()}`;

  if (await isAccessCodeRateLimited(attemptKey)) {
    return { ok: false, error: 'Too many attempts. Try again later.' };
  }

  const { userPolicy } = await getSettings();
  const policyError = validatePasswordAgainstPolicy(password, userPolicy);
  if (policyError) {
    return { ok: false, error: policyError, fieldErrors: { password: policyError } };
  }

  const result = await redeemAccessCode(email, code, password);
  if (!result.ok || !result.userId) {
    await recordFailedAccessCodeAttempt(attemptKey);
    return { ok: false, error: result.error ?? 'That code is invalid or has expired.' };
  }

  try {
    await clearAccessCodeAttempts(attemptKey);

    // Password/code changes have committed in PostgreSQL. Revoke Redis sessions
    // before creating the activation session; the two stores cannot share a transaction.
    await revokeAllSessionsForUser(result.userId);

    await auditRepository.append({
      eventType: result.purpose === 'account_activation' ? 'account_activated' : 'password_reset_completed',
      actorUserId: result.userId,
      entityType: 'user',
      entityId: result.userId,
      sourceIp: ip
    });

    if (result.purpose === 'account_activation') {
      const { user } = await auth.api.completeAccountActivation({
        body: { userId: result.userId }, headers: await headers()
      });
      // A notification failure must not undo a completed activation or ask the
      // user to retry a code that has already been consumed.
      void sendNotification({
        templateKey: 'account_activated', to: user.email,
        variables: { recipientName: user.name || user.email },
        entityType: 'user', entityId: user.id
      }).catch(() => { console.error('Account activation confirmation could not be queued.'); });
    }
  } catch {
    return {
      ok: false, passwordSaved: true,
      error: 'Your password was saved, but sign-in could not be completed. Sign in with your email and new password.'
    };
  }

  // Next redirects throw; keep this outside the failure handler above.
  if (result.purpose === 'account_activation') redirect('/');

  return { ok: true };
}
