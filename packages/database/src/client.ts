import { PrismaClient } from './generated/client/index.js';

/**
 * Singleton Prisma client. Reused across repositories rather than instantiated
 * per-call, so the connection pool isn't recreated on every request.
 */
export const prisma = new PrismaClient();

export type { PrismaClient } from './generated/client/index.js';
