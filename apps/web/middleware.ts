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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)']
};
