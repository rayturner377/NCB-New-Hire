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
 */
export const prisma = new PrismaClient();

export type { PrismaClient } from './generated/client/index.js';
