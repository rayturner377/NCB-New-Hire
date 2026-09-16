import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaClient } from './generated/client/index.js';

/**
 * @ncb/database has no .env of its own — the monorepo's single .env lives at
 * the repo root. Consumers (apps/web) can't be trusted to reliably get that
 * loaded into whatever process actually runs this code: Next.js's dev-mode
 * App Router renders Server Components/Actions in forked worker processes
 * that don't consistently inherit env mutations made in the parent process
 * (e.g. next.config.mjs's loadEnvConfig), even though a plain top-level dev
 * server process does. Loading it here instead guarantees it's set wherever
 * this module actually executes. dotenv's config() never overrides a
 * variable that's already set, so a real deployment's env (or DATABASE_URL
 * already present another way) always wins over this file.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(here, '..', '..', '..', '.env') });

/**
 * Singleton Prisma client. Reused across repositories rather than instantiated
 * per-call, so the connection pool isn't recreated on every request.
 *
 * In dev, Next.js's Fast Refresh re-evaluates this module on every relevant
 * file change without the Node process ever exiting — a plain
 * `new PrismaClient()` here would spin up a brand new connection pool on
 * every reload, and old orphaned ones never get released until the process
 * actually dies. Stashing the instance on `globalThis` (Prisma's documented
 * pattern for this exact problem) makes reloads reuse the same client. In
 * production this module only ever loads once per process anyway, so the
 * global isn't needed there.
 */
const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

export const prisma = globalForPrisma.prismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaClient = prisma;
}

/**
 * A second connection, authenticated as the least-privileged `ncb_audit_writer` Postgres role
 * (created by docker/postgres-init's init script, granted INSERT+SELECT on audit_events only — see
 * that migration's own comment) instead of `ncb_medical_app` — used exclusively by
 * repositories/audit.ts. This exists because Postgres table OWNERS bypass REVOKE-based restriction
 * entirely, and `ncb_medical_app` (the role every other query in this app runs as) owns
 * audit_events; a plain REVOKE on that role would be a no-op. A genuinely different role is the only
 * way a compromised main app credential is actually physically incapable of deleting or altering
 * existing audit history, rather than merely being told not to.
 *
 * Falls back to the main `prisma` client (with a console warning, not a thrown error) when
 * AUDIT_DATABASE_URL isn't set — local dev/CI environments that never ran docker/postgres-init's
 * role-creation script (Testcontainers-based CI, in particular) still work, just without this
 * specific hardening; a real deployment should always set it.
 */
const globalForAuditPrisma = globalThis as unknown as { auditPrismaClient?: PrismaClient };

function createAuditPrismaClient(): PrismaClient {
  const auditDatabaseUrl = process.env.AUDIT_DATABASE_URL;
  if (!auditDatabaseUrl) {
    console.warn(
      'AUDIT_DATABASE_URL is not set — audit_events reads/writes are using the main DATABASE_URL role instead of the least-privileged ncb_audit_writer role. Set AUDIT_DATABASE_URL in any real deployment.'
    );
    return prisma;
  }
  return new PrismaClient({ datasources: { db: { url: auditDatabaseUrl } } });
}

export const auditPrisma = globalForAuditPrisma.auditPrismaClient ?? createAuditPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForAuditPrisma.auditPrismaClient = auditPrisma;
}

export type { PrismaClient } from './generated/client/index.js';
