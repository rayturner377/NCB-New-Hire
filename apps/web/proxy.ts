import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@ncb/auth';

const PUBLIC_PATHS = ['/login', '/forgot-password'];

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
