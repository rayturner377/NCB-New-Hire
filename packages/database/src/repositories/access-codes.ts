import { randomUUID } from 'node:crypto';
import type { AccessCode, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export type AccessCodePurpose = 'account_activation' | 'password_reset';
export const MAX_ACCESS_CODE_ATTEMPTS = 5;

export interface ClaimCodeAndSetPasswordInput {
  codeId: string;
  userId: string;
  purpose: AccessCodePurpose;
  /** Already hashed — the CPU-bound scrypt work has no need to happen inside this transaction, and doing it before means the transaction (and whatever row locks it holds) stays as short as possible. */
  passwordHash: string;
}

export interface CreateAccessCodeInput {
  id: string;
  userId: string;
  codeHash: string;
  purpose: AccessCodePurpose;
  expiresAt: Date;
}

/**
 * One-time codes for account activation and password reset — see the model's own doc comment in
 * schema.prisma for why this replaced emailing a real password directly. Only ever stores a hash
 * of the code, never the code itself.
 */
export function createAccessCodesRepository(db: PrismaClient) {
  return {
    create(input: CreateAccessCodeInput): Promise<AccessCode> {
      return db.accessCode.create({ data: input });
    },

    /** The most recent still-live (unused, unexpired) code for this user — optionally scoped to one purpose — a fresh request supersedes any earlier one implicitly, since only the latest is ever looked up. Purpose is left unscoped by the redemption flow (apps/web's access-codes-service.ts) so one "enter your code" page works for both activation and reset without the caller needing to know which kind it issued. */
    findLatestActive(userId: string, purpose?: AccessCodePurpose): Promise<AccessCode | null> {
      return db.accessCode.findFirst({
        where: { userId, ...(purpose ? { purpose } : {}), usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' }
      });
    },

    incrementAttempts(id: string): Promise<AccessCode> {
      return db.accessCode.update({ where: { id }, data: { attemptCount: { increment: 1 } } });
    },

    /**
     * Invalidates every currently-live (unused, unexpired) code for this user/purpose — called
     * right before issuing a new one (see access-codes-service.ts's issueAccessCode). Without this,
     * an older code stays fully redeemable in parallel with a newer one, and — since
     * findLatestActive only ever excludes a USED/expired code, not a merely-superseded one — becomes
     * "the latest active code" again the moment the newer one is consumed, silently un-superseding
     * itself. `updateMany` rather than looking one up first: there's no reason to serialize on a
     * read when the intent ("kill every live code for this purpose") doesn't depend on how many
     * there currently are.
     */
    invalidateAllActive(userId: string, purpose: AccessCodePurpose): Promise<{ count: number }> {
      return db.accessCode.updateMany({
        where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() }
      });
    },

    markUsed(id: string): Promise<AccessCode> {
      return db.accessCode.update({ where: { id }, data: { usedAt: new Date() } });
    },

    /** Locks a code out immediately (e.g. after too many wrong attempts) without waiting for its natural expiry — a used-but-not-successfully-redeemed marker. */
    invalidate(id: string): Promise<AccessCode> {
      return db.accessCode.update({ where: { id }, data: { usedAt: new Date() } });
    },

    /**
     * The real redemption — claiming the code and applying the password change it authorizes, in
     * one transaction. Two things this closes that separate calls couldn't:
     *
     * 1. Two concurrent redemptions of the same code can no longer both succeed. The claim itself is
     *    a conditional `updateMany` (`WHERE id = ? AND usedAt IS NULL AND expiresAt > now()`), and
     *    Postgres's own row locking inside the transaction serializes concurrent attempts against it
     *    — only one can ever see `count === 1`; every other racing caller sees `count === 0` and this
     *    returns `false` without touching the account at all. Checking the code's validity via a
     *    prior read (access-codes-service.ts's own checkAccessCode) is still what decides whether to
     *    call this at all, but the CLAIM itself — the only step that actually matters for
     *    correctness — never trusts that earlier read alone.
     * 2. The password/account write and the mustChangePassword clear commit together with the claim
     *    or not at all — no more "code marked used but password never actually changed" if the
     *    process dies mid-sequence. Session revocation (features/auth/actions/redeem-access-code.ts)
     *    still happens as a separate step after this commits, since it's a different store (Redis,
     *    not Postgres) a single Prisma transaction can't span.
     */
    async claimCodeAndSetPassword(input: ClaimCodeAndSetPasswordInput): Promise<boolean> {
      const rejected = new Error('Access code is no longer redeemable');
      try {
        return await db.$transaction(async (tx) => {
          // Lock the account first: concurrent activation/reset claims must not both
          // authorize first activation. Throwing rolls this update back on a lost claim.
          const eligible = await tx.appUser.updateMany({
            where: {
              id: input.userId, active: true, deletedAt: null,
              ...(input.purpose === 'account_activation' ? { emailVerified: false } : {})
            },
            data: { mustChangePassword: false, emailVerified: true }
          });
          if (eligible.count !== 1) throw rejected;
          const claim = await tx.accessCode.updateMany({
            where: { id: input.codeId, userId: input.userId, purpose: input.purpose, usedAt: null, expiresAt: { gt: new Date() }, attemptCount: { lt: MAX_ACCESS_CODE_ATTEMPTS } },
            data: { usedAt: new Date() }
          });
          if (claim.count !== 1) throw rejected;

          const existingAccount = await tx.account.findFirst({ where: { userId: input.userId, providerId: 'credential' } });
          if (existingAccount) {
            await tx.account.update({ where: { id: existingAccount.id }, data: { password: input.passwordHash } });
          } else {
            await tx.account.create({
              data: { id: randomUUID(), accountId: input.userId, providerId: 'credential', userId: input.userId, password: input.passwordHash }
            });
          }
          return true;
        });
      } catch (error) {
        if (error === rejected) return false;
        throw error;
      }
    }
  };
}

export const accessCodesRepository = createAccessCodesRepository(prisma);
