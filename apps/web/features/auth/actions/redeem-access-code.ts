'use server';

import { auditRepository } from '@ncb/database';
import { revokeAllSessionsForUser } from '@ncb/auth/utils';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getClientIp } from '../../../lib/client-ip';
import { validatePasswordAgainstPolicy } from '../../settings/password-policy';
import { getSettings } from '../../settings/services/settings-service';
import { redeemAccessCodeSchema } from '../schemas/redeem-access-code';
import { clearAccessCodeAttempts, isAccessCodeRateLimited, recordFailedAccessCodeAttempt } from '../services/access-code-rate-limit';
import { redeemAccessCode } from '../services/access-codes-service';

export interface RedeemAccessCodeResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * The public /forgot-password page's action — no session required, since the
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
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]!])
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details.', fieldErrors };
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

  await clearAccessCodeAttempts(attemptKey);

  // The code claim + password change + mustChangePassword clear already committed atomically
  // inside redeemAccessCode itself (see access-codes-service.ts / claimCodeAndSetPassword) — this
  // is the one remaining step, a different store (Redis, not Postgres) that can't be part of that
  // same transaction, and only makes sense to run once the password change has actually committed.
  await revokeAllSessionsForUser(result.userId);

  await auditRepository.append({
    eventType: result.purpose === 'account_activation' ? 'account_activated' : 'password_reset_completed',
    actorUserId: result.userId,
    entityType: 'user',
    entityId: result.userId,
    sourceIp: ip
  });

  return { ok: true };
}
