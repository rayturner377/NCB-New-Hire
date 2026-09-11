import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@ncb/auth';

/**
 * Better Auth's HTTP surface. Not currently on the critical path — every
 * auth action in this app (login/logout/change-password/etc.) calls
 * `auth.api.*` directly from a Server Action, in-process, rather than
 * through this route — but it's still the standard place Better Auth
 * expects to be reachable (its own internal redirects/callbacks, and any
 * future client-side `authClient` usage, assume it exists here).
 * proxy.ts explicitly excludes this path from its session gate — hitting
 * e.g. /api/auth/sign-in/email while unauthenticated must not itself
 * require being authenticated.
 */
export const { GET, POST } = toNextJsHandler(auth);
