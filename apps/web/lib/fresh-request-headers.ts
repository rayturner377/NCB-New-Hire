import { cookies } from 'next/headers';

/**
 * Builds a Headers object carrying every cookie this request currently has — including one an
 * earlier `auth.api.*` call in this SAME server action just set (e.g. signInEmail's pending
 * two-factor cookie, or verifyTwoFactorOTP's new session cookie).
 *
 * next/headers's own `headers()` is a read-only snapshot of the ORIGINAL incoming request and never
 * reflects a cookie set later in the same action — only `cookies()` (the mutable jar Better Auth's
 * `nextCookies()` plugin actually writes into) sees pending writes within the same request. Passing
 * `{ headers: await headers() }` straight to a follow-up `auth.api.*` call is only safe when nothing
 * earlier in the action set a NEW cookie — real end-to-end testing found this the hard way:
 * login.ts's `sendTwoFactorOTP` call was throwing `INVALID_TWO_FACTOR_COOKIE` on every single
 * unrecognized-device sign-in, because it couldn't see the pending cookie signInEmail had just set
 * moments earlier in the same request. Use this instead of `headers()` wherever a same-request
 * follow-up auth.api call needs to see a cookie an earlier call in that same action just set.
 */
export async function freshRequestHeaders(): Promise<Headers> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  return new Headers({ cookie: cookieHeader });
}
