import { headers } from 'next/headers';

export class OriginMismatchError extends Error {
  constructor(message = 'Request origin does not match the app.') {
    super(message);
  }
}

/**
 * Server Actions get most of their CSRF protection from Next.js's own
 * action-id encryption (they aren't callable as a plain cross-site POST the
 * way the old hand-rolled JSON API's x-csrf-token check, server.js
 * ~L3480-3482, had to defend against). This is a cheap extra check for
 * defense-in-depth: confirm the request's Origin header actually matches the
 * app's own host before letting a mutation proceed.
 */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get('origin');
  const host = headerList.get('host');

  if (!origin || !host) return; // same-origin browser navigations may omit Origin

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new OriginMismatchError();
  }

  if (originHost !== host) {
    throw new OriginMismatchError();
  }
}
