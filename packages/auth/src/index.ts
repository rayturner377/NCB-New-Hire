import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { redisStorage } from '@better-auth/redis-storage';
import { prisma } from '@ncb/database';
import { redis } from '@ncb/redis';
import { hash, verify } from './password.js';

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error('BETTER_AUTH_SECRET is not set.');
}
// The Dockerfile bakes this exact literal in as a build-time placeholder (next build needs some
// syntactically valid value to construct this module against — see the Dockerfile's own comment),
// always overridden by the real value from .env at container runtime. A plain truthiness check
// wouldn't catch a deployment that's missing that override: this string is committed to the repo
// and would otherwise pass silently as a real, working secret.
//
// Skipped during `next build` itself (NEXT_PHASE is set to phase-production-build only then, per
// Next.js's own convention): next build's "Collecting page data" step imports every route module
// to inspect it, constructing this exact betterAuth() instance against the Dockerfile's own
// placeholder as it does — rejecting it here too would fail the build using the very placeholder
// the build stage set for exactly this purpose. The check still runs at every other time,
// including `next start`, which is what actually matters for a real deployment.
if (secret === 'docker-build-placeholder-overridden-at-runtime' && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('BETTER_AUTH_SECRET is still the Docker build placeholder — set a real value in .env at runtime.');
}

/**
 * Without an explicit baseURL, Better Auth derives the origin from each
 * incoming request's own Host header — the exact behavior its own startup
 * warning flags, and a real security concern (a spoofed Host header could
 * otherwise influence callback/redirect URLs), not just a cosmetic warning.
 * BETTER_AUTH_URL must be set explicitly in any real deployment (see
 * .env.example); the localhost fallback only covers local dev, matching the
 * default port docker-compose.yml/next dev both use.
 */
const baseURL = process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`;

/**
 * Sliding inactivity timeout, same admin-configurable env var and 5-480
 * minute clamp as the pre-Better-Auth lib/session.ts's sessionTtlMs(). A
 * session refreshes to a fresh full window once it's within `updateAge`
 * seconds of needing it — 60s here means effectively every real page visit
 * refreshes it (matching today's per-request extension) without rewriting
 * Redis on every single request within the same minute.
 */
function sessionTimeoutSeconds(): number {
  const minutes = Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15', 10);
  const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 480) : 15;
  return safeMinutes * 60;
}

/**
 * Secure by default, same reasoning and same env var as the pre-Better-Auth
 * lib/session.ts's cookieIsSecure() — only plain local HTTP dev opts out
 * explicitly via COOKIE_SECURE=false; an unset var stays secure rather than
 * silently degrading in a real deployment that forgot to set it.
 */
function cookieIsSecure(): boolean {
  return process.env.COOKIE_SECURE !== 'false';
}

/**
 * `user` here intentionally declares no additionalFields. role,
 * active, mustChangePassword, medicalProfile, and permissionOverrides all
 * stay exactly where they already live on AppUser — apps/web's session
 * facade (lib/session.ts) fetches the full row directly via
 * usersRepository.findById() after confirming a valid session here, the
 * same way it already does today, rather than asking Better Auth to know
 * about fields it never needs to read or write itself. This also sidesteps
 * a real field-collision risk: Better Auth's own `admin` plugin declares its
 * own `role`/`banned`/`banReason`/`banExpires` fields, and adopting it would
 * require new schema columns (banned/banReason/banExpires) this app doesn't
 * want — RBAC here stays entirely on apps/web/lib/permissions.ts, untouched
 * by Better Auth.
 */
export const auth = betterAuth({
  secret,
  baseURL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secondaryStorage: redisStorage({ client: redis, keyPrefix: 'ncb-auth:' }),
  session: {
    expiresIn: sessionTimeoutSeconds(),
    updateAge: 60
  },
  advanced: {
    // Better Auth's own default is SameSite=Lax — this app's CSRF posture
    // (see packages/auth's retirement of the old hand-rolled csrfToken)
    // explicitly relies on SameSite=Strict as one of its layers, so this
    // isn't optional. secure mirrors the same COOKIE_SECURE env var and
    // default-safe reasoning the old hand-rolled session cookie used.
    defaultCookieAttributes: {
      sameSite: 'strict',
      secure: cookieIsSecure()
    }
  },
  emailAndPassword: {
    enabled: true,
    // No public self-signup — every account is created by an admin/reviewer
    // through createUser() (features/users/services/users-service.ts). Without
    // this, /api/auth/sign-up/email stayed live even with no signup page ever
    // linking to it, letting an uninvited caller create a real patient account
    // directly against the API.
    disableSignUp: true,
    password: { hash, verify }
  },
  databaseHooks: {
    session: {
      create: {
        /**
         * Better Auth has no concept of this app's own `active` flag —
         * without this, a deactivated account's credentials would still
         * pass emailAndPassword's verify() and get a real session. Mirrors
         * the pre-Better-Auth login.ts's inline `user.active === false`
         * rejection, just centralized here so every path that can create a
         * session (not just the one sign-in action) is covered. Returning
         * `false` aborts session creation — Better Auth then reports the
         * same generic invalid-credentials failure to the caller as a wrong
         * password would, not a distinct "account disabled" message (this
         * app doesn't want to reveal account status to whoever's typing the
         * password, only to the account's own legitimate owner elsewhere).
         */
        before: async (session) => {
          const user = await prisma.appUser.findFirst({ where: { id: session.userId } });
          if (!user || user.active === false) return false;
        }
      }
    }
  },
  user: {
    // Prisma Client exposes models as camelCase properties (prisma.appUser),
    // not the PascalCase name schema.prisma declares (AppUser) — the adapter
    // matches this against the client's actual property names.
    modelName: 'appUser',
    fields: { name: 'displayName' },
    additionalFields: {
      // role has no DB-level default (deliberately — every real write in
      // this app sets it explicitly), but Better Auth's own schema
      // validation requires every NOT NULL column it doesn't know about to
      // have one, since its own insert path (signUpEmail) never sets it.
      // This app has no public self-signup page, so that path is never
      // actually exercised for a real account — the default only satisfies
      // Better Auth's validation. input:false blocks a caller from choosing
      // their own role through it regardless.
      role: { type: 'string', defaultValue: 'patient', input: false }
    }
  },
  plugins: [nextCookies()]
});

// hashPassword/setUserPassword/revokeAllSessionsForUser live at the
// '@ncb/auth/utils' subpath instead of here — see utils.ts's docstring on
// why importing them shouldn't force this file's betterAuth() construction
// (and its BETTER_AUTH_SECRET requirement) to run too.

