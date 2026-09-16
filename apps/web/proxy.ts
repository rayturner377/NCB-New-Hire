import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@ncb/auth';

// /verify-device is reached with NO session at all — signInEmail's own `after` hook deletes the
// session it briefly created whenever a device isn't yet trusted (see verify-device/page.tsx's own
// doc comment and login.ts's twoFactorRedirect branch), so gating it behind getSession() below would
// bounce every single unrecognized-device sign-in straight back to /login before the code entry form
// (or its Server Actions) ever runs — confirmed the hard way via real end-to-end testing, not
// assumed. The page itself never trusts anything from the request other than the signed two-factor
// cookie Better Auth's own APIs validate, same trust boundary as /login.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/verify-device'];

/**
 * Full session check, not just cookie-presence — renamed from `middleware`
 * to `proxy` for Next.js 16 (the `middleware` convention is deprecated),
 * which also dropped Edge runtime support for this file in favor of Node
 * only. That's exactly what makes the real check affordable here now: this
 * used to only check that a `sid` cookie existed (Edge couldn't reach
 * Postgres), leaving the actual session/expiry/user lookup entirely to
 * lib/session.ts's getSession() in each Server Component/Action. Better
 * Auth's own session lookup (Redis-backed, no Postgres round-trip) is cheap
 * enough to run here too, so an expired or revoked session now gets caught
 * at this gate instead of one layer in.
 *
 * getSession() (lib/session.ts) is still the real authorization boundary —
 * it additionally re-checks `active` and resolves permissions, neither of
 * which this proxy needs to know about just to decide "redirect to /login
 * or not."
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    /**
     * A Server Action invocation (identified by Next's own `next-action` header — the same signal
     * `nextCookies()` itself checks, see node_modules/better-auth/dist/integrations/next-js.mjs) is a
     * POST back to whatever page the user is already on, not a normal navigation — Next's client
     * runtime expects that response to be a real RSC/action payload (`content-type: text/x-component`)
     * or a redirect Next itself specifically flagged as one (`x-action-redirect`), and treats anything
     * else, a plain redirect included, as a broken response: `node_modules/next/dist/client/components/
     * router-reducer/reducers/server-action-reducer.js` throws "An unexpected response was received
     * from the server." for exactly this case. Confirmed the hard way: a session revoked out from
     * under an open tab (this app's own single-active-session enforcement routinely does this now —
     * see login.ts's/verify-device-code.ts's revokeOtherSessions calls) crashed the tab with that
     * error the next time any Server Action fired, instead of a clean redirect.
     * Every real Server Action in this app already re-checks its own session via getSession()/
     * requireFullSession() and returns a normal `{ ok: false, error }` result rather than assuming
     * middleware already gated it (see lib/session.ts's own doc comments) — so letting the request
     * through here doesn't open anything up; it just lets the action itself handle "no session"
     * gracefully instead of the middleware breaking the response shape the client expects.
     */
    if (request.headers.get('next-action')) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated pages show data another user's session can change at any
  // moment (case status, a doctor's inbox) — an intermediate cache (a
  // corporate proxy, or the browser itself) serving a stale copy on a plain
  // refresh would look like the app failing to update in real time. This
  // header is the actual instruction that stops that; app/(app)/layout.tsx's
  // `force-dynamic` only stops Next's own server-side caching.
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)']
};
