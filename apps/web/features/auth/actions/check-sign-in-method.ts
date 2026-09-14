'use server';

import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { requestPasswordResetSchema } from '../schemas/request-password-reset';
import { hasLiveAccessCode } from '../services/access-codes-service';

export interface CheckSignInMethodResult {
  method: 'password' | 'code';
}

/**
 * The unified sign-in page's email step calls this the moment "Next" is
 * clicked, deciding whether to show the ordinary password field or jump
 * straight to code entry. Deliberately reveals more than a strict
 * no-enumeration posture would (a stranger typing a real email in
 * mid-activation learns that much) — chosen because the alternative left
 * someone who just received an activation-code email with no password to
 * type and no obvious reason to click "Forgot password?" for an account
 * they never set a password on. Every other password/code action in this
 * file still keeps its own generic-error, no-enumeration behavior; this is
 * the one deliberate, scoped exception.
 */
export async function checkSignInMethodAction(email: string): Promise<CheckSignInMethodResult> {
  await assertSameOrigin();

  const parsed = requestPasswordResetSchema.safeParse({ email });
  if (!parsed.success) {
    return { method: 'password' };
  }

  const hasCode = await hasLiveAccessCode(parsed.data.email);
  return { method: hasCode ? 'code' : 'password' };
}
