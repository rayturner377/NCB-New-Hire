import { randomUUID } from 'node:crypto';
import { accessCodesRepository, usersRepository, MAX_ACCESS_CODE_ATTEMPTS, type AccessCodePurpose } from '@ncb/database';
import { hashPassword } from '@ncb/auth/utils';
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

/**
 * Generates, hashes, and stores a new code for the given user/purpose,
 * returning the raw code to email — never persisted or logged anywhere else.
 * `ttlMs` overrides the purpose's own default — see activation-code-ttl.ts's
 * admin-facing presets for account_activation.
 *
 * Invalidates any code this same purpose already has live first — without this, an earlier
 * unexpired code stays fully redeemable alongside the new one, and (since findLatestActive only
 * ever skips a used/expired code, not a merely-superseded one) becomes "the latest active code"
 * again the instant the new one is consumed, silently un-superseding itself.
 */
export async function issueAccessCode(userId: string, purpose: AccessCodePurpose, ttlMs = DEFAULT_TTL_MS[purpose]): Promise<string> {
  await accessCodesRepository.invalidateAllActive(userId, purpose);
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
  /** Internal — lets redeemAccessCode below target the exact row it just checked with an atomic claim, instead of re-querying "latest active" a second time (which would reopen the same race this exists to close). Not meaningful to a caller outside this file. */
  codeId?: string;
  purpose?: AccessCodePurpose;
  error?: string;
}

const GENERIC_CODE_ERROR = 'That code is invalid or has expired. Request a new one and try again.';

/**
 * Shared by verifyAccessCode and redeemAccessCode below — looks up the
 * user's latest live code and checks it against the supplied one, tracking
 * wrong attempts either way. Never marks a *correct* code used itself
 * (verifyAccessCode never should; redeemAccessCode does that atomically,
 * together with the password change it authorizes — see
 * claimCodeAndSetPassword's own doc comment on why a plain "mark used here,
 * change the password over there" sequence isn't safe). Every failure path
 * returns the same generic error (no email/wrong-code distinction) to avoid
 * confirming which part was wrong, same posture as login.ts.
 */
async function checkAccessCode(email: string, code: string): Promise<CheckAccessCodeResult> {
  const user = await usersRepository.findByEmail(email.toLowerCase());
  if (!user || user.active === false || user.deletedAt) {
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  const accessCode = await accessCodesRepository.findLatestActive(user.id);
  if (!accessCode || (accessCode.purpose === 'account_activation' && user.emailVerified)) {
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  if (accessCode.attemptCount >= MAX_ACCESS_CODE_ATTEMPTS) {
    await accessCodesRepository.invalidate(accessCode.id);
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  if (!verifyAccessCodeHash(code, accessCode.codeHash)) {
    const updated = await accessCodesRepository.incrementAttempts(accessCode.id);
    if (updated.attemptCount >= MAX_ACCESS_CODE_ATTEMPTS) {
      await accessCodesRepository.invalidate(accessCode.id);
    }
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  return { ok: true, userId: user.id, codeId: accessCode.id, purpose: accessCode.purpose as AccessCodePurpose };
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
  if (!user || user.active === false || user.deletedAt) {
    return false;
  }
  const accessCode = await accessCodesRepository.findLatestActive(user.id);
  return accessCode !== null && !(accessCode.purpose === 'account_activation' && user.emailVerified);
}

/**
 * Checks a code without consuming it — the unified sign-in page's "Forgot
 * password?" step calls this as soon as 6 digits are entered so the
 * new-password fields only unfold once the code genuinely matches, while
 * leaving the code itself redeemable by the redeemAccessCode call that
 * actually sets the password afterwards.
 */
export function verifyAccessCode(email: string, code: string): Promise<CheckAccessCodeResult> {
  return checkAccessCode(email, code);
}

export interface RedeemAccessCodeResult {
  ok: boolean;
  userId?: string;
  purpose?: AccessCodePurpose;
  error?: string;
}

/**
 * The real, final redemption — verifies the code, then atomically claims it and applies the
 * password change it authorizes in a single database transaction (see
 * accessCodesRepository.claimCodeAndSetPassword's own doc comment). Two failure modes this closes
 * that a separate "check, then mark used, then set the password" sequence couldn't:
 *
 * - Two concurrent submissions of the same correct code can no longer both succeed — only the first
 *   to win the atomic claim actually changes the password; the loser gets the same generic error as
 *   an outright wrong code, not a misleading "success" that silently didn't take effect.
 * - A crash between "code marked used" and "password actually changed" can no longer leave the
 *   account in a half-changed state — both commit together or neither does.
 *
 * Session revocation is still the caller's own job afterward (features/auth/actions/
 * redeem-access-code.ts) — Redis, not Postgres, so it can't be part of the same transaction, and
 * only makes sense to run once the password change has actually committed.
 */
export async function redeemAccessCode(email: string, code: string, newPassword: string): Promise<RedeemAccessCodeResult> {
  const checked = await checkAccessCode(email, code);
  if (!checked.ok || !checked.userId || !checked.codeId || !checked.purpose) {
    return { ok: false, error: checked.error };
  }

  const passwordHash = await hashPassword(newPassword);
  const claimed = await accessCodesRepository.claimCodeAndSetPassword({
    codeId: checked.codeId,
    userId: checked.userId,
    purpose: checked.purpose,
    passwordHash
  });
  if (!claimed) {
    return { ok: false, error: GENERIC_CODE_ERROR };
  }

  return { ok: true, userId: checked.userId, purpose: checked.purpose };
}
