/**
 * Lightweight entry point — importable without triggering index.ts's
 * betterAuth() construction (which requires BETTER_AUTH_SECRET and connects
 * to Redis/Postgres at module-evaluation time). Everything re-exported here
 * lives in its own file with no dependency on index.ts or the constructed
 * `auth` instance, so importing just this subpath stays cheap: safe for
 * plain unit tests of things like users-service.ts, which need
 * setUserPassword/revokeAllSessionsForUser but have no reason to spin up a
 * full Better Auth instance just to run.
 */
export { hash as hashPassword } from './password.js';
export { setUserPassword } from './set-password.js';
export { revokeAllSessionsForUser } from './revoke-sessions.js';
