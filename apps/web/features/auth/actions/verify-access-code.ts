'use server';

import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getClientIp } from '../../../lib/client-ip';
import { verifyAccessCodeSchema } from '../schemas/verify-access-code';
import { isAccessCodeRateLimited, recordFailedAccessCodeAttempt } from '../services/access-code-rate-limit';
import { verifyAccessCode } from '../services/access-codes-service';

export interface VerifyAccessCodeResult {
  ok: boolean;
  error?: string;
}

/**
 * The unified sign-in page's intermediate step, called once 6 digits are
 * entered — checks the code without consuming it (see
 * access-codes-service.ts's verifyAccessCode) so the new-password fields
 * only unfold on a genuine match, while leaving the code itself still
 * redeemable by the final submit (redeemAccessCodeAction). Shares its
 * rate-limit bucket with that final step since both are "guess the code"
 * attempts against the same 5-try budget.
 */
export async function verifyAccessCodeAction(
  _prevState: VerifyAccessCodeResult | null,
  formData: FormData
): Promise<VerifyAccessCodeResult> {
  await assertSameOrigin();

  const parsed = verifyAccessCodeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter the 6-digit code from your email.' };
  }

  const { email, code } = parsed.data;
  const ip = await getClientIp();
  const attemptKey = `${ip}:${email.toLowerCase()}`;

  if (await isAccessCodeRateLimited(attemptKey)) {
    return { ok: false, error: 'Too many attempts. Try again later.' };
  }

  const result = await verifyAccessCode(email, code);
  if (!result.ok) {
    await recordFailedAccessCodeAttempt(attemptKey);
    return { ok: false, error: result.error ?? 'That code is invalid or has expired.' };
  }

  return { ok: true };
}
