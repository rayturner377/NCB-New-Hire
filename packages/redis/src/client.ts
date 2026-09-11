import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { Redis } from 'ioredis';

/**
 * Same reasoning as packages/database/src/client.ts: apps/web's Server
 * Components/Actions can run in worker processes that don't reliably inherit
 * the parent process's env, so load the monorepo's single root .env here too
 * rather than trusting the caller already did it.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(here, '..', '..', '..', '.env') });

const globalForRedis = globalThis as unknown as { redisClient?: Redis };

/**
 * Singleton, same globalThis-stashing reasoning as Prisma's client — Next's
 * dev-mode Fast Refresh re-evaluates this module on every relevant file
 * change without the process exiting, so a plain `new Redis()` here would
 * leak a new connection on every reload.
 *
 * maxRetriesPerRequest is bounded (not ioredis's default of unlimited
 * retry-forever) so a command actually rejects instead of hanging silently
 * when Redis is unreachable — callers can then fail loudly, matching this
 * app's existing "refuse to start rather than silently degrade" posture for
 * its other required infra (see DATABASE.md's connection-validation stance).
 * The offline queue stays on (ioredis's default): a command issued in the
 * brief window before the initial connection handshake finishes still needs
 * to queue and wait, not reject outright — maxRetriesPerRequest is what
 * makes a *genuinely* unreachable Redis fail loudly, not disabling queuing.
 */
function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set.');
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3
  });
  // ioredis logs "Unhandled error event" to the console by default when
  // nothing is listening — this replaces that with a single clear line per
  // error rather than a raw stack trace on every reconnect attempt.
  client.on('error', (error) => {
    console.error('Redis connection error:', error.message);
  });
  return client;
}

export const redis = globalForRedis.redisClient ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redis;
}

/** Verifies Redis is actually reachable — call once at app startup so an unreachable Redis fails fast rather than surfacing as a mysterious failure on the first real session/cache read. */
export async function pingRedis(): Promise<void> {
  const result = await redis.ping();
  if (result !== 'PONG') {
    throw new Error(`Unexpected Redis PING response: ${result}`);
  }
}

export { Redis };
