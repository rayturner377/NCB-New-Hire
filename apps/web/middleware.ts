import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'sid';
const PUBLIC_PATHS = ['/login', '/forgot-password'];

/**
 * Lightweight, cookie-presence-only gate. Middleware runs on the Edge
 * runtime, which can't reach Postgres/Prisma (@ncb/database is Node-only) —
 * so this only checks that a sid cookie exists and redirects to /login if
 * not, matching server.js's coarse route-protection (~L3455). The actual
 * session/expiry/user lookup (lib/session.ts's getSession()) still runs in
 * each Server Component/Action on the Node runtime and is the real
 * authorization boundary; this middleware is a fast-path redirect only.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || pathname.startsWith('/api/public')) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
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
