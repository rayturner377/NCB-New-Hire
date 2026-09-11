import { NextResponse } from 'next/server';

/**
 * Trivial, unauthenticated readiness probe — proxy.ts already excludes
 * `/api/public` from its session gate. Deliberately does nothing (no DB/Redis
 * reachability check): its only job is confirming the Next.js server itself
 * has finished starting and is accepting requests, e.g. for Playwright's
 * `webServer.url` in playwright.config.ts, so readiness doesn't depend on
 * Turbopack compiling the full authenticated route tree.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
