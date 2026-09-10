import type { PrismaClient, Session } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NewSessionInput {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: Date;
}

/**
 * Postgres-backed replacement for the old in-memory `sessions = new Map()`
 * (server.js ~L63) — a restart used to log everyone out, and it couldn't run
 * as more than one process. Rows expire naturally via `deleteExpired()`,
 * intended to be called periodically (e.g. on login, or a cron/cleanup task).
 */
export function createSessionsRepository(db: PrismaClient) {
  return {
    create(input: NewSessionInput): Promise<Session> {
      return db.session.create({
        data: {
          id: input.id,
          userId: input.userId,
          csrfToken: input.csrfToken,
          expiresAt: input.expiresAt
        }
      });
    },

    findById(id: string): Promise<Session | null> {
      return db.session.findFirst({ where: { id, expiresAt: { gt: new Date() } } });
    },

    async touchExpiry(id: string, expiresAt: Date): Promise<Session | null> {
      try {
        return await db.session.update({ where: { id }, data: { expiresAt } });
      } catch {
        return null;
      }
    },

    async delete(id: string): Promise<void> {
      await db.session.deleteMany({ where: { id } });
    },

    /**
     * Every session belonging to a user, not just one — used when a password
     * changes (an old, possibly-compromised session token should stop working
     * immediately, not just the browser that changed it) and for a "sign out
     * of all other devices" self-service action. `exceptId` lets a caller keep
     * the session making the request alive (e.g. the browser that just
     * changed its own password) rather than logging itself out too.
     */
    async deleteAllForUser(userId: string, exceptId?: string): Promise<void> {
      await db.session.deleteMany({ where: { userId, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    },

    async deleteExpired(now: Date = new Date()): Promise<number> {
      const result = await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
      return result.count;
    }
  };
}

export const sessionsRepository = createSessionsRepository(prisma);
