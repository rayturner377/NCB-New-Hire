'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SessionIdleManager } from '../../features/auth/components/session-idle-manager';
import { ScrollProgressBar } from '../ui/scroll-progress-bar';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const STORAGE_KEY = 'ncb.sidebar.collapsed';

export interface AppShellProps {
  user: { displayName: string; email: string; role: string };
  logoutAction: () => Promise<void>;
  sessionTtlMs: number;
  /** The two logos configured under Settings → General — which one the topbar shows follows the sidebar's own expanded/collapsed state below, not a fixed choice. */
  smallLogoSrc?: string;
  largeLogoSrc?: string;
  children: ReactNode;
}

/**
 * Owns the sidebar's collapsed/expanded state (persisted to localStorage) at
 * this level — a client component, unlike the old plain Sidebar-owns-it-
 * alone version — specifically so the Topbar's logo can follow it too: the
 * large/branding logo while expanded, the small/icon one once collapsed.
 * Sidebar itself is now a controlled component (collapsed/onCollapsedChange
 * props) rather than tracking this itself.
 */
export function AppShell({ user, logoutAction, sessionTtlMs, smallLogoSrc, largeLogoSrc, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      // Private browsing / storage blocked: default to expanded.
    }
  }, []);

  function setCollapsedPersisted(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Ignore storage failures — the toggle still works for this render.
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <SessionIdleManager sessionTtlMs={sessionTtlMs} />
      <Topbar user={user} logoutAction={logoutAction} logoSrc={collapsed ? smallLogoSrc : largeLogoSrc} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar role={user.role} collapsed={collapsed} onCollapsedChange={setCollapsedPersisted} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {/* Rendered inside <main> (not as a sibling) so its own scroll-parent lookup finds this element — the actual scrolling container — rather than nothing. One instance here covers every page under the shell instead of each page wiring its own (see patient-case-form.tsx, which used to). */}
          <ScrollProgressBar position="bottom" />
          {children}
        </main>
      </div>
    </div>
  );
}
