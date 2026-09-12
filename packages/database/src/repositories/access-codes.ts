import type { AccessCode, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export type AccessCodePurpose = 'account_activation' | 'password_reset';

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

    markUsed(id: string): Promise<AccessCode> {
      return db.accessCode.update({ where: { id }, data: { usedAt: new Date() } });
    },

    /** Locks a code out immediately (e.g. after too many wrong attempts) without waiting for its natural expiry — a used-but-not-successfully-redeemed marker. */
    invalidate(id: string): Promise<AccessCode> {
      return db.accessCode.update({ where: { id }, data: { usedAt: new Date() } });
    }
  };
}

export const accessCodesRepository = createAccessCodesRepository(prisma);
