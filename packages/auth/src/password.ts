import { hashPassword as scryptHash, verifyPassword as scryptVerify } from 'better-auth/crypto';
import { verifyPassword as verifyLegacyPassword, type PasswordRecord } from '@ncb/shared';

/**
 * Migration bridge from the pre-Better-Auth PBKDF2 password records
 * (packages/shared/src/password.ts's makePasswordRecord) to Better Auth's own
 * scrypt format. `accounts.password` holds either:
 *  - Better Auth's native `salt:hash` scrypt string (hashPassword's output —
 *    never valid JSON), or
 *  - a JSON-serialized legacy PasswordRecord, for any account not yet
 *    re-hashed since the one-time migrate-users-to-better-auth backfill.
 * Distinguishing the two only needs a JSON.parse attempt: scrypt's
 * `salt:hash` format can never parse as JSON.
 */
export function tryParseLegacyRecord(stored: string): PasswordRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    (parsed as { alg?: unknown }).alg === 'PBKDF2-SHA256'
  ) {
    return parsed as PasswordRecord;
  }
  return null;
}

export async function hash(password: string): Promise<string> {
  return scryptHash(password);
}

/**
 * Pure check, no side effects. The lazy re-hash-to-scrypt-on-success upgrade
 * lives in index.ts's databaseHooks.session.create.after instead of here —
 * this callback only ever receives the stored hash string and the plaintext
 * password, neither of which safely identifies *which* account row to
 * update (multiple accounts can legitimately share byte-identical legacy
 * records, e.g. seed-users.ts's demo accounts, which all share one password
 * and therefore one PasswordRecord — matching an update by password content
 * would touch every row sharing that value, not just the one that just
 * signed in). The session-creation hook has the actual userId to target
 * precisely instead.
 */
export async function verify({ hash: stored, password }: { hash: string; password: string }): Promise<boolean> {
  const legacyRecord = tryParseLegacyRecord(stored);
  if (legacyRecord) {
    return verifyLegacyPassword(password, legacyRecord);
  }
  return scryptVerify({ hash: stored, password });
}
