import { randomUUID } from 'node:crypto';
import { accessCodesRepository, usersRepository, type AccessCodePurpose } from '@ncb/database';
import { generateAccessCode, hashAccessCode, verifyAccessCodeHash } from '@ncb/shared';

const CODE_TTL_MS = 15 * 60 * 1000;
/** After this many wrong guesses on the same code, it's locked out (invalidated) rather than left guessable indefinitely — the 6-digit space (1,000,000 possibilities) is small enough that hash strength alone isn't sufficient protection; this bounds an online brute-force attempt against a single issued code to 5 tries. */
const MAX_ATTEMPTS = 5;

/** Generates, hashes, and stores a new code for the given user/purpose, returning the raw code to email — never persisted or logged anywhere else. */
export async function issueAccessCode(userId: string, purpose: AccessCodePurpose): Promise<string> {
  const code = generateAccessCode();
  await accessCodesRepository.create({
    id: randomUUID(),
    userId,
    codeHash: hashAccessCode(code),
    purpose,
    expiresAt: new Date(Date.now() + CODE_TTL_MS)
  });
  return code;
}

export interface RedeemAccessCodeResult {
  ok: boolean;
  userId?: string;
  purpose?: AccessCodePurpose;
  error?: string;
}

/**
 * Looks up the user by email and verifies the code against their latest live
 * code — deliberately purpose-agnostic (an account-activation and a
 * password-reset code are redeemed through the exact same form) so the
 * caller doesn't need to know in advance which kind was issued; the result's
 * own `purpose` tells it which one matched. Every failure path returns the
 * same generic error (no email/wrong-code distinction) to avoid confirming
 * which part was wrong, same posture as login.ts.
 */
export async function redeemAccessCode(email: string, code: string): Promise<RedeemAccessCodeResult> {
  const genericError = 'That code is invalid or has expired. Request a new one and try again.';

  const user = await usersRepository.findByEmail(email.toLowerCase());
  if (!user) {
    return { ok: false, error: genericError };
  }

  const accessCode = await accessCodesRepository.findLatestActive(user.id);
  if (!accessCode) {
    return { ok: false, error: genericError };
  }

  if (accessCode.attemptCount >= MAX_ATTEMPTS) {
    await accessCodesRepository.invalidate(accessCode.id);
    return { ok: false, error: genericError };
  }

  if (!verifyAccessCodeHash(code, accessCode.codeHash)) {
    const updated = await accessCodesRepository.incrementAttempts(accessCode.id);
    if (updated.attemptCount >= MAX_ATTEMPTS) {
      await accessCodesRepository.invalidate(accessCode.id);
    }
    return { ok: false, error: genericError };
  }

  await accessCodesRepository.markUsed(accessCode.id);
  return { ok: true, userId: user.id, purpose: accessCode.purpose as AccessCodePurpose };
}
