import { hashPassword as scryptHash, verifyPassword as scryptVerify } from 'better-auth/crypto';
import { verifyPassword as verifyLegacyPassword, type PasswordRecord } from '@ncb/shared';
import { prisma } from '@ncb/database';

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
function tryParseLegacyRecord(stored: string): PasswordRecord | null {
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
 * On a successful legacy-format verify, re-hashes with scrypt and persists it
 * — lazy migration on next successful login, so no account needs a forced
 * password reset. Runs after responding to the caller's `verify()` (the
 * account row's own id isn't available inside `verify()` itself, only the
 * stored hash string, so this looks the row back up by its password value;
 * see the account row's uniqueness assumption below).
 */
async function upgradeLegacyAccount(storedRecord: string, password: string): Promise<void> {
  const newHash = await scryptHash(password);
  // password isn't unique across rows in principle, but in practice every
  // legacy record's salt makes its serialized JSON effectively unique to one
  // account — this only ever touches the row(s) that verified successfully
  // against this exact value a moment ago.
  await prisma.account.updateMany({
    where: { password: storedRecord, providerId: 'credential' },
    data: { password: newHash }
  });
}

export async function verify({ hash: stored, password }: { hash: string; password: string }): Promise<boolean> {
  const legacyRecord = tryParseLegacyRecord(stored);
  if (legacyRecord) {
    const ok = verifyLegacyPassword(password, legacyRecord);
    if (ok) {
      // Fire-and-forget: the login itself must not fail or slow down because
      // of this housekeeping write.
      void upgradeLegacyAccount(stored, password).catch((error) => {
        console.error('Failed to upgrade legacy password hash:', error);
      });
    }
    return ok;
  }
  return scryptVerify({ hash: stored, password });
}
