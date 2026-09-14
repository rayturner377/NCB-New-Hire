import { randomUUID } from 'node:crypto';
import { accessCodesRepository, usersRepository, type AccessCodePurpose } from '@ncb/database';
import { generateAccessCode, hashAccessCode, verifyAccessCodeHash } from '@ncb/shared';

/**
 * account_activation defaults to a generous window since it covers HR
 * onboarding a new hire who may not check email right away (the
 * candidate-creation form lets HR pick a shorter or longer one explicitly —
 * see activation-code-ttl.ts); password_reset is always this short default,
 * whether triggered by the account holder themselves via "Forgot password?"
 * or by HR/admin resetting someone's password, since a self-issued or
 * admin-issued reset code is meant to be used right away, not held onto.
 */
const DEFAULT_TTL_MS: Record<AccessCodePurpose, number> = {
  account_activation: 24 * 60 * 60 * 1000,
  password_reset: 20 * 60 * 1000
};

/** After this many wrong guesses on the same code, it's locked out (invalidated) rather than left guessable indefinitely — the 6-digit space (1,000,000 possibilities) is small enough that hash strength alone isn't sufficient protection; this bounds an online brute-force attempt against a single issued code to 5 tries. */
const MAX_ATTEMPTS = 5;

/**
 * Generates, hashes, and stores a new code for the given user/purpose,
 * returning the raw code to email — never persisted or logged anywhere else.
 * `ttlMs` overrides the purpose's own default — see activation-code-ttl.ts's
 * admin-facing presets for account_activation.
 */
export async function issueAccessCode(userId: string, purpose: AccessCodePurpose, ttlMs = DEFAULT_TTL_MS[purpose]): Promise<string> {
  const code = generateAccessCode();
  await accessCodesRepository.create({
    id: randomUUID(),
    userId,
    codeHash: hashAccessCode(code),
    purpose,
    expiresAt: new Date(Date.now() + ttlMs)
  });
  return code;
}

export interface CheckAccessCodeResult {
  ok: boolean;
  userId?: string;
  purpose?: AccessCodePurpose;
  error?: string;
}

const GENERIC_CODE_ERROR = 'That code is invalid or has expired. Request a new one and try again.';

/**
 * Shared by verifyAccessCode and redeemAccessCode below — looks up the
 * user's latest live code and checks it against the supplied one, tracking
 * wrong attempts either way. `consume` controls only whether a *correct*
 * code gets marked used: verifyAccessCode (the unified sign-in page's
 * "does this code match" step, called before the new-password fields ever
 * appear) leaves it live so the same code can still be redeemed for real
 * afterwards; redeemAccessCode (the actual password-setting step) consumes
 * it. Every failure path returns the same generic error (no email/wrong-code
 * distinction) to avoid confirming which part was wrong, same posture as
 * login.ts.
 */
async function checkAccessCode(email: string, code: string, consume: boolean): Promise<CheckAccessCodeResult> {
  const user = await usersRepository.findByEmail(email.toLowerCase());
  if (!user) {
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  const accessCode = await accessCodesRepository.findLatestActive(user.id);
  if (!accessCode) {
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  if (accessCode.attemptCount >= MAX_ATTEMPTS) {
    await accessCodesRepository.invalidate(accessCode.id);
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  if (!verifyAccessCodeHash(code, accessCode.codeHash)) {
    const updated = await accessCodesRepository.incrementAttempts(accessCode.id);
    if (updated.attemptCount >= MAX_ATTEMPTS) {
      await accessCodesRepository.invalidate(accessCode.id);
    }
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  if (consume) {
    await accessCodesRepository.markUsed(accessCode.id);
  }
  return { ok: true, userId: user.id, purpose: accessCode.purpose as AccessCodePurpose };
}

/**
 * Whether this email currently has a live (unused, unexpired) code waiting
 * to be redeemed — the unified sign-in page's email step calls this to
 * decide whether Next should lead to the password field or straight to code
 * entry, so someone who just received an activation email (and has no
 * password to type yet) isn't stuck guessing they need to click "Forgot
 * password?" for an account they never set a password on in the first
 * place. A nonexistent email quietly resolves to false (same as everywhere
 * else in this file, no distinction drawn between "no such account" and
 * "no live code").
 */
export async function hasLiveAccessCode(email: string): Promise<boolean> {
  const user = await usersRepository.findByEmail(email.toLowerCase());
  if (!user) {
    return false;
  }
  const accessCode = await accessCodesRepository.findLatestActive(user.id);
  return accessCode !== null;
}

/**
 * Checks a code without consuming it — the unified sign-in page's "Forgot
 * password?" step calls this as soon as 6 digits are entered so the
 * new-password fields only unfold once the code genuinely matches, while
 * leaving the code itself redeemable by the redeemAccessCode call that
 * actually sets the password afterwards.
 */
export function verifyAccessCode(email: string, code: string): Promise<CheckAccessCodeResult> {
  return checkAccessCode(email, code, false);
}

export type RedeemAccessCodeResult = CheckAccessCodeResult;

/**
 * Looks up the user by email and verifies the code against their latest live
 * code — deliberately purpose-agnostic (an account-activation and a
 * password-reset code are redeemed through the exact same form) so the
 * caller doesn't need to know in advance which kind was issued; the result's
 * own `purpose` tells it which one matched. Marks the code used on success,
 * unlike verifyAccessCode above.
 */
export function redeemAccessCode(email: string, code: string): Promise<RedeemAccessCodeResult> {
  return checkAccessCode(email, code, true);
}
