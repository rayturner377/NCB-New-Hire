import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { logout } from '../../features/auth/actions/logout';
import { getPublicSettings } from '../../features/settings/services/settings-service';
import { getSession, sessionTtlMs } from '../../lib/session';

// Every page under here reads live per-request data (a doctor's inbox, case
// status, billing) that another user's session can change at any moment —
// this app has no websocket/polling push, so a plain page reload is the only
// way a change becomes visible, and it must always hit the server rather
// than a cached response. cookies() in getSession() already makes Next treat
// these routes as dynamic, but that's an inference, not a promise — this
// makes it explicit so a refactor elsewhere can't silently reintroduce
// caching and reproduce "stale until a hard refresh" bugs.
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (session.user.mustChangePassword) {
    redirect('/change-password');
  }

  const { general } = await getPublicSettings();

  return (
    <AppShell
      user={{ displayName: session.user.displayName, email: session.user.email, role: session.user.role }}
      logoutAction={logout}
      sessionTtlMs={sessionTtlMs()}
      smallLogoSrc={general.smallLogoDataUrl || undefined}
      largeLogoSrc={general.largeLogoDataUrl || undefined}
    >
      {children}
    </AppShell>
  );
}
